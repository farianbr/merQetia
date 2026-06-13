import { useEffect, useState, useMemo } from 'react';
import { getInvoices, markAsPaid, voidInvoice, createInvoice, downloadPDF } from '../../api/invoices';
import { getOrders } from '../../api/orders';
import { LuDownload, LuPlus, LuTrash2, LuCheck, LuSearch } from 'react-icons/lu';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const TYPE_LABEL = { full: 'Full', advance: 'Advance', partial: 'Partial' };

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/* ── Create Invoice Modal ──────────────────────────────────────────── */
function CreateInvoiceModal({ onClose, onCreated }) {
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [form, setForm] = useState({ orderId: '', amount: '', type: 'advance', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getOrders({ limit: 200 })
      .then((r) => setOrders(r.data.orders || []))
      .catch(() => setError('Failed to load orders'))
      .finally(() => setOrdersLoading(false));
  }, []);

  const selectedOrder = orders.find((o) => o._id === form.orderId);
  const maxAmount = selectedOrder?.totalPrice ?? '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.orderId) { setError('Select an order'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Enter a valid amount'); return; }
    if (maxAmount && parseFloat(form.amount) > maxAmount) {
      setError(`Amount cannot exceed order total (${usd.format(maxAmount)})`);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await createInvoice({
        orderId: form.orderId,
        amount: parseFloat(form.amount),
        type: form.type,
        notes: form.notes || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Invoice</h2>
          <button className="pm-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Order</label>
            {ordersLoading ? (
              <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Loading orders…</p>
            ) : (
              <select
                className="field rp-date-input"
                style={{ width: '100%' }}
                value={form.orderId}
                onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value, amount: '' }))}
                disabled={submitting}
              >
                <option value="">— Select an order —</option>
                {orders
                  .filter((o) => o.status !== 'rejected')
                  .map((o) => {
                    const services = (o.services || []).map((s) => s.name).join(', ') || '—';
                    const client = o.clientId?.name || '—';
                    const shortId = o._id.slice(-6).toUpperCase();
                    return (
                      <option key={o._id} value={o._id}>
                        #{shortId} — {client} — {services}
                      </option>
                    );
                  })}
              </select>
            )}
            {selectedOrder && (
              <span style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
                Order total: {usd.format(selectedOrder.totalPrice)}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Type</label>
            <select
              className="field rp-date-input"
              style={{ width: '100%' }}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              disabled={submitting}
            >
              <option value="advance">Advance</option>
              <option value="partial">Partial</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Amount ($)</label>
            <input
              type="number"
              className="field rp-date-input"
              style={{ width: '100%' }}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              max={maxAmount || undefined}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="field rp-date-input"
              style={{ width: '100%', height: '72px', resize: 'vertical' }}
              placeholder="e.g. 50% advance payment"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={submitting}
              maxLength={300}
            />
          </div>

          {error && <p className="pm-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Admin Invoices Page ───────────────────────────────────────────── */
export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const r = await getInvoices(params);
      setInvoices(r.data.invoices || r.data || []);
    } catch {
      setError('Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter((inv) => {
      const clientName = inv.orderId?.clientId?.name || '';
      return (
        clientName.toLowerCase().includes(q) ||
        inv.invoiceNumber?.toLowerCase().includes(q)
      );
    });
  }, [invoices, search]);

  const counts = useMemo(() => ({
    all: invoices.length,
    paid: invoices.filter((i) => i.status === 'paid').length,
    unpaid: invoices.filter((i) => i.status === 'unpaid').length,
  }), [invoices]);

  const totalOutstanding = useMemo(
    () => invoices.filter((i) => i.status === 'unpaid').reduce((s, i) => s + i.amount, 0),
    [invoices],
  );

  const handleMarkPaid = async (id) => {
    setActionLoading(id + '-pay');
    try {
      await markAsPaid(id);
      setInvoices((prev) =>
        prev.map((inv) =>
          inv._id === id ? { ...inv, status: 'paid', paidAt: new Date().toISOString() } : inv,
        ),
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark as paid');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVoid = async (id) => {
    if (!window.confirm('Void this invoice? This cannot be undone.')) return;
    setActionLoading(id + '-void');
    try {
      await voidInvoice(id);
      setInvoices((prev) => prev.filter((inv) => inv._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to void invoice');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (inv) => {
    setDownloading(inv._id);
    try {
      const res = await downloadPDF(inv._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download PDF.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h1>Invoices</h1>
          <p className="subtitle">Manage billing and track payment status.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <LuPlus size={15} />
          New Invoice
        </button>
      </div>

      {error && <p className="page-error">{error}</p>}

      {/* Outstanding banner */}
      {totalOutstanding > 0 && (
        <div className="inv-outstanding-banner">
          <strong>{usd.format(totalOutstanding)}</strong> outstanding across{' '}
          {counts.unpaid} unpaid invoice{counts.unpaid !== 1 ? 's' : ''}
        </div>
      )}

      {/* Filters */}
      <div className="inv-toolbar">
        <div className="card rp-presets">
          {['all', 'paid', 'unpaid'].map((s) => (
            <button
              key={s}
              type="button"
              className={`rp-preset-btn${statusFilter === s ? ' rp-preset-btn--active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="inv-tab-count">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="inv-search">
          <LuSearch size={14} className="inv-search-icon" />
          <input
            type="text"
            className="field inv-search-input"
            placeholder="Search client or invoice #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center', fontSize: '.9rem' }}>
          No invoices match your filters.
        </div>
      ) : (
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Order</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => {
              const isPaid = inv.status === 'paid';
              const client = inv.orderId?.clientId;
              const orderId = inv.orderId?._id || inv.orderId;
              const orderShort = orderId ? `#${orderId.toString().slice(-6).toUpperCase()}` : '—';
              const isActing = actionLoading === inv._id + '-pay' || actionLoading === inv._id + '-void';

              return (
                <tr key={inv._id}>
                  <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                  <td>
                    {client ? (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{client.name}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{client.email}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '.85rem' }}>
                    {orderShort}
                  </td>
                  <td>
                    <span className="inv-type-tag">{TYPE_LABEL[inv.type] || inv.type}</span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{usd.format(inv.amount)}</td>
                  <td>
                    <span className={`badge ${isPaid ? 'badge-green' : 'badge-yellow'}`}>
                      {isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                    {isPaid && inv.paidAt && (
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
                        {fmtDate(inv.paidAt)}
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>
                    {fmtDate(inv.createdAt)}
                  </td>
                  <td className="action-cell">
                    <div className="action-cell-inner">
                      <button
                        className="inv-action-btn"
                        title="Download PDF"
                        disabled={downloading === inv._id}
                        onClick={() => handleDownload(inv)}
                      >
                        <LuDownload size={14} />
                      </button>
                      {!isPaid && (
                        <>
                          <button
                            className="btn-sm btn-primary"
                            title="Mark as paid"
                            disabled={isActing}
                            onClick={() => handleMarkPaid(inv._id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}
                          >
                            <LuCheck size={13} />
                            {actionLoading === inv._id + '-pay' ? '…' : 'Mark Paid'}
                          </button>
                          <button
                            className="inv-void-btn"
                            title="Void invoice"
                            disabled={isActing}
                            onClick={() => handleVoid(inv._id)}
                          >
                            <LuTrash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {showCreate && (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchInvoices}
        />
      )}
    </div>
  );
}
