import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyAssignments } from '../../api/orders';
import {
  LuUser, LuMail, LuCalendar, LuBriefcase, LuCircleCheck,
  LuSettings, LuTag, LuStar, LuZap,
} from 'react-icons/lu';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const STATUS_CONFIG = {
  assigned: { label: 'Assigned', bg: '#dbeafe', color: '#1d4ed8' },
  accepted: { label: 'In Progress', bg: '#ede9fe', color: '#6d28d9' },
  overdue: { label: 'Overdue', bg: '#fee2e2', color: '#b91c1c' },
  rejected: { label: 'Rejected', bg: '#fee2e2', color: '#b91c1c' },
  completed: { label: 'Completed', bg: '#d1fae5', color: '#065f46' },
};

const DEPT_COLORS = {
  Creative: { bg: '#fef3c7', color: '#b45309' },
  Strategy: { bg: '#ede9fe', color: '#6d28d9' },
  'Media Buying': { bg: '#d1fae5', color: '#065f46' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function EmployeeProfile() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const avatarSrc = user?.avatar ? `${API_BASE}${user.avatar}` : null;
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'E';
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  const departments = user?.departments || [];

  useEffect(() => {
    getMyAssignments()
      .then((r) => setOrders(r.data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalAssigned = orders.length;
  const activeOrders = orders.filter((o) => ['assigned', 'accepted'].includes(o.status)).length;
  const completedOrders = orders.filter((o) => o.status === 'completed').length;
  const completionRate = totalAssigned > 0 ? Math.round((completedOrders / totalAssigned) * 100) : 0;

  const recentWork = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <div className="pf-page">
      <div className="pf-emp-cols">
        <div className="pf-emp-left">
          <div className="pf-emp-hero">
            {avatarSrc
              ? <img src={avatarSrc} alt={user?.name} className="pf-emp-avatar-img" />
              : <div className="pf-emp-avatar-placeholder">{initials}</div>}
            <h1 className="pf-emp-name">{user?.name || '—'}</h1>
            {departments.length > 0 && <p className="pf-emp-title">{departments[0]}</p>}
            <span className="pf-status-badge pf-status-badge--active">Active</span>

            {departments.length > 0 && (
              <div className="pf-dept-tags" style={{ justifyContent: 'center' }}>
                {departments.map((dept) => {
                  const dc = DEPT_COLORS[dept] || { bg: '#ede9fe', color: '#6d28d9' };
                  return (
                    <span key={dept} className="pf-dept-tag" style={{ background: dc.bg, color: dc.color }}>
                      <LuTag size={10} /> {dept}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="pf-emp-meta">
              <span className="pf-emp-meta-item"><LuMail size={13} />{user?.email}</span>
              {memberSince && <span className="pf-emp-meta-item"><LuCalendar size={13} />Joined {memberSince}</span>}
            </div>

            <Link to="/employee/settings" className="pf-edit-btn" style={{ width: '100%', justifyContent: 'center' }}>
              <LuSettings size={14} /> Edit Profile
            </Link>
          </div>

          <div className="pf-section-card">
            <h2 className="pf-section-title" style={{ marginBottom: '.9rem' }}>Performance</h2>
            <div className="pf-perf-list">
              <div className="pf-perf-row">
                <span className="pf-perf-icon" style={{ color: '#f59e0b' }}><LuStar size={16} /></span>
                <span className="pf-perf-label">Total Assigned</span>
                <span className="pf-perf-value">{loading ? '…' : totalAssigned}</span>
              </div>
              <div className="pf-perf-row">
                <span className="pf-perf-icon" style={{ color: '#10b981' }}><LuCircleCheck size={16} /></span>
                <span className="pf-perf-label">Completion Rate</span>
                <span className="pf-perf-value">{loading ? '…' : `${completionRate}%`}</span>
              </div>
              <div className="pf-perf-row">
                <span className="pf-perf-icon" style={{ color: '#6366f1' }}><LuZap size={16} /></span>
                <span className="pf-perf-label">Active</span>
                <span className="pf-perf-value">{loading ? '…' : activeOrders}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pf-emp-right">
          <div className="pf-section-card">
            <div className="pf-section-header">
              <h2 className="pf-section-title">Recent Work</h2>
              <Link to="/employee/orders" className="pf-section-link">View Full Ledger →</Link>
            </div>

            {loading ? (
              <p className="pf-empty">Loading…</p>
            ) : recentWork.length === 0 ? (
              <p className="pf-empty">No assignments yet.</p>
            ) : (
              <div className="pf-work-list">
                {recentWork.map((order) => {
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.assigned;
                  const serviceName = order.services?.map((s) => s.name).join(', ') || '—';
                  const clientName = order.clientId?.name || null;
                  const serviceTags = order.services?.map((s) => s.name) || [];

                  return (
                    <div key={order._id} className="pf-work-card">
                      <div className="pf-work-head">
                        <div>
                          <span className="pf-work-name">{serviceName}</span>
                          {clientName && <span className="pf-work-client">{clientName}</span>}
                        </div>
                        <span className="pf-status-pill" style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label.toUpperCase()}
                        </span>
                      </div>

                      {serviceTags.length > 1 && (
                        <div className="pf-work-tags">
                          {serviceTags.map((t) => (
                            <span key={t} className="pf-work-tag" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="pf-work-footer">
                        <LuCalendar size={12} style={{ color: '#9ca3af' }} />
                        <span className="pf-work-date">{fmtDate(order.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pf-section-card">
            <h2 className="pf-section-title" style={{ marginBottom: '.9rem' }}>Account Details</h2>
            <div className="pf-info-grid">
              <div className="pf-info-row">
                <LuUser size={14} className="pf-info-icon" />
                <div>
                  <span className="pf-info-label">Full Name</span>
                  <span className="pf-info-value">{user?.name || '—'}</span>
                </div>
              </div>
              <div className="pf-info-row">
                <LuMail size={14} className="pf-info-icon" />
                <div>
                  <span className="pf-info-label">Email</span>
                  <span className="pf-info-value">{user?.email || '—'}</span>
                </div>
              </div>
              {memberSince && (
                <div className="pf-info-row">
                  <LuCalendar size={14} className="pf-info-icon" />
                  <div>
                    <span className="pf-info-label">Joined</span>
                    <span className="pf-info-value">{memberSince}</span>
                  </div>
                </div>
              )}
              {departments.length > 0 && (
                <div className="pf-info-row">
                  <LuBriefcase size={14} className="pf-info-icon" />
                  <div>
                    <span className="pf-info-label">Departments</span>
                    <span className="pf-info-value">{departments.join(', ')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
