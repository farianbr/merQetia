import { useState, useEffect } from 'react';
import { getEmployees, inviteEmployee } from '../../api/admin';
import { LuCircleCheck } from 'react-icons/lu';

const DEPARTMENTS = ['Creative', 'Strategy', 'Media Buying'];

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', departments: [] });
  const [submitting, setSubmitting] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [error, setError] = useState('');

  const fetchEmployees = async () => {
    try {
      const res = await getEmployees();
      setEmployees(res.data.employees || []);
    } catch {
      // silently fail — list just stays empty
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const openModal = () => {
    setForm({ email: '', departments: [] });
    setSentEmail('');
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSentEmail('');
    setError('');
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleDept = (dept) => {
    setForm((prev) => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter((d) => d !== dept)
        : [...prev.departments, dept],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.departments.length === 0) {
      setError('Please select at least one department');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await inviteEmployee({ email: form.email, departments: form.departments });
      setSentEmail(form.email);
      setForm({ email: '', departments: [] });
      fetchEmployees();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAnother = () => {
    setSentEmail('');
    setError('');
    setForm({ email: '', departments: [] });
  };

  return (
    <div className="page">
      <div className="section-header">
        <h1>Employees</h1>
        <button className="btn-primary" onClick={openModal}>+ Invite Employee</button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {sentEmail ? (
              /* ── Sent confirmation state ── */
              <div className="inv-sent-wrap">
                <div className="inv-sent-icon">
                  <LuCircleCheck size={40} color="#14a800" />
                </div>
                <h2 className="inv-sent-title">Invitation Sent!</h2>
                <p className="inv-sent-body">
                  An invitation email has been sent to <strong>{sentEmail}</strong>.
                  They can use it to complete their registration.
                </p>
                <div className="modal-actions" style={{ justifyContent: 'center', flexDirection: 'column', gap: '.6rem' }}>
                  <button className="btn-primary" onClick={handleSendAnother}>
                    + Send Another Invite
                  </button>
                  <button className="btn-secondary" onClick={closeModal}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* ── Invite form ── */
              <>
                <h2>Invite New Employee</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '.88rem' }}>
                  The employee will enter their name when completing registration via the invite link.
                </p>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {error && <p className="error-msg">{error}</p>}

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      name="email"
                      type="email"
                      placeholder="jane@example.com"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Departments</label>
                    <div className="checkbox-group">
                      {DEPARTMENTS.map((dept) => (
                        <label key={dept} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={form.departments.includes(dept)}
                            onChange={() => toggleDept(dept)}
                          />
                          {dept}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={submitting}>
                      {submitting ? 'Sending…' : 'Send Invitation'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Departments</th>
            <th>Active Tasks</th>
            <th>Completed Tasks</th>
          </tr>
        </thead>
        <tbody>
          {loadingList ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9CA3AF' }}>Loading…</td></tr>
          ) : employees.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9CA3AF' }}>No employees yet</td></tr>
          ) : (
            employees.map((emp) => (
              <tr key={emp._id}>
                <td>{emp.name}</td>
                <td>{emp.email}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {emp.departments?.length > 0
                      ? emp.departments.map((d) => <span key={d} className="category-tag">{d}</span>)
                      : '—'}
                  </div>
                </td>
                <td>{emp.activeTasks}</td>
                <td>{emp.completedTasks}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
