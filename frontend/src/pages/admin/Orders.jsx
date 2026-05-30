import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuLayoutGrid, LuTrendingUp, LuCircleCheck, LuEye } from 'react-icons/lu';
import { getOrders } from '../../api/orders';

const STATUS_CONFIG = {
  placed:    { label: 'Pending',     color: '#6b7280', bg: '#f3f4f6' },
  assigned:  { label: 'Assigned',    color: '#2563eb', bg: '#dbeafe' },
  accepted:  { label: 'In Progress', color: '#7c3aed', bg: '#ede9fe' },
  overdue:   { label: 'Overdue',     color: '#dc2626', bg: '#fee2e2' },
  rejected:  { label: 'Rejected',    color: '#dc2626', bg: '#fee2e2' },
  completed: { label: 'Completed',   color: '#059669', bg: '#d1fae5' },
};

function getDisplayStatus(order) {
  if (order.status === 'accepted' && order.deliveryDate && new Date(order.deliveryDate) < new Date()) {
    return 'overdue';
  }
  return order.status;
}

const STATUSES = ['all', 'placed', 'assigned', 'accepted', 'rejected', 'completed'];
const STATUS_LABEL = Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label]));
STATUS_LABEL.all = 'All Statuses';

const PAGE_SIZE = 10;

const AVATAR_COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#db2777','#7c3aed','#0284c7','#16a34a'];
function avatarColor(name = '') {
  const code = [...(name || 'U')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}
function initials(name = '') {
  return (name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function LetterAvatar({ name, size = 30 }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: avatarColor(name), color: '#fff',
        fontSize: size * 0.38, fontWeight: 700, userSelect: 'none',
      }}
    >
      {initials(name)}
    </span>
  );
}

