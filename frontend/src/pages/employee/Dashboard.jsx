import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getMyAssignments, sendUpdate } from '../../api/orders';
import { useAuth } from '../../context/AuthContext';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';
import {
  LuMessageSquare, LuFile, LuPaperclip,
  LuChevronDown, LuX,
} from 'react-icons/lu';

const STATUS_CONFIG = {
  assigned:  { label: 'New Request', color: '#3b82f6' },
  accepted:  { label: 'In Progress', color: '#8b5cf6' },
  overdue:   { label: 'Overdue',     color: '#ef4444' },
  rejected:  { label: 'Declined',    color: '#ef4444' },
  completed: { label: 'Completed',   color: '#10b981' },
};

const EMP_GROUPS = [
  { key: 'active',    label: 'Active',    color: '#0073ea', statuses: ['assigned', 'accepted'] },
  { key: 'completed', label: 'Completed', color: '#00c875', statuses: ['completed'] },
  { key: 'rejected',  label: 'Declined',  color: '#e2445c', statuses: ['rejected'] },
];

function fmtTimeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtTimeFull(iso) {
  const d = new Date(iso);
  const isToday = d.toDateString() === new Date().toDateString();
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isToday ? `Today at ${t}` : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + t;
}

function StatusPill({ status, deliveryDate }) {
  let cfg = STATUS_CONFIG[status] || { label: status, color: '#9ca3af' };
  if (status === 'accepted' && deliveryDate) {
    const due = new Date(deliveryDate);
    due.setHours(23, 59, 59, 999);
    if (due < new Date()) cfg = { label: 'Overdue', color: '#ef4444' };
  }
  return <span className="mq-status-pill" style={{ background: cfg.color }}>{cfg.label}</span>;
}

/* --- Updates Panel ----------------------------------------------- */
function UpdatesPanel({ order, onClose, onMessagesUpdate }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachFiles, setAttachFiles] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [timeTip, setTimeTip] = useState(null);
  const timeTipTimer = useRef(null);
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [order?._id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [order?.messages?.length]);

  const canMessage = order.status === 'accepted' || order.status === 'completed';

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() && attachFiles.length === 0) return;
    setSending(true);
    try {
      const r = await sendUpdate(order._id, text.trim(), attachFiles);
      setText('');
      setAttachFiles([]);
      onMessagesUpdate(order._id, r.data.updates);
    } catch { /* silent */ } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files);
    setAttachFiles((prev) => [...prev, ...picked].slice(0, 5));
    e.target.value = '';
  };

  const serviceName = (order.services || []).map((s) => s.name).join(', ') || 'Order';

  return (
    <>
      <div className="mq-panel-overlay" onClick={onClose} />
      <div className="mq-updates-panel">
        <div className="mq-panel-header">
          <span className="mq-panel-title">{serviceName}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: 'transparent', border: 'none', padding: 0, color: '#6b7280', cursor: 'pointer', flexShrink: 0, transition: 'background .12s, color .12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}
          ><LuX size={16} /></button>
        </div>

        <div className="mq-panel-tabs">
          <span className="mq-panel-tab mq-panel-tab--active">
            Updates {order.updates?.length > 0 && <span className="mq-panel-tab-count">{order.updates.length}</span>}
          </span>
        </div>

        <div className="mq-panel-messages">
          {!canMessage ? (
            <div className="mq-panel-placeholder">
              <LuMessageSquare size={32} color="#d1d5db" />
              <p>Accept this order to start the conversation.</p>
            </div>
          ) : (!order.updates || order.updates.length === 0) ? (
            <div className="mq-panel-placeholder">
              <LuMessageSquare size={32} color="#d1d5db" />
              <p>No updates yet. Write the first message below.</p>
            </div>
          ) : (
            <div className="mq-panel-chat">
              {order.updates.map((msg) => {
                const isMine = msg.senderRole === 'employee';
                const senderName = msg.sender?.name || (isMine ? 'You' : '—');
                const initials = senderName.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'Y';
                const avatarBg = msg.senderRole === 'admin' ? '#4f46e5' : '#7c3aed';
                return (
                  <div key={msg._id} className="mq-msg">
                    <div className="mq-msg-header">
                      <span className="mq-msg-avatar" style={{ background: avatarBg }}>{initials}</span>
                      <div className="mq-msg-info">
                        <span className="mq-msg-sender">{isMine ? 'You' : senderName}</span>
                        <span
                          className="mq-msg-time"
                          onMouseEnter={(e) => { clearTimeout(timeTipTimer.current); const r = e.currentTarget.getBoundingClientRect(); setTimeTip({ text: fmtTimeFull(msg.createdAt), x: r.left + r.width / 2, y: r.top, out: false }); }}
                          onMouseLeave={() => { setTimeTip((t) => t ? { ...t, out: true } : null); timeTipTimer.current = setTimeout(() => setTimeTip(null), 150); }}
                        >{fmtTimeAgo(msg.createdAt)}</span>
                      </div>
                    </div>
                    <div className="mq-msg-body">
                      {msg.text && <p className="mq-msg-text">{msg.text}</p>}
                      <ChatAttachments attachments={msg.attachments} onImageClick={(src, name) => setLightbox({ src, name })} />
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>
          )}
        </div>

        {canMessage && (
          <form className="mq-panel-input" onSubmit={handleSend}>
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
                    <button type="button" className="chat-attach-chip-rm" onClick={() => setAttachFiles((p) => p.filter((_, j) => j !== i))}>�</button>
                  </div>
                ))}
              </div>
            )}
            <div className="mq-panel-input-row">
              <input
                type="text"
                className="mq-panel-input-text"
                placeholder="Write an update"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={sending}
              />
              <input ref={fileInputRef} type="file" multiple accept="image/*,.zip,.pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={handleFileChange} />
              <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()} disabled={sending || attachFiles.length >= 5} title="Attach file">
                <LuPaperclip size={15} />
              </button>
              <button type="submit" className="btn-primary btn-sm" disabled={sending || (!text.trim() && attachFiles.length === 0)}>
                {sending ? 'sending...' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
      {lightbox && <ImageLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />}
      {timeTip && (
        <div className={`mq-footer-tip mq-tip${timeTip.out ? ' mq-tip--out' : ' mq-tip--in'}`} style={{ position: 'fixed', left: timeTip.x, top: timeTip.y - 8, pointerEvents: 'none', zIndex: 9999 }}>
          {timeTip.text}
        </div>
      )}
    </>
  );
}

