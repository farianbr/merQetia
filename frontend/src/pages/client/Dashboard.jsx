import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../../api/orders';
import { useSocket } from '../../context/SocketContext';
import OrderTimeline from '../../components/OrderTimeline';
import { LuX } from 'react-icons/lu';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVE_STATUSES = new Set(['placed', 'assigned', 'accepted']);

const STATUS_COLORS = {
  placed:    '#f59e0b',
  assigned:  '#3b82f6',
  accepted:  '#06b6d4',
  overdue:   '#dc2626',
};
const STATUS_LABEL = {
  placed:    'Placed',
  assigned:  'Assigned',
  accepted:  'In Progress',
  overdue:   'Overdue',
};

function getDisplayStatus(order) {
  if (order.status === 'accepted' && order.deliveryDate && new Date(order.deliveryDate) < new Date()) {
    return 'overdue';
  }
  return order.status;
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, isActive, onClick }) {
  const serviceName = (order.services || []).map((s) => s.name).join(', ') || 'Order';
  const ds = getDisplayStatus(order);
  const color = STATUS_COLORS[ds] || '#6b7280';
  const label = STATUS_LABEL[ds] || ds;
  const isPaid = order.invoice?.status === 'paid';

  return (
    <button
      className={`pw-order-card ${isActive ? 'pw-order-card--active' : ''}`}
      onClick={onClick}
    >
      <div className="pw-oc-top">
        <span className="pw-oc-name">{serviceName}</span>
        <span className="pw-oc-badge" style={{ background: color + '1a', color }}>
          {label}
        </span>
      </div>
      <span className="pw-oc-id">Order #{order._id.slice(-6).toUpperCase()}</span>
      <div className="pw-oc-foot">
        <span className={`pw-oc-pay ${isPaid ? 'pw-oc-pay--paid' : 'pw-oc-pay--unpaid'}`}>
          {isPaid ? '✓ Paid' : '⚠ Unpaid'}
        </span>
        {(order.status === 'accepted' || getDisplayStatus(order) === 'overdue') && (
          <span className="pw-oc-date">
            {order.deliveryDate
              ? `Due ${new Date(order.deliveryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
              : new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Order Detail Panel ───────────────────────────────────────────────────────
function OrderDetail({ order, onClose }) {
  const serviceName = (order.services || []).map((s) => s.name).join(', ') || 'Order';
  const ds = getDisplayStatus(order);
  const color = STATUS_COLORS[ds] || '#6b7280';
  const label = STATUS_LABEL[ds] || ds;

  const allAnswers = order.answers || {};
  const briefEntries = Object.entries(allAnswers).flatMap(([, qa]) =>
    typeof qa === 'object' && !Array.isArray(qa) ? Object.entries(qa) : []
  );

  return (
    <div className="card pw-detail">
      {/* Header */}
      <div className="pw-detail-header">
        <div>
          <span className="pw-detail-eyebrow">Order Detail</span>
          <h2 className="pw-detail-title">{serviceName}</h2>
        </div>
        <div className="pw-detail-header-right">
          <span className="pw-oc-badge" style={{ background: color + '1a', color }}>{label}</span>
          <button className="pw-close-btn" onClick={onClose} aria-label="Close">
            <LuX size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <OrderTimeline status={order.status} />

      {/* Meta strip */}
      <div className="pw-meta-strip">
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
        {order.assignedEmployee?.name && (
          <div className="pw-meta-item">
            <span className="pw-meta-label">Assigned to</span>
            <span className="pw-meta-value">{order.assignedEmployee.name}</span>
          </div>
        )}
      </div>

      {/* Brief / answers */}
      {briefEntries.length > 0 && (
        <div className="pw-brief">
          <span className="pw-section-label">Initial Brief</span>
          <div className="pw-brief-grid">
            {briefEntries.map(([question, answer]) => (
              <div key={question} className="pw-brief-card">
                <span className="pw-brief-q">{question}</span>
                <span className="pw-brief-a">{Array.isArray(answer) ? answer.join(', ') : answer}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pw-detail-footer">
        <Link to="/orders" state={{ selectOrderId: order._id }} className="pw-feedback-btn">View Full Order →</Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const socket = useSocket();

  useEffect(() => {
    getOrders()
      .then((r) => {
        const all = r.data.orders || r.data;
        const active = all.filter((o) => ACTIVE_STATUSES.has(o.status));
        setOrders(active);
        const first = active.find((o) => o.status === 'accepted') || active[0];
        if (first) setActiveOrder(first);
      })
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  // Live: keep the active-orders list and the open detail in sync
  useEffect(() => {
    if (!socket) return;
    const handle = ({ order }) => {
      if (!order?._id) return;
      const isActive = ACTIVE_STATUSES.has(order.status);
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o._id === order._id);
        if (!isActive) return idx === -1 ? prev : prev.filter((o) => o._id !== order._id);
        if (idx === -1) return [order, ...prev];
        const next = [...prev];
        next[idx] = order;
        return next;
      });
      setActiveOrder((cur) => {
        if (cur?._id !== order._id) return cur;
        return isActive ? order : null;
      });
    };
    socket.on('order:updated', handle);
    socket.on('order:created', handle);
    return () => {
      socket.off('order:updated', handle);
      socket.off('order:created', handle);
    };
  }, [socket]);

  if (loading) return <div className="loading">Loading workspace…</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="pw-page">
      <div className="pw-page-header">
        <div>
          <h1 className="pw-page-title">Project Workspace</h1>
          <p className="pw-page-sub">Manage your creative requests and monitor delivery progress with real-time updates.</p>
        </div>
      </div>

      <div className="pw-workspace">
        {/* Left: active orders list */}
        <div className="card pw-list-col">
          <div className="pw-list-header">
            <span className="pw-list-title">Active Orders</span>
            {orders.length > 0 && (
              <span className="pw-list-count">{orders.length} Order{orders.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="pw-order-list">
            {orders.length === 0 ? (
              <div className="pw-empty">
                <p>No active orders.</p>
                <Link to="/services" className="pw-empty-cta">Browse Services →</Link>
              </div>
            ) : (
              orders.map((o) => (
                <OrderCard
                  key={o._id}
                  order={o}
                  isActive={activeOrder?._id === o._id}
                  onClick={() => setActiveOrder(o)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="pw-detail-col">
          {activeOrder ? (
            <OrderDetail order={activeOrder} onClose={() => setActiveOrder(null)} />
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