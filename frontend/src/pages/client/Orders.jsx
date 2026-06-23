import { useEffect, useRef, useState } from 'react';
import { getOrders, sendMessage, confirmOrder, requestChanges } from '../../api/orders';
import { useSocket } from '../../context/SocketContext';
import { Link, useLocation } from 'react-router-dom';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';
import { LuClipboard, LuFile, LuPaperclip, LuImage, LuDownload } from 'react-icons/lu';

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
  accepted: '#06b6d4',
  review: '#8b5cf6',
  overdue: '#dc2626',
  rejected: '#ef4444',
  completed: '#10b981',
};

const STATUS_LABEL = {
  placed: 'Placed',
  assigned: 'Assigned',
  accepted: 'In Progress',
  review: 'Needs Your Review',
  overdue: 'Overdue',
  rejected: 'Rejected',
  completed: 'Completed',
};

function getDisplayStatus(order) {
  if (order.status === 'accepted' && order.deliveryDate && new Date(order.deliveryDate) < new Date()) {
    return 'overdue';
  }
  return order.status;
}


export default function ClientOrders() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [msgText, setMsgText] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [mediaModal, setMediaModal] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [changesModal, setChangesModal] = useState(false);
  const [changesNote, setChangesNote] = useState('');
  const chatBottomRef = useRef(null);
  const activeOrderRef = useRef(null);
  const fileInputRef = useRef(null);
  const socket = useSocket();
  activeOrderRef.current = activeOrder;

  const fetchOrders = async (selectId) => {
    const r = await getOrders();
    const list = r.data.orders || r.data;
    setOrders(list);
    if (selectId) {
      const target = list.find((o) => o._id === selectId);
      if (target) setActiveOrder(target);
    } else if (activeOrderRef.current) {
      const updated = list.find((o) => o._id === activeOrderRef.current._id);
      if (updated) setActiveOrder(updated);
    }
  };

  const newOrderId = location.state?.newOrderId;
  const selectOrderId = location.state?.selectOrderId;
  useEffect(() => {
    fetchOrders(newOrderId || selectOrderId);
  }, [newOrderId, selectOrderId]);

  // Live order updates (status changes, new messages) — patch state in place
  useEffect(() => {
    if (!socket) return;
    const upsert = ({ order }) => {
      if (!order?._id) return;
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o._id === order._id);
        if (idx === -1) return [order, ...prev];
        const next = [...prev];
        next[idx] = order;
        return next;
      });
      setActiveOrder((cur) => (cur && cur._id === order._id ? order : cur));
    };
    socket.on('order:updated', upsert);
    socket.on('order:created', upsert);
    return () => {
      socket.off('order:updated', upsert);
      socket.off('order:created', upsert);
    };
  }, [socket]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeOrder?.messages?.length]);

  // Scroll to bottom immediately when a different order is selected
  useEffect(() => {
    if (activeOrder) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [activeOrder?._id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const applyOrder = (updated) => {
    setActiveOrder(updated);
    setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
  };

  const handleConfirm = async () => {
    if (!activeOrder) return;
    setReviewLoading(true);
    setError('');
    try {
      const r = await confirmOrder(activeOrder._id);
      applyOrder(r.data.order);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to confirm order');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!activeOrder || !changesNote.trim()) return;
    setReviewLoading(true);
    setError('');
    try {
      const r = await requestChanges(activeOrder._id, changesNote.trim());
      applyOrder(r.data.order);
      setChangesModal(false);
      setChangesNote('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request changes');
    } finally {
      setReviewLoading(false);
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
        {/* ── Left: order list ── */}
        <div className="co-list">
          {orders.length === 0 && (
            <p className="co-empty">No orders yet. <Link to="/services">Browse services →</Link></p>
          )}
          {orders.map((o) => {
            const isActive = activeOrder?._id === o._id;
            const serviceNames = (o.services || []).map((s) => s.name).join(', ') || '—';
            return (
              <button
                key={o._id}
                className={`co-item ${isActive ? 'co-item--active' : ''}`}
                onClick={() => { setActiveOrder(o); setMsgText(''); setAttachFiles([]); setError(''); }}
              >
                <div className="co-item-top">
                  <span className="co-item-services">{serviceNames}</span>
                </div>
                <p className="co-item-id">#{o._id.slice(-6).toUpperCase()}</p>
                <div className="co-item-meta">
                  <span
                    className="co-item-status"
                    style={{ background: STATUS_COLORS[getDisplayStatus(o)] + '22', color: STATUS_COLORS[getDisplayStatus(o)] }}
                  >
                    {STATUS_LABEL[getDisplayStatus(o)]}
                  </span>
                  <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Right: detail + conversation ── */}
        {activeOrder ? (
          <div className="co-detail">
            {/* Header + Meta — unified card */}
            <div className="co-detail-header co-detail-header--shaded">
              <div className="co-detail-header-row">
                <div>
                  <h2 className="co-detail-id">Order #{activeOrder._id.slice(-6).toUpperCase()}</h2>
                  <span
                    className="co-detail-status"
                    style={{ background: STATUS_COLORS[getDisplayStatus(activeOrder)] + '22', color: STATUS_COLORS[getDisplayStatus(activeOrder)] }}
                  >
                    {STATUS_LABEL[getDisplayStatus(activeOrder)]}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                  <button className="co-dp-media-btn co-dp-media-btn--sm" onClick={() => setMediaModal(true)}>
                    <LuImage size={14} />
                    View All Media
                  </button>
                  <button className="co-close-btn" onClick={() => setActiveOrder(null)}>✕</button>
                </div>
              </div>
              <div className="co-meta-grid co-meta-grid--incard">
                <div className="co-meta-item">
                  <span className="co-meta-label">Services</span>
                  <span className="co-meta-value">{(activeOrder.services || []).map((s) => s.name).join(', ') || '—'}</span>
                </div>
                <div className="co-meta-item">
                  <span className="co-meta-label">Total</span>
                  <span className="co-meta-value co-meta-price">${activeOrder.totalPrice?.toFixed(2)}</span>
                </div>
                <div className="co-meta-item">
                  <span className="co-meta-label">Employee</span>
                  <span className="co-meta-value">{activeOrder.assignedEmployee?.name || '—'}</span>
                </div>
                <div className="co-meta-item">
                  <span className="co-meta-label">Delivery</span>
                  <span className="co-meta-value">
                    {activeOrder.deliveryDate ? new Date(activeOrder.deliveryDate).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div className="co-meta-item">
                  <span className="co-meta-label">Placed</span>
                  <span className="co-meta-value">{new Date(activeOrder.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Rejection note */}
            {activeOrder.status === 'rejected' && activeOrder.rejectionReason && (
              <div className="co-rejection">
                <strong>Rejection reason:</strong> {activeOrder.rejectionReason}
              </div>
            )}

            {/* Review action panel — client confirmation needed to complete */}
            {activeOrder.status === 'review' && (
              <div className="co-review-panel">
                <div className="co-review-text">
                  <strong>Your work is ready for review.</strong>
                  <span>Please confirm the order is complete, or request changes if something needs adjusting.</span>
                </div>
                <div className="co-review-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => { setChangesNote(''); setChangesModal(true); }}
                    disabled={reviewLoading}
                  >
                    Request Changes
                  </button>
                  <button className="btn-primary" onClick={handleConfirm} disabled={reviewLoading}>
                    {reviewLoading ? 'Confirming…' : 'Confirm & Complete'}
                  </button>
                </div>
              </div>
            )}

            {/* Conversation */}
            <div className="co-conversation">
              <h3 className="co-conv-title">Conversation</h3>

              {(activeOrder.status === 'placed' || activeOrder.status === 'assigned') ? (
                <p className="co-conv-placeholder">
                  Conversation opens once your order is accepted by an employee.
                </p>
              ) : (
                <>
                  <div className="chat-window co-chat-window">
                    {(!activeOrder.messages || activeOrder.messages.length === 0) && (
                      <p className="chat-empty">No messages yet. Say hello!</p>
                    )}
                    {activeOrder.messages?.map((msg) => {
                      const isMine = msg.senderRole === 'client';
                      return (
                        <div
                          key={msg._id}
                          className={`chat-bubble ${isMine ? 'chat-bubble--mine' : 'chat-bubble--theirs'}`}
                        >
                          <span className="chat-sender">{isMine ? 'You' : msg.sender?.name || 'Employee'}</span>
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

                  {(activeOrder.status === 'accepted' || activeOrder.status === 'review') && (
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
                          <LuPaperclip size={18} />
                        </button>
                        <button type="submit" className="btn-primary" disabled={sendingMsg || (!msgText.trim() && attachFiles.length === 0)}>
                          {sendingMsg ? '…' : 'Send'}
                        </button>
                      </div>
                    </form>
                  )}
                  {activeOrder.status === 'completed' && (
                    <p className="chat-closed">This order is completed. The conversation is read-only.</p>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="co-empty-detail">
            <LuClipboard size={40} />
            <p>Select an order to view details</p>
          </div>
        )}
      </div>

      {changesModal && (
        <div className="modal-overlay" onClick={() => setChangesModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Request Changes</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>
              Describe what needs to change. The order goes back to the employee to revise.
            </p>
            <label className="form-label">What needs changing?</label>
            <textarea
              className="input"
              rows={4}
              value={changesNote}
              onChange={(e) => setChangesNote(e.target.value)}
              placeholder="e.g. Please adjust the colors on the logo and resend the source files"
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setChangesModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleRequestChanges} disabled={reviewLoading || !changesNote.trim()}>
                {reviewLoading ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <ImageLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}

      {mediaModal && (() => {
        const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');
        const allAttachments = (activeOrder?.messages || []).flatMap((msg) => msg.attachments || []);
        const images = allAttachments.filter((a) => a.mimetype?.startsWith('image/'));
        const files  = allAttachments.filter((a) => !a.mimetype?.startsWith('image/'));
        return (
          <div className="modal-overlay" onClick={() => setMediaModal(false)}>
            <div className="modal modal--media" onClick={(e) => e.stopPropagation()}>
              <div className="modal-media-header">
                <h2>Shared Media &amp; Files</h2>
                <button className="co-close-btn" onClick={() => setMediaModal(false)}>✕</button>
              </div>
              {allAttachments.length === 0 ? (
                <p className="modal-media-empty">No files shared in this conversation yet.</p>
              ) : (
                <>
                  {images.length > 0 && (
                    <>
                      <p className="modal-media-section-label">Images</p>
                      <div className="media-grid">
                        {images.map((att, i) => {
                          const src = `${BASE}${att.url}`;
                          return (
                            <button
                              key={i}
                              className="media-grid-item"
                              onClick={() => { setMediaModal(false); setLightbox({ src, name: att.originalName }); }}
                            >
                              <img src={src} alt={att.originalName} />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {files.length > 0 && (
                    <>
                      <p className="modal-media-section-label">Files</p>
                      <div className="media-file-list">
                        {files.map((att, i) => (
                          <a
                            key={i}
                            href={`${BASE}${att.url}`}
                            download={att.originalName}
                            target="_blank"
                            rel="noreferrer"
                            className="media-file-row"
                          >
                            <LuFile size={15} />
                            <span className="media-file-name">{att.originalName}</span>
                            <LuDownload className="media-file-dl" size={13} />
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
