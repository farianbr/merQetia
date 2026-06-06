import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getOrders } from '../../api/orders';
import { getInvoices } from '../../api/invoices';
import {
  LuUser, LuMail, LuCalendar, LuSettings, LuCircleCheck,
  LuClock, LuShoppingBag, LuTag,
} from 'react-icons/lu';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const ORDER_STATUS = {
  placed:    { label: 'Pending Review', pill: 'pending',    color: '#9ca3af' },
  assigned:  { label: 'Assigned',       pill: 'assigned',   color: '#3b82f6' },
  accepted:  { label: 'In Progress',    pill: 'inprogress', color: '#8b5cf6' },
  overdue:   { label: 'Overdue',        pill: 'overdue',    color: '#ef4444' },
  rejected:  { label: 'Rejected',       pill: 'rejected',   color: '#ef4444' },
  completed: { label: 'Completed',      pill: 'completed',  color: '#10b981' },
};

const PILL_STYLES = {
  pending:    { bg: '#f3f4f6', color: '#6b7280' },
  assigned:   { bg: '#dbeafe', color: '#1d4ed8' },
  inprogress: { bg: '#ede9fe', color: '#6d28d9' },
  overdue:    { bg: '#fee2e2', color: '#b91c1c' },
  rejected:   { bg: '#fee2e2', color: '#b91c1c' },
  completed:  { bg: '#d1fae5', color: '#065f46' },
};

function fmtMoney(n) {
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


const STATUS_CONFIG = {
  placed:    { label: 'Pending',     color: '#9ca3af' },
  assigned:  { label: 'Assigned',    color: '#3b82f6' },
  accepted:  { label: 'In Progress', color: '#8b5cf6' },
  overdue:   { label: 'Overdue',     color: '#ef4444' },
  rejected:  { label: 'Rejected',    color: '#ef4444' },
  completed: { label: 'Completed',   color: '#10b981' },
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="pf-stat-card">
      <div className="pf-stat-icon" style={{ background: color + '18', color }}>
        <Icon size={20} />
      </div>
      <div className="pf-stat-info">
        <span className="pf-stat-value">{value}</span>
        <span className="pf-stat-label">{label}</span>
      </div>
    </div>
  );
}

export default function ClientProfile() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const avatarSrc = user?.avatar ? `${API_BASE}${user.avatar}` : null;
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  useEffect(() => {
    getOrders({ limit: 200 })
      .then((r) => setOrders(r.data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalOrders     = orders.length;
  const activeOrders    = orders.filter((o) => ['placed', 'assigned', 'accepted'].includes(o.status)).length;
  const completedOrders = orders.filter((o) => o.status === 'completed').length;

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <div className="pf-page">
      {/* ── Hero card ── */}
      <div className="pf-hero-card">
        <div className="pf-avatar-wrap">
          {avatarSrc ? (
            <img src={avatarSrc} alt={user?.name} className="pf-avatar-img" />
          ) : (
            <div className="pf-avatar-placeholder">{initials}</div>
          )}
        </div>
        <div className="pf-hero-info">
          <h1 className="pf-name">{user?.name || '—'}</h1>
          <span className="pf-role-badge">Client</span>
          <div className="pf-meta">
            <span className="pf-meta-item"><LuMail size={14} />{user?.email}</span>
            {memberSince && (
              <span className="pf-meta-item"><LuCalendar size={14} />Member since {memberSince}</span>
            )}
          </div>
        </div>
        <Link to="/settings" className="pf-edit-btn">
          <LuSettings size={15} /> Edit Profile
        </Link>
      </div>

      {/* ── Stats ── */}
      <div className="pf-stats-row">
        <StatCard icon={LuShoppingBag} label="Total Orders"    value={loading ? '…' : totalOrders}     color="#6366f1" />
        <StatCard icon={LuClock}       label="Active Orders"   value={loading ? '…' : activeOrders}    color="#f59e0b" />
        <StatCard icon={LuCircleCheck} label="Completed"       value={loading ? '…' : completedOrders} color="#10b981" />
      </div>

      {/* ── Recent orders ── */}
      <div className="pf-section-card">
        <div className="pf-section-header">
          <h2 className="pf-section-title">Recent Orders</h2>
          <Link to="/orders" className="pf-section-link">View all →</Link>
        </div>
        {loading ? (
          <p className="pf-empty">Loading…</p>
        ) : recentOrders.length === 0 ? (
          <p className="pf-empty">No orders yet.</p>
        ) : (
          <div className="pf-order-list">
            {recentOrders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] || { label: order.status, color: '#9ca3af' };
              const serviceName = order.services?.map((s) => s.name).join(', ') || '—';
              const date = order.createdAt
                ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
              return (
                <div key={order._id} className="pf-order-row">
                  <div className="pf-order-info">
                    <span className="pf-order-name">{serviceName}</span>
                    <span className="pf-order-date">{date}</span>
                  </div>
                  <span className="pf-order-status" style={{ background: cfg.color + '18', color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Account info ── */}
      <div className="pf-section-card">
        <div className="pf-section-header">
          <h2 className="pf-section-title">Account Details</h2>
        </div>
        <div className="pf-info-grid">
          <div className="pf-info-row">
            <LuUser size={15} className="pf-info-icon" />
            <div>
              <span className="pf-info-label">Full Name</span>
              <span className="pf-info-value">{user?.name || '—'}</span>
            </div>
          </div>
          <div className="pf-info-row">
            <LuMail size={15} className="pf-info-icon" />
            <div>
              <span className="pf-info-label">Email</span>
              <span className="pf-info-value">{user?.email || '—'}</span>
            </div>
          </div>
          <div className="pf-info-row">
            <LuCalendar size={15} className="pf-info-icon" />
            <div>
              <span className="pf-info-label">Member Since</span>
              <span className="pf-info-value">{memberSince || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