/* --- Order Group -------------------------------------------------- */
function EmpOrderGroup({ group, orders, onUpdateClick, activeUpdateId }) {
  const [collapsed, setCollapsed] = useState(group.key !== 'active');
  const [footerTip, setFooterTip] = useState(null);
  const footerTipTimer = useRef(null);
  const groupOrders = orders.filter((o) => group.statuses.includes(o.status));

  const statusCounts = groupOrders.reduce((acc, o) => {
    const st = (() => {
      if (o.status === 'accepted' && o.deliveryDate) {
        const due = new Date(o.deliveryDate);
        due.setHours(23, 59, 59, 999);
        if (due < new Date()) return 'overdue';
      }
      return o.status;
    })();
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  const dateRange = (() => {
    const dates = groupOrders.filter((o) => o.deliveryDate).map((o) => new Date(o.deliveryDate));
    if (!dates.length) return null;
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    return min.getTime() === max.getTime() ? fmt(min) : `${fmt(min)} � ${fmt(max)}`;
  })();

  return (
    <div className="mq-group">
      <div className="mq-group-header" onClick={() => setCollapsed((c) => !c)}>
        <LuChevronDown
          size={14}
          style={{ color: group.color, transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .18s', flexShrink: 0 }}
        />
        <span className="mq-group-name" style={{ color: group.color }}>{group.label}</span>
        <span className="mq-group-count">{groupOrders.length}</span>
      </div>

      {!collapsed && (
        <div className="mq-group-body">
          <table className="mq-table">
            <thead>
              <tr>
                <th className="mq-th-marker" style={{ background: group.color }} />
                <th className="mq-th-id">Order #</th>
                <th className="mq-th-task">Service</th>
                <th className="mq-th-client">Client</th>
                <th className="mq-th-status">Status</th>
                <th className="mq-th-date">Delivery Date</th>
              </tr>
            </thead>
            <tbody>
              {groupOrders.length === 0 ? (
                <tr>
                  <td className="mq-td-marker" style={{ background: group.color }} />
                  <td colSpan={5} className="mq-empty-row">No orders in this group</td>
                </tr>
              ) : (
                groupOrders.map((order) => {
                  const isActive = activeUpdateId === order._id;
                  const msgCount = order.updates?.length || 0;
                  return (
                    <tr key={order._id} className={`mq-row${isActive ? ' mq-row--panel-open' : ''}`}>
                      <td className="mq-td-marker" style={{ background: group.color }} />
                      <td className="mq-td-id">#{order._id.slice(-6).toUpperCase()}</td>
                      <td className="mq-td-task">
                        <div className="mq-task-name-row">
                          <Link to="/employee/orders" state={{ orderId: order._id }} className="mq-order-link">
                            {order.services?.map((s) => s.name).join(', ') || '—'}
                          </Link>
                          <button
                            className={`mq-updates-btn${isActive ? ' mq-updates-btn--active' : ''}`}
                            onClick={() => onUpdateClick(order)}
                            title={`${msgCount} update${msgCount !== 1 ? 's' : ''}`}
                          >
                            <LuMessageSquare size={13} />
                            {msgCount > 0 && <span className="mq-updates-count">{msgCount}</span>}
                          </button>
                        </div>
                      </td>
                      <td className="mq-td">{order.clientId?.name || '—'}</td>
                      <td className="mq-td-status"><StatusPill status={order.status} deliveryDate={order.deliveryDate} /></td>
                      <td className="mq-td mq-td-date">
                        {order.deliveryDate
                          ? new Date(order.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="mq-footer-row">
                <td className="mq-td-marker" style={{ background: group.color }} />
                <td className="mq-footer-empty" />
                <td className="mq-footer-empty" />
                <td className="mq-footer-empty" />
                <td className="mq-footer-status-cell">
                  <div className="mq-footer-bar" onMouseLeave={() => { setFooterTip((t) => t ? { ...t, out: true } : null); footerTipTimer.current = setTimeout(() => setFooterTip(null), 150); }}>
                    {Object.entries(statusCounts).map(([st, count]) => {
                      const cfg = STATUS_CONFIG[st] || { label: st, color: '#9ca3af' };
                      const total = groupOrders.length;
                      return (
                        <div
                          key={st}
                          className="mq-footer-seg"
                          style={{ background: cfg.color, flex: count }}
                          onMouseEnter={(e) => { clearTimeout(footerTipTimer.current); const r = e.currentTarget.getBoundingClientRect(); setFooterTip({ label: cfg.label, count, total, pct: Math.round((count / total) * 100), x: r.left + r.width / 2, y: r.top, out: false }); }}
                        />
                      );
                    })}
                  </div>
                </td>
                <td className="mq-footer-date-cell">
                  {dateRange && <span className="mq-footer-daterange">{dateRange}</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {footerTip && (
        <div
          className={`mq-footer-tip mq-tip${footerTip.out ? ' mq-tip--out' : ' mq-tip--in'}`}
          style={{ position: 'fixed', left: footerTip.x, top: footerTip.y - 8, pointerEvents: 'none', zIndex: 9999 }}
        >
          <span>{footerTip.label}</span>
          <span>{footerTip.count}/{footerTip.total}</span>
          <span className="mq-footer-tip-pct">{footerTip.pct}%</span>
        </div>
      )}
    </div>
  );
}

/* --- Main Employee Dashboard -------------------------------------- */
export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [panelOrder, setPanelOrder] = useState(null);
  const pendingOpenRef = useRef(null);

  useEffect(() => {
    getMyAssignments()
      .then((r) => {
        const list = r.data.orders || r.data;
        setOrders(list);
        const targetId = pendingOpenRef.current;
        if (targetId) {
          const found = list.find((o) => String(o._id) === targetId);
          if (found) { pendingOpenRef.current = null; setPanelOrder(found); }
        }
      })
      .catch(() => {});
  }, []);

  // Handle ?openUpdate=<id> query param from notification redirect
  const openUpdateId = searchParams.get('openUpdate');
  useEffect(() => {
    if (!openUpdateId) return;
    // Clear the param from the URL immediately
    navigate('/employee', { replace: true });
    pendingOpenRef.current = openUpdateId;
    // If orders already loaded, open right away
    setOrders((prev) => {
      if (prev.length > 0) {
        const found = prev.find((o) => String(o._id) === openUpdateId);
        if (found) { pendingOpenRef.current = null; setPanelOrder(found); }
      }
      return prev;
    });
  }, [openUpdateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdateClick = (order) => {
    setPanelOrder((prev) => (prev?._id === order._id ? null : order));
  };

  const handleMessagesUpdate = (orderId, updates) => {
    setOrders((prev) => prev.map((o) => o._id === orderId ? { ...o, updates } : o));
    setPanelOrder((prev) => prev?._id === orderId ? { ...prev, updates } : prev);
  };

  return (
    <div className={`page mq-page${panelOrder ? ' mq-page--panel-open' : ''}`}>
      <div className="mq-main">
        <div className="section-header">
          <div>
            <h1>My Work</h1>
            <p className="subtitle">Welcome back, {user?.name?.split(' ')[0]}</p>
          </div>
          <Link to="/employee/orders" className="btn-primary" style={{ textDecoration: 'none', fontSize: '.875rem' }}>
            View All Orders ?
          </Link>
        </div>

        <div className="mq-board">
          {EMP_GROUPS.map((group) => (
            <EmpOrderGroup
              key={group.key}
              group={group}
              orders={orders}
              onUpdateClick={handleUpdateClick}
              activeUpdateId={panelOrder?._id}
            />
          ))}
        </div>
      </div>

      {panelOrder && (
        <UpdatesPanel
          order={panelOrder}
          onClose={() => setPanelOrder(null)}
          onMessagesUpdate={handleMessagesUpdate}
        />
      )}
    </div>
  );
}
