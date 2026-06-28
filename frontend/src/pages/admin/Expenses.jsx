import { useEffect, useMemo, useState } from 'react';
import {
  getExpenses, createExpense, updateExpense, deleteExpense,
  addExpenseTransaction, deleteExpenseTransaction, getEmployees,
} from '../../api/admin';
import {
  LuPlus, LuTrash2, LuPencil, LuUsers, LuRepeat, LuReceipt, LuArrowLeft, LuX,
} from 'react-icons/lu';

const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

const TYPE_META = {
  payroll:       { label: 'Salary / Payroll', Icon: LuUsers,   desc: 'Recurring pay for an employee' },
  subscription:  { label: 'Subscription',     Icon: LuRepeat,  desc: 'Recurring software or service' },
  'one-time':    { label: 'One-time',         Icon: LuReceipt, desc: 'A single purchase or cost' },
};

const BILLING_CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly'];
const ONE_TIME_CATEGORIES = ['Software', 'Tooling', 'Marketing', 'Hardware', 'Travel', 'Office', 'Other'];

const typeLabel = (t) => TYPE_META[t]?.label || (t ? t.charAt(0).toUpperCase() + t.slice(1) : '—');
const cycleLabel = (c) => (c && c !== 'one-time' ? c.charAt(0).toUpperCase() + c.slice(1) : 'One-time');
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const today = () => new Date().toISOString().slice(0, 10);

