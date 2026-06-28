import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getOrders } from '../../api/orders';
import {
  LuUser, LuMail, LuCalendar, LuSettings, LuCircleCheck,
  LuClock, LuShoppingBag, LuPhone, LuMapPin,
} from 'react-icons/lu';

import { mediaUrl } from '../../utils/media';

const STATUS_CONFIG = {
  placed:    { label: 'Pending',     color: '#9ca3af' },
  assigned:  { label: 'Assigned',    color: '#3b82f6' },
  accepted:  { label: 'In Progress', color: '#33a8d1' },
  review:    { label: 'In Review',   color: '#8b5cf6' },
  overdue:   { label: 'Overdue',     color: '#ef4444' },
  rejected:  { label: 'Rejected',    color: '#ef4444' },
  completed: { label: 'Completed',   color: '#10b981' },
};

export default function ClientProfile() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const avatarSrc = mediaUrl(user?.avatar);
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const addr = user?.address || {};
  const addressLine = [addr.street, addr.city, addr.state, addr.postalCode, addr.country]
    .filter(Boolean)
    .join(', ');

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
      <div className="pf-emp-cols">

        {/* ── Left column ── */}
        <div className="pf-emp-left">

          {/* Hero card */}
          <div className="pf-emp-hero">
            {avatarSrc
              ? <img src={avatarSrc} alt={user?.name} className="pf-emp-avatar-img" />
              : <div className="pf-emp-avatar-placeholder" style={{ background: 'linear-gradient(135deg,#1f8cb4,#33a8d1)' }}>{initials}</div>}
            <h1 className="pf-emp-name">{user?.name || '—'}</h1>
            <span className="pf-role-badge">Client</span>
            <div className="pf-emp-meta">
              <span className="pf-emp-meta-item"><LuMail size={13} />{user?.email}</span>
              {memberSince && (
                <span className="pf-emp-meta-item"><LuCalendar size={13} />Since {memberSince}</span>
              )}
            </div>
            <Link to="/settings" className="pf-edit-btn" style={{ width: '100%', justifyContent: 'center' }}>
              <LuSettings size={14} /> Edit Profile
            </Link>
          </div>

          {/* Overview stats */}
          <div className="pf-section-card">
            <h2 className="pf-section-title" style={{ marginBottom: '.9rem' }}>Overview</h2>
            <div className="pf-perf-list">
              <div className="pf-perf-row">
                <span className="pf-perf-icon" style={{ color: '#1f8cb4' }}><LuShoppingBag size={16} /></span>
                <span className="pf-perf-label">Total Orders</span>
                <span className="pf-perf-value">{loading ? '…' : totalOrders}</span>
              </div>
              <div className="pf-perf-row">
                <span className="pf-perf-icon" style={{ color: '#f59e0b' }}><LuClock size={16} /></span>
                <span className="pf-perf-label">Active</span>
                <span className="pf-perf-value">{loading ? '…' : activeOrders}</span>
              </div>
              <div className="pf-perf-row">
                <span className="pf-perf-icon" style={{ color: '#10b981' }}><LuCircleCheck size={16} /></span>
                <span className="pf-perf-label">Completed</span>
                <span className="pf-perf-value">{loading ? '…' : completedOrders}</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── Right column ── */}
        <div className="pf-emp-right">

          {/* Recent orders */}
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

          {/* Account details */}
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
              <div className="pf-info-row">
                <LuPhone size={15} className="pf-info-icon" />
                <div>
                  <span className="pf-info-label">Phone</span>
                  <span className="pf-info-value">{user?.phone || '—'}</span>
                </div>
              </div>
              <div className="pf-info-row">
                <LuMapPin size={15} className="pf-info-icon" />
                <div>
                  <span className="pf-info-label">Address</span>
                  <span className="pf-info-value">{addressLine || '—'}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
