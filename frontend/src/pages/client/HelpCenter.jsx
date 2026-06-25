import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sendSupportMessage, getMyTickets, postSupportMessage } from '../../api/support';
import { useSocket } from '../../context/SocketContext';
import MeetingMessage from '../../components/MeetingMessage';
import FullscreenButton from '../../components/FullscreenButton';
import { useNow, activeMeeting, meetingHeaderLabel } from '../../utils/meeting';
import {
  LuMail, LuCircleCheck, LuSendHorizontal, LuMessageSquare,
  LuLifeBuoy, LuSearch, LuClock, LuCopy, LuUserCheck, LuX, LuPlus, LuVideo,
} from 'react-icons/lu';

const STATUS_META = {
  open:     { label: 'Open',        badge: 'badge-yellow' },
  accepted: { label: 'In Progress', badge: 'badge-blue' },
  resolved: { label: 'Resolved',    badge: 'badge-green' },
};

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── New ticket form ── */
function NewRequestForm({ onCreated }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const reset = () => { setSubject(''); setMessage(''); setError(''); setCreated(null); };
  const valid = subject.trim() && message.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError('');
    try {
      const r = await sendSupportMessage({ subject, message });
      setCreated(r.data.request);
      onCreated?.(r.data.request);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <div className="hc-success">
        <LuCircleCheck size={40} color="#10b981" />
        <p className="hc-success-title">Ticket opened!</p>
        <p className="hc-success-sub">
          Your ticket <strong>{created.ticketId}</strong> is now open. Once a team member picks it up,
          you can chat with them under <strong>My Tickets</strong>.
        </p>
        <button className="btn-secondary" onClick={reset}>Open another ticket</button>
      </div>
    );
  }

  return (
    <form className="hc-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Subject</label>
        <input
          type="text"
          className="input hc-input"
          placeholder="What do you need help with?"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          disabled={loading}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Message</label>
        <textarea
          className="input hc-input hc-textarea"
          placeholder="Describe your question or issue in detail…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          disabled={loading}
          required
        />
        <span className="hc-char-hint">{message.length} / 2000</span>
      </div>

      {error && <p className="page-error">{error}</p>}
      <button type="submit" className="btn-primary hc-submit-btn" disabled={loading || !valid}>
        {loading ? 'Sending…' : <><LuSendHorizontal size={15} /> Open Ticket</>}
      </button>
    </form>
  );
}