/* ── Step 1: choose the expense type ──────────────────────────────────── */
function TypePickerModal({ onSelect, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>What kind of expense?</h2>
          <button className="pm-close-btn" onClick={onClose} aria-label="Close"><LuX size={18} /></button>
        </div>
        <p className="subtitle" style={{ marginTop: 0 }}>Pick a type to get the right form.</p>
        <div className="exp-type-grid">
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <button key={key} type="button" className="exp-type-card" onClick={() => onSelect(key)}>
              <span className="exp-type-card-icon"><meta.Icon size={22} /></span>
              <span className="exp-type-card-label">{meta.label}</span>
              <span className="exp-type-card-desc">{meta.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: type-specific form ───────────────────────────────────────── */
function ExpenseFormModal({ type, editing, employees, onBack, onClose, onSaved }) {
  const isEdit = !!editing;
  const [form, setForm] = useState(() => ({
    title: editing?.title || '',
    amount: '',
    date: editing?.date?.slice(0, 10) || today(),
    billingCycle: editing?.billingCycle && editing.billingCycle !== 'one-time' ? editing.billingCycle : 'monthly',
    employee: editing?.employee?._id || editing?.employee || '',
    employeeName: editing?.employeeName || '',
    vendor: editing?.vendor || '',
    renewalDate: editing?.renewalDate?.slice(0, 10) || '',
    category: editing?.category || 'Software',
    notes: editing?.notes || '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onEmployeeSelect = (id) => {
    const emp = employees.find((e) => e._id === id);
    setForm((f) => ({ ...f, employee: id, employeeName: emp ? emp.name : f.employeeName }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isEdit && (!form.amount || parseFloat(form.amount) <= 0)) {
      return setError('Enter a valid amount.');
    }
    if (type === 'payroll' && !form.employeeName.trim()) {
      return setError('Employee name is required.');
    }
    if (type !== 'payroll' && !form.title.trim()) {
      return setError(type === 'subscription' ? 'Service name is required.' : 'Title is required.');
    }

    const title = type === 'payroll'
      ? (form.title.trim() || `Salary — ${form.employeeName.trim()}`)
      : form.title.trim();

    const payload = { type, title, notes: form.notes || undefined };
    if (!isEdit) { payload.amount = parseFloat(form.amount); payload.date = form.date; }

    if (type === 'payroll') {
      payload.billingCycle = form.billingCycle;
      payload.employeeName = form.employeeName.trim();
      payload.employee = form.employee || null;
    } else if (type === 'subscription') {
      payload.billingCycle = form.billingCycle;
      payload.vendor = form.vendor || undefined;
      payload.renewalDate = form.renewalDate || undefined;
    } else {
      payload.billingCycle = 'one-time';
      payload.category = form.category || undefined;
    }

    setSubmitting(true);
    try {
      if (isEdit) await updateExpense(editing._id, payload);
      else await createExpense(payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const meta = TYPE_META[type] || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            {!isEdit && (
              <button className="pm-close-btn" onClick={onBack} aria-label="Back" style={{ marginRight: '.25rem' }}>
                <LuArrowLeft size={18} />
              </button>
            )}
            {isEdit ? 'Edit' : 'New'} {meta.label}
          </h2>
          <button className="pm-close-btn" onClick={onClose} aria-label="Close"><LuX size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── Payroll ── */}
          {type === 'payroll' && (
            <>
              <div className="form-group">
                <label className="form-label">Employee</label>
                <select
                  className="field" style={{ width: '100%' }}
                  value={form.employee}
                  onChange={(e) => onEmployeeSelect(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">— Custom / not listed —</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Employee name</label>
                <input
                  className="field" style={{ width: '100%' }}
                  placeholder="e.g. Jane Doe"
                  value={form.employeeName}
                  onChange={(e) => set('employeeName', e.target.value)}
                  disabled={submitting}
                />
              </div>
            </>
          )}

          {/* ── Subscription ── */}
          {type === 'subscription' && (
            <>
              <div className="form-group">
                <label className="form-label">Service name</label>
                <input
                  className="field" style={{ width: '100%' }}
                  placeholder="e.g. Adobe Creative Cloud"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor (optional)</label>
                <input
                  className="field" style={{ width: '100%' }}
                  placeholder="e.g. Adobe Inc."
                  value={form.vendor}
                  onChange={(e) => set('vendor', e.target.value)}
                  disabled={submitting}
                />
              </div>
            </>
          )}

          {/* ── One-time ── */}
          {type === 'one-time' && (
            <>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  className="field" style={{ width: '100%' }}
                  placeholder="e.g. New office laptop"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="field" style={{ width: '100%' }}
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  disabled={submitting}
                >
                  {ONE_TIME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}

          {/* ── Shared: amount + cycle/date ── */}
          <div className="form-row">
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">{type === 'one-time' ? 'Amount (€)' : 'Amount per cycle (€)'}</label>
                <input
                  type="number" className="field" style={{ width: '100%' }}
                  placeholder="0.00" min="0.01" step="0.01"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  disabled={submitting}
                />
              </div>
            )}
            {type !== 'one-time' && (
              <div className="form-group">
                <label className="form-label">Billing cycle</label>
                <select
                  className="field" style={{ width: '100%' }}
                  value={form.billingCycle}
                  onChange={(e) => set('billingCycle', e.target.value)}
                  disabled={submitting}
                >
                  {BILLING_CYCLES.map((c) => <option key={c} value={c}>{cycleLabel(c)}</option>)}
                </select>
              </div>
            )}
          </div>

          {!isEdit && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  {type === 'payroll' ? 'First payment date' : type === 'subscription' ? 'Start date' : 'Date'}
                </label>
                <input
                  type="date" className="field" style={{ width: '100%' }}
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                  disabled={submitting}
                />
              </div>
              {type === 'subscription' && (
                <div className="form-group">
                  <label className="form-label">Next renewal (optional)</label>
                  <input
                    type="date" className="field" style={{ width: '100%' }}
                    value={form.renewalDate}
                    onChange={(e) => set('renewalDate', e.target.value)}
                    disabled={submitting}
                  />
                </div>
              )}
            </div>
          )}

          {isEdit && type === 'subscription' && (
            <div className="form-group">
              <label className="form-label">Next renewal (optional)</label>
              <input
                type="date" className="field" style={{ width: '100%' }}
                value={form.renewalDate}
                onChange={(e) => set('renewalDate', e.target.value)}
                disabled={submitting}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="field" style={{ width: '100%', height: '64px', resize: 'vertical' }}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
          </div>

          {isEdit && (
            <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', margin: '0 0 .5rem' }}>
              The amount is calculated from recorded transactions. Add or remove payments from the expense detail view.
            </p>
          )}

          {error && <p className="pm-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Detail + transaction history ─────────────────────────────────────── */
function ExpenseDetailModal({ expense, onClose, onChanged, onEdit, onDelete }) {
  const [exp, setExp] = useState(expense);
  const [tx, setTx] = useState({ amount: '', date: today(), method: '', notes: '' });
  const [adding, setAdding] = useState(false);
  const [busyTx, setBusyTx] = useState(null);
  const [error, setError] = useState('');

  const sortedTx = useMemo(
    () => [...(exp.transactions || [])].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [exp.transactions],
  );

  const sync = (updated) => { setExp(updated); onChanged(updated); };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    if (!tx.amount || parseFloat(tx.amount) <= 0) return setError('Enter a valid amount.');
    setAdding(true);
    try {
      const r = await addExpenseTransaction(exp._id, {
        amount: parseFloat(tx.amount),
        date: tx.date,
        method: tx.method || undefined,
        notes: tx.notes || undefined,
      });
      sync(r.data.expense);
      setTx({ amount: '', date: today(), method: '', notes: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add transaction.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteTx = async (txId) => {
    setBusyTx(txId);
    try {
      const r = await deleteExpenseTransaction(exp._id, txId);
      sync(r.data.expense);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove transaction.');
    } finally {
      setBusyTx(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{exp.title}</h2>
          <button className="pm-close-btn" onClick={onClose} aria-label="Close"><LuX size={18} /></button>
        </div>

        <div className="exp-detail-meta">
          <span className="inv-type-tag">{typeLabel(exp.type)}</span>
          {exp.type !== 'one-time' && <span className="exp-chip">{cycleLabel(exp.billingCycle)}</span>}
          {exp.employeeName && <span className="exp-chip">{exp.employeeName}</span>}
          {exp.vendor && <span className="exp-chip">{exp.vendor}</span>}
          {exp.category && <span className="exp-chip">{exp.category}</span>}
          {exp.renewalDate && <span className="exp-chip">Renews {fmtDate(exp.renewalDate)}</span>}
          {exp.status === 'cancelled' && <span className="badge badge-yellow">Cancelled</span>}
        </div>

        <div className="exp-detail-total">
          <span className="stat-label">Total spent</span>
          <span className="stat-count">{eur.format(exp.amount || 0)}</span>
        </div>

        {exp.notes && <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>{exp.notes}</p>}

        <h3 style={{ fontSize: '.95rem', margin: '1rem 0 .5rem' }}>Transaction history</h3>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Amount</th><th>Method</th><th>Notes</th><th></th></tr>
            </thead>
            <tbody>
              {sortedTx.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions yet.</td></tr>
              ) : sortedTx.map((t) => (
                <tr key={t._id}>
                  <td>{fmtDate(t.date)}</td>
                  <td style={{ fontWeight: 600 }}>{eur.format(t.amount)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{t.method || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{t.notes || '—'}</td>
                  <td className="action-cell">
                    <button
                      className="inv-void-btn" title="Remove transaction"
                      disabled={busyTx === t._id}
                      onClick={() => handleDeleteTx(t._id)}
                    >
                      <LuTrash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Record a payment */}
        <form onSubmit={handleAdd} className="exp-tx-form">
          <h4 style={{ fontSize: '.85rem', margin: '0 0 .5rem' }}>Record a payment</h4>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Amount (€)</label>
              <input
                type="number" className="field" style={{ width: '100%' }}
                placeholder="0.00" min="0.01" step="0.01"
                value={tx.amount} onChange={(e) => setTx((s) => ({ ...s, amount: e.target.value }))}
                disabled={adding}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date" className="field" style={{ width: '100%' }}
                value={tx.date} onChange={(e) => setTx((s) => ({ ...s, date: e.target.value }))}
                disabled={adding}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Method (optional)</label>
              <input
                className="field" style={{ width: '100%' }}
                placeholder="e.g. Bank transfer"
                value={tx.method} onChange={(e) => setTx((s) => ({ ...s, method: e.target.value }))}
                disabled={adding}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input
                className="field" style={{ width: '100%' }}
                value={tx.notes} onChange={(e) => setTx((s) => ({ ...s, notes: e.target.value }))}
                disabled={adding}
              />
            </div>
          </div>
          {error && <p className="pm-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={adding}>
            <LuPlus size={14} /> {adding ? 'Adding…' : 'Add transaction'}
          </button>
        </form>

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <button className="btn-danger" onClick={() => onDelete(exp)}>
            <LuTrash2 size={14} /> Delete expense
          </button>
          <button className="btn-secondary" onClick={() => onEdit(exp)}>
            <LuPencil size={14} /> Edit details
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [formState, setFormState] = useState(null); // { type, editing }
  const [detail, setDetail] = useState(null);

  const fetchExpenses = () =>
    getExpenses().then((r) => setExpenses(r.data.expenses || r.data || []));

  useEffect(() => {
    fetchExpenses().catch(() => setError('Failed to load expenses.'));
    getEmployees().then((r) => setEmployees(r.data.employees || [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return expenses;
    if (typeFilter === 'one-time') return expenses.filter((e) => !['payroll', 'subscription'].includes(e.type));
    return expenses.filter((e) => e.type === typeFilter);
  }, [expenses, typeFilter]);

  const total = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

  const handleSaved = () => {
    setFormState(null);
    fetchExpenses();
  };

  const handleDelete = async (exp) => {
    if (!window.confirm(`Delete "${exp.title}" and its transaction history?`)) return;
    try {
      await deleteExpense(exp._id);
      setDetail(null);
      fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed.');
    }
  };

  const onDetailChanged = (updated) => {
    setExpenses((prev) => prev.map((e) => (e._id === updated._id ? { ...e, ...updated } : e)));
  };

  const TYPE_TABS = ['all', 'payroll', 'subscription', 'one-time'];

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h1>Expenses</h1>
          <p className="subtitle">Track payroll, subscriptions and one-off costs.</p>
        </div>
        <button className="btn-primary" onClick={() => setPickerOpen(true)}>
          <LuPlus size={15} /> Add Expense
        </button>
      </div>

      {error && <p className="page-error">{error}</p>}

      <div className="stat-card" style={{ marginBottom: '1.5rem', maxWidth: 220 }}>
        <span className="stat-count">{eur.format(total)}</span>
        <span className="stat-label">
          {typeFilter === 'all' ? 'Total Expenses' : `Total — ${typeLabel(typeFilter)}`}
        </span>
      </div>

      <div className="card rp-presets" style={{ marginBottom: '1rem' }}>
        {TYPE_TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`rp-preset-btn${typeFilter === t ? ' rp-preset-btn--active' : ''}`}
            onClick={() => setTypeFilter(t)}
          >
            {t === 'all' ? 'All' : typeLabel(t)}
          </button>
        ))}
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Cycle</th>
              <th>Total</th>
              <th>Payments</th>
              <th>Last activity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                No expenses yet.
              </td></tr>
            ) : filtered.map((e) => (
              <tr key={e._id} className="exp-row" onClick={() => setDetail(e)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>
                  {e.title}
                  {e.employeeName && e.type === 'payroll' && (
                    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{e.employeeName}</div>
                  )}
                </td>
                <td><span className="inv-type-tag">{typeLabel(e.type)}</span></td>
                <td style={{ color: 'var(--text-muted)' }}>{e.type === 'payroll' || e.type === 'subscription' ? cycleLabel(e.billingCycle) : '—'}</td>
                <td style={{ fontWeight: 700 }}>{eur.format(e.amount || 0)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{e.transactions?.length || 0}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>{fmtDate(e.date)}</td>
                <td className="action-cell" onClick={(ev) => ev.stopPropagation()}>
                  <button className="btn-sm btn-secondary" onClick={() => setFormState({ type: e.type, editing: e })}>Edit</button>
                  <button className="btn-sm btn-danger" onClick={() => handleDelete(e)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pickerOpen && (
        <TypePickerModal
          onClose={() => setPickerOpen(false)}
          onSelect={(type) => { setPickerOpen(false); setFormState({ type, editing: null }); }}
        />
      )}

      {formState && (
        <ExpenseFormModal
          type={formState.editing ? (['payroll', 'subscription'].includes(formState.editing.type) ? formState.editing.type : 'one-time') : formState.type}
          editing={formState.editing}
          employees={employees}
          onBack={() => { setFormState(null); setPickerOpen(true); }}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}

      {detail && (
        <ExpenseDetailModal
          expense={detail}
          onClose={() => setDetail(null)}
          onChanged={onDetailChanged}
          onEdit={(exp) => { setDetail(null); setFormState({ type: exp.type, editing: exp }); }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
