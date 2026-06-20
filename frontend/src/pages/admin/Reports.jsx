import { useEffect, useState } from 'react';
import {
  LuChartColumn,
  LuDollarSign,
  LuPercent,
  LuReceipt,
  LuTrendingDown,
  LuTrendingUp,
  LuTrophy,
  LuWallet,
} from 'react-icons/lu';
import { getReportSummary, getOrderStats, getTopServices } from '../../api/admin';

const STATUS_CONFIG = {
  placed: { label: 'Not Started', color: '#9ca3af' },
  assigned: { label: 'Assigned', color: '#3b82f6' },
  accepted: { label: 'In Progress', color: '#06b6d4' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  completed: { label: 'Completed', color: '#10b981' },
};

const PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'month', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'quarter', label: 'Last 3 Months' },
  { key: 'year', label: 'This Year' },
];

const toInputDate = (d) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const presetRange = (key) => {
  const now = new Date();
  switch (key) {
    case 'month':
      return [new Date(now.getFullYear(), now.getMonth(), 1), now];
    case 'lastMonth':
      return [
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
        new Date(now.getFullYear(), now.getMonth(), 0),
      ];
    case 'quarter':
      return [new Date(now.getFullYear(), now.getMonth() - 2, 1), now];
    case 'year':
      return [new Date(now.getFullYear(), 0, 1), now];
    default:
      return [null, null];
  }
};

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmtMoney = (v) => usd.format(v ?? 0);

