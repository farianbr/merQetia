import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder, acceptOrder, rejectOrder, completeOrder, sendMessage } from '../../api/orders';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';

function fmtTime(iso) {
  const d = new Date(iso);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}${M}${D}-${h}${m}`;
}

const STATUS_COLORS = {
  placed: '#f59e0b',
  assigned: '#3b82f6',
  accepted: '#8b5cf6',
  rejected: '#ef4444',
  completed: '#10b981',
};

const STATUS_LABEL = {
  placed: 'Pending',
  assigned: 'Offered',
  accepted: 'In Progress',
  rejected: 'Declined',
  completed: 'Completed',
};

export default function AssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Accept
  const [acceptModal, setAcceptModal] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [acceptError, setAcceptError] = useState('');

  // Decline
  const [declineModal, setDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Message
  const [msgText, setMsgText] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];

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

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [order?.messages?.length]);

  const handleAccept = async () => {
    if (!deliveryDate) { setAcceptError('Please pick a delivery date'); return; }
    setActionLoading(true);
    try {
      await acceptOrder(id, deliveryDate);
      setAcceptModal(false);
      fetchOrder();
    } catch (err) {
      setAcceptError(err.response?.data?.message || 'Failed to accept');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    setActionLoading(true);
    try {
      await rejectOrder(id, declineReason);
      setDeclineModal(false);
      fetchOrder();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to decline');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      await completeOrder(id);
      fetchOrder();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark complete');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim() && attachFiles.length === 0) return;
    setSendingMsg(true);
    try {
      const r = await sendMessage(id, msgText.trim(), attachFiles);
      setMsgText('');
      setAttachFiles([]);
      setOrder((prev) => ({ ...prev, messages: r.data.messages }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setAttachFiles((prev) => [...prev, ...selected].slice(0, 5));
    e.target.value = '';
  };

  const removeAttachFile = (idx) =>
    setAttachFiles((prev) => prev.filter((_, i) => i !== idx));

  if (loading) return <div className="loading">Loading…</div>;
  if (error && !order) return <div className="page-error">{error}</div>;

  const serviceName =
    order.services?.length > 0
      ? order.services.map((s) => s.name).join(', ')
      : `Order #${order._id.slice(-6).toUpperCase()}`;

  return (
    <div className="asd-page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <button className="asd-back-btn" onClick={() => navigate('/employee/orders')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          My Orders
        </button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">#{order._id.slice(-6).toUpperCase()}</span>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* Header */}
      <div className="asd-header">
        <div className="asd-header-left">
          <h1 className="asd-title">{serviceName}</h1>
          <div className="asd-header-meta">
            <span className="badge" style={{ background: STATUS_COLORS[order.status] }}>
              {STATUS_LABEL[order.status]}
            </span>
            <span className="asd-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              {order.clientId?.name || '—'}
            </span>
            <span className="asd-meta-item asd-meta-price">
              ${order.totalPrice?.toFixed(2)}
            </span>
            {order.deliveryDate && (
              <span className="asd-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Due {new Date(order.deliveryDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="asd-header-actions">
          {order.status === 'assigned' && (
            <>
              <button className="ew-btn-accept" onClick={() => { setAcceptModal(true); setAcceptError(''); setDeliveryDate(''); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Accept Offer
              </button>
              <button className="ew-btn-decline" onClick={() => { setDeclineModal(true); setDeclineReason(''); }}>
                Decline
              </button>
            </>
          )}
          {order.status === 'accepted' && (
            <button className="ew-btn-complete" disabled={actionLoading} onClick={handleComplete}>
              {actionLoading ? 'Saving…' : 'Mark as Complete'}
            </button>
          )}
        </div>
      </div>

      <div className="asd-grid">
        {/* Left column — conversation (bigger) */}
        <div className="asd-col-main">
          {(order.status === 'accepted' || order.status === 'completed') ? (
            <div className="asd-card asd-chat-card">
              <h3 className="asd-card-title">
                Conversation
                {order.messages?.length > 0 && (
                  <span className="asd-msg-count">{order.messages.length}</span>
                )}
              </h3>
              <div className="chat-window chat-window--detail">
                {(!order.messages || order.messages.length === 0) && (
                  <p className="chat-empty">No messages yet. Start the conversation!</p>
                )}
                {order.messages?.map((msg) => {
                  const isMine = msg.senderRole === 'employee';
                  return (
                    <div
                      key={msg._id}
                      className={`chat-bubble ${isMine ? 'chat-bubble--mine' : 'chat-bubble--theirs'}`}
                    >
                      <span className="chat-sender">{isMine ? 'You' : msg.sender?.name || 'Client'}</span>
                      {msg.text && <p>{msg.text}</p>}
                      <ChatAttachments
                        attachments={msg.attachments}
                        onImageClick={(src, name) => setLightbox({ src, name })}
                      />
                      <span className="chat-time">
                        {fmtTime(msg.createdAt)}
                      </span>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {order.status === 'accepted' && (
                <form className="chat-input-area" onSubmit={handleSendMessage}>
                  {attachFiles.length > 0 && (
                    <div className="chat-attach-preview">
                      {attachFiles.map((f, i) => (
                        <div key={i} className="chat-attach-chip">
                          {f.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(f)} alt={f.name} className="chat-attach-thumb" />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          )}
                          <span className="chat-attach-chip-name">{f.name}</span>
                          <button type="button" className="chat-attach-chip-rm" onClick={() => removeAttachFile(i)} aria-label="Remove">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="chat-input-row">
                    <input
                      type="text"
                      className="input"
                      placeholder="Type a message…"
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      disabled={sendingMsg}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.zip,.pdf,.doc,.docx,.txt"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                    <button
                      type="button"
                      className="chat-attach-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sendingMsg || attachFiles.length >= 5}
                      title="Attach files (max 5)"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                    </button>
                    <button type="submit" className="btn-primary" disabled={sendingMsg || (!msgText.trim() && attachFiles.length === 0)}>
                      {sendingMsg ? '…' : 'Send'}
                    </button>
                  </div>
                </form>
              )}
              {order.status === 'completed' && (
                <p className="chat-closed">This job is completed. Messages are read-only.</p>
              )}
            </div>
          ) : (
            /* No conversation yet — show a placeholder card */
            <div className="asd-card">
              <h3 className="asd-card-title">Conversation</h3>
              <p className="asd-summary">Conversation will be available once you accept this offer.</p>
            </div>
          )}
        </div>

        {/* Right column — order details */}
        <div className="asd-col-side">
          {/* Services */}
          {order.services?.length > 0 && (
            <div className="asd-card">
              <h3 className="asd-card-title">Services</h3>
              <div className="asd-services-list">
                {order.services.map((s) => (
                  <div className="asd-service-row" key={s._id || s.name}>
                    <div className="asd-service-left">
                      <span className="asd-service-name">{s.name}</span>
                      {s.category && <span className="category-tag">{s.category}</span>}
                    </div>
                    {s.price != null && (
                      <span className="asd-service-price">${s.price?.toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="asd-total-row">
                <span>Total</span>
                <span className="asd-total-amount">${order.totalPrice?.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Summary / description */}
          {order.summary && (
            <div className="asd-card">
              <h3 className="asd-card-title">Brief</h3>
              <p className="asd-summary">{order.summary}</p>
            </div>
          )}

          {/* Client answers */}
          {order.answers?.length > 0 && (
            <div className="asd-card">
              <h3 className="asd-card-title">Client Answers</h3>
              {order.answers.map((group, gi) => (
                <div className="asd-answers-group" key={gi}>
                  {group.serviceName && (
                    <p className="asd-answers-service">{group.serviceName}</p>
                  )}
                  {group.answers?.map((qa, qi) => (
                    <div className="asd-qa" key={qi}>
                      <p className="asd-question">{qa.question}</p>
                      <p className="asd-answer">{qa.answer}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Order info */}
          <div className="asd-card asd-info-card">
            <h3 className="asd-card-title">Order Info</h3>
            <div className="asd-info-rows">
              <div className="asd-info-row">
                <span className="asd-info-label">Order ID</span>
                <span className="asd-info-value asd-info-mono">#{order._id.slice(-6).toUpperCase()}</span>
              </div>
              <div className="asd-info-row">
                <span className="asd-info-label">Status</span>
                <span className="badge" style={{ background: STATUS_COLORS[order.status] }}>
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
              <div className="asd-info-row">
                <span className="asd-info-label">Client</span>
                <span className="asd-info-value">{order.clientId?.name || '—'}</span>
              </div>
              <div className="asd-info-row">
                <span className="asd-info-label">Total</span>
                <span className="asd-info-value asd-info-price">${order.totalPrice?.toFixed(2)}</span>
              </div>
              {order.deliveryDate && (
                <div className="asd-info-row">
                  <span className="asd-info-label">Delivery Date</span>
                  <span className="asd-info-value">{new Date(order.deliveryDate).toLocaleDateString()}</span>
                </div>
              )}
              {order.createdAt && (
                <div className="asd-info-row">
                  <span className="asd-info-label">Assigned On</span>
                  <span className="asd-info-value">{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rejection reason */}
          {order.status === 'rejected' && order.rejectionReason && (
            <div className="asd-rejection-box">
              <strong>Declined reason:</strong> {order.rejectionReason}
            </div>
          )}
        </div>
      </div>

      {/* Accept Modal */}
      {acceptModal && (
        <div className="modal-overlay" onClick={() => setAcceptModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Accept Offer</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>
              Set an estimated delivery date to confirm this job.
            </p>
            {acceptError && <p className="error-msg">{acceptError}</p>}
            <label className="form-label">Delivery Date</label>
            <input
              type="date"
              className="input"
              min={today}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setAcceptModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAccept} disabled={actionLoading}>
                {actionLoading ? 'Accepting…' : 'Confirm & Accept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {declineModal && (
        <div className="modal-overlay" onClick={() => setDeclineModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Decline Offer</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>
              Optionally provide a reason for declining.
            </p>
            <label className="form-label">Reason (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. I'm fully booked this week"
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeclineModal(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDecline} disabled={actionLoading}>
                {actionLoading ? 'Declining…' : 'Decline Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightbox && (
        <ImageLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
