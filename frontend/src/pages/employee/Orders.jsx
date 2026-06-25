import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getMyAssignments, acceptOrder, rejectOrder, submitForReview, sendMessage,
  scheduleOrderMeeting, rescheduleOrderMeeting, cancelOrderMeeting,
} from '../../api/orders';
import { useSocket } from '../../context/SocketContext';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';
import ConversationEvent from '../../components/ConversationEvent';
import MeetingMessage from '../../components/MeetingMessage';
import MeetingScheduleModal from '../../components/MeetingScheduleModal';
import MeetingCancelModal from '../../components/MeetingCancelModal';
import FullscreenButton from '../../components/FullscreenButton';
import { useNow, activeMeeting, canScheduleMeeting, meetingHeaderLabel } from '../../utils/meeting';
import { LuClipboard, LuFile, LuPaperclip, LuImage, LuDownload, LuVideo, LuCalendarDays } from 'react-icons/lu';

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
  accepted: '#33a8d1',
  review: '#8b5cf6',
  overdue: '#dc2626',
  rejected: '#ef4444',
  completed: '#10b981',
};

const STATUS_LABEL = {
  placed: 'Placed',
  assigned: 'New Request',
  accepted: 'In Progress',
  review: 'In Review',
  overdue: 'Overdue',
  rejected: 'Declined',
  completed: 'Completed',
};

function getDisplayStatus(order) {
  if (order.status === 'accepted' && order.deliveryDate && new Date(order.deliveryDate) < new Date()) {
    return 'overdue';
  }
  return order.status;
}

/* Order details (services, brief, info, media) — shared by the inline brief
   shown for new requests and the Details modal. */
function OrderDetailsContent({ order, onViewMedia }) {
  return (
    <>
      {/* Services */}
      <div className="co-dp-section">
        <span className="co-dp-label">Services</span>
        <div className="co-dp-services-card">
          {(order.services || []).map((s) => (
            <div key={s._id} className="co-dp-service-row">
              <span className="co-dp-service-name">{s.name}</span>
              <span className="co-dp-service-price">€{s.price?.toFixed(2)}</span>
            </div>
          ))}
          <div className="co-dp-total-row">
            <span>Total</span>
            <span className="co-dp-total-amount">€{order.totalPrice?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Brief */}
      {order.summary && (
        <div className="co-dp-section">
          <span className="co-dp-label">Brief</span>
          <p className="co-dp-brief">{order.summary}</p>
        </div>
      )}

      {/* Order Info */}
      <div className="co-dp-section">
        <span className="co-dp-label">Order Info</span>
        <div className="co-dp-info-list">
          <div className="co-dp-info-row">
            <span className="co-dp-info-key">Order ID</span>
            <span className="co-dp-info-val">#{order._id.slice(-6).toUpperCase()}</span>
          </div>
          <div className="co-dp-info-row">
            <span className="co-dp-info-key">Status</span>
            <span
              className="co-dp-status-badge"
              style={{ background: STATUS_COLORS[getDisplayStatus(order)] + '22', color: STATUS_COLORS[getDisplayStatus(order)] }}
            >
              {STATUS_LABEL[getDisplayStatus(order)]}
            </span>
          </div>
          <div className="co-dp-info-row">
            <span className="co-dp-info-key">Client</span>
            <span className="co-dp-info-val">{order.clientId?.name || '—'}</span>
          </div>
          <div className="co-dp-info-row">
            <span className="co-dp-info-key">Total</span>
            <span className="co-dp-info-val co-dp-info-price">€{order.totalPrice?.toFixed(2)}</span>
          </div>
          {order.deliveryDate && (
            <div className="co-dp-info-row">
              <span className="co-dp-info-key">Delivery Date</span>
              <span className="co-dp-info-val">{new Date(order.deliveryDate).toLocaleDateString()}</span>
            </div>
          )}
          <div className="co-dp-info-row">
            <span className="co-dp-info-key">Placed</span>
            <span className="co-dp-info-val">{new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* View All Media */}
      <div className="co-dp-section">
        <button className="co-dp-media-btn" onClick={onViewMedia}>
          <LuImage size={15} />
          View All Media
        </button>
      </div>
    </>
  );
}

