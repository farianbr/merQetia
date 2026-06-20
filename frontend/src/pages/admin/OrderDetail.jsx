import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder, assignEmployee, adminSetDeliveryDate, adminResetStatus } from '../../api/orders';
import { getEmployees } from '../../api/admin';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';
import {
  LuArrowLeft, LuCalendarDays, LuUserCog, LuSettings2,
  LuCheck, LuX, LuFileText, LuDownload, LuShieldCheck,
  LuLayoutList, LuClipboardList, LuPaperclip, LuMessageSquare,
} from 'react-icons/lu';

/* ─── helpers ─────────────────────────────────────── */
const STATUS_CONFIG = {
  placed:    { label: 'Placed',      color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  assigned:  { label: 'Assigned',    color: '#1e40af', bg: '#dbeafe', dot: '#3b82f6' },
  accepted:  { label: 'In Progress', color: '#155e75', bg: '#cffafe', dot: '#06b6d4' },
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
const LIFECYCLE_STEPS = [
  { key: 'placed',    label: 'Order Placed',   getSubtitle: (o) => fmtDate(o.createdAt) },
  { key: 'assigned',  label: 'Brief Approved', getSubtitle: () => null },
  { key: 'accepted',  label: 'In Progress',    getSubtitle: () => null },
  { key: 'completed', label: 'Pending Review', getSubtitle: (o) => o.deliveryDate ? `Est. ${fmtDate(o.deliveryDate)}` : null },
];
const STATUS_ORDER = ['placed', 'assigned', 'accepted', 'completed'];

function LifecycleTracker({ order }) {
  const isRejected = order.status === 'rejected';
  const activeIdx = isRejected ? 1 : STATUS_ORDER.indexOf(order.status);

  return (
    <div className="odv-tracker">
      <h3 className="odv-tracker-title">Lifecycle Tracker</h3>
      <div className="odv-tracker-steps">
        {LIFECYCLE_STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = !isRejected && i === activeIdx;
          const sub = step.getSubtitle(order);
          return (
            <div key={step.key} className="odv-tl-item">
              <div className="odv-tl-left">
                <div className={`odv-tl-dot ${done ? 'odv-tl-dot--done' : active ? 'odv-tl-dot--active' : ''}`}>
                  {done && <LuCheck size={10} strokeWidth={3} color="#fff" />}
                  {active && <span className="odv-tl-inner" />}
                </div>
                {i < LIFECYCLE_STEPS.length - 1 && (
                  <div className={`odv-tl-line ${done || active ? 'odv-tl-line--done' : ''}`} />
                )}
              </div>
              <div className="odv-tl-content">
                <span className={`odv-tl-label ${active ? 'odv-tl-label--active' : done ? 'odv-tl-label--done' : ''}`}>
                  {step.label}
                </span>
                {active && <span className="odv-tl-active-tag">Currently Active</span>}
                {sub && <span className="odv-tl-sub">{sub}</span>}
              </div>
            </div>
          );
        })}
        {isRejected && (
          <div className="odv-tl-item">
            <div className="odv-tl-left">
              <div className="odv-tl-dot odv-tl-dot--rejected">
                <LuX size={10} strokeWidth={3} color="#fff" />
              </div>
            </div>
            <div className="odv-tl-content">
              <span className="odv-tl-label" style={{ color: '#ef4444' }}>Rejected</span>
              {order.rejectionReason && <span className="odv-tl-sub">{order.rejectionReason}</span>}
            </div>
          </div>
        )}
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
  const isConvoOpen = order.status === 'accepted' || order.status === 'completed';

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
          <LuShieldCheck size={16} color="#0e7490" />
          <div className="odv-controls-text">
            <span className="odv-controls-label">Administrative Controls</span>
            <span className="odv-controls-sub">Override settings for this specific order instance.</span>
          </div>
        </div>
        <div className="odv-controls-btns">
          {/* Assign employee — only when no employee assigned (placed) */}
          {order.status === 'placed' && (
            <button className="odv-ctrl-btn" onClick={() => setModal('assign')}>
              <LuUserCog size={14} color="#06b6d4" /> Assign Employee
            </button>
          )}
          {/* Change delivery date — only when accepted (in progress) */}
          {order.status === 'accepted' && order.deliveryDate && (
            <button className="odv-ctrl-btn" onClick={() => { setNewDeliveryDate(''); setDeliveryError(''); setModal('delivery'); }}>
              <LuCalendarDays size={14} color="#3b82f6" /> Change Delivery Date
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
        <div className="odv-main">

          {/* Core Information */}
          <section className="odv-card">
            <h2 className="odv-card-title"><LuLayoutList size={16} color="#0e7490" />Core Information</h2>
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
                <span className="odv-info-value odv-info-price">${order.totalPrice?.toFixed(2)}</span>
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
              <h2 className="odv-card-title"><LuFileText size={16} color="#06b6d4" />Project Brief</h2>
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

          {/* Communication Log */}
          <section className="odv-card">
            <div className="odv-card-header-row">
              <h2 className="odv-card-title" style={{ margin: 0 }}><LuMessageSquare size={16} color="#3b82f6" />Communication Log</h2>
              {order.messages?.length > 0 && (
                <span className="odv-msg-count">{order.messages.length} message{order.messages.length !== 1 ? 's' : ''}</span>
              )}
              <span className="odv-readonly-tag">Read-Only</span>
            </div>

            {!isConvoOpen ? (
              <p className="odv-conv-empty">Conversation opens once the employee accepts the order.</p>
            ) : (!order.messages || order.messages.length === 0) ? (
              <p className="odv-conv-empty">No messages yet.</p>
            ) : (
              <div className="odv-chat">
                {order.messages.map((msg) => {
                  const isClient = msg.senderRole === 'client';
                  const name = msg.sender?.name || '—';
                  const initials = name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                  const avatarBg = isClient ? '#3b82f6' : '#06b6d4';
                  return (
                    <div key={msg._id} className={`odv-msg ${isClient ? 'odv-msg--left' : 'odv-msg--right'}`}>
                      {isClient && (
                        <span className="odv-msg-avatar" style={{ background: avatarBg }}>{initials}</span>
                      )}
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
                      {!isClient && (
                        <span className="odv-msg-avatar" style={{ background: avatarBg }}>{initials}</span>
                      )}
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>
            )}
          </section>
        </div>

        {/* ── RIGHT COLUMN — Lifecycle Tracker ── */}
        <div className="odv-sidebar">
          <LifecycleTracker order={order} />
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === 'assign' && (
        <Modal title="Assign Employee" onClose={() => { setModal(null); setAssignError(''); }}>
          {assignError && <p className="error-msg">{assignError}</p>}
          <div className="form-group">
            <label className="form-label">Select employee</label>
            <select className="input" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map((emp) => (
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

      {lightbox && (
        <ImageLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
