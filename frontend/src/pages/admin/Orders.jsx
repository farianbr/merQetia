import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders } from '../../api/orders';

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
  assigned: 'Assigned',
  accepted: 'In Progress',
  overdue: 'Overdue',
  rejected: 'Rejected',
  completed: 'Completed',
};

function getDisplayStatus(order) {
  if (order.status === 'accepted' && order.deliveryDate && new Date(order.deliveryDate) < new Date()) {
    return 'overdue';
  }
  return order.status;
}

const STATUSES = ['all', 'placed', 'assigned', 'accepted', 'rejected', 'completed'];

function getDepartments(order) {
  return [...new Set((order.services || []).map((s) => s.department).filter(Boolean))].join(', ') || '—';
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getOrders()
      .then((r) => setOrders(r.data.orders || r.data))
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      const shortId = o._id.slice(-8).toUpperCase();
      const client = o.clientId?.name?.toLowerCase() || '';
      const employee = o.assignedEmployee?.name?.toLowerCase() || '';
      const dept = getDepartments(o).toLowerCase();
      const status = (STATUS_LABEL[getDisplayStatus(o)] || o.status).toLowerCase();
      const orderDate = new Date(o.createdAt).toLocaleDateString().toLowerCase();
      const deliveryDate = o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString().toLowerCase() : '';
      return (
        shortId.includes(q.toUpperCase()) ||
        client.includes(q) ||
        employee.includes(q) ||
        dept.includes(q) ||
        status.includes(q) ||
        orderDate.includes(q) ||
        deliveryDate.includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="page">
      <div className="section-header">
        <h1>All Orders</h1>
        <span className="orders-count">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* Search + filter bar */}
      <div className="orders-toolbar">
        <input
          type="search"
          className="input orders-search"
          placeholder="Search by ID, client, employee, department, status, date…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input orders-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No orders match your search.</p>
      ) : (
        <table className="data-table orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Client</th>
              <th>Department</th>
              <th>Status</th>
              <th>Total</th>
              <th>Employee</th>
              <th>Order Date</th>
              <th>Delivery Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr
                key={o._id}
                className="order-row"
                onClick={() => navigate(`/admin/orders/${o._id}`)}
              >
                <td>
                  <span className="order-id-chip">{o._id.slice(-8).toUpperCase()}</span>
                </td>
                <td>{o.clientId?.name || '—'}</td>
                <td>{getDepartments(o)}</td>
                <td>
                  <span className="badge" style={{ background: STATUS_COLORS[getDisplayStatus(o)] }}>
                    {STATUS_LABEL[getDisplayStatus(o)] || o.status}
                  </span>
                </td>
                <td>${o.totalPrice?.toFixed(2)}</td>
                <td>{o.assignedEmployee?.name || '—'}</td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>{o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
