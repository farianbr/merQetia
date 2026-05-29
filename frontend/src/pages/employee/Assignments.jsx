import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyAssignments, acceptOrder, rejectOrder, completeOrder, sendMessage } from '../../api/orders';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';
import OrderTimeline from '../../components/OrderTimeline';
import { LuClipboard, LuFile, LuPaperclip, LuImage } from 'react-icons/lu';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const isToday = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ┬╖ ' + time;
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
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeOrder?.messages?.length]);

  useEffect(() => {
    if (activeOrder) chatBottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [activeOrder?._id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        {/* ΓöÇΓöÇ Left: order list ΓöÇΓöÇ */}
        <div className="co-list">
          {orders.length === 0 && (
            <p className="co-empty">No orders yet.</p>
          )}
          {orders.map((o) => {
            const isActive = activeOrder?._id === o._id;
            const serviceNames = (o.services || []).map((s) => s.name).join(', ') || 'ΓÇö';
            return (
              <button
                key={o._id}
                className={`co-item ${isActive ? 'co-item--active' : ''}`}
                onClick={() => { setActiveOrder(o); setMsgText(''); setAttachFiles([]); setError(''); }}
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
                  <span>{o.clientId?.name || 'ΓÇö'}</span>
                  <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ΓöÇΓöÇ Right: detail + conversation ΓöÇΓöÇ */}
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
                    {actionLoading ? 'SavingΓÇª' : 'Mark Complete'}
                  </button>
                )}
                <button
                  className="btn-secondary"
                  style={{ fontSize: '.8rem', padding: '.35rem .75rem' }}
                  onClick={() => navigate(`/employee/orders/${activeOrder._id}`)}
                >
                  Full View ΓåÆ
                </button>
                <button className="co-close-btn" onClick={() => setActiveOrder(null)}>Γ£ò</button>
              </div>
            </div>

            {/* Meta rows */}
            <div className="co-meta-grid">
              <div className="co-meta-item">
                <span className="co-meta-label">Services</span>
                <span className="co-meta-value">{(activeOrder.services || []).map((s) => s.name).join(', ') || 'ΓÇö'}</span>
              </div>
              <div className="co-meta-item">
                <span className="co-meta-label">Total</span>
                <span className="co-meta-value co-meta-price">${activeOrder.totalPrice?.toFixed(2)}</span>
              </div>
              <div className="co-meta-item">
                <span className="co-meta-label">Client</span>
                <span className="co-meta-value">{activeOrder.clientId?.name || 'ΓÇö'}</span>
              </div>
              <div className="co-meta-item">
                <span className="co-meta-label">Delivery</span>
                <span className="co-meta-value">
                  {activeOrder.deliveryDate ? new Date(activeOrder.deliveryDate).toLocaleDateString() : 'ΓÇö'}
                </span>
              </div>
              <div className="co-meta-item">
                <span className="co-meta-label">Placed</span>
                <span className="co-meta-value">{new Date(activeOrder.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Timeline */}
            <OrderTimeline status={activeOrder.status} />

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
                                <LuFile size={14} />
                              )}
                              <span className="chat-attach-chip-name">{f.name}</span>
                              <button type="button" className="chat-attach-chip-rm" onClick={() => removeAttachFile(i)} aria-label="Remove">├ù</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="chat-input-row">
                        <input
                          type="text"
                          className="input"
                          placeholder="Type a messageΓÇª"
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
                          <LuPaperclip size={18} />
                        </button>
                        <button type="submit" className="btn-primary" disabled={sendingMsg || (!msgText.trim() && attachFiles.length === 0)}>
                          {sendingMsg ? 'ΓÇª' : 'Send'}
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
        ) : (
          <div className="co-empty-detail">
            <LuClipboard size={40} color="currentColor" />
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
                {actionLoading ? 'AcceptingΓÇª' : 'Confirm & Accept'}
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
                {actionLoading ? 'DecliningΓÇª' : 'Decline Order'}
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
