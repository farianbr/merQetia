import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getMyAssignments, sendUpdate } from '../../api/orders';
import { saveDashboardPrefs } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';
import {
  LuMessageSquare, LuFile, LuPaperclip,
  LuChevronDown, LuX, LuArrowRight, LuPlus,
} from 'react-icons/lu';

const STATUS_CONFIG = {
  assigned:  { label: 'New Request', color: '#3b82f6' },
  accepted:  { label: 'In Progress', color: '#8b5cf6' },
  overdue:   { label: 'Overdue',     color: '#ef4444' },
  rejected:  { label: 'Declined',    color: '#ef4444' },
  completed: { label: 'Completed',   color: '#10b981' },
};

const EMP_GROUPS = [
  { key: 'new',       label: 'New Requests',  color: '#ff8000', statuses: ['assigned'] },
  { key: 'active',    label: 'Active Orders',  color: '#0073ea', statuses: ['accepted'] },
  { key: 'completed', label: 'Completed',      color: '#00c875', statuses: ['completed'] },
  { key: 'declined',  label: 'Declined',       color: '#e2445c', statuses: ['rejected'] },
];

const COLUMN_DEFS = [
  {
    key: "id",
    label: "Order #",
    sortable: true,
    sortType: "alpha",
    defaultVisible: false,
  },
  {
    key: "service",
    label: "Task",
    sortable: true,
    sortType: "alpha",
    defaultVisible: true,
  },
  {
    key: "update",
    label: "Update",
    sortable: true,
    sortType: "update",
    defaultVisible: true,
  },
  {
    key: "client",
    label: "Client",
    sortable: true,
    sortType: "alpha",
    defaultVisible: true,
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    sortType: "status",
    defaultVisible: true,
  },
  {
    key: "date",
    label: "Due Date",
    sortable: true,
    sortType: "date",
    defaultVisible: true,
  },
];

const DEFAULT_COL_ORDER = COLUMN_DEFS.map((c) => c.key);
const DEFAULT_VISIBLE_COLS = new Set(
  COLUMN_DEFS.filter((c) => c.defaultVisible).map((c) => c.key),
);

