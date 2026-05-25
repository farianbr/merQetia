import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyAssignments, acceptOrder, rejectOrder } from '../../api/orders';
import { useAuth } from '../../context/AuthContext';
import OrderTimeline from '../../components/OrderTimeline';

// ─── Order Card (workspace panel) ────────────────────────────────────────────
function WorkspaceCard({ order, isActive, onClick, statusColors, statusLabels }) {
  const serviceName = (order.services || []).map((s) => s.name).join(', ') || 'Order';
  const color = statusColors[order.status] || '#6b7280';
  const label = statusLabels[order.status] || order.status;
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
  const color = statusColors[order.status] || '#6b7280';
  const label = statusLabels[order.status] || order.status;
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
  rejected: '#ef4444',
  completed: '#10b981',
};

const STATUS_LABEL = {
  placed: 'Pending',
  assigned: 'New Request',
  accepted: 'In Progress',
  rejected: 'Declined',
  completed: 'Completed',
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [error, setError] = useState('');

  // Accept modal
  const [acceptModal, setAcceptModal] = useState(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [acceptError, setAcceptError] = useState('');

  // Reject modal
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchOrders = async () => {
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
  };

  useEffect(() => { fetchOrders(); }, []);

  const newRequests = orders.filter((o) => o.status === 'assigned');
  const activeOrders = orders.filter((o) => o.status === 'accepted');

  const handleAccept = async () => {
    if (!deliveryDate) { setAcceptError('Please pick a delivery date'); return; }
    setActionLoading(true);
    try {
      await acceptOrder(acceptModal, deliveryDate);
      setAcceptModal(null);
      fetchOrders();
    } catch (err) {
      setAcceptError(err.response?.data?.message || 'Failed to accept order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await rejectOrder(rejectModal, rejectReason);
      setRejectModal(null);
      fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to decline order');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="pw-page">
      {/* Header */}
      <div className="pw-page-header">
        <div>
          <h1 className="pw-page-title">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="pw-page-sub">Here's your work overview for today.</p>
        </div>
        <Link to="/employee/orders" className="btn-secondary">View All Orders →</Link>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* New Requests */}
      {newRequests.length > 0 && (
        <section className="emp-section">
          <div className="emp-section-header">
            <h2 className="emp-section-title">New Requests</h2>
            <span className="emp-section-badge">{newRequests.length} waiting</span>
          </div>
          <div className="ew-offers-list">
            {newRequests.map((order) => (
              <div className="ew-offer-card" key={order._id}>
                <div className="ew-offer-card-main">
                  <div className="ew-offer-card-top">
                    <div className="ew-offer-info">
                      <h3 className="ew-offer-title">
                        {order.services?.length > 0
                          ? order.services.map((s) => s.name).join(', ')
                          : `Order #${order._id.slice(-6).toUpperCase()}`}
                      </h3>
                      <div className="ew-offer-meta">
                        <span className="ew-offer-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          {order.clientId?.name || 'Unknown Client'}
                        </span>
                        <span className="ew-offer-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                          Received {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                        <span className="ew-offer-meta-item ew-offer-id">
                          #{order._id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ew-offer-budget">
                      <span className="ew-budget-amount">${order.totalPrice?.toFixed(2)}</span>
                      <span className="ew-budget-label">Fixed Price</span>
                    </div>
                  </div>
                  {order.summary && <p className="ew-offer-description">{order.summary}</p>}
                  {order.services?.length > 0 && (
                    <div className="ew-offer-tags">
                      {order.services.map((s, i) => (
                        <span key={i} className="ew-tag">{s.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="ew-offer-card-actions">
                  <button className="ew-btn-accept" onClick={() => { setAcceptModal(order._id); setDeliveryDate(''); setAcceptError(''); }}>
                    Accept
                  </button>
                  <button className="ew-btn-decline" onClick={() => { setRejectModal(order._id); setRejectReason(''); }}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
                {newRequests.length === 0 && (
                  <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Check back for new requests.</p>
                )}
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

      {/* Accept Modal */}
      {acceptModal && (
        <div className="modal-overlay" onClick={() => setAcceptModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Accept Order</h2>
            <p>Set an estimated delivery date to confirm acceptance.</p>
            {acceptError && <p className="error-msg">{acceptError}</p>}
            <label className="form-label">Delivery Date</label>
            <input
              type="date"
              className="input"
              min={today}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleAccept} disabled={actionLoading}>
                {actionLoading ? 'Accepting…' : 'Accept Order'}
              </button>
              <button className="btn-secondary" onClick={() => setAcceptModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Decline Order</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Optionally provide a reason for declining.</p>
            <label className="form-label">Reason (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. I'm fully booked this week"
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setRejectModal(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleReject} disabled={actionLoading}>
                {actionLoading ? 'Declining…' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
