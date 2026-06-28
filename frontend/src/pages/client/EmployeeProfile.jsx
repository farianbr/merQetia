import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPublicEmployee } from '../../api/clients';
import {
  LuCalendar, LuTag, LuShoppingBag, LuCircleCheck, LuClock, LuArrowLeft,
} from 'react-icons/lu';

import { mediaUrl } from '../../utils/media';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',     bg: '#fef3c7', color: '#b45309' },
  assigned:  { label: 'Assigned',    bg: '#dbeafe', color: '#1d4ed8' },
  accepted:  { label: 'In Progress', bg: '#d8eef7', color: '#155e75' },
  review:    { label: 'In Review',   bg: '#ede9fe', color: '#5b21b6' },
  overdue:   { label: 'Overdue',     bg: '#fee2e2', color: '#b91c1c' },
  rejected:  { label: 'Rejected',    bg: '#fee2e2', color: '#b91c1c' },
  completed: { label: 'Completed',   bg: '#d1fae5', color: '#065f46' },
};

const DEPT_COLORS = {
  Creative:       { bg: '#fef3c7', color: '#b45309' },
  Strategy:       { bg: '#d8eef7', color: '#155e75' },
  'Media Buying': { bg: '#d1fae5', color: '#065f46' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function ClientEmployeeProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPublicEmployee(id)
      .then((r) => setData(r.data))
      .catch((err) =>
        setError(err.response?.data?.message || 'Failed to load profile.'),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="page"><p className="page-error">{error}</p></div>;
  if (!data?.employee) return <div className="page"><p className="page-error">Profile not found.</p></div>;

  const { employee, orders = [] } = data;
  const avatarSrc = mediaUrl(employee.avatar);
  const departments = employee.departments || [];

  const totalOrders = orders.length;
  const activeOrders = orders.filter((o) => ['assigned', 'accepted'].includes(o.status)).length;
  const completedOrders = orders.filter((o) => o.status === 'completed').length;

  return (
    <div className="page">
      <div className="acp-back-row">
        <Link to="/dashboard" className="acp-back-link">
          <LuArrowLeft size={14} /> Back to Dashboard
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
                const dc = DEPT_COLORS[dept] || { bg: '#d8eef7', color: '#155e75' };
                return (
                  <span key={dept} className="acp-dept-tag" style={{ background: dc.bg, color: dc.color }}>
                    <LuTag size={10} /> {dept}
                  </span>
                );
              })}
            </div>
            <div className="acp-meta">
              <span><LuCalendar size={12} />Part of the team since {new Date(employee.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          <div className="acp-stats-grid">
            <div className="acp-stat-card">
              <LuShoppingBag size={18} className="acp-stat-icon acp-stat-icon--blue" />
              <span className="acp-stat-value">{totalOrders}</span>
              <span className="acp-stat-label">Your Orders</span>
            </div>
            <div className="acp-stat-card">
              <LuClock size={18} className="acp-stat-icon acp-stat-icon--purple" />
              <span className="acp-stat-value">{activeOrders}</span>
              <span className="acp-stat-label">Active</span>
            </div>
            <div className="acp-stat-card">
              <LuCircleCheck size={18} className="acp-stat-icon acp-stat-icon--green" />
              <span className="acp-stat-value">{completedOrders}</span>
              <span className="acp-stat-label">Completed</span>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="acp-right">
          <div className="acp-card">
            <h2 className="acp-section-title">Orders Handled For You</h2>
            {orders.length === 0 ? (
              <p className="acp-empty">No shared orders.</p>
            ) : (
              <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Services</th>
                    <th>Status</th>
                    <th>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={o._id}>
                        <td>
                          <Link to="/orders" state={{ selectOrderId: o._id }} className="acp-order-link">
                            #{o._id.slice(-6).toUpperCase()}
                          </Link>
                        </td>
                        <td>{(o.services || []).map((s) => s.name).join(', ') || '—'}</td>
                        <td>
                          <span className="status-badge" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td>{fmtDate(o.deliveryDate)}</td>
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
