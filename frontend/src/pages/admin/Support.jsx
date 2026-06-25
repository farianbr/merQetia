import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getSupportRequests, acceptSupportRequest, updateSupportStatus,
  postSupportMessage, scheduleSupportMeeting, rescheduleSupportMeeting, cancelSupportMeeting,
} from '../../api/support';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import MeetingScheduleModal from '../../components/MeetingScheduleModal';
import MeetingMessage from '../../components/MeetingMessage';
import MeetingCancelModal from '../../components/MeetingCancelModal';
import FullscreenButton from '../../components/FullscreenButton';
import { useNow, activeMeeting, canScheduleMeeting, meetingHeaderLabel } from '../../utils/meeting';
import {
  LuMessageSquare, LuCalendarDays, LuMail, LuClock, LuCircleCheck,
  LuSendHorizontal, LuRotateCcw, LuLifeBuoy, LuSearch, LuHandshake,
  LuUserCheck, LuVideo,
} from 'react-icons/lu';

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'open',     label: 'Open' },
  { key: 'accepted', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

const STATUS_META = {
  open:     { label: 'Open',        badge: 'badge-yellow' },
  accepted: { label: 'In Progress', badge: 'badge-blue' },
  resolved: { label: 'Resolved',    badge: 'badge-green' },
};

function fmtTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminSupport() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [actionErr, setActionErr] = useState('');

  // scheduleModal: { meeting } when rescheduling, { meeting: null } when new, or null
  const [scheduleModal, setScheduleModal] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null); // meeting to cancel
  const [cancelling, setCancelling] = useState(false);
  const [fsConvo, setFsConvo] = useState(false);

  const socket = useSocket();
  const { user } = useAuth();
  const myId = user?._id || user?.id || null;
  const threadEndRef = useRef(null);
  const now = useNow();
  const [searchParams, setSearchParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    try {
      const r = await getSupportRequests();
      setRequests(r.data.requests || []);
    } catch {
      setError('Failed to load support requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Deep-link: open the ticket named in ?ticket=<id> (from notifications).
  useEffect(() => {
    const id = searchParams.get('ticket');
    if (id) setSelectedId(id);
  }, [searchParams]);

  // Live support updates — new requests appear, status/replies sync across staff
  useEffect(() => {
    if (!socket) return;
    const onNew = ({ request }) => {
      if (!request?._id) return;
      setRequests((prev) =>
        prev.some((r) => r._id === request._id) ? prev : [request, ...prev]
      );
    };
    const onUpdated = ({ request }) => {
      if (!request?._id) return;
      setRequests((prev) => prev.map((r) => (r._id === request._id ? request : r)));
    };
    socket.on('support:new', onNew);
    socket.on('support:updated', onUpdated);
    return () => {
      socket.off('support:new', onNew);
      socket.off('support:updated', onUpdated);
    };
  }, [socket]);

  const filtered = useMemo(() => {
    let list = requests;
    switch (filter) {
      case 'open':     list = list.filter((r) => r.status === 'open'); break;
      case 'accepted': list = list.filter((r) => r.status === 'accepted'); break;
      case 'resolved': list = list.filter((r) => r.status === 'resolved'); break;
      default: break;
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        r.ticketId?.toLowerCase().includes(q) ||
        r.subject?.toLowerCase().includes(q) ||
        r.clientName?.toLowerCase().includes(q) ||
        r.clientEmail?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, filter, query]);

  const openCount = useMemo(() => requests.filter((r) => r.status === 'open').length, [requests]);
  const selected = requests.find((r) => r._id === selectedId) || null;

  const assignedToId = selected?.assignedTo?._id || selected?.assignedTo || null;
  const isMine = !!(assignedToId && myId && String(assignedToId) === String(myId));
  const isResolved = selected?.status === 'resolved';
  const liveMeeting = activeMeeting(selected?.meetings, now);
  const canSchedule = canScheduleMeeting(selected?.meetings, now);

  // Reset action state whenever a different request is opened
  useEffect(() => {
    setReply(''); setActionErr(''); setScheduleModal(null); setCancelTarget(null); setFsConvo(false);
  }, [selectedId]);

  // Keep the conversation scrolled to the latest message.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected?.messages?.length, selectedId]);

  const patchLocal = (updated) =>
    setRequests((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));

  const selectTicket = (id) => {
    setSelectedId(id);
    if (searchParams.get('ticket')) {
      searchParams.delete('ticket');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleAccept = async (req) => {
    setActionErr('');
    try {
      const r = await acceptSupportRequest(req._id);
      patchLocal(r.data.request);
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Failed to accept ticket');
    }
  };

  const handleStatus = async (req, status) => {
    setActionErr('');
    try {
      const r = await updateSupportStatus(req._id, status);
      patchLocal(r.data.request);
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setActionErr('');
    try {
      const r = await postSupportMessage(selected._id, reply.trim());
      patchLocal(r.data.request);
      setReply('');
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Schedule / reschedule run through the modal's onSubmit and return the
  // updated request so the modal can patch local state and close.
  const submitSchedule = async (payload) => {
    const meeting = scheduleModal?.meeting;
    const r = meeting
      ? await rescheduleSupportMeeting(selected._id, meeting._id, payload)
      : await scheduleSupportMeeting(selected._id, payload);
    return r.data.request;
  };

  const handleCancelMeeting = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setActionErr('');
    try {
      const r = await cancelSupportMeeting(selected._id, cancelTarget._id);
      patchLocal(r.data.request);
      setCancelTarget(null);
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Failed to cancel the meeting');
    } finally {
      setCancelling(false);
    }
  };

  const renderStatusBadge = (status, extra = {}) => {
    const meta = STATUS_META[status] || STATUS_META.open;
    return <span className={`badge ${meta.badge}`} {...extra}>{meta.label}</span>;
  };

  // Build the full conversation: opening message + the back-and-forth thread,
  // with any scheduled meeting woven in as a system event at its booking time.
  const thread = useMemo(() => {
    if (!selected) return [];
    const items = [
      { _id: 'original', kind: 'message', senderRole: 'client', senderName: selected.clientName, body: selected.message, createdAt: selected.createdAt },
      ...(selected.messages || []).map((m) => ({ ...m, kind: 'message' })),
      ...(selected.meetings || []).map((mt) => ({
        _id: `meeting-${mt._id}`, kind: 'meeting', meeting: mt,
        createdAt: mt.bookedAt || mt.scheduledAt || mt.createdAt,
      })),
    ];
    return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [selected]);

  return (
    <div className="page sp-page">
      <div className="section-header">
        <div>
          <h1>Support Center</h1>
          <p className="subtitle">
            Client tickets and conversations.
            {openCount > 0 && <strong style={{ color: 'var(--primary)' }}> {openCount} open.</strong>}
          </p>
        </div>
      </div>

      {error && <p className="page-error">{error}</p>}

      <div className="sp-search">
        <LuSearch size={16} />
        <input
          type="text"
          placeholder="Search by ticket ID, subject, or client…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="sp-filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`tm-chip ${filter === f.key ? 'tm-chip--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key === 'open' && openCount > 0 && <span className="tm-chip-count">{openCount}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="sp-layout">
          {/* List */}
          <div className="card sp-list">
            {filtered.length === 0 ? (
              <div className="sp-empty">
                <LuLifeBuoy size={32} />
                <p>No requests in this view.</p>
              </div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r._id}
                  className={`sp-item ${r._id === selectedId ? 'sp-item--active' : ''} ${r.status === 'open' ? 'sp-item--open' : ''}`}
                  onClick={() => selectTicket(r._id)}
                >
                  <span className="sp-item-icon sp-item-icon--message">
                    <LuMessageSquare size={15} />
                  </span>
                  <div className="sp-item-body">
                    <span className="sp-item-subject">{r.subject}</span>
                    <span className="sp-item-meta">
                      <span className="sp-item-ticket">{r.ticketId}</span> · {r.clientName || r.clientEmail} · {fmtTime(r.createdAt)}
                    </span>
                  </div>
                  {renderStatusBadge(r.status)}
                </button>
              ))
            )}
          </div>

          {/* Detail */}
          <div className="card sp-detail">
            {!selected ? (
              <div className="sp-detail-empty">
                <LuLifeBuoy size={40} />
                <p>Select a ticket to view the conversation.</p>
              </div>
            ) : (
              <div className={`sp-detail-inner ${fsConvo ? 'conv-fs' : ''}`}>
                <div className="sp-detail-head">
                  <span className="sp-item-icon sp-item-icon--message">
                    <LuMessageSquare size={16} />
                  </span>
                  <div>
                    <h2 className="sp-detail-subject">{selected.subject}</h2>
                    <span className="sp-detail-type">
                      <span className="sp-item-ticket">{selected.ticketId}</span>
                    </span>
                  </div>
                  {renderStatusBadge(selected.status, { style: { marginLeft: 'auto' } })}
                  <FullscreenButton active={fsConvo} onToggle={setFsConvo} />
                </div>

                <div className="sp-meta-grid">
                  <div className="sp-meta">
                    <LuMail size={14} />
                    <a href={`mailto:${selected.clientEmail}`}>{selected.clientName} ({selected.clientEmail})</a>
                  </div>
                  <div className="sp-meta">
                    <LuClock size={14} />
                    <span>Opened {fmtTime(selected.createdAt)}</span>
                  </div>
                  {selected.assignedTo && (
                    <div className="sp-meta">
                      <LuUserCheck size={14} />
                      <span>Handled by {isMine ? 'you' : (selected.assignedTo.name || 'a team member')}</span>
                    </div>
                  )}
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

                {/* Conversation thread — meetings appear inline as system events */}
                <div className="cv-thread">
                  {thread.map((m) => {
                    if (m.kind === 'meeting') {
                      return (
                        <MeetingMessage
                          key={m._id}
                          meeting={m.meeting}
                          now={now}
                          canManage={isMine && !isResolved}
                          showCalendarLink
                          onReschedule={() => setScheduleModal({ meeting: m.meeting })}
                          onCancel={() => setCancelTarget(m.meeting)}
                          cancelling={cancelling && cancelTarget?._id === m.meeting._id}
                        />
                      );
                    }
                    const mine = m.senderRole === 'staff';
                    return (
                      <div key={m._id} className={`cv-msg ${mine ? 'cv-msg--mine' : 'cv-msg--them'}`}>
                        <div className="cv-bubble">{m.body}</div>
                        <span className="cv-meta">
                          {mine ? (m.senderName || 'Team') : (m.senderName || selected.clientName || 'Client')} · {fmtTime(m.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                {actionErr && <p className="page-error">{actionErr}</p>}

                {/* Accept step — surfaced for open tickets */}
                {selected.status === 'open' && (
                  <button className="btn-primary sp-accept-btn" onClick={() => handleAccept(selected)}>
                    <LuHandshake size={15} /> Accept Ticket
                  </button>
                )}

                {/* Resolved — closed to messages until reopened */}
                {isResolved && (
                  <div className="sp-reply-box">
                    <p className="cv-waiting">This ticket is resolved. Reopen it to continue the conversation.</p>
                    {isMine && (
                      <div className="sp-detail-actions">
                        <button className="btn-secondary" onClick={() => handleStatus(selected, 'accepted')}>
                          <LuRotateCcw size={14} /> Reopen
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Active conversation — only the staff member who accepted can reply */}
                {selected.status !== 'open' && !isResolved && (
                  isMine ? (
                    <div className="sp-reply-box">
                      <label className="form-label">Reply to client</label>
                      <textarea
                        className="input"
                        style={{ minHeight: '90px', resize: 'vertical' }}
                        placeholder="Type your message…"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        disabled={sending}
                        maxLength={4000}
                      />
                      <div className="sp-detail-actions">
                        {canSchedule && (
                          <button className="btn-secondary" onClick={() => setScheduleModal({ meeting: null })}>
                            <LuCalendarDays size={14} /> Schedule meeting
                          </button>
                        )}
                        <button className="btn-secondary" onClick={() => handleStatus(selected, 'resolved')}>
                          <LuCircleCheck size={14} /> Mark Resolved
                        </button>
                        <button className="btn-primary" onClick={handleSend} disabled={sending || !reply.trim()}>
                          <LuSendHorizontal size={14} /> {sending ? 'Sending…' : 'Send'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="cv-waiting">
                      This ticket is being handled by {selected.assignedTo?.name || 'another team member'} — only they can reply to the client.
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {scheduleModal && selected && (
        <MeetingScheduleModal
          existing={scheduleModal.meeting}
          inviteeLabel={selected.clientName || selected.clientEmail}
          onSubmit={submitSchedule}
          onScheduled={patchLocal}
          onClose={() => setScheduleModal(null)}
        />
      )}

      {cancelTarget && selected && (
        <MeetingCancelModal
          meeting={cancelTarget}
          cancelling={cancelling}
          onClose={() => setCancelTarget(null)}
          onReschedule={() => { const mt = cancelTarget; setCancelTarget(null); setScheduleModal({ meeting: mt }); }}
          onConfirm={handleCancelMeeting}
        />
      )}
    </div>
  );
}
