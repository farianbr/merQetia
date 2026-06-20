import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getClientById } from '../../api/admin';
import {
  LuUser, LuMail, LuCalendar, LuShoppingBag, LuArrowLeft,
  LuCircleCheck, LuClock, LuFileText,
} from 'react-icons/lu';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',     bg: '#fef3c7', color: '#b45309' },
  assigned:  { label: 'Assigned',    bg: '#dbeafe', color: '#1d4ed8' },
  accepted:  { label: 'In Progress', bg: '#cffafe', color: '#155e75' },
  overdue:   { label: 'Overdue',     bg: '#fee2e2', color: '#b91c1c' },
  rejected:  { label: 'Rejected',    bg: '#fee2e2', color: '#b91c1c' },
  completed: { label: 'Completed',   bg: '#d1fae5', color: '#065f46' },
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

export default function AdminClientProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getClientById(id)
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load client profile.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="page"><p className="page-error">{error}</p></div>;
  if (!data?.client) return <div className="page"><p className="page-error">Client not found.</p></div>;

  const { client, orders = [], invoices = [] } = data;
  const avatarSrc = client.avatar ? `${API_BASE}${client.avatar}` : null;

  const totalOrders = orders.length;
  const activeOrders = orders.filter((o) => ['assigned', 'accepted', 'pending'].includes(o.status)).length;
  const completedOrders = orders.filter((o) => o.status === 'completed').length;
  const totalSpend = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
  const outstanding = invoices.filter((i) => i.status === 'unpaid').reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <div className="page">
      <div className="acp-back-row">
        <Link to="/admin/clients" className="acp-back-link">
          <LuArrowLeft size={14} /> All Clients
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
              <span className="acp-stat-label">Total Orders</span>
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
            <div className="acp-stat-card">
              <LuFileText size={18} className="acp-stat-icon acp-stat-icon--amber" />
              <span className="acp-stat-value">{fmtCurrency(totalSpend)}</span>
              <span className="acp-stat-label">Total Paid</span>
            </div>
          </div>

          {outstanding > 0 && (
            <div className="acp-outstanding">
              Outstanding: <strong>{fmtCurrency(outstanding)}</strong>
            </div>
          )}

          <div className="acp-info-card">
            <h2 className="acp-section-title">Account Details</h2>
            <div className="acp-info-row"><LuUser size={13} /><span className="acp-info-label">Full Name</span><span className="acp-info-val">{client.name}</span></div>
            <div className="acp-info-row"><LuMail size={13} /><span className="acp-info-label">Email</span><span className="acp-info-val">{client.email}</span></div>
            <div className="acp-info-row"><LuCalendar size={13} /><span className="acp-info-label">Joined</span><span className="acp-info-val">{fmtDate(client.createdAt)}</span></div>
          </div>
        </div>

        {/* Right panel */}
        <div className="acp-right">
          <div className="acp-card">
            <h2 className="acp-section-title">Orders</h2>
            {orders.length === 0 ? (
              <p className="acp-empty">No orders yet.</p>
            ) : (
              <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Services</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={o._id}>
                        <td>
                          <Link to={`/admin/orders/${o._id}`} className="acp-order-link">
                            #{o._id.slice(-6).toUpperCase()}
                          </Link>
                        </td>
                        <td>{(o.services || []).map((s) => s.name).join(', ') || '—'}</td>
                        <td>
                          <span className="status-badge" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td>{fmtDate(o.createdAt)}</td>
                        <td>{fmtCurrency(o.totalPrice)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {invoices.length > 0 && (
            <div className="acp-card">
              <h2 className="acp-section-title">Invoices</h2>
              <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv._id}>
                      <td>#{inv._id.slice(-6).toUpperCase()}</td>
                      <td>{fmtCurrency(inv.amount)}</td>
                      <td>
                        <span className={`inv-status-badge inv-status-badge--${inv.status}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>{fmtDate(inv.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
