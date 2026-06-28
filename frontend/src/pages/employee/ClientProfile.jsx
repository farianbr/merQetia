import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSharedClient } from '../../api/clients';
import {
  LuUser, LuMail, LuPhone, LuMapPin, LuCalendar, LuShoppingBag,
  LuCircleCheck, LuClock, LuArrowLeft,
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

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCurrency(n) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function addressLine(a) {
  if (!a) return '';
  return [a.street, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ');
}

export default function EmployeeClientProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSharedClient(id)
      .then((r) => setData(r.data))
      .catch((err) =>
        setError(err.response?.data?.message || 'Failed to load client profile.'),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="page"><p className="page-error">{error}</p></div>;
  if (!data?.client) return <div className="page"><p className="page-error">Client not found.</p></div>;

  const { client, orders = [] } = data;
  const avatarSrc = mediaUrl(client.avatar);
  const addr = addressLine(client.address);

  const totalOrders = orders.length;
  const activeOrders = orders.filter((o) => ['assigned', 'accepted'].includes(o.status)).length;
  const completedOrders = orders.filter((o) => o.status === 'completed').length;

  return (
    <div className="page">
      <div className="acp-back-row">
        <Link to="/employee" className="acp-back-link">
          <LuArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>

      <div className="acp-cols">
        {/* Left panel */}
        <div className="acp-left">
          <div className="acp-hero">
            <div className="acp-avatar">
              {avatarSrc
                ? <img src={avatarSrc} alt={client.name} className="acp-avatar-img" />
                : <span>{initials(client.name)}</span>}
            </div>
            <h1 className="acp-name">{client.name}</h1>
            <div className="acp-meta">
              <span><LuMail size={12} />{client.email}</span>
              <span><LuCalendar size={12} />Client since {new Date(client.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
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

          <div className="acp-info-card">
            <h2 className="acp-section-title">Contact Details</h2>
            <div className="acp-info-row"><LuUser size={13} /><span className="acp-info-label">Full Name</span><span className="acp-info-val">{client.name}</span></div>
            <div className="acp-info-row"><LuMail size={13} /><span className="acp-info-label">Email</span><span className="acp-info-val">{client.email}</span></div>
            {client.phone && <div className="acp-info-row"><LuPhone size={13} /><span className="acp-info-label">Phone</span><span className="acp-info-val">{client.phone}</span></div>}
            {addr && <div className="acp-info-row"><LuMapPin size={13} /><span className="acp-info-label">Address</span><span className="acp-info-val">{addr}</span></div>}
          </div>
        </div>

        {/* Right panel */}
        <div className="acp-right">
          <div className="acp-card">
            <h2 className="acp-section-title">Your Shared Orders</h2>
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
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={o._id}>
                        <td>#{o._id.slice(-6).toUpperCase()}</td>
                        <td>{(o.services || []).map((s) => s.name).join(', ') || '—'}</td>
                        <td>
                          <span className="status-badge" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td>{fmtDate(o.deliveryDate)}</td>
                        <td>{fmtCurrency(o.totalPrice)}</td>
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
