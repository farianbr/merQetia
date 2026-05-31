import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getEmployees } from '../../api/admin';
import { assignEmployee as assignEmployeeApi, getOrders, sendUpdate } from '../../api/orders';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';
import {
  LuChevronDown, LuFile, LuMessageSquare, LuPaperclip,
  LuSlidersHorizontal, LuX,
} from 'react-icons/lu';

const STATUS_CONFIG = {
  placed:    { label: 'Not Started', color: '#9ca3af' },
  assigned:  { label: 'Assigned',    color: '#3b82f6' },
  accepted:  { label: 'In Progress', color: '#8b5cf6' },
  overdue:   { label: 'Overdue',     color: '#ef4444' },
  rejected:  { label: 'Rejected',    color: '#ef4444' },
  completed: { label: 'Completed',   color: '#10b981' },
};

const COLUMN_DEFS = [
  { key: 'id',      label: 'Order #',      sortable: true, sortType: 'alpha',  defaultVisible: false },
  { key: 'service', label: 'Service',       sortable: true, sortType: 'alpha',  defaultVisible: true  },
  { key: 'client',  label: 'Client',        sortable: true, sortType: 'alpha',  defaultVisible: true  },
  { key: 'owner',   label: 'Assigned To',   sortable: true, sortType: 'alpha',  defaultVisible: false },
  { key: 'status',  label: 'Status',        sortable: true, sortType: 'status', defaultVisible: true  },
  { key: 'date',    label: 'Delivery Date', sortable: true, sortType: 'date',   defaultVisible: true  },
];

const STATUS_TIMELINE = ['placed', 'assigned', 'accepted', 'overdue', 'completed', 'rejected'];

