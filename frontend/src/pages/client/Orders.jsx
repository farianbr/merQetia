import { useEffect, useRef, useState } from 'react';
import { getOrders, sendMessage } from '../../api/orders';
import { Link, useLocation } from 'react-router-dom';
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
  assigned: 'Assigned',
  accepted: 'In Progress',
  rejected: 'Rejected',
  completed: 'Completed',
};


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
  const chatBottomRef = useRef(null);
  const activeOrderRef = useRef(null);
  const fileInputRef = useRef(null);
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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeOrder?.messages?.length]);

  // Scroll to bottom immediately when a different order is selected
  useEffect(() => {
    if (activeOrder) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [activeOrder?._id]);

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
                  <span>${o.totalPrice?.toFixed(2)}</span>
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
                    style={{ background: STATUS_COLORS[activeOrder.status] + '22', color: STATUS_COLORS[activeOrder.status] }}
                  >
                    {STATUS_LABEL[activeOrder.status]}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                  <button className="co-dp-media-btn co-dp-media-btn--sm" onClick={() => setMediaModal(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
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
                  {activeOrder.status === 'completed' && (
                    <p className="chat-closed">This order is completed. The conversation is read-only.</p>
                  )}
                </>
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
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span className="media-file-name">{att.originalName}</span>
                            <svg className="media-file-dl" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
