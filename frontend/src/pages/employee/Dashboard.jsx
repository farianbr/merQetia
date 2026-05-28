import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyAssignments } from '../../api/orders';
import { useAuth } from '../../context/AuthContext';
import OrderTimeline from '../../components/OrderTimeline';

// ─── Order Card (workspace panel) ────────────────────────────────────────────
function WorkspaceCard({ order, isActive, onClick, statusColors, statusLabels }) {
  const serviceName = (order.services || []).map((s) => s.name).join(', ') || 'Order';
  const ds = getDisplayStatus(order);
  const color = statusColors[ds] || '#6b7280';
  const label = statusLabels[ds] || ds;
  return (
    <button
      className={`pw-order-card ${isActive ? 'pw-order-card--active' : ''}`}
      onClick={onClick}
    >
      <div className="pw-oc-top">
        <span className="pw-oc-name">{serviceName}</span>
        <span className="pw-oc-badge" style={{ background: color + '1a', color }}>{label}</span>
      </div>
      <span className="pw-oc-id">Order #{order._id.slice(-6).toUpperCase()}</span>
      <div className="pw-oc-foot">
        <span className="pw-oc-date">{order.clientId?.name || '—'}</span>
        {order.deliveryDate && (
          <span className="pw-oc-date">
            Due {new Date(order.deliveryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Order Detail Panel (workspace) ─────────────────────────────────────────
function WorkspaceDetail({ order, onClose, statusColors, statusLabels }) {
  const navigate = useNavigate();
  const serviceName = (order.services || []).map((s) => s.name).join(', ') || 'Order';
  const ds = getDisplayStatus(order);
  const color = statusColors[ds] || '#6b7280';
  const label = statusLabels[ds] || ds;
  return (
    <div className="pw-detail">
      <div className="pw-detail-header">
        <div>
          <span className="pw-detail-eyebrow">Order Detail</span>
          <h2 className="pw-detail-title">{serviceName}</h2>
        </div>
        <div className="pw-detail-header-right">
          <span className="pw-oc-badge" style={{ background: color + '1a', color }}>{label}</span>
          <button className="pw-close-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <OrderTimeline status={order.status} />
      <div className="pw-meta-strip">
        <div className="pw-meta-item">
          <span className="pw-meta-label">Client</span>
          <span className="pw-meta-value">{order.clientId?.name || '—'}</span>
        </div>
        <div className="pw-meta-item">
          <span className="pw-meta-label">Total</span>
          <span className="pw-meta-value">${order.totalPrice?.toFixed(2) ?? '—'}</span>
        </div>
        <div className="pw-meta-item">
          <span className="pw-meta-label">Placed</span>
          <span className="pw-meta-value">{new Date(order.createdAt).toLocaleDateString()}</span>
        </div>
        {order.deliveryDate && (
          <div className="pw-meta-item">
            <span className="pw-meta-label">Delivery</span>
            <span className="pw-meta-value">{new Date(order.deliveryDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      {order.summary && (
        <div className="pw-brief">
          <span className="pw-section-label">Brief</span>
          <p style={{ fontSize: '.9rem', color: 'var(--text-muted)', marginTop: '.4rem' }}>{order.summary}</p>
        </div>
      )}
      <div className="pw-detail-footer">
        <button
          className="pw-feedback-btn"
          onClick={() => navigate('/employee/orders', { state: { orderId: order._id } })}
        >
          View Full Order →
        </button>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  placed: '#f59e0b',
  assigned: '#3b82f6',
  accepted: '#8b5cf6',
  overdue: '#dc2626',
  rejected: '#ef4444',
  completed: '#10b981',
};

const STATUS_LABEL = {
  placed: 'Placed',
  assigned: 'New Request',
  accepted: 'In Progress',
  overdue: 'Overdue',
  rejected: 'Declined',
  completed: 'Completed',
};

function getDisplayStatus(order) {
  if (order.status === 'accepted' && order.deliveryDate && new Date(order.deliveryDate) < new Date()) {
    return 'overdue';
  }
  return order.status;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await getMyAssignments();
        const list = r.data.orders || r.data;
        setOrders(list);
        setActiveOrder((prev) => {
          if (prev) return list.find((o) => o._id === prev._id) || null;
          return list.find((o) => o.status === 'accepted') || null;
        });
      } catch {
        setError('Failed to load orders');
      }
    })();
  }, []);

  const activeOrders = orders.filter((o) => o.status === 'accepted');

  return (
    <div className="pw-page">
      {/* Header */}
      <div className="pw-page-header">
        <div>
          <h1 className="pw-page-title">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="pw-page-sub">Here's your work overview for today.</p>
        </div>
        <Link to="/employee/orders" className="pw-all-orders-btn">
          View All Orders
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </Link>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* Workspace: active orders split panel */}
      <div className="pw-workspace">
        <div className="pw-list-col">
          <div className="pw-list-header">
            <span className="pw-list-title">Active Work</span>
            {activeOrders.length > 0 && (
              <span className="pw-list-count">{activeOrders.length} Order{activeOrders.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="pw-order-list">
            {activeOrders.length === 0 ? (
              <div className="pw-empty">
                <p>No active orders.</p>
                <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>New requests will appear in your notifications.</p>
              </div>
            ) : (
              activeOrders.map((o) => (
                <WorkspaceCard
                  key={o._id}
                  order={o}
                  isActive={activeOrder?._id === o._id}
                  onClick={() => setActiveOrder(o)}
                  statusColors={STATUS_COLORS}
                  statusLabels={STATUS_LABEL}
                />
              ))
            )}
          </div>
        </div>

        <div className="pw-detail-col">
          {activeOrder ? (
            <WorkspaceDetail
              order={activeOrder}
              onClose={() => setActiveOrder(null)}
              statusColors={STATUS_COLORS}
              statusLabels={STATUS_LABEL}
            />
          ) : (
            <div className="pw-detail-placeholder">
              <p>Select an order to view details</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