export default function EmployeeOrders() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [error, setError] = useState('');
  const activeOrderRef = useRef(null);
  activeOrderRef.current = activeOrder;
  const socket = useSocket();

  // Chat
  const [msgText, setMsgText] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const [acceptModal, setAcceptModal] = useState(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [acceptError, setAcceptError] = useState('');

  // Decline modal
  const [declineModal, setDeclineModal] = useState(null);
  const [declineReason, setDeclineReason] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [mediaModal, setMediaModal] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const today = new Date().toISOString().split('T')[0];

  // Meetings
  const [scheduleModal, setScheduleModal] = useState(null); // { meeting } | null
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [fsConvo, setFsConvo] = useState(false);
  const now = useNow();

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

  // Live order updates (new assignments, status changes, new messages)
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
    return () => socket.off('order:updated', upsert);
  }, [socket]);

  // Capture orderId from navigation state — fires every time location.key changes
  // (location.key is unique per navigation, so re-navigating to same orderId re-triggers)
  useEffect(() => {
    if (location.state?.orderId) setPendingOrderId(location.state.orderId);
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply pending orderId once orders are loaded
  useEffect(() => {
    if (!pendingOrderId || orders.length === 0) return;
    const target = orders.find((o) => o._id === pendingOrderId);
    if (target) {
      setActiveOrder(target);
      setShowAttachments(false);
      setPendingOrderId(null);
    }
  }, [pendingOrderId, orders]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeOrder?.messages?.length]);

  useEffect(() => {
    if (activeOrder) chatBottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [activeOrder?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Exit full screen when switching to a different order.
  useEffect(() => { setFsConvo(false); }, [activeOrder?._id]);

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

  const handleSubmitForReview = async (orderId) => {
    setActionLoading(true);
    try {
      await submitForReview(orderId);
      fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit for review');
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

  // Reflect a returned order everywhere it's shown.
  const patchOrder = (order) => {
    if (!order?._id) return;
    setActiveOrder((cur) => (cur && cur._id === order._id ? order : cur));
    setOrders((prev) => prev.map((o) => (o._id === order._id ? order : o)));
  };

  // Schedule / reschedule run through the modal's onSubmit and return the order.
  const submitSchedule = async (payload) => {
    const meeting = scheduleModal?.meeting;
    const r = meeting
      ? await rescheduleOrderMeeting(activeOrder._id, meeting._id, payload)
      : await scheduleOrderMeeting(activeOrder._id, payload);
    return r.data.order;
  };

  const handleCancelMeeting = async () => {
    if (!cancelTarget || !activeOrder) return;
    setCancelling(true);
    try {
      const r = await cancelOrderMeeting(activeOrder._id, cancelTarget._id);
      patchOrder(r.data.order);
      setCancelTarget(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel the meeting');
    } finally {
      setCancelling(false);
    }
  };

  // Conversation thread: messages + meeting events, in chronological order.
  const thread = useMemo(() => {
    if (!activeOrder) return [];
    const items = [
      ...(activeOrder.messages || []).map((m) => ({ ...m, kind: m.kind || 'message', _sort: m.createdAt })),
      ...(activeOrder.meetings || []).map((mt) => ({
        _id: `meeting-${mt._id}`, kind: 'meeting', meeting: mt,
        _sort: mt.bookedAt || mt.scheduledAt || mt.createdAt,
      })),
    ];
    return items.sort((a, b) => new Date(a._sort) - new Date(b._sort));
  }, [activeOrder]);

  const liveMeeting = activeMeeting(activeOrder?.meetings, now);
  const canSchedule = canScheduleMeeting(activeOrder?.meetings, now);
  const convoActive = activeOrder && (activeOrder.status === 'accepted' || activeOrder.status === 'review');

  const newRequests = orders.filter((o) => o.status === 'assigned');
  const otherOrders = orders.filter((o) => o.status !== 'assigned');

  const renderOrderItem = (o) => {
    const isActive = activeOrder?._id === o._id;
    const serviceNames = (o.services || []).map((s) => s.name).join(', ') || '—';
    return (
      <button
        key={o._id}
        className={`co-item ${isActive ? 'co-item--active' : ''} ${o.status === 'assigned' ? 'co-item--new-request' : ''}`}
        onClick={() => { setActiveOrder(o); setMsgText(''); setAttachFiles([]); setError(''); setShowAttachments(false); }}
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
  };

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
          {newRequests.map(renderOrderItem)}
          {newRequests.length > 0 && otherOrders.length > 0 && (
            <div className="co-list-section-bar" />
          )}
          {otherOrders.map(renderOrderItem)}
        </div>

        {/* —— Right: detail + conversation —— */}
        {activeOrder ? (
          <div className="co-detail">
            {/* Header */}
            <div className="co-detail-header co-detail-header--shaded">
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
                  <button className="ew-btn-complete" disabled={actionLoading} onClick={() => handleSubmitForReview(activeOrder._id)}>
                    {actionLoading ? 'Submitting…' : 'Submit for Review'}
                  </button>
                )}
                {activeOrder.status === 'review' && (
                  <span className="co-item-status" style={{ background: STATUS_COLORS.review + '22', color: STATUS_COLORS.review }}>
                    Awaiting client confirmation
                  </span>
                )}
                {convoActive && canSchedule && (
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '.8rem', padding: '.35rem .75rem', display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}
                    onClick={() => setScheduleModal({ meeting: null })}
                  >
                    <LuVideo size={14} /> Schedule meeting
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

            {/* Body: conversation (full width) */}
            <div className="co-detail-body">
              <div className="co-detail-main">
                {/* Rejection note */}
                {activeOrder.status === 'rejected' && activeOrder.rejectionReason && (
                  <div className="co-rejection">
                    <strong>Decline reason:</strong> {activeOrder.rejectionReason}
                  </div>
                )}

                {/* New requests have no conversation yet — surface the brief inline
                    so the employee can review it before accepting. */}
                {activeOrder.status === 'assigned' && (
                  <div className="co-detail-inline-details">
                    <OrderDetailsContent order={activeOrder} onViewMedia={() => setMediaModal(true)} />
                  </div>
                )}

                {/* Conversation */}
                <div className={`co-conversation ${fsConvo ? 'conv-fs' : ''}`}>
              <div className="co-conv-top">
                <h3 className="co-conv-title">Conversation</h3>
                {activeOrder.status !== 'assigned' && <FullscreenButton active={fsConvo} onToggle={setFsConvo} />}
              </div>

              {activeOrder.status === 'assigned' ? (
                <p className="co-conv-placeholder">
                  Accept this order to start the conversation with the client.
                </p>
              ) : (
                <>
                  {liveMeeting && (
                    <div className="cv-head-meeting">
                      <LuVideo size={14} />
                      <span>{meetingHeaderLabel(liveMeeting, now)}</span>
                      {liveMeeting.meetingLink && (
                        <a href={liveMeeting.meetingLink} target="_blank" rel="noreferrer" className="cv-head-join">Join</a>
                      )}
                    </div>
                  )}
                  <div className="chat-window co-chat-window">
                    {thread.length === 0 && (
                      <p className="chat-empty">No messages yet. Start the conversation!</p>
                    )}
                    {thread.map((msg, i) => {
                      if (msg.kind === 'meeting') {
                        return (
                          <MeetingMessage
                            key={msg._id}
                            meeting={msg.meeting}
                            now={now}
                            canManage={convoActive}
                            showCalendarLink
                            onReschedule={() => setScheduleModal({ meeting: msg.meeting })}
                            onCancel={() => setCancelTarget(msg.meeting)}
                            cancelling={cancelling && cancelTarget?._id === msg.meeting._id}
                          />
                        );
                      }
                      if (msg.kind === 'change-request' || msg.kind === 'review-submitted') {
                        return (
                          <ConversationEvent
                            key={msg._id}
                            msg={msg}
                            index={i}
                            messages={activeOrder.messages}
                            orderStatus={activeOrder.status}
                          />
                        );
                      }
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
                  {(activeOrder.status === 'completed' || activeOrder.status === 'rejected') && (
                    <p className="chat-closed">This order is closed. The conversation is read-only.</p>
                  )}
                </>
              )}
            </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="co-empty-detail">
            <LuClipboard size={40} />
            <p>Select an order to view details</p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showAttachments && activeOrder && (
        <div className="modal-overlay" onClick={() => setShowAttachments(false)}>
          <div className="modal modal--details" onClick={(e) => e.stopPropagation()}>
            <div className="modal-media-header">
              <h2>Order Details</h2>
              <button className="co-close-btn" onClick={() => setShowAttachments(false)}>✕</button>
            </div>
            <div className="co-details-modal-body">
              <OrderDetailsContent
                order={activeOrder}
                onViewMedia={() => { setShowAttachments(false); setMediaModal(true); }}
              />
            </div>
          </div>
        </div>
      )}

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

      {scheduleModal && activeOrder && (
        <MeetingScheduleModal
          existing={scheduleModal.meeting}
          inviteeLabel={activeOrder.clientId?.name || 'the client'}
          onSubmit={submitSchedule}
          onScheduled={patchOrder}
          onClose={() => setScheduleModal(null)}
        />
      )}

      {cancelTarget && activeOrder && (
        <MeetingCancelModal
          meeting={cancelTarget}
          cancelling={cancelling}
          onClose={() => setCancelTarget(null)}
          onReschedule={() => { const mt = cancelTarget; setCancelTarget(null); setScheduleModal({ meeting: mt }); }}
          onConfirm={handleCancelMeeting}
        />
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