const GROUPS = [
  { key: 'new',    label: 'New Orders',    color: '#ff8000', statuses: ['placed', 'assigned'] },
  { key: 'active', label: 'Active Orders', color: '#0073ea', statuses: ['accepted'] },
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

function OwnerAvatar({ name }) {
  if (!name) return <span className="mq-owner-empty">Unassigned</span>;
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <span className="mq-owner-avatar" title={name}>{initials}</span>;
}

/* ─── Assign Employee Select ─────────────────────────────────────── */
function AssignSelect({ orderId, employees, onAssign }) {
  const [assigning, setAssigning] = useState(false);
  const handleChange = async (e) => {
    const empId = e.target.value;
    if (!empId) return;
    setAssigning(true);
    try {
      await assignEmployeeApi(orderId, empId);
      onAssign();
    } catch { /* silent */ } finally {
      setAssigning(false);
    }
  };
  return (
    <select className="mq-assign-select" onChange={handleChange} defaultValue="" disabled={assigning}>
      <option value="" disabled>Assign…</option>
      {employees.map((emp) => (
        <option key={emp._id} value={emp._id}>{emp.name}</option>
      ))}
    </select>
  );
}

/* ─── Updates Panel ─────────────────────────────────────────────── */
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
        {/* Header */}
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

        {/* Tabs */}
        <div className="mq-panel-tabs">
          <span className="mq-panel-tab mq-panel-tab--active">
            Updates {order.updates?.length > 0 && <span className="mq-panel-tab-count">{order.updates.length}</span>}
          </span>
        </div>

        {/* Messages */}
        <div className="mq-panel-messages" ref={chatBottomRef}>
          {!canMessage ? (
            <div className="mq-panel-placeholder">
              <LuMessageSquare size={32} color="#d1d5db" />
              <p>Updates are available once the order is accepted.</p>
            </div>
          ) : (!order.updates || order.updates.length === 0) ? (
            <div className="mq-panel-placeholder">
              <LuMessageSquare size={32} color="#d1d5db" />
              <p>No updates yet. Write the first message below.</p>
            </div>
          ) : (
            <div className="mq-panel-chat">
              {order.updates.map((msg) => {
                const senderName = msg.sender?.name || '—';
                const initials = senderName.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                const avatarBg = msg.senderRole === 'admin' ? '#4f46e5' : '#7c3aed';
                return (
                  <div key={msg._id} className="mq-msg">
                    <div className="mq-msg-header">
                      <span className="mq-msg-avatar" style={{ background: avatarBg }}>{initials}</span>
                      <div className="mq-msg-info">
                        <span className="mq-msg-sender">{senderName}</span>
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

        {/* Input */}
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
                    <button type="button" className="chat-attach-chip-rm" onClick={() => setAttachFiles((p) => p.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="mq-panel-input-row">
              <input
                type="text"
                className="mq-panel-input-text"
                placeholder="Write an update…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={sending}
              />
              <input ref={fileInputRef} type="file" multiple accept="image/*,.zip,.pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={handleFileChange} />
              <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()} disabled={sending || attachFiles.length >= 5} title="Attach file">
                <LuPaperclip size={15} />
              </button>
              <button type="submit" className="btn-primary btn-sm" disabled={sending || (!text.trim() && attachFiles.length === 0)}>
                {sending ? '…' : 'Send'}
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

/* ─── Order Group ────────────────────────────────────────────────── */
function OrderGroup({ group, orders, onUpdateClick, activeUpdateId, employees, onAssign, colOrder, visibleCols, sortState, onSort, onColDragStart, onColDrop }) {
  const [collapsed, setCollapsed] = useState(false);
  const [footerTip, setFooterTip] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const footerTipTimer = useRef(null);

  const groupOrders = useMemo(
    () => orders.filter((o) => group.statuses.includes(o.status)),
    [orders, group.statuses],
  );

  const activeCols = useMemo(
    () => colOrder.filter((k) => visibleCols.has(k)),
    [colOrder, visibleCols],
  );

  const getEffectiveStatus = useCallback((o) => {
    if (o.status === 'accepted' && o.deliveryDate) {
      const due = new Date(o.deliveryDate);
      due.setHours(23, 59, 59, 999);
      if (due < new Date()) return 'overdue';
    }
    return o.status;
  }, []);

  const sortedOrders = useMemo(() => {
    const { col, dir } = sortState;
    if (!col) return groupOrders;
    const def = COLUMN_DEFS.find((c) => c.key === col);
    if (!def) return groupOrders;
    return [...groupOrders].sort((a, b) => {
      if (def.sortType === 'alpha') {
        let av = '', bv = '';
        if (col === 'id')      { av = a._id; bv = b._id; }
        else if (col === 'service') { av = (a.services || []).map((s) => s.name).join(', '); bv = (b.services || []).map((s) => s.name).join(', '); }
        else if (col === 'client')  { av = a.clientId?.name || ''; bv = b.clientId?.name || ''; }
        else if (col === 'owner')   { av = a.assignedEmployee?.name || ''; bv = b.assignedEmployee?.name || ''; }
        const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
        return dir === 'asc' ? cmp : -cmp;
      }
      if (def.sortType === 'status') {
        const ai = STATUS_TIMELINE.indexOf(getEffectiveStatus(a));
        const bi = STATUS_TIMELINE.indexOf(getEffectiveStatus(b));
        return dir === 'asc' ? ai - bi : bi - ai;
      }
      if (def.sortType === 'date') {
        const at = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
        const bt = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
        return dir === 'asc' ? at - bt : bt - at;
      }
      return 0;
    });
  }, [groupOrders, sortState, getEffectiveStatus]);

  const statusCounts = useMemo(() => groupOrders.reduce((acc, o) => {
    const st = getEffectiveStatus(o);
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {}), [groupOrders, getEffectiveStatus]);

  const dateRange = useMemo(() => {
    const dates = groupOrders.filter((o) => o.deliveryDate).map((o) => new Date(o.deliveryDate));
    if (!dates.length) return null;
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    return min.getTime() === max.getTime() ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  }, [groupOrders]);

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
                {activeCols.map((colKey) => {
                  const def = COLUMN_DEFS.find((c) => c.key === colKey);
                  if (!def) return null;
                  const isSorted = sortState.col === colKey;
                  return (
                    <th
                      key={colKey}
                      className={`mq-th${isSorted ? ' mq-th--sorted' : ''}${dragOverCol === colKey ? ' mq-th--drag-over' : ''}`}
                      draggable
                      onDragStart={() => onColDragStart(colKey)}
                      onDragOver={(e) => { e.preventDefault(); setDragOverCol(colKey); }}
                      onDragLeave={() => setDragOverCol((c) => (c === colKey ? null : c))}
                      onDrop={() => { onColDrop(colKey); setDragOverCol(null); }}
                      onDragEnd={() => setDragOverCol(null)}
                      onClick={() => def.sortable && onSort(colKey)}
                      title="Click to sort · Drag to reorder"
                    >
                      <span className="mq-th-inner">
                        <span>{def.label}</span>
                        {def.sortable && (
                          <span className="mq-sort-icon">
                            {isSorted ? (sortState.dir === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedOrders.length === 0 ? (
                <tr>
                  <td className="mq-td-marker" style={{ background: group.color }} />
                  <td colSpan={activeCols.length} className="mq-empty-row">No orders in this group</td>
                </tr>
              ) : (
                sortedOrders.map((order) => {
                  const isActive = activeUpdateId === order._id;
                  const msgCount = order.updates?.length || 0;
                  return (
                    <tr key={order._id} className={`mq-row${isActive ? ' mq-row--panel-open' : ''}${!order.assignedEmployee ? ' mq-row--unassigned' : ''}`}>
                      <td className="mq-td-marker" style={{ background: group.color }} />
                      {activeCols.map((colKey) => {
                        switch (colKey) {
                          case 'id': return (
                            <td key={colKey} className="mq-td-id">#{order._id.slice(-6).toUpperCase()}</td>
                          );
                          case 'service': return (
                            <td key={colKey} className="mq-td-task">
                              <div className="mq-task-name-row">
                                <Link to={`/admin/orders/${order._id}`} className="mq-order-link">
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
                          );
                          case 'client': return (
                            <td key={colKey} className="mq-td">{order.clientId?.name || '—'}</td>
                          );
                          case 'owner': return (
                            <td key={colKey} className="mq-td mq-td-owner">
                              {order.assignedEmployee
                                ? <OwnerAvatar name={order.assignedEmployee.name} />
                                : <AssignSelect orderId={order._id} employees={employees} onAssign={onAssign} />}
                            </td>
                          );
                          case 'status': return (
                            <td key={colKey} className="mq-td-status">
                              <StatusPill status={order.status} deliveryDate={order.deliveryDate} />
                            </td>
                          );
                          case 'date': return (
                            <td key={colKey} className="mq-td mq-td-date">
                              {order.deliveryDate
                                ? new Date(order.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '—'}
                            </td>
                          );
                          default: return <td key={colKey} />;
                        }
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="mq-footer-row">
                <td className="mq-td-marker" style={{ background: group.color }} />
                {activeCols.map((colKey) => {
                  if (colKey === 'status') return (
                    <td key={colKey} className="mq-footer-status-cell">
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
                  );
                  if (colKey === 'date') return (
                    <td key={colKey} className="mq-footer-date-cell">
                      {dateRange && <span className="mq-footer-daterange">{dateRange}</span>}
                    </td>
                  );
                  return <td key={colKey} className="mq-footer-empty" />;
                })}
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

/* ─── Main Dashboard ─────────────────────────────────────────────── */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [panelOrder, setPanelOrder] = useState(null);
  const pendingOpenRef = useRef(null);

  // Column config
  const [colOrder, setColOrder] = useState(() => COLUMN_DEFS.map((c) => c.key));
  const [visibleCols, setVisibleCols] = useState(
    () => new Set(COLUMN_DEFS.filter((c) => c.defaultVisible).map((c) => c.key)),
  );
  const [sortState, setSortState] = useState({ col: null, dir: 'asc' });
  const [showColPicker, setShowColPicker] = useState(false);
  const dragColRef = useRef(null);
  const colPickerRef = useRef(null);

  const handleSort = useCallback((colKey) => {
    setSortState((prev) => ({
      col: colKey,
      dir: prev.col === colKey && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleColDragStart = useCallback((colKey) => {
    dragColRef.current = colKey;
  }, []);

  const handleColDrop = useCallback((targetKey) => {
    const from = dragColRef.current;
    if (!from || from === targetKey) return;
    setColOrder((prev) => {
      const arr = [...prev];
      const fi = arr.indexOf(from);
      const ti = arr.indexOf(targetKey);
      if (fi === -1 || ti === -1) return prev;
      arr.splice(fi, 1);
      arr.splice(ti, 0, from);
      return arr;
    });
    dragColRef.current = null;
  }, []);

  const toggleCol = useCallback((key) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Close picker on outside click
  useEffect(() => {
    if (!showColPicker) return;
    const handler = (e) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target)) {
        setShowColPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColPicker]);

  const fetchOrders = () =>
    getOrders({ limit: 200 }).then((r) => {
      const list = r.data.orders || [];
      setOrders(list);
      setPanelOrder((prev) => {
        if (!prev) {
          const targetId = pendingOpenRef.current;
          if (targetId) {
            const found = list.find((o) => String(o._id) === targetId);
            if (found) { pendingOpenRef.current = null; return found; }
          }
          return null;
        }
        return list.find((o) => o._id === prev._id) || null;
      });
    }).catch(() => {});

  // Handle ?openUpdate=<id> query param from notification redirect
  const openUpdateId = searchParams.get('openUpdate');
  useEffect(() => {
    if (!openUpdateId) return;
    // Clear the param from the URL immediately
    navigate('/admin', { replace: true });
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

  useEffect(() => {
    fetchOrders();
    getEmployees().then((r) => setEmployees(r.data.employees || [])).catch(() => {});
  }, []);

  const handleUpdateClick = (order) => {
    setPanelOrder((prev) => (prev?._id === order._id ? null : order));
  };

  const handleMessagesUpdate = (orderId, updates) => {
    setOrders((prev) => prev.map((o) => o._id === orderId ? { ...o, updates } : o));
    setPanelOrder((prev) => prev?._id === orderId ? { ...prev, updates } : prev);
  };

  const handleAssign = () => fetchOrders();

  return (
    <div className={`page mq-page${panelOrder ? ' mq-page--panel-open' : ''}`}>
      <div className="mq-main">
        <div className="section-header">
          <div>
            <h1>Dashboard</h1>
            <p className="subtitle">Overview of client orders.</p>
          </div>
          <div className="mq-col-picker-wrap" ref={colPickerRef}>
            <button className="mq-col-picker-btn" onClick={() => setShowColPicker((p) => !p)}>
              <LuSlidersHorizontal size={14} />
              Columns
            </button>
            {showColPicker && (
              <div className="mq-col-picker-dropdown">
                {COLUMN_DEFS.map((col) => (
                  <label key={col.key} className="mq-col-picker-row">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.key)}
                      onChange={() => toggleCol(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mq-board">
          {GROUPS.map((group) => (
            <OrderGroup
              key={group.key}
              group={group}
              orders={orders}
              onUpdateClick={handleUpdateClick}
              activeUpdateId={panelOrder?._id}
              employees={employees}
              onAssign={handleAssign}
              colOrder={colOrder}
              visibleCols={visibleCols}
              sortState={sortState}
              onSort={handleSort}
              onColDragStart={handleColDragStart}
              onColDrop={handleColDrop}
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