/* ── Conversation detail for the selected ticket ── */
function TicketDetail({ ticket, onUpdated }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [fs, setFs] = useState(false);
  const threadEndRef = useRef(null);

  useEffect(() => { setReply(''); setErr(''); setFs(false); }, [ticket._id]);
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [ticket.messages?.length, ticket._id]);

  const now = useNow();
  const meta = STATUS_META[ticket.status] || STATUS_META.open;
  const accepted = !!ticket.assignedTo;
  const resolved = ticket.status === 'resolved';
  const liveMeeting = activeMeeting(ticket.meetings, now);

  const thread = useMemo(() => {
    const items = [
      { _id: 'original', kind: 'message', senderRole: 'client', body: ticket.message, createdAt: ticket.createdAt },
      ...(ticket.messages || []).map((m) => ({ ...m, kind: 'message' })),
      ...(ticket.meetings || []).map((mt) => ({
        _id: `meeting-${mt._id}`, kind: 'meeting', meeting: mt,
        createdAt: mt.bookedAt || mt.scheduledAt || mt.createdAt,
      })),
    ];
    return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [ticket]);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setErr('');
    try {
      const r = await postSupportMessage(ticket._id, reply.trim());
      onUpdated?.(r.data.request);
      setReply('');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to send your message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`sp-detail-inner ${fs ? 'conv-fs' : ''}`}>
      <div className="sp-detail-head">
        <span className="sp-item-icon sp-item-icon--message"><LuMessageSquare size={16} /></span>
        <div>
          <h2 className="sp-detail-subject">{ticket.subject}</h2>
          <span className="sp-detail-type"><span className="sp-item-ticket">{ticket.ticketId}</span></span>
        </div>
        <span className={`badge ${meta.badge}`} style={{ marginLeft: 'auto' }}>{meta.label}</span>
        <FullscreenButton active={fs} onToggle={setFs} />
      </div>

      <div className="sp-meta-grid">
        <div className="sp-meta">
          <LuClock size={14} />
          <span>Opened {fmtTime(ticket.createdAt)}</span>
        </div>
        {accepted && (
          <div className="sp-meta">
            <LuUserCheck size={14} />
            <span>Being handled by our team</span>
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

      <div className="cv-thread">
        {thread.map((m) => {
          if (m.kind === 'meeting') {
            return <MeetingMessage key={m._id} meeting={m.meeting} now={now} />;
          }
          const mine = m.senderRole === 'client';
          return (
            <div key={m._id} className={`cv-msg ${mine ? 'cv-msg--mine' : 'cv-msg--them'}`}>
              <div className="cv-bubble">{m.body}</div>
              <span className="cv-meta">
                {mine ? 'You' : (m.senderName || 'Support team')} · {fmtTime(m.createdAt)}
              </span>
            </div>
          );
        })}
        <div ref={threadEndRef} />
      </div>

      {resolved ? (
        <p className="cv-waiting">This ticket has been resolved. Open a new ticket if you need more help.</p>
      ) : accepted ? (
        <div className="sp-reply-box">
          <textarea
            className="input"
            style={{ minHeight: '90px', resize: 'vertical' }}
            placeholder="Write a reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={sending}
            maxLength={4000}
          />
          {err && <p className="page-error">{err}</p>}
          <div className="sp-detail-actions">
            <button className="btn-primary" onClick={send} disabled={sending || !reply.trim()}>
              <LuSendHorizontal size={14} /> {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      ) : (
        <p className="cv-waiting">Waiting for a team member to pick up your ticket — you'll be able to reply here once they do.</p>
      )}
    </div>
  );
}

/* ── New ticket modal ── */
function NewTicketModal({ onClose, onCreated }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal smm" onClick={(e) => e.stopPropagation()}>
        <div className="smm-head">
          <div className="smm-head-title">
            <LuMail size={17} />
            <span>How can we help?</span>
          </div>
          <button className="smm-close" onClick={onClose} aria-label="Close"><LuX size={16} /></button>
        </div>
        <div className="smm-form">
          <p className="hc-card-sub" style={{ marginBottom: '.25rem' }}>
            Tell us what you need — we'll pick it up and reply right here.
          </p>
          <NewRequestForm onCreated={onCreated} />
        </div>
      </div>
    </div>
  );
}

export default function HelpCenter() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const socket = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    try {
      const r = await getMyTickets();
      setTickets(r.data.requests || []);
    } catch {
      /* ignore — empty list is a fine fallback */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Deep-link from a notification: ?ticket=<id> opens that ticket.
  useEffect(() => {
    const id = searchParams.get('ticket');
    if (id) setSelectedId(id);
  }, [searchParams]);

  // Live-sync the client's own tickets as staff accept / reply / schedule.
  useEffect(() => {
    if (!socket) return;
    const onUpdated = ({ request }) => {
      if (!request?._id) return;
      setTickets((prev) => prev.map((t) => (t._id === request._id ? request : t)));
    };
    socket.on('support:updated', onUpdated);
    return () => socket.off('support:updated', onUpdated);
  }, [socket]);

  const openCount = useMemo(() => tickets.filter((t) => t.status !== 'resolved').length, [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      t.ticketId?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q)
    );
  }, [tickets, query]);

  const selected = tickets.find((t) => t._id === selectedId) || null;

  const handleCreated = (ticket) => {
    if (ticket?._id) { setTickets((prev) => [ticket, ...prev]); setSelectedId(ticket._id); }
    setNewOpen(false);
  };

  const handleUpdated = (ticket) => {
    if (ticket?._id) setTickets((prev) => prev.map((t) => (t._id === ticket._id ? ticket : t)));
  };

  const selectTicket = (id) => {
    setSelectedId(id);
    if (searchParams.get('ticket')) {
      searchParams.delete('ticket');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const copyId = (e, id) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(id).catch(() => {});
  };

  return (
    <div className="page">
      <div className="section-header">
        <div className="hc-hero">
          <h1>Help Center</h1>
          <p className="subtitle">
            Open a ticket and chat with our team — every request gets a tracking ID. We typically respond within 24 hours.
            {openCount > 0 && <strong style={{ color: 'var(--primary)' }}> {openCount} open.</strong>}
          </p>
        </div>
        <button className="btn-primary hc-new-btn" onClick={() => setNewOpen(true)}>
          <LuPlus size={15} /> New Ticket
        </button>
      </div>

      <div className="sp-search">
        <LuSearch size={16} />
        <input
          type="text"
          placeholder="Search by ticket ID or subject…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="hc-empty">
          <LuLifeBuoy size={36} />
          <p>You have no tickets yet.</p>
          <button className="btn-primary hc-new-btn" onClick={() => setNewOpen(true)}>
            <LuPlus size={15} /> Open your first ticket
          </button>
        </div>
      ) : (
        <div className="sp-layout">
          {/* List */}
          <div className="card sp-list">
            {filtered.length === 0 ? (
              <div className="sp-empty">
                <LuLifeBuoy size={32} />
                <p>No tickets match your search.</p>
              </div>
            ) : (
              filtered.map((t) => {
                const meta = STATUS_META[t.status] || STATUS_META.open;
                return (
                  <button
                    key={t._id}
                    className={`sp-item ${t._id === selectedId ? 'sp-item--active' : ''} ${t.status !== 'resolved' ? 'sp-item--open' : ''}`}
                    onClick={() => selectTicket(t._id)}
                  >
                    <span className="sp-item-icon sp-item-icon--message"><LuMessageSquare size={15} /></span>
                    <div className="sp-item-body">
                      <span className="sp-item-subject">{t.subject}</span>
                      <span className="sp-item-meta">
                        <span
                          className="sp-item-ticket"
                          role="button"
                          tabIndex={0}
                          title="Copy ticket ID"
                          onClick={(e) => copyId(e, t.ticketId)}
                        >
                          {t.ticketId} <LuCopy size={10} />
                        </span> · {fmtTime(t.createdAt)}
                      </span>
                    </div>
                    <span className={`badge ${meta.badge}`}>{meta.label}</span>
                  </button>
                );
              })
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
              <TicketDetail ticket={selected} onUpdated={handleUpdated} />
            )}
          </div>
        </div>
      )}

      {newOpen && <NewTicketModal onClose={() => setNewOpen(false)} onCreated={handleCreated} />}
    </div>
  );
}
