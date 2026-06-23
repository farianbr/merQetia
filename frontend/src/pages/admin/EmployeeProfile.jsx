import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEmployeeById } from '../../api/admin';
import {
  LuMail, LuCalendar, LuTag, LuShoppingBag,
  LuCircleCheck, LuZap, LuArrowLeft,
} from 'react-icons/lu';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',     bg: '#fef3c7', color: '#b45309' },
  assigned:  { label: 'Assigned',    bg: '#dbeafe', color: '#1d4ed8' },
  accepted:  { label: 'In Progress', bg: '#cffafe', color: '#155e75' },
  review:    { label: 'In Review',   bg: '#ede9fe', color: '#5b21b6' },
  overdue:   { label: 'Overdue',     bg: '#fee2e2', color: '#b91c1c' },
  rejected:  { label: 'Rejected',    bg: '#fee2e2', color: '#b91c1c' },
  completed: { label: 'Completed',   bg: '#d1fae5', color: '#065f46' },
};

const DEPT_COLORS = {
  Creative:      { bg: '#fef3c7', color: '#b45309' },
  Strategy:      { bg: '#cffafe', color: '#155e75' },
  'Media Buying': { bg: '#d1fae5', color: '#065f46' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function AdminEmployeeProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getEmployeeById(id)
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load employee profile.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="page"><p className="page-error">{error}</p></div>;
  if (!data?.employee) return <div className="page"><p className="page-error">Employee not found.</p></div>;

  const { employee, orders = [] } = data;
  const avatarSrc = employee.avatar ? `${API_BASE}${employee.avatar}` : null;
  const departments = employee.departments || [];

  const totalAssigned = orders.length;
  const activeOrders = orders.filter((o) => ['assigned', 'accepted'].includes(o.status)).length;
  const completedOrders = orders.filter((o) => o.status === 'completed').length;
  const completionRate = totalAssigned > 0 ? Math.round((completedOrders / totalAssigned) * 100) : 0;

  return (
    <div className="page">
      <div className="acp-back-row">
        <Link to="/admin/employees" className="acp-back-link">
          <LuArrowLeft size={14} /> All Employees
        </Link>
      </div>

      <div className="acp-cols">
        {/* Left panel */}
        <div className="acp-left">
          <div className="acp-hero">
            <div className="acp-avatar">
              {avatarSrc
                ? <img src={avatarSrc} alt={employee.name} className="acp-avatar-img" />
                : <span>{initials(employee.name)}</span>}
            </div>
            <h1 className="acp-name">{employee.name}</h1>
            {departments.length > 0 && (
              <p className="acp-role-label">{departments[0]}</p>
            )}
            <div className="acp-dept-tags">
              {departments.map((dept) => {
                const dc = DEPT_COLORS[dept] || { bg: '#cffafe', color: '#155e75' };
                return (
                  <span key={dept} className="acp-dept-tag" style={{ background: dc.bg, color: dc.color }}>
                    <LuTag size={10} /> {dept}
                  </span>
                );
              })}
            </div>
            <div className="acp-meta">
              <span><LuMail size={12} />{employee.email}</span>
              <span><LuCalendar size={12} />Joined {new Date(employee.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          <div className="acp-info-card">
            <h2 className="acp-section-title">Performance</h2>
            <div className="acp-perf-row">
              <span className="acp-perf-icon" style={{ color: '#f59e0b' }}><LuShoppingBag size={15} /></span>
              <span className="acp-perf-label">Total Assigned</span>
              <span className="acp-perf-val">{totalAssigned}</span>
            </div>
            <div className="acp-perf-row">
              <span className="acp-perf-icon" style={{ color: '#10b981' }}><LuCircleCheck size={15} /></span>
              <span className="acp-perf-label">Completion Rate</span>
              <span className="acp-perf-val">{completionRate}%</span>
            </div>
            <div className="acp-perf-row">
              <span className="acp-perf-icon" style={{ color: '#0891b2' }}><LuZap size={15} /></span>
              <span className="acp-perf-label">Active Now</span>
              <span className="acp-perf-val">{activeOrders}</span>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="acp-right">
          <div className="acp-card">
            <h2 className="acp-section-title">Assigned Orders</h2>
            {orders.length === 0 ? (
              <p className="acp-empty">No orders assigned yet.</p>
            ) : (
              <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Client</th>
                    <th>Services</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.assigned;
                    return (
                      <tr key={o._id}>
                        <td>
                          <Link to={`/admin/orders/${o._id}`} className="acp-order-link">
                            #{o._id.slice(-6).toUpperCase()}
                          </Link>
                        </td>
                        <td>{o.clientId?.name || '—'}</td>
                        <td>{(o.services || []).map((s) => s.name).join(', ') || '—'}</td>
                        <td>
                          <span className="status-badge" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td>{fmtCurrency(o.totalPrice)}</td>
                        <td>{fmtDate(o.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
