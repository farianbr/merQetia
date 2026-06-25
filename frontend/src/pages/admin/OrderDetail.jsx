import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder, assignEmployee, adminSetDeliveryDate, adminResetStatus, forceCompleteOrder } from '../../api/orders';
import { getEmployees } from '../../api/admin';
import { useSocket } from '../../context/SocketContext';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';
import ConversationEvent from '../../components/ConversationEvent';
import MeetingMessage from '../../components/MeetingMessage';
import FullscreenButton from '../../components/FullscreenButton';
import { useNow, activeMeeting, meetingHeaderLabel } from '../../utils/meeting';
import {
  LuCalendarDays, LuUserCog, LuSettings2,
  LuCheck, LuX, LuFileText, LuDownload, LuShieldCheck,
  LuLayoutList, LuClipboardList, LuPaperclip, LuMessageSquare, LuRefreshCw, LuVideo,
} from 'react-icons/lu';

/* ─── helpers ─────────────────────────────────────── */
const STATUS_CONFIG = {
  placed:    { label: 'Placed',      color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  assigned:  { label: 'Assigned',    color: '#1e40af', bg: '#dbeafe', dot: '#3b82f6' },
  accepted:  { label: 'In Progress', color: '#155e75', bg: '#d8eef7', dot: '#33a8d1' },
  review:    { label: 'In Review',   color: '#5b21b6', bg: '#ede9fe', dot: '#8b5cf6' },
  overdue:   { label: 'Overdue',     color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  rejected:  { label: 'Rejected',    color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  completed: { label: 'Completed',   color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
};

function getDisplayStatus(order) {
  if (order.status === 'accepted' && order.deliveryDate && new Date(order.deliveryDate) < new Date()) {
    return 'overdue';
  }
  return order.status;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Lifecycle Tracker sidebar ───────────────────── */
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const STATUS_NODE_LABEL = {
  review:    'Client Review',
  completed: 'Completed',
  rejected:  'Rejected',
};

/**
 * Build the tracker timeline from the order's full status history merged with
 * its change requests, in chronological order. Every revision round adds new
 * nodes (Changes Requested → In Progress → Client Review …) rather than
 * overwriting earlier ones, so the whole journey stays visible.
 *
 * The two opening milestones — Order Placed and Order Assigned — are always
 * seeded first. They can't be derived reliably from statusHistory alone
 * (orders predating status tracking, or whose history was only stamped from a
 * later stage onward, would otherwise drop them), so we anchor them to known
 * order fields.
 */
function buildTimeline(order) {
  // First time each status was reached → its date.
  const reachedAt = {};
  (order.statusHistory || []).forEach((h) => {
    if (h?.status && !reachedAt[h.status]) reachedAt[h.status] = h.at;
  });

  // Dynamic events: everything from "accepted" onward, plus change requests.
  // (placed/assigned are handled separately as fixed opening milestones.)
  const events = [];
  if ((order.statusHistory || []).length) {
    order.statusHistory.forEach((h) => {
      if (h?.status && h.status !== 'placed' && h.status !== 'assigned') {
        events.push({ kind: 'status', status: h.status, at: h.at });
      }
    });
  } else {
    // Legacy orders saved before status history was tracked: synthesize a
    // best-effort sequence from the first time each status was seen.
    ['accepted', 'review', 'completed', 'rejected'].forEach((s) => {
      if (reachedAt[s]) events.push({ kind: 'status', status: s, at: reachedAt[s] });
    });
  }
  (order.messages || [])
    .filter((m) => m.kind === 'change-request')
    .forEach((m) => events.push({ kind: 'change', at: m.createdAt, note: m.text }));

  // Chronological; when timestamps tie (a change request and the bounce-back to
  // In Progress are saved together), the change request comes first.
  events.sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    if (ta !== tb) return ta - tb;
    return (a.kind === 'change' ? 0 : 1) - (b.kind === 'change' ? 0 : 1);
  });

  // Always open with Order Placed, then Order Assigned (when the order has ever
  // been assigned), before the dynamic events.
  const nodes = [];
  nodes.push({ type: 'placed', label: 'Order Placed', at: reachedAt.placed || order.createdAt });
  const wasAssigned =
    order.assignedEmployee ||
    reachedAt.assigned ||
    ['assigned', 'accepted', 'review', 'completed'].includes(order.status);
  if (wasAssigned) {
    nodes.push({ type: 'assigned', label: 'Order Assigned', at: reachedAt.assigned });
  }

  let changes = 0;
  events.forEach((e) => {
    if (e.kind === 'change') {
      changes += 1;
      nodes.push({ type: 'change', label: 'Changes Requested', at: e.at, note: e.note });
    } else if (e.status === 'accepted') {
      nodes.push({
        type: 'progress',
        label: changes === 0 ? 'In Progress' : `In Progress · Round ${changes + 1}`,
        at: e.at,
        revising: changes > 0,
      });
    } else if (STATUS_NODE_LABEL[e.status]) {
      nodes.push({ type: e.status, label: STATUS_NODE_LABEL[e.status], at: e.at, note: e.status === 'rejected' ? order.rejectionReason : undefined });
    }
  });

  return nodes;
}

function LifecycleTracker({ order, maxHeight }) {
  const terminal = order.status === 'completed' || order.status === 'rejected';
  const nodes = buildTimeline(order);
  // Active marker sits on the most recent real node unless the order is in a
  // terminal state (everything is then settled).
  const activeIdx = terminal ? -1 : nodes.length - 1;
  // Show the final goal as an upcoming step while the order is still in flight.
  if (!terminal && !nodes.some((n) => n.type === 'completed')) {
    nodes.push({ type: 'completed', label: 'Completed', upcoming: true });
  }

  return (
    <div className="odv-tracker" style={maxHeight ? { maxHeight } : undefined}>
      <h3 className="odv-tracker-title">Lifecycle Tracker</h3>
      <div className="odv-tracker-steps">
        {nodes.map((node, i) => {
          const isLast = i === nodes.length - 1;
          const active = i === activeIdx;
          const isChange = node.type === 'change';
          const isRejected = node.type === 'rejected';
          const done = !node.upcoming && !active && !isRejected;
          const dotCls = isRejected
            ? 'odv-tl-dot--rejected'
            : isChange
              ? 'odv-tl-dot--revised'
              : active
                ? 'odv-tl-dot--active'
                : done
                  ? 'odv-tl-dot--done'
                  : '';
          return (
            <div key={`${node.type}-${i}`} className="odv-tl-item">
              <div className="odv-tl-left">
                <div className={`odv-tl-dot ${dotCls}`}>
                  {isRejected
                    ? <LuX size={10} strokeWidth={3} color="#fff" />
                    : isChange
                      ? <LuRefreshCw size={10} strokeWidth={3} color="#fff" />
                      : done
                        ? <LuCheck size={10} strokeWidth={3} color="#fff" />
                        : active ? <span className="odv-tl-inner" /> : null}
                </div>
                {!isLast && (
                  <div className={`odv-tl-line ${done || isChange ? 'odv-tl-line--done' : ''}`} />
                )}
              </div>
              <div className="odv-tl-content">
                <span
                  className={`odv-tl-label ${active ? 'odv-tl-label--active' : done && !isChange ? 'odv-tl-label--done' : ''}`}
                  style={isRejected ? { color: '#ef4444' } : undefined}
                >
                  {node.label}
                </span>
                {active && (
                  <span className={`odv-tl-active-tag ${node.revising ? 'odv-tl-active-tag--revising' : ''}`}>
                    {node.revising ? 'Revising' : 'Currently Active'}
                  </span>
                )}
                {node.note && <span className="odv-tl-revision">{node.note}</span>}
                {node.at && <span className="odv-tl-sub">{fmtDateTime(node.at)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Inline modal ────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{title}</h2>
          <button className="btn-secondary btn-sm" onClick={onClose} style={{ padding: '2px 8px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────── */
export default function AdminOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);

  /* modal states */
  const [modal, setModal] = useState(null); // 'assign' | 'status' | 'delivery'
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [newDeliveryDate, setNewDeliveryDate] = useState('');
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  const chatBottomRef = useRef(null);
  const mainColRef = useRef(null);
  const [trackerMax, setTrackerMax] = useState(null);
  const socket = useSocket();
  const now = useNow();

  // Communication log: messages + meeting events, in chronological order.
  const convoThread = useMemo(() => {
    if (!order) return [];
    const items = [
      ...(order.messages || []).map((m) => ({ ...m, kind: m.kind || 'message', _sort: m.createdAt })),
      ...(order.meetings || []).map((mt) => ({
        _id: `meeting-${mt._id}`, kind: 'meeting', meeting: mt,
        _sort: mt.bookedAt || mt.scheduledAt || mt.createdAt,
      })),
    ];
    return items.sort((a, b) => new Date(a._sort) - new Date(b._sort));
  }, [order]);

  const liveMeeting = activeMeeting(order?.meetings, now);
  const [fsConvo, setFsConvo] = useState(false);

  // Cap the lifecycle tracker to the left column's height so it never grows
  // past the questionnaires — the step list scrolls internally instead. On
  // narrow screens the columns stack, so the cap is removed.
  useEffect(() => {
    const el = mainColRef.current;
    if (!el) return undefined;
    const measure = () => {
      setTrackerMax(window.innerWidth <= 900 ? null : el.offsetHeight);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [order]);

  const fetchOrder = useCallback(async () => {
    try {
      const r = await getOrder(id);
      setOrder(r.data.order);
    } catch (err) {
      setError(err.response?.data?.message || 'Order not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);
  useEffect(() => { getEmployees().then((r) => setEmployees(r.data.employees || [])); }, []);

  // Live updates for this order (status, assignment, new messages)
  useEffect(() => {
    if (!socket) return;
    const onUpdate = ({ order: updated }) => {
      if (updated?._id === id) setOrder(updated);
    };
    socket.on('order:updated', onUpdate);
    return () => socket.off('order:updated', onUpdate);
  }, [socket, id]);

  const handleAssign = async () => {
    if (!selectedEmployee) return;
    setAssignLoading(true);
    setAssignError('');
    try {
      await assignEmployee(id, selectedEmployee);
      setModal(null);
      setSelectedEmployee('');
      fetchOrder();
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Assignment failed');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleSetDeliveryDate = async () => {
    if (!newDeliveryDate) return;
    setDeliveryLoading(true);
    setDeliveryError('');
    try {
      await adminSetDeliveryDate(id, newDeliveryDate);
      setModal(null);
      setNewDeliveryDate('');
      fetchOrder();
    } catch (err) {
      setDeliveryError(err.response?.data?.message || 'Failed to update delivery date');
    } finally {
      setDeliveryLoading(false);
    }
  };

  const handleResetStatus = async () => {
    setStatusLoading(true);
    setStatusError('');
    try {
      await adminResetStatus(id);
      setModal(null);
      fetchOrder();
    } catch (err) {
      setStatusError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleForceComplete = async () => {
    setStatusLoading(true);
    setStatusError('');
    try {
      await forceCompleteOrder(id);
      setModal(null);
      fetchOrder();
    } catch (err) {
      setStatusError(err.response?.data?.message || 'Failed to complete order');
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading order…</div>;
  if (error) return (
    <div className="page">
      <p className="error-msg">{error}</p>
      <button className="btn-secondary" onClick={() => navigate('/admin/orders')}>← Back to Orders</button>
    </div>
  );

  const ds = getDisplayStatus(order);
  const cfg = STATUS_CONFIG[ds] || STATUS_CONFIG.placed;
  const serviceName = (order.services || []).map((s) => s.name).join(', ') || 'Order';
  const allAttachments = (order.messages || []).flatMap((m) =>
    (m.attachments || []).map((att) => ({ ...att, sharedBy: m.sender?.name || '—', sharedAt: m.createdAt }))
  );
  const isConvoOpen = ['accepted', 'review', 'completed'].includes(order.status);

  return (
    <div className="page odv-page">

      {/* ── Page title + status ── */}
      <div className="odv-hero">
        <div>
          <div className="odv-hero-top">
            <span className="odv-status-pill" style={{ color: cfg.color, background: cfg.bg }}>
              <span className="odv-status-dot" style={{ background: cfg.dot }} />
              {cfg.label.toUpperCase()}
            </span>
          </div>
          <h1 className="odv-title">Order #{order._id.slice(-8).toUpperCase()}</h1>
          <p className="odv-subtitle">{serviceName} for <strong>{order.clientId?.name || '—'}</strong></p>
        </div>
      </div>

      {/* ── Admin Controls bar ── */}
      <div className="odv-controls">
        <div className="odv-controls-left">
          <LuShieldCheck size={18} color="#d97706" />
          <div className="odv-controls-text">
            <span className="odv-controls-label">Administrative Controls</span>
            <span className="odv-controls-sub">Override settings for this specific order instance.</span>
          </div>
        </div>
        <div className="odv-controls-btns">
          {/* Assign employee — when no employee assigned (placed) */}
          {order.status === 'placed' && (
            <button className="odv-ctrl-btn" onClick={() => { setSelectedEmployee(''); setAssignError(''); setModal('assign'); }}>
              <LuUserCog size={14} color="#33a8d1" /> Assign Employee
            </button>
          )}
          {/* Reassign — before the employee accepts (still assigned) */}
          {order.status === 'assigned' && (
            <button className="odv-ctrl-btn" onClick={() => { setSelectedEmployee(''); setAssignError(''); setModal('assign'); }}>
              <LuUserCog size={14} color="#33a8d1" /> Reassign Employee
            </button>
          )}
          {/* Change delivery date — only when accepted (in progress) */}
          {order.status === 'accepted' && order.deliveryDate && (
            <button className="odv-ctrl-btn" onClick={() => { setNewDeliveryDate(''); setDeliveryError(''); setModal('delivery'); }}>
              <LuCalendarDays size={14} color="#3b82f6" /> Change Delivery Date
            </button>
          )}
          {/* Force complete — override client confirmation while in progress / review */}
          {(order.status === 'accepted' || order.status === 'review') && (
            <button className="odv-ctrl-btn" onClick={() => { setStatusError(''); setModal('force-complete'); }}>
              <LuShieldCheck size={14} color="#10b981" /> Force Complete
            </button>
          )}
          {/* Change status — only for rejected or completed */}
          {(order.status === 'rejected' || order.status === 'completed') && (
            <button className="odv-ctrl-btn" onClick={() => { setStatusError(''); setModal('status'); }}>
              <LuSettings2 size={14} color="#6b7280" /> Change Status
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="odv-body">

        {/* ── LEFT COLUMN ── */}
        <div className="odv-main" ref={mainColRef}>

          {/* Core Information */}
          <section className="odv-card">
            <h2 className="odv-card-title"><LuLayoutList size={16} color="#1f8cb4" />Core Information</h2>
            <div className="odv-info-grid">
              <div className="odv-info-item">
                <span className="odv-info-label">SERVICE TYPE</span>
                <span className="odv-info-value">{serviceName}</span>
              </div>
              <div className="odv-info-item">
                <span className="odv-info-label">CLIENT</span>
                <span className="odv-info-value">{order.clientId?.name || '—'}</span>
              </div>
              <div className="odv-info-item">
                <span className="odv-info-label">BUDGET</span>
                <span className="odv-info-value odv-info-price">€{order.totalPrice?.toFixed(2)}</span>
              </div>
              <div className="odv-info-item">
                <span className="odv-info-label">START DATE</span>
                <span className="odv-info-value">{fmtDate(order.createdAt)}</span>
              </div>
              {order.deliveryDate && (
                <div className="odv-info-item">
                  <span className="odv-info-label">DELIVERY DATE</span>
                  <span className="odv-info-value">{fmtDate(order.deliveryDate)}</span>
                </div>
              )}
              {order.assignedEmployee && (
                <div className="odv-info-item">
                  <span className="odv-info-label">ASSIGNED TO</span>
                  <span className="odv-info-value">{order.assignedEmployee.name}</span>
                </div>
              )}
            </div>
          </section>

          {/* Project Brief */}
          {(order.summary || order.notes) && (
            <section className="odv-card">
              <h2 className="odv-card-title"><LuFileText size={16} color="#33a8d1" />Project Brief</h2>
              <p className="odv-brief-text">{order.summary || order.notes}</p>
            </section>
          )}

          {/* Questionnaires */}
          {order.answers && Object.keys(order.answers).length > 0 && (
            <section className="odv-card">
              <h2 className="odv-card-title"><LuClipboardList size={16} color="#f59e0b" />Questionnaires</h2>
              {(order.services || []).map((svc) => {
                const svcAnswers = order.answers[svc._id];
                if (!svcAnswers || Object.keys(svcAnswers).length === 0) return null;
                return (
                  <div key={svc._id} className="odv-qa-group">
                    {Object.entries(svcAnswers).map(([q, a]) => (
                      <div className="odv-qa-row" key={q}>
                        <span className="odv-qa-q">{q}</span>
                        <span className="odv-qa-a">{String(a)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          )}

          {/* Rejection notice */}
          {order.status === 'rejected' && order.rejectionReason && (
            <section className="odv-card odv-card--warn">
              <h2 className="odv-card-title">Rejection Reason</h2>
              <p className="odv-brief-text">{order.rejectionReason}</p>
            </section>
          )}

          {/* Shared Files */}
          {allAttachments.length > 0 && (
            <section className="odv-card">
              <h2 className="odv-card-title"><LuPaperclip size={16} color="#10b981" />Shared Files</h2>
              <div className="odv-artifacts">
                {allAttachments.map((att, i) => (
                  <div key={i} className="odv-artifact-row">
                    <LuFileText size={16} color="#6b7280" />
                    <div className="odv-artifact-info">
                      <span className="odv-artifact-name">{att.originalName || att.filename}</span>
                      <span className="odv-artifact-meta">
                        Shared by {att.sharedBy}
                        {att.sharedAt ? ` · ${fmtDate(att.sharedAt)}` : ''}
                        {att.size ? ` · ${fileSize(att.size)}` : ''}
                      </span>
                    </div>
                    {att.url && (
                      <a href={att.url} download className="odv-artifact-dl" title="Download">
                        <LuDownload size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* ── RIGHT COLUMN — Lifecycle Tracker ── */}
        <div className="odv-sidebar">
          <LifecycleTracker order={order} maxHeight={trackerMax} />
        </div>
      </div>

      {/* ── Communication Log (full width) ── */}
      <section className={`odv-card odv-convo-card odv-convo-full ${fsConvo ? 'conv-fs' : ''}`}>
          <div className="odv-card-header-row">
            <h2 className="odv-card-title" style={{ margin: 0 }}><LuMessageSquare size={16} color="#3b82f6" />Communication Log</h2>
            {order.messages?.length > 0 && (
              <span className="odv-msg-count">{order.messages.length} message{order.messages.length !== 1 ? 's' : ''}</span>
            )}
            <span className="odv-readonly-tag">Read-Only</span>
            <FullscreenButton active={fsConvo} onToggle={setFsConvo} />
          </div>

          {liveMeeting && (
            <div className="cv-head-meeting">
              <LuVideo size={14} />
              <span>{meetingHeaderLabel(liveMeeting, now)}</span>
              {liveMeeting.meetingLink && (
                <a href={liveMeeting.meetingLink} target="_blank" rel="noreferrer" className="cv-head-join">Join</a>
              )}
            </div>
          )}

          {!isConvoOpen ? (
            <p className="odv-conv-empty">Conversation opens once the employee accepts the order.</p>
          ) : convoThread.length === 0 ? (
            <p className="odv-conv-empty">No messages yet.</p>
          ) : (
            <div className="odv-chat">
              {convoThread.map((msg, i) => {
                if (msg.kind === 'meeting') {
                  return <MeetingMessage key={msg._id} meeting={msg.meeting} now={now} showCalendarLink />;
                }
                if (msg.kind === 'change-request' || msg.kind === 'review-submitted') {
                  return (
                    <ConversationEvent
                      key={msg._id}
                      msg={msg}
                      index={i}
                      messages={order.messages}
                      orderStatus={order.status}
                    />
                  );
                }
                // Admin is a read-only viewer, so every message is left-aligned —
                // the right side is reserved for "you" in two-party chats only.
                const isClient = msg.senderRole === 'client';
                const name = msg.sender?.name || '—';
                const initials = name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                const avatarBg = isClient ? '#3b82f6' : '#33a8d1';
                return (
                  <div key={msg._id} className="odv-msg odv-msg--left">
                    <span className="odv-msg-avatar" style={{ background: avatarBg }}>{initials}</span>
                    <div className="odv-msg-body">
                      <div className="odv-msg-meta">
                        <span className="odv-msg-name">{name}</span>
                        <span className="odv-msg-time">
                          {new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {', '}
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {msg.text && <p className="odv-msg-text">{msg.text}</p>}
                      <ChatAttachments attachments={msg.attachments} onImageClick={(src, nm) => setLightbox({ src, name: nm })} />
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>
          )}
      </section>

      {/* ── Modals ── */}
      {modal === 'assign' && (
        <Modal title={order.status === 'assigned' ? 'Reassign Employee' : 'Assign Employee'} onClose={() => { setModal(null); setAssignError(''); }}>
          {assignError && <p className="error-msg">{assignError}</p>}
          {order.status === 'assigned' && order.assignedEmployee && (
            <p style={{ fontSize: '.88rem', color: '#6b7280', marginBottom: 12 }}>
              Currently assigned to <strong>{order.assignedEmployee.name}</strong>. Pick a different employee to reassign before they accept.
            </p>
          )}
          <div className="form-group">
            <label className="form-label">Select employee</label>
            <select className="input" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
              <option value="">Select employee…</option>
              {employees
                .filter((emp) => emp._id !== (order.assignedEmployee?._id || order.assignedEmployee))
                .map((emp) => (
                  <option key={emp._id} value={emp._id}>{emp.name} — {emp.email}</option>
                ))}
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setModal(null); setAssignError(''); }}>Cancel</button>
            <button className="btn-primary" onClick={handleAssign} disabled={!selectedEmployee || assignLoading}>
              {assignLoading ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'delivery' && (
        <Modal title="Change Delivery Date" onClose={() => { setModal(null); setNewDeliveryDate(''); setDeliveryError(''); }}>
          {deliveryError && <p className="error-msg">{deliveryError}</p>}
          <p style={{ fontSize: '.88rem', color: '#6b7280', marginBottom: 12 }}>
            Current delivery date: <strong>{fmtDate(order.deliveryDate)}</strong>
          </p>
          <div className="form-group">
            <label className="form-label">New delivery date</label>
            <input
              type="date"
              className="input"
              value={newDeliveryDate}
              onChange={(e) => setNewDeliveryDate(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setModal(null); setNewDeliveryDate(''); setDeliveryError(''); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSetDeliveryDate} disabled={!newDeliveryDate || deliveryLoading}>
              {deliveryLoading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'status' && (
        <Modal title="Change Order Status" onClose={() => { setModal(null); setStatusError(''); }}>
          {statusError && <p className="error-msg">{statusError}</p>}
          <p style={{ fontSize: '.88rem', color: '#6b7280', marginBottom: 8 }}>
            Current status: <strong>{cfg.label}</strong>
          </p>
          <p style={{ fontSize: '.85rem', color: '#374151', marginBottom: 16 }}>
            {order.status === 'rejected'
              ? 'This will reset the order back to Unassigned (Placed) status so it can be assigned to a new employee.'
              : 'This will move the order back to In Progress status.'}
          </p>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setModal(null); setStatusError(''); }}>Cancel</button>
            <button className="btn-primary" onClick={handleResetStatus} disabled={statusLoading}>
              {statusLoading ? 'Updating…' : order.status === 'rejected' ? 'Reset to Unassigned' : 'Set to In Progress'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'force-complete' && (
        <Modal title="Force Complete Order" onClose={() => { setModal(null); setStatusError(''); }}>
          {statusError && <p className="error-msg">{statusError}</p>}
          <p style={{ fontSize: '.85rem', color: '#374151', marginBottom: 16 }}>
            This overrides client confirmation and marks the order as <strong>Completed</strong>.
            Use this only when the client is unresponsive or has confirmed off-platform.
          </p>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setModal(null); setStatusError(''); }}>Cancel</button>
            <button className="btn-primary" onClick={handleForceComplete} disabled={statusLoading}>
              {statusLoading ? 'Completing…' : 'Force Complete'}
            </button>
          </div>
        </Modal>
      )}

      {lightbox && (
        <ImageLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
