import { useEffect, useState } from 'react';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../../api/admin';
import { useForm } from 'react-hook-form';

const EXPENSE_TYPES = ['payroll', 'subscription', 'tooling', 'marketing', 'other'];

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm();

  const fetchExpenses = () =>
    getExpenses().then((r) => setExpenses(r.data.expenses || r.data));

  useEffect(() => { fetchExpenses(); }, []);

  const openEdit = (exp) => {
    setEditing(exp);
    setValue('title', exp.title);
    setValue('amount', exp.amount);
    setValue('type', exp.type);
    setValue('date', exp.date?.slice(0, 10));
    setValue('notes', exp.notes);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    reset();
    setShowForm(true);
  };

  const onSubmit = async (data) => {
    try {
      setError('');
      if (editing) {
        await updateExpense(editing._id, data);
      } else {
        await createExpense(data);
      }
      setShowForm(false);
      reset();
      setEditing(null);
      fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await deleteExpense(id);
      fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="page">
      <div className="section-header">
        <h1>Expenses</h1>
        <button className="btn-primary" onClick={openCreate}>+ Add Expense</button>
      </div>
      {error && <p className="error-msg">{error}</p>}

      <div className="stat-card" style={{ marginBottom: '1.5rem', maxWidth: 200 }}>
        <span className="stat-count">€{total.toFixed(2)}</span>
        <span className="stat-label">Total Expenses</span>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editing ? 'Edit Expense' : 'New Expense'}</h2>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-group">
                <label>Title</label>
                <input {...register('title', { required: true })} placeholder="Expense title" />
                {errors.title && <span className="field-error">Required</span>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount (€)</label>
                  <input type="number" step="0.01" {...register('amount', { required: true, min: 0 })} />
                  {errors.amount && <span className="field-error">Required</span>}
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select {...register('type', { required: true })}>
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" {...register('date')} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea {...register('notes')} rows={2} placeholder="Optional notes" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e._id}>
              <td>{e.title}</td>
              <td>{e.type}</td>
              <td>€{e.amount?.toFixed(2)}</td>
              <td>{e.date ? new Date(e.date).toLocaleDateString() : '—'}</td>
              <td>
                <button className="btn-sm btn-secondary" onClick={() => openEdit(e)}>Edit</button>
                <button className="btn-sm btn-danger" onClick={() => handleDelete(e._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
