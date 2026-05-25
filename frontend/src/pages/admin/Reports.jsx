import { useEffect, useState } from 'react';
import { getReportSummary, getOrderStats, getTopServices } from '../../api/admin';

export default function AdminReports() {
  const [summary, setSummary] = useState(null);
  const [orderStats, setOrderStats] = useState(null);
  const [topServices, setTopServices] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const loadReports = () => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    getReportSummary(params).then((r) => setSummary(r.data)).catch(() => setError('Failed to load summary'));
    getOrderStats(params).then((r) => setOrderStats(r.data)).catch(() => {});
    getTopServices(params).then((r) => setTopServices(r.data.topServices || [])).catch(() => {});
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadReports(); }, []);

  return (
    <div className="page">
      <h1>Reports</h1>

      <div className="filter-bar">
        <div className="form-group">
          <label>Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={loadReports}>Apply Filter</button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div className="section">
        <h2>P&amp;L Summary</h2>
        <div className="stat-grid">
          <div className="stat-card" style={{ borderTop: '4px solid #10b981' }}>
            <span className="stat-count">${summary?.revenue?.toFixed(2) ?? '—'}</span>
            <span className="stat-label">Revenue</span>
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
        <div className="stat-grid" style={{ marginTop: '1rem' }}>
          <div className="stat-card">
            <span className="stat-count">${summary?.expenses?.manual?.toFixed(2) ?? '—'}</span>
            <span className="stat-label">Manual Expenses</span>
          </div>
          <div className="stat-card">
            <span className="stat-count">${summary?.expenses?.internalCosts?.toFixed(2) ?? '—'}</span>
            <span className="stat-label">Internal Costs</span>
          </div>
          <div className="stat-card">
            <span className="stat-count">{summary?.paidInvoicesCount ?? '—'}</span>
            <span className="stat-label">Paid Invoices</span>
          </div>
        </div>
      </div>

      {orderStats && (
        <div className="section">
          <h2>Order Stats</h2>
          <div className="stat-grid">
            {Object.entries(orderStats.byStatus || {}).map(([status, count]) => (
              <div className="stat-card" key={status}>
                <span className="stat-count">{count}</span>
                <span className="stat-label">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topServices.length > 0 && (
        <div className="section">
          <h2>Top Services</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Department</th>
                <th>Order Count</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topServices.map((s) => (
                <tr key={s._id}>
                  <td>{s.name}</td>
                  <td>{s.department || '—'}</td>
                  <td>{s.orderCount}</td>
                  <td>${s.revenue?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
