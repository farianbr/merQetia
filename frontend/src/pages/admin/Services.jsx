import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { getServices, createService, updateService, deleteService } from '../../api/services';
import { LuInfo } from 'react-icons/lu';

const DEPT_COLORS = {
  Creative: { bg: '#cffafe', text: '#155e75' },
  Strategy: { bg: '#dbeafe', text: '#1d4ed8' },
  'Media Buying': { bg: '#dcfce7', text: '#15803d' },
};

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [error, setError] = useState('');
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm();

  const fetchServices = () =>
    getServices().then((r) => setServices(r.data.services || r.data));

  useEffect(() => { fetchServices(); }, []);

  const openEdit = (svc) => {
    setEditing(svc);
    setValue('name', svc.name);
    setValue('description', svc.description);
    setValue('price', svc.price);
    setValue('internalCost', svc.internalCost);
    setValue('department', svc.department);
    setQuestions(svc.questions || []);
    setNewQuestion('');
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    reset();
    setQuestions([]);
    setNewQuestion('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setQuestions([]);
    setNewQuestion('');
    reset();
  };

  const addQuestion = () => {
    const q = newQuestion.trim();
    if (!q || questions.includes(q)) return;
    setQuestions([...questions, q]);
    setNewQuestion('');
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const onSubmit = async (data) => {
    try {
      setError('');
      const payload = { ...data, questions };
      if (editing) {
        await updateService(editing._id, payload);
      } else {
        await createService(payload);
      }
      closeForm();
      fetchServices();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this service?')) return;
    try {
      await deleteService(id);
      fetchServices();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h1>Services</h1>
          <p className="subtitle">{services.length} service{services.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New Service</button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {services.length === 0 ? (
        <div className="svc-empty">
          <p>No services yet.</p>
          <button className="btn-primary" onClick={openCreate}>Create your first service</button>
        </div>
      ) : (
        <div className="svc-grid">
          {services.map((s) => {
            const deptStyle = DEPT_COLORS[s.department] || { bg: '#f3f4f6', text: '#374151' };
            return (
              <div className={`svc-card ${!s.isActive ? 'svc-card--inactive' : ''}`} key={s._id}>
                <div className="svc-card-top">
                  <span
                    className="svc-dept-tag"
                    style={{ background: deptStyle.bg, color: deptStyle.text }}
                  >
                    {s.department}
                  </span>
                  {!s.isActive && <span className="svc-inactive-tag">Inactive</span>}
                </div>

                <div className="svc-card-body">
                  <h3 className="svc-name">{s.name}</h3>
                  {s.description && (
                    <p className="svc-desc">{s.description}</p>
                  )}
                </div>

                <div className="svc-card-pricing">
                  <div className="svc-price-item">
                    <span className="svc-price-label">Client Price</span>
                    <span className="svc-price-value">${s.price?.toFixed(2)}</span>
                  </div>
                  <div className="svc-price-divider" />
                  <div className="svc-price-item">
                    <span className="svc-price-label">Internal Cost</span>
                    <span className="svc-price-value svc-price-value--cost">${s.internalCost?.toFixed(2)}</span>
                  </div>
                </div>

                {s.questions?.length > 0 && (
                  <div className="svc-questions-hint">
                    <LuInfo size={14} />
                    {s.questions.length} intake question{s.questions.length !== 1 ? 's' : ''}
                  </div>
                )}

                <div className="svc-card-actions">
                  <button className="btn-sm btn-secondary" onClick={() => openEdit(s)}>Edit</button>
                  <button className="btn-sm btn-danger" onClick={() => handleDelete(s._id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal svc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="svc-modal-header">
              <h2>{editing ? 'Edit Service' : 'New Service'}</h2>
              <button type="button" className="svc-modal-close" onClick={closeForm}>✕</button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="svc-modal-form">
              {error && <p className="error-msg">{error}</p>}

              {/* Name + Department side by side */}
              <div className="form-row">
                <div className="form-group">
                  <label>Service Name</label>
                  <input
                    {...register('name', { required: 'Name is required' })}
                    placeholder="e.g. Logo Design"
                  />
                  {errors.name && <span className="field-error">{errors.name.message}</span>}
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <select {...register('department', { required: 'Department is required' })}>
                    <option value="">Select…</option>
                    <option value="Creative">Creative</option>
                    <option value="Strategy">Strategy</option>
                    <option value="Media Buying">Media Buying</option>
                  </select>
                  {errors.department && <span className="field-error">{errors.department.message}</span>}
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Description</label>
                <textarea
                  {...register('description')}
                  placeholder="Briefly describe what this service includes…"
                  rows={3}
                />
              </div>

              {/* Price + Internal Cost */}
              <div className="form-row">
                <div className="form-group">
                  <label>Client Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register('price', { required: 'Price is required', min: { value: 0, message: 'Must be ≥ 0' } })}
                  />
                  {errors.price && <span className="field-error">{errors.price.message}</span>}
                </div>
                <div className="form-group">
                  <label>Internal Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register('internalCost', { min: { value: 0, message: 'Must be ≥ 0' } })}
                  />
                  {errors.internalCost && <span className="field-error">{errors.internalCost.message}</span>}
                </div>
              </div>

              {/* Questions */}
              <div className="form-group">
                <label>
                  Intake Questions
                  <span className="svc-label-hint"> — clients answer these when placing an order</span>
                </label>
                {questions.length > 0 && (
                  <ul className="svc-question-list">
                    {questions.map((q, i) => (
                      <li key={i} className="svc-question-item">
                        <span className="svc-question-num">{i + 1}</span>
                        <span className="svc-question-text">{q}</span>
                        <button
                          type="button"
                          className="svc-question-remove"
                          onClick={() => removeQuestion(i)}
                          aria-label="Remove question"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="svc-question-add">
                  <input
                    type="text"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQuestion(); } }}
                    placeholder="Type a question and press Add or Enter"
                  />
                  <button type="button" className="btn-secondary btn-sm" onClick={addQuestion}>
                    Add
                  </button>
                </div>
              </div>

              <div className="svc-modal-footer">
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

