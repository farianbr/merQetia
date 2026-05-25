import { useEffect, useState } from 'react';
import { getReportSummary, getOrderStats } from '../../api/admin';

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [orderStats, setOrderStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getReportSummary()
      .then((r) => setSummary(r.data))
      .catch(() => setError('Failed to load report'));
    getOrderStats()
      .then((r) => setOrderStats(r.data))
      .catch(() => {});
  }, []);

  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="page">
      <h1>Admin Dashboard</h1>

      <div className="stat-grid">
        <div className="stat-card" style={{ borderTop: '4px solid #10b981' }}>
          <span className="stat-count">${summary?.revenue?.toFixed(2) ?? '—'}</span>
          <span className="stat-label">Total Revenue</span>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid #ef4444' }}>
          <span className="stat-count">${summary?.expenses?.total?.toFixed(2) ?? '—'}</span>
          <span className="stat-label">Total Expenses</span>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid #3b82f6' }}>
          <span className="stat-count">${summary?.profit?.toFixed(2) ?? '—'}</span>
          <span className="stat-label">Net Profit</span>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid #8b5cf6' }}>
          <span className="stat-count">{summary?.profitMargin ?? '—'}</span>
          <span className="stat-label">Profit Margin</span>
        </div>
      </div>

      {orderStats && (
        <div className="section">
          <h2>Orders Overview</h2>
          <div className="stat-grid">
            {Object.entries(orderStats.byStatus || {}).map(([status, count]) => (
              <div className="stat-card" key={status}>
                <span className="stat-count">{count}</span>
                <span className="stat-label">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
          <p className="total-note">Total Orders: <strong>{orderStats.totalOrders}</strong></p>
        </div>
      )}

      <div className="section">
        <h2>Expense Breakdown</h2>
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-count">${summary?.expenses?.manual?.toFixed(2) ?? '—'}</span>
            <span className="stat-label">Manual Expenses</span>
          </div>
          <div className="stat-card">
            <span className="stat-count">${summary?.expenses?.internalCosts?.toFixed(2) ?? '—'}</span>
            <span className="stat-label">Service Internal Costs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