function TrendBadge({ value, tooltip }) {
  const [show, setShow] = useState(false);
  const isPos = value >= 0;
  return (
    <span
      className={`om-stat-trend${isPos ? '' : ' om-stat-trend--down'}`}
      style={{ position: 'relative', cursor: 'default' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {isPos ? '↑' : '↓'} {Math.abs(value)}%
      {show && <span className="om-trend-tooltip">{tooltip}</span>}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getServiceType(order) {
  return (order.services || []).map((s) => s.name).join(', ') || '—';
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    getOrders()
      .then((r) => setOrders(r.data.orders || r.data))
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const stats = useMemo(() => {
    const nowMs = now.getTime();
    const WEEK = 7 * 86400000;

    const isActive = (o) => ['placed', 'assigned', 'accepted'].includes(o.status);
    const active = orders.filter(isActive).length;

    // Active trend: new active orders this week vs last week
    const activeThisWeek = orders.filter((o) => isActive(o) && nowMs - new Date(o.createdAt).getTime() < WEEK).length;
    const activeLastWeek = orders.filter((o) => {
      const age = nowMs - new Date(o.createdAt).getTime();
      return isActive(o) && age >= WEEK && age < 2 * WEEK;
    }).length;
    const activeTrend = activeLastWeek === 0
      ? (activeThisWeek > 0 ? 100 : 0)
      : Math.round(((activeThisWeek - activeLastWeek) / activeLastWeek) * 100);

    // Efficiency: completed / (completed + rejected) for this month vs last month
    const inThisMonth = (o) => {
      const d = new Date(o.updatedAt || o.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };
    const inLastMonth = (o) => {
      const d = new Date(o.updatedAt || o.createdAt);
      const lm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const ly = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return d.getMonth() === lm && d.getFullYear() === ly;
    };
    const compThis = orders.filter((o) => o.status === 'completed' && inThisMonth(o)).length;
    const rejThis  = orders.filter((o) => o.status === 'rejected'  && inThisMonth(o)).length;
    const effThis  = (compThis + rejThis) === 0 ? 0 : Math.round((compThis / (compThis + rejThis)) * 100);

    const compLast = orders.filter((o) => o.status === 'completed' && inLastMonth(o)).length;
    const rejLast  = orders.filter((o) => o.status === 'rejected'  && inLastMonth(o)).length;
    const effLast  = (compLast + rejLast) === 0 ? 0 : Math.round((compLast / (compLast + rejLast)) * 100);
    const effTrend = effLast === 0
      ? (effThis > 0 ? 100 : 0)
      : Math.round(((effThis - effLast) / effLast) * 100);

    // Completed this month trend vs last month
    const completedTrend = compLast === 0
      ? (compThis > 0 ? 100 : 0)
      : Math.round(((compThis - compLast) / compLast) * 100);

    return { active, activeTrend, activeThisWeek, effThis, effTrend, compThis, completedTrend };
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps


  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      const id = o._id.slice(-6).toUpperCase();
      const client = o.clientId?.name?.toLowerCase() || '';
      const employee = o.assignedEmployee?.name?.toLowerCase() || '';
      const svc = getServiceType(o).toLowerCase();
      const status = (STATUS_CONFIG[getDisplayStatus(o)]?.label || o.status).toLowerCase();
      const dueDate = o.deliveryDate ? fmtDate(o.deliveryDate).toLowerCase() : '';
      return id.includes(q.toUpperCase()) || client.includes(q) || employee.includes(q) || svc.includes(q) || status.includes(q) || dueDate.includes(q);
    });
  }, [orders, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div className="page om-page">

      {/* ── Header ── */}
      <div className="om-header">
        <div>
          <h1 className="om-title">Order Management</h1>
          <p className="om-subtitle">Track and manage all client orders across services. Assign employees, monitor progress, and ensure timely delivery.</p>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* ── Stat cards ── */}
      <div className="om-stats">
        <div className="om-stat-card">
          <div className="om-stat-top">
            <div className="om-stat-icon" style={{ background: '#eff6ff' }}><LuLayoutGrid size={20} color="#3b82f6" /></div>
            <TrendBadge
              value={stats.activeTrend}
              tooltip={`New active orders this week vs last week. This week: ${stats.activeThisWeek}`}
            />
          </div>
          <span className="om-stat-count">{loading ? '—' : stats.active}</span>
          <span className="om-stat-label">Total Active Orders</span>
        </div>
        <div className="om-stat-card">
          <div className="om-stat-top">
            <div className="om-stat-icon" style={{ background: '#f0fdf4' }}><LuTrendingUp size={20} color="#10b981" /></div>
            <TrendBadge
              value={stats.effTrend}
              tooltip={`Completion rate this month vs last month. This month: ${stats.effThis}% of closed orders were completed successfully.`}
            />
          </div>
          <span className="om-stat-count">{loading ? '—' : `${stats.effThis}%`}</span>
          <span className="om-stat-label">Efficiency this Month</span>
        </div>
        <div className="om-stat-card">
          <div className="om-stat-top">
            <div className="om-stat-icon" style={{ background: '#f5f3ff' }}><LuCircleCheck size={20} color="#8b5cf6" /></div>
            <TrendBadge
              value={stats.completedTrend}
              tooltip={`Orders completed this month vs last month.`}
            />
          </div>
          <span className="om-stat-count">{loading ? '—' : stats.compThis}</span>
          <span className="om-stat-label">Completed this Month</span>
        </div>
      </div>

      {/* ── Search + filter bar ── */}
      <div className="orders-toolbar">
        <input
          type="search"
          className="input orders-search"
          placeholder="Search by ID, client, service, status, date…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input orders-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No orders match your search.</p>
      ) : (
        <div className="om-table-wrap">
          <table className="om-table">
            <thead>
              <tr>
                <th>ORDER ID</th>
                <th>CLIENT NAME</th>
                <th>SERVICE TYPE</th>
                <th>STATUS</th>
                <th>ASSIGNED</th>
                <th>DUE DATE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((o) => {
                const ds = getDisplayStatus(o);
                const cfg = STATUS_CONFIG[ds] || STATUS_CONFIG.placed;
                const assignedName = o.assignedEmployee?.name || null;
                return (
                  <tr key={o._id} className="om-row" onClick={() => navigate(`/admin/orders/${o._id}`)}>
                    <td>#{o._id.slice(-6).toUpperCase()}</td>
                    <td>{o.clientId?.name || '—'}</td>
                    <td>{getServiceType(o)}</td>
                    <td>{cfg.label}</td>
                    <td>{assignedName || 'Unassigned'}</td>
                    <td>{fmtDate(o.deliveryDate)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="om-action-btn" onClick={() => navigate(`/admin/orders/${o._id}`)}>
                        <LuEye size={14} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── Pagination ── */}
          <div className="om-pagination">
            <span className="om-pg-info">
              Showing {start} to {end} of {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            </span>
            <div className="om-pg-btns">
              <button className="om-pg-btn" disabled={safePage === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="om-pg-ellipsis">…</span>
                  ) : (
                    <button key={p} className={`om-pg-btn${p === safePage ? ' om-pg-btn--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  )
                )}
              <button className="om-pg-btn" disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
