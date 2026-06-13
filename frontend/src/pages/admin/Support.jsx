import { useEffect, useMemo, useState } from 'react';
import {
  getSupportRequests, updateSupportStatus, replySupportRequest,
} from '../../api/support';
import {
  LuMessageSquare, LuCalendarDays, LuMail, LuClock, LuCircleCheck,
  LuSendHorizontal, LuRotateCcw, LuLifeBuoy,
} from 'react-icons/lu';

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'open',     label: 'Open' },
  { key: 'message',  label: 'Messages' },
  { key: 'meeting',  label: 'Meetings' },
  { key: 'resolved', label: 'Resolved' },
];

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
  const [selectedId, setSelectedId] = useState(null);

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [actionErr, setActionErr] = useState('');

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

  const filtered = useMemo(() => {
    switch (filter) {
      case 'open':     return requests.filter((r) => r.status === 'open');
      case 'resolved': return requests.filter((r) => r.status === 'resolved');
      case 'message':  return requests.filter((r) => r.type === 'message');
      case 'meeting':  return requests.filter((r) => r.type === 'meeting');
      default:         return requests;
    }
  }, [requests, filter]);

  const openCount = useMemo(() => requests.filter((r) => r.status === 'open').length, [requests]);
  const selected = requests.find((r) => r._id === selectedId) || null;

  // Reset the reply box whenever a different request is opened
  useEffect(() => { setReply(''); setActionErr(''); }, [selectedId]);

  const patchLocal = (updated) =>
    setRequests((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));

  const handleStatus = async (req, status) => {
    setActionErr('');
    try {
      const r = await updateSupportStatus(req._id, status);
      patchLocal(r.data.request);
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setActionErr('');
    try {
      const r = await replySupportRequest(selected._id, reply.trim());
      patchLocal(r.data.request);
      setReply('');
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page sp-page">
      <div className="section-header">
        <div>
          <h1>Support Center</h1>
          <p className="subtitle">
            Client messages and meeting requests.
            {openCount > 0 && <strong style={{ color: 'var(--primary)' }}> {openCount} open.</strong>}
          </p>
        </div>
      </div>

      {error && <p className="page-error">{error}</p>}

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
                  onClick={() => setSelectedId(r._id)}
                >
                  <span className={`sp-item-icon sp-item-icon--${r.type}`}>
                    {r.type === 'meeting' ? <LuCalendarDays size={15} /> : <LuMessageSquare size={15} />}
                  </span>
                  <div className="sp-item-body">
                    <span className="sp-item-subject">{r.subject}</span>
                    <span className="sp-item-meta">{r.clientName || r.clientEmail} · {fmtTime(r.createdAt)}</span>
                  </div>
                  <span className={`badge ${r.status === 'open' ? 'badge-yellow' : 'badge-green'}`}>
                    {r.status === 'open' ? 'Open' : 'Resolved'}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Detail */}
          <div className="card sp-detail">
            {!selected ? (
              <div className="sp-detail-empty">
                <LuLifeBuoy size={40} />
                <p>Select a request to view details and reply.</p>
              </div>
            ) : (
              <div className="sp-detail-inner">
                <div className="sp-detail-head">
                  <span className={`sp-item-icon sp-item-icon--${selected.type}`}>
                    {selected.type === 'meeting' ? <LuCalendarDays size={16} /> : <LuMessageSquare size={16} />}
                  </span>
                  <div>
                    <h2 className="sp-detail-subject">{selected.subject}</h2>
                    <span className="sp-detail-type">
                      {selected.type === 'meeting' ? 'Meeting request' : 'Support message'}
                    </span>
                  </div>
                  <span className={`badge ${selected.status === 'open' ? 'badge-yellow' : 'badge-green'}`} style={{ marginLeft: 'auto' }}>
                    {selected.status === 'open' ? 'Open' : 'Resolved'}
                  </span>
                </div>

                <div className="sp-meta-grid">
                  <div className="sp-meta">
                    <LuMail size={14} />
                    <a href={`mailto:${selected.clientEmail}`}>{selected.clientName} ({selected.clientEmail})</a>
                  </div>
                  <div className="sp-meta">
                    <LuClock size={14} />
                    <span>Submitted {fmtTime(selected.createdAt)}</span>
                  </div>
                  {selected.type === 'meeting' && (
                    <div className="sp-meta">
                      <LuCalendarDays size={14} />
                      <span>Preferred: {selected.preferredDate || '—'}{selected.preferredTime ? ` at ${selected.preferredTime}` : ''}</span>
                    </div>
                  )}
                </div>

                <div className="sp-message">{selected.message}</div>

                {selected.reply?.message && (
                  <div className="sp-reply-prev">
                    <span className="sp-reply-prev-label">
                      <LuCircleCheck size={14} /> Your reply · {fmtTime(selected.reply.repliedAt)}
                    </span>
                    <p>{selected.reply.message}</p>
                  </div>
                )}

                {actionErr && <p className="page-error">{actionErr}</p>}

                {/* Reply box */}
                <div className="sp-reply-box">
                  <label className="form-label">{selected.reply?.message ? 'Send another reply' : 'Reply to client'}</label>
                  <textarea
                    className="input"
                    style={{ minHeight: '90px', resize: 'vertical' }}
                    placeholder="Type your reply… this will be emailed to the client."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    disabled={sending}
                  />
                  <div className="sp-detail-actions">
                    {selected.status === 'open' ? (
                      <button className="btn-secondary" onClick={() => handleStatus(selected, 'resolved')}>
                        <LuCircleCheck size={14} /> Mark Resolved
                      </button>
                    ) : (
                      <button className="btn-secondary" onClick={() => handleStatus(selected, 'open')}>
                        <LuRotateCcw size={14} /> Reopen
                      </button>
                    )}
                    <button className="btn-primary" onClick={handleReply} disabled={sending || !reply.trim()}>
                      <LuSendHorizontal size={14} /> {sending ? 'Sending…' : 'Send Reply & Resolve'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
