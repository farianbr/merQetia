import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getMyAssignments, acceptOrder, rejectOrder, completeOrder, sendMessage } from '../../api/orders';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const isToday = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + time;
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
  assigned: 'New Request',
  accepted: 'In Progress',
  rejected: 'Declined',
  completed: 'Completed',
};

export default function EmployeeOrders() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [error, setError] = useState('');
  const activeOrderRef = useRef(null);
  activeOrderRef.current = activeOrder;

  // Chat
  const [msgText, setMsgText] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Accept modal
  const [acceptModal, setAcceptModal] = useState(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [acceptError, setAcceptError] = useState('');

  // Decline modal
  const [declineModal, setDeclineModal] = useState(null);
  const [declineReason, setDeclineReason] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const fetchOrders = useCallback(async () => {
    try {
      const r = await getMyAssignments();
      const list = r.data.orders || r.data;
      setOrders(list);
      if (activeOrderRef.current) {
        const updated = list.find((o) => o._id === activeOrderRef.current._id);
        if (updated) setActiveOrder(updated);
      }
    } catch {
      setError('Failed to load orders');
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Pre-select order when navigated from dashboard
  useEffect(() => {
    if (location.state?.orderId && orders.length > 0) {
      const target = orders.find((o) => o._id === location.state.orderId);
      if (target) setActiveOrder(target);
    }
  }, [orders, location.state?.orderId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeOrder?.messages?.length]);

  useEffect(() => {
    if (activeOrder) chatBottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [activeOrder?._id]);

  const handleAccept = async () => {
    if (!deliveryDate) { setAcceptError('Please pick a delivery date'); return; }
    setActionLoading(true);
    try {
      await acceptOrder(acceptModal, deliveryDate);
      setAcceptModal(null);
      fetchOrders();
    } catch (err) {
      setAcceptError(err.response?.data?.message || 'Failed to accept order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    setActionLoading(true);
    try {
      await rejectOrder(declineModal, declineReason);
      setDeclineModal(null);
      fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to decline order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (orderId) => {
    setActionLoading(true);
    try {
      await completeOrder(orderId);
      fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark complete');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim() && attachFiles.length === 0) return;
    if (!activeOrder) return;
    setSendingMsg(true);
    setError('');
    try {
      const r = await sendMessage(activeOrder._id, msgText.trim(), attachFiles);
      setMsgText('');
      setAttachFiles([]);
      setActiveOrder((prev) => ({ ...prev, messages: r.data.messages }));
      setOrders((prev) =>
        prev.map((o) => (o._id === activeOrder._id ? { ...o, messages: r.data.messages } : o))
      );
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

  return (
    <div className="co-page">
      <div className="co-page-header">
        <div>
          <h1>My Orders</h1>
          <p className="subtitle">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div className="co-layout">
        {/* —— Left: order list —— */}
        <div className="co-list">
          {orders.length === 0 && (
            <p className="co-empty">No orders yet.</p>
          )}
          {orders.map((o) => {
            const isActive = activeOrder?._id === o._id;
            const serviceNames = (o.services || []).map((s) => s.name).join(', ') || '—';
            return (
              <button
                key={o._id}
                className={`co-item ${isActive ? 'co-item--active' : ''}`}
                onClick={() => { setActiveOrder(o); setMsgText(''); setAttachFiles([]); setError(''); setShowAttachments(false); }}
              >
                <div className="co-item-top">
                  <span className="co-item-id">#{o._id.slice(-6).toUpperCase()}</span>
                  <span
                    className="co-item-status"
                    style={{ background: STATUS_COLORS[o.status] + '22', color: STATUS_COLORS[o.status] }}
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
                <p className="co-item-services">{serviceNames}</p>
                <div className="co-item-meta">
                  <span>{o.clientId?.name || '—'}</span>
                  <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* —— Right: detail + conversation —— */}
        {activeOrder ? (
          <div className="co-detail">
            {/* Header */}
            <div className="co-detail-header">
              <div>
                <h2 className="co-detail-id">Order #{activeOrder._id.slice(-6).toUpperCase()}</h2>
                <span
                  className="co-detail-status"
                  style={{ background: STATUS_COLORS[activeOrder.status] + '22', color: STATUS_COLORS[activeOrder.status] }}
                >
                  {STATUS_LABEL[activeOrder.status]}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                {activeOrder.status === 'assigned' && (
                  <>
                    <button className="ew-btn-accept" onClick={() => { setAcceptModal(activeOrder._id); setDeliveryDate(''); setAcceptError(''); }}>
                      Accept
                    </button>
                    <button className="ew-btn-decline" onClick={() => { setDeclineModal(activeOrder._id); setDeclineReason(''); }}>
                      Decline
                    </button>
                  </>
                )}
                {activeOrder.status === 'accepted' && (
                  <button className="ew-btn-complete" disabled={actionLoading} onClick={() => handleComplete(activeOrder._id)}>
                    {actionLoading ? 'Saving…' : 'Mark Complete'}
                  </button>
                )}
                <button
                  className={`btn-secondary${showAttachments ? ' btn-secondary--active' : ''}`}
                  style={{ fontSize: '.8rem', padding: '.35rem .75rem' }}
                  onClick={() => setShowAttachments((v) => !v)}
                >
                  {showAttachments ? 'Hide Details' : 'Details'}
                </button>
                <button className="co-close-btn" onClick={() => setActiveOrder(null)}>✕</button>
              </div>
            </div>

            {/* Body: main conversation col + optional details side panel */}
            <div className="co-detail-body">
              <div className="co-detail-main">
                {/* Rejection note */}
                {activeOrder.status === 'rejected' && activeOrder.rejectionReason && (
                  <div className="co-rejection">
                    <strong>Decline reason:</strong> {activeOrder.rejectionReason}
                  </div>
                )}

                {/* Conversation */}
                <div className="co-conversation">
              <h3 className="co-conv-title">Conversation</h3>

              {activeOrder.status === 'assigned' ? (
                <p className="co-conv-placeholder">
                  Accept this order to start the conversation with the client.
                </p>
              ) : (
                <>
                  <div className="chat-window co-chat-window">
                    {(!activeOrder.messages || activeOrder.messages.length === 0) && (
                      <p className="chat-empty">No messages yet. Start the conversation!</p>
                    )}
                    {activeOrder.messages?.map((msg) => {
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
                          <span className="chat-time">{fmtTime(msg.createdAt)}</span>
                        </div>
                      );
                    })}
                    <div ref={chatBottomRef} />
                  </div>

                  {activeOrder.status === 'accepted' && (
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
                  {(activeOrder.status === 'completed' || activeOrder.status === 'rejected') && (
                    <p className="chat-closed">This order is closed. The conversation is read-only.</p>
                  )}
                </>
              )}
            </div>
              </div>

              {/* Side: details panel (1/3) */}
              {showAttachments && (
                <div className="co-details-panel">
                  {/* Services */}
                  <div className="co-dp-section">
                    <span className="co-dp-label">Services</span>
                    <div className="co-dp-services-card">
                      {(activeOrder.services || []).map((s) => (
                        <div key={s._id} className="co-dp-service-row">
                          <span className="co-dp-service-name">{s.name}</span>
                          <span className="co-dp-service-price">${s.price?.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="co-dp-total-row">
                        <span>Total</span>
                        <span className="co-dp-total-amount">${activeOrder.totalPrice?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Brief */}
                  {activeOrder.summary && (
                    <div className="co-dp-section">
                      <span className="co-dp-label">Brief</span>
                      <p className="co-dp-brief">{activeOrder.summary}</p>
                    </div>
                  )}

                  {/* Order Info */}
                  <div className="co-dp-section">
                    <span className="co-dp-label">Order Info</span>
                    <div className="co-dp-info-list">
                      <div className="co-dp-info-row">
                        <span className="co-dp-info-key">Order ID</span>
                        <span className="co-dp-info-val">#{activeOrder._id.slice(-6).toUpperCase()}</span>
                      </div>
                      <div className="co-dp-info-row">
                        <span className="co-dp-info-key">Status</span>
                        <span
                          className="co-dp-status-badge"
                          style={{ background: STATUS_COLORS[activeOrder.status] + '22', color: STATUS_COLORS[activeOrder.status] }}
                        >
                          {STATUS_LABEL[activeOrder.status]}
                        </span>
                      </div>
                      <div className="co-dp-info-row">
                        <span className="co-dp-info-key">Client</span>
                        <span className="co-dp-info-val">{activeOrder.clientId?.name || '—'}</span>
                      </div>
                      <div className="co-dp-info-row">
                        <span className="co-dp-info-key">Total</span>
                        <span className="co-dp-info-val co-dp-info-price">${activeOrder.totalPrice?.toFixed(2)}</span>
                      </div>
                      {activeOrder.deliveryDate && (
                        <div className="co-dp-info-row">
                          <span className="co-dp-info-key">Delivery Date</span>
                          <span className="co-dp-info-val">{new Date(activeOrder.deliveryDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="co-dp-info-row">
                        <span className="co-dp-info-key">Placed</span>
                        <span className="co-dp-info-val">{new Date(activeOrder.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="co-empty-detail">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            <p>Select an order to view details</p>
          </div>
        )}
      </div>

      {/* Accept Modal */}
      {acceptModal && (
        <div className="modal-overlay" onClick={() => setAcceptModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Accept Order</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Set an estimated delivery date to confirm acceptance.</p>
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
              <button className="btn-secondary" onClick={() => setAcceptModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleAccept} disabled={actionLoading}>
                {actionLoading ? 'Accepting…' : 'Confirm & Accept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {declineModal && (
        <div className="modal-overlay" onClick={() => setDeclineModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Decline Order</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Optionally provide a reason for declining.</p>
            <label className="form-label">Reason (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. I'm fully booked this week"
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeclineModal(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDecline} disabled={actionLoading}>
                {actionLoading ? 'Declining…' : 'Decline Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