const STATUS_TIMELINE = [
  "assigned",
  "accepted",
  "overdue",
  "completed",
  "rejected",
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
  }, [order?.updates?.length]);

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
                    <button type="button" className="chat-attach-chip-rm" onClick={() => setAttachFiles((p) => p.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="mq-panel-input-row">
              <input
                type="text"
                className="field mq-panel-input-text"
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

/* --- Order Group -------------------------------------------------- */
function EmpOrderGroup({
  group,
  orders,
  onUpdateClick,
  activeUpdateId,
  colOrder,
  visibleCols,
  sortState,
  onSort,
  onColDragStart,
  onColDrop,
  onAddColClick,
}) {
  const [collapsed, setCollapsed] = useState(group.key === 'completed' || group.key === 'declined');
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
        let av = '',
          bv = '';
        if (col === 'id') {
          av = a._id;
          bv = b._id;
        } else if (col === 'service') {
          av = (a.services || []).map((s) => s.name).join(', ');
          bv = (b.services || []).map((s) => s.name).join(', ');
        } else if (col === 'client') {
          av = a.clientId?.name || '';
          bv = b.clientId?.name || '';
        }
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
      if (def.sortType === 'update') {
        const ac = a.updates?.length || 0;
        const bc = b.updates?.length || 0;
        return dir === 'asc' ? ac - bc : bc - ac;
      }
      return 0;
    });
  }, [groupOrders, sortState, getEffectiveStatus]);

  const statusCounts = useMemo(
    () =>
      groupOrders.reduce((acc, o) => {
        const st = getEffectiveStatus(o);
        acc[st] = (acc[st] || 0) + 1;
        return acc;
      }, {}),
    [groupOrders, getEffectiveStatus],
  );

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
                      className={`mq-th${isSorted ? ' mq-th--sorted' : ''}${colKey === 'update' ? ' mq-th--update' : ''}${dragOverCol === colKey ? ' mq-th--drag-over' : ''}`}
                      draggable
                      onDragStart={() => onColDragStart(colKey)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverCol(colKey);
                      }}
                      onDragLeave={() => setDragOverCol((c) => (c === colKey ? null : c))}
                      onDrop={() => {
                        onColDrop(colKey);
                        setDragOverCol(null);
                      }}
                      onDragEnd={() => setDragOverCol(null)}
                      onClick={() => def.sortable && onSort(colKey)}
                      title={def.sortable ? 'Click to sort · Drag to reorder' : undefined}
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
                <th className="mq-th-addcol" onClick={onAddColClick} title="Add / hide columns">
                  <LuPlus size={12} />
                </th>
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
                    <tr key={order._id} className={`mq-row${isActive ? ' mq-row--panel-open' : ''}`}>
                      <td className="mq-td-marker" style={{ background: group.color }} />
                      {activeCols.map((colKey) => {
                        switch (colKey) {
                          case 'id':
                            return (
                              <td key={colKey} className="mq-td mq-td-id">
                                #{order._id.slice(-6).toUpperCase()}
                              </td>
                            );
                          case 'service':
                            return (
                              <td key={colKey} className="mq-td-task">
                                <Link to="/employee/orders" state={{ orderId: order._id }} className="mq-order-link">
                                  {order.services?.map((s) => s.name).join(', ') || '—'}
                                </Link>
                              </td>
                            );
                          case 'update':
                            return (
                              <td key={colKey} className="mq-td mq-td-update">
                                <button
                                  className={`mq-update-btn${isActive ? ' mq-update-btn--active' : ''}`}
                                  onClick={() => onUpdateClick(order)}
                                  title={`${msgCount} update${msgCount !== 1 ? 's' : ''}`}
                                >
                                  <LuMessageSquare size={13} />
                                  {msgCount > 0 && <span className="mq-update-count">{msgCount}</span>}
                                </button>
                              </td>
                            );
                          case 'client':
                            return (
                              <td key={colKey} className="mq-td">
                                {order.clientId?.name || '—'}
                              </td>
                            );
                          case 'status':
                            return (
                              <td key={colKey} className="mq-td-status">
                                <StatusPill status={order.status} deliveryDate={order.deliveryDate} />
                              </td>
                            );
                          case 'date':
                            return (
                              <td key={colKey} className="mq-td mq-td-date">
                                {order.deliveryDate
                                  ? new Date(order.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                  : '—'}
                              </td>
                            );
                          default:
                            return <td key={colKey} />;
                        }
                      })}
                      <td className="mq-td-addcol-spacer" />
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="mq-footer-row">
                <td className="mq-td-marker mq-td-marker--footer" />
                {activeCols.map((colKey) => {
                  if (colKey === 'status')
                    return (
                      <td key={colKey} className="mq-footer-status-cell">
                        <div
                          className="mq-footer-bar"
                          onMouseLeave={() => {
                            setFooterTip((t) => t ? { ...t, out: true } : null);
                            footerTipTimer.current = setTimeout(() => setFooterTip(null), 150);
                          }}
                        >
                          {Object.entries(statusCounts).map(([st, count]) => {
                            const cfg = STATUS_CONFIG[st] || { label: st, color: '#9ca3af' };
                            const total = groupOrders.length;
                            return (
                              <div
                                key={st}
                                className="mq-footer-seg"
                                style={{ background: cfg.color, flex: count }}
                                onMouseEnter={(e) => {
                                  clearTimeout(footerTipTimer.current);
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setFooterTip({
                                    label: cfg.label,
                                    count,
                                    total,
                                    pct: Math.round((count / total) * 100),
                                    x: r.left + r.width / 2,
                                    y: r.top,
                                    out: false,
                                  });
                                }}
                              />
                            );
                          })}
                        </div>
                      </td>
                    );
                  if (colKey === 'date')
                    return (
                      <td key={colKey} className="mq-footer-date-cell">
                        {dateRange && <span className="mq-footer-daterange">{dateRange}</span>}
                      </td>
                    );
                  return <td key={colKey} className="mq-footer-empty" />;
                })}
                <td className="mq-footer-empty" />
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

  /* ── Column config — init from saved prefs ── */
  const prefs = user?.dashboardPrefs;

  const [colOrder, setColOrder] = useState(() => {
    if (prefs?.colOrder?.length) {
      const saved = prefs.colOrder.filter((k) =>
        COLUMN_DEFS.some((c) => c.key === k),
      );
      const missing = DEFAULT_COL_ORDER.filter((k) => !saved.includes(k));
      return [...saved, ...missing];
    }
    return DEFAULT_COL_ORDER;
  });

  const [visibleCols, setVisibleCols] = useState(() => {
    if (prefs?.visibleCols?.length) return new Set(prefs.visibleCols);
    return DEFAULT_VISIBLE_COLS;
  });

  const [sortState, setSortState] = useState(() => {
    if (prefs?.sortCol)
      return { col: prefs.sortCol, dir: prefs.sortDir || 'asc' };
    return { col: null, dir: 'asc' };
  });

  const [showColPicker, setShowColPicker] = useState(false);
  const [colPickerPos, setColPickerPos] = useState({ top: 0, left: 0 });
  const dragColRef = useRef(null);
  const colPickerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const isInitialMount = useRef(true);

  /* ── Persist prefs (debounced) ── */
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDashboardPrefs({
        colOrder,
        visibleCols: [...visibleCols],
        sortCol: sortState.col,
        sortDir: sortState.dir,
      }).catch(() => {});
    }, 800);
  }, [colOrder, visibleCols, sortState]);

  const handleSort = useCallback((colKey) => {
    setSortState((prev) => {
      if (prev.col !== colKey) return { col: colKey, dir: 'asc' };
      if (prev.dir === 'asc') return { col: colKey, dir: 'desc' };
      return { col: null, dir: 'asc' };
    });
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

      const base = arr.filter((k) => k !== from);
      const targetIdx = base.indexOf(targetKey);
      if (targetIdx === -1) return prev;

      const insertIdx = fi < ti ? targetIdx + 1 : targetIdx;
      base.splice(insertIdx, 0, from);
      return base;
    });

    dragColRef.current = null;
  }, []);

  const handleAddColClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 180, rect.right + 8);
    const top = rect.top + rect.height / 2;
    setColPickerPos({ top, left });
    setShowColPicker(true);
  }, []);

  const toggleCol = useCallback((key) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
        setColOrder((currentOrder) => {
          const arr = currentOrder.filter((k) => k !== key);
          arr.push(key);
          return arr;
        });
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
          <Link
            to="/employee/orders"
            className="btn-secondary"
            style={{
              textDecoration: "none",
              fontSize: ".85rem",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: ".4rem",
            }}
          >
            View All Orders <LuArrowRight size={14} />
          </Link>
        </div>

        <div className="mq-board">
          {/* Column picker dropdown */}
          <div
            className="mq-col-picker-wrap"
            ref={colPickerRef}
            style={{ top: `${colPickerPos.top}px`, left: `${colPickerPos.left}px` }}
          >
            {showColPicker && (
              <div className="mq-col-picker-dropdown mq-col-picker-dropdown--in">
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
          {EMP_GROUPS.map((group) => (
            <EmpOrderGroup
              key={group.key}
              group={group}
              orders={orders}
              onUpdateClick={handleUpdateClick}
              activeUpdateId={panelOrder?._id}
              colOrder={colOrder}
              visibleCols={visibleCols}
              sortState={sortState}
              onSort={handleSort}
              onColDragStart={handleColDragStart}
              onColDrop={handleColDrop}
              onAddColClick={handleAddColClick}
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