const fmtDate = (s) =>
  new Date(`${s}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function KpiCard({ icon, iconBg, iconColor, label, value, valueColor, sub }) {
  return (
    <div className="card rp-kpi">
      <span className="rp-kpi-icon" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </span>
      <div className="rp-kpi-body">
        <span className="rp-kpi-label">{label}</span>
        <span className="rp-kpi-value" style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </span>
        {sub && <span className="rp-kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function AdminReports() {
  const [summary, setSummary] = useState(null);
  const [orderStats, setOrderStats] = useState(null);
  const [topServices, setTopServices] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState('all');
  const [applied, setApplied] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = async (start, end) => {
    setLoading(true);
    setError('');
    const params = { limit: 10 };
    if (start) params.startDate = start;
    if (end) params.endDate = end;

    const [sumRes, statRes, topRes] = await Promise.allSettled([
      getReportSummary(params),
      getOrderStats(params),
      getTopServices(params),
    ]);

    if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
    else setError('Failed to load report data. Please try again.');
    if (statRes.status === 'fulfilled') setOrderStats(statRes.value.data);
    if (topRes.status === 'fulfilled') setTopServices(topRes.value.data.topServices || []);

    setApplied({ start: start || '', end: end || '' });
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReports('', '');
  }, []);

  const applyPreset = (key) => {
    setPreset(key);
    const [s, e] = presetRange(key);
    const sv = s ? toInputDate(s) : '';
    const ev = e ? toInputDate(e) : '';
    setStartDate(sv);
    setEndDate(ev);
    loadReports(sv, ev);
  };

  const applyCustom = (e) => {
    e.preventDefault();
    setPreset('');
    loadReports(startDate, endDate);
  };

  const periodLabel =
    !applied.start && !applied.end
      ? 'All time'
      : `${applied.start ? fmtDate(applied.start) : 'Beginning'} – ${
          applied.end ? fmtDate(applied.end) : 'Today'
        }`;

  const profit = summary?.profit ?? 0;
  const expManual = summary?.expenses?.manual ?? 0;
  const expInternal = summary?.expenses?.internalCosts ?? 0;
  const expTotal = summary?.expenses?.total ?? 0;

  const totalOrders = orderStats?.totalOrders ?? 0;
  const byStatus = orderStats?.byStatus ?? {};

  const maxServiceRevenue = Math.max(...topServices.map((s) => s.revenue || 0), 1);

  if (loading && !summary) {
    return (
      <div className="page">
        <h1>Reports</h1>
        <div className="loading">Loading reports…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="rp-header">
        <div>
          <h1>Reports</h1>
          <p className="subtitle">Profit &amp; loss, order volume, and top services.</p>
        </div>
      </div>

      {/* ── Period filter ── */}
      <div className="rp-toolbar">
        <div className="card rp-presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`rp-preset-btn${preset === p.key ? ' rp-preset-btn--active' : ''}`}
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <form className="rp-dates" onSubmit={applyCustom}>
          <input
            type="date"
            className="rp-date-input"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date"
          />
          <span className="rp-date-sep">to</span>
          <input
            type="date"
            className="rp-date-input"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            Apply
          </button>
        </form>
      </div>

      {error && <p className="page-error">{error}</p>}

      <div className={`rp-content${loading ? ' rp-content--loading' : ''}`}>
        {/* ── P&L KPIs ── */}
        <div className="section">
          <div className="rp-section-head">
            <h2>P&amp;L Summary</h2>
            <span className="rp-period-tag">{periodLabel}</span>
          </div>
          <div className="rp-kpi-grid">
            <KpiCard
              icon={<LuDollarSign size={19} />}
              iconBg="#d1fae5"
              iconColor="#059669"
              label="Revenue"
              value={fmtMoney(summary?.revenue)}
              sub={`${summary?.paidInvoicesCount ?? 0} paid invoice${
                (summary?.paidInvoicesCount ?? 0) === 1 ? '' : 's'
              }`}
            />
            <KpiCard
              icon={<LuReceipt size={19} />}
              iconBg="#fee2e2"
              iconColor="#dc2626"
              label="Total Expenses"
              value={fmtMoney(expTotal)}
              sub="Manual + internal costs"
            />
            <KpiCard
              icon={profit < 0 ? <LuTrendingDown size={19} /> : <LuTrendingUp size={19} />}
              iconBg={profit < 0 ? '#fee2e2' : '#dbeafe'}
              iconColor={profit < 0 ? '#dc2626' : '#2563eb'}
              label="Net Profit"
              value={fmtMoney(profit)}
              valueColor={profit < 0 ? '#dc2626' : '#059669'}
              sub={profit < 0 ? 'Operating at a loss' : 'Revenue minus expenses'}
            />
            <KpiCard
              icon={<LuPercent size={19} />}
              iconBg="#cffafe"
              iconColor="#0e7490"
              label="Profit Margin"
              value={summary?.profitMargin ?? '0%'}
              sub="Of total revenue"
            />
          </div>
        </div>

        {/* ── Breakdown cards ── */}
        <div className="rp-grid-2">
          <div className="rp-card">
            <div className="rp-card-head">
              <LuWallet size={16} className="rp-card-icon" />
              <h3 className="rp-card-title">Expense Breakdown</h3>
            </div>
            {expTotal > 0 ? (
              <>
                <div className="rp-bar">
                  {expManual > 0 && (
                    <div
                      className="rp-bar-seg"
                      style={{ flex: expManual, background: '#f59e0b' }}
                    />
                  )}
                  {expInternal > 0 && (
                    <div
                      className="rp-bar-seg"
                      style={{ flex: expInternal, background: '#0891b2' }}
                    />
                  )}
                </div>
                <div className="rp-legend">
                  <div className="rp-legend-row">
                    <span className="rp-dot" style={{ background: '#f59e0b' }} />
                    <span className="rp-legend-label">Manual expenses</span>
                    <span className="rp-legend-val">{fmtMoney(expManual)}</span>
                    <span className="rp-legend-pct">
                      {Math.round((expManual / expTotal) * 100)}%
                    </span>
                  </div>
                  <div className="rp-legend-row">
                    <span className="rp-dot" style={{ background: '#0891b2' }} />
                    <span className="rp-legend-label">
                      Internal costs (completed orders)
                    </span>
                    <span className="rp-legend-val">{fmtMoney(expInternal)}</span>
                    <span className="rp-legend-pct">
                      {Math.round((expInternal / expTotal) * 100)}%
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="rp-empty">No expenses recorded for this period.</p>
            )}
          </div>

          <div className="rp-card">
            <div className="rp-card-head">
              <LuChartColumn size={16} className="rp-card-icon" />
              <h3 className="rp-card-title">Orders by Status</h3>
              <span className="rp-card-total">{totalOrders} total</span>
            </div>
            {totalOrders > 0 ? (
              <>
                <div className="rp-bar">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) =>
                    byStatus[key] > 0 ? (
                      <div
                        key={key}
                        className="rp-bar-seg"
                        style={{ flex: byStatus[key], background: cfg.color }}
                        title={`${cfg.label}: ${byStatus[key]}`}
                      />
                    ) : null,
                  )}
                </div>
                <div className="rp-legend">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <div className="rp-legend-row" key={key}>
                      <span className="rp-dot" style={{ background: cfg.color }} />
                      <span className="rp-legend-label">{cfg.label}</span>
                      <span className="rp-legend-val">{byStatus[key] ?? 0}</span>
                      <span className="rp-legend-pct">
                        {Math.round(((byStatus[key] ?? 0) / totalOrders) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="rp-empty">No orders placed in this period.</p>
            )}
          </div>
        </div>

        {/* ── Top services ── */}
        <div className="rp-card">
          <div className="rp-card-head">
            <LuTrophy size={16} className="rp-card-icon" />
            <h3 className="rp-card-title">Top Services</h3>
            <span className="rp-card-total">by order count</span>
          </div>
          {topServices.length > 0 ? (
            <div className="table-scroll">
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th-rank">#</th>
                  <th>Service</th>
                  <th>Department</th>
                  <th className="rp-th-num">Orders</th>
                  <th className="rp-th-num">Revenue</th>
                  <th className="rp-th-share">Share</th>
                </tr>
              </thead>
              <tbody>
                {topServices.map((s, i) => (
                  <tr key={s._id}>
                    <td>
                      <span className={`rp-rank${i < 3 ? ` rp-rank--${i + 1}` : ''}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="rp-td-name">{s.name}</td>
                    <td>
                      <span className="rp-dept-tag">{s.department || '—'}</span>
                    </td>
                    <td className="rp-td-num">{s.orderCount}</td>
                    <td className="rp-td-num rp-td-revenue">{fmtMoney(s.revenue)}</td>
                    <td>
                      <div className="rp-share-track">
                        <div
                          className="rp-share-fill"
                          style={{
                            width: `${Math.max(
                              ((s.revenue || 0) / maxServiceRevenue) * 100,
                              2,
                            )}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <p className="rp-empty">No service activity in this period.</p>
          )}
        </div>
      </div>
    </div>
  );
}
