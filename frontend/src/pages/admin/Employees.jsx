import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getEmployees, inviteEmployee, updateEmployeeDepartments,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
} from '../../api/admin';
import {
  LuCircleCheck, LuUsers, LuLayers, LuPencil, LuTrash2, LuPlus, LuUserPlus,
} from 'react-icons/lu';

/* ── Invite Employee Modal ─────────────────────────────────────────── */
function InviteModal({ departments, onClose, onInvited }) {
  const [form, setForm] = useState({ email: '', departments: [] });
  const [submitting, setSubmitting] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [error, setError] = useState('');

  const toggleDept = (name) =>
    setForm((p) => ({
      ...p,
      departments: p.departments.includes(name)
        ? p.departments.filter((d) => d !== name)
        : [...p.departments, name],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.departments.length === 0) { setError('Select at least one department'); return; }
    setSubmitting(true);
    setError('');
    try {
      await inviteEmployee({ email: form.email, departments: form.departments });
      setSentEmail(form.email);
      setForm({ email: '', departments: [] });
      onInvited();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {sentEmail ? (
          <div className="inv-sent-wrap">
            <div className="inv-sent-icon"><LuCircleCheck size={40} color="#14a800" /></div>
            <h2 className="inv-sent-title">Invitation Sent!</h2>
            <p className="inv-sent-body">
              An invitation email has been sent to <strong>{sentEmail}</strong>.
              They can use it to complete their registration.
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center', flexDirection: 'column', gap: '.6rem' }}>
              <button className="btn-primary" onClick={() => setSentEmail('')}>+ Send Another Invite</button>
              <button className="btn-secondary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <h2>Invite New Employee</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.88rem' }}>
              The employee will set their name and password when completing registration via the invite link.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && <p className="error-msg">{error}</p>}
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  className="input"
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Departments</label>
                {departments.length === 0 ? (
                  <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                    No departments yet — create one in the Departments tab first.
                  </p>
                ) : (
                  <div className="checkbox-group">
                    {departments.map((d) => (
                      <label key={d._id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.departments.includes(d.name)}
                          onChange={() => toggleDept(d.name)}
                        />
                        {d.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting || departments.length === 0}>
                  {submitting ? 'Sending…' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Assign Departments Modal ──────────────────────────────────────── */
function AssignModal({ employee, departments, onClose, onSaved }) {
  const [selected, setSelected] = useState(employee.departments || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (name) =>
    setSelected((s) => (s.includes(name) ? s.filter((d) => d !== name) : [...s, name]));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateEmployeeDepartments(employee._id, selected);
      onSaved(employee._id, selected);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update departments');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Manage Departments</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '.88rem' }}>
          Assign <strong>{employee.name}</strong> to one or more teams.
        </p>
        {error && <p className="error-msg">{error}</p>}
        {departments.length === 0 ? (
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', margin: '1rem 0' }}>No departments available.</p>
        ) : (
          <div className="checkbox-group" style={{ margin: '1rem 0' }}>
            {departments.map((d) => (
              <label key={d._id} className="checkbox-label">
                <input type="checkbox" checked={selected.includes(d.name)} onChange={() => toggle(d.name)} />
                {d.name}
              </label>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Department Editor Modal ───────────────────────────────────────── */
function DeptModal({ dept, onClose, onSaved }) {
  const editing = Boolean(dept);
  const [name, setName] = useState(dept?.name || '');
  const [description, setDescription] = useState(dept?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = editing
        ? await updateDepartment(dept._id, { name, description })
        : await createDepartment({ name, description });
      onSaved(res.data.department);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save department');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? 'Edit Department' : 'New Department'}</h2>
        {editing && (
          <p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
            Renaming updates every employee assigned to this team.
          </p>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '.5rem' }}>
          {error && <p className="error-msg">{error}</p>}
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Web Development"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              className="input"
              style={{ height: '70px', resize: 'vertical' }}
              placeholder="What this team handles…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={240}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Team Page ─────────────────────────────────────────────────────── */
export default function AdminTeam() {
  const [tab, setTab] = useState('members');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('all');

  const [showInvite, setShowInvite] = useState(false);
  const [assignFor, setAssignFor] = useState(null);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editDept, setEditDept] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([getEmployees(), getDepartments()]);
      setEmployees(empRes.data.employees || []);
      setDepartments(deptRes.data.departments || []);
    } catch {
      // leave empty on failure
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const refreshDepartments = async () => {
    try {
      const r = await getDepartments();
      setDepartments(r.data.departments || []);
    } catch { /* ignore */ }
  };

  const filteredEmployees = useMemo(() => {
    if (deptFilter === 'all') return employees;
    if (deptFilter === '__none__') return employees.filter((e) => !e.departments?.length);
    return employees.filter((e) => e.departments?.includes(deptFilter));
  }, [employees, deptFilter]);

  const handleAssigned = (id, depts) => {
    setEmployees((prev) => prev.map((e) => (e._id === id ? { ...e, departments: depts } : e)));
    setAssignFor(null);
    refreshDepartments(); // member counts shift
  };

  const handleDeptSaved = () => {
    setShowDeptModal(false);
    setEditDept(null);
    loadAll(); // names may have cascaded onto employees
  };

  const handleDeleteDept = async (dept) => {
    if (!window.confirm(`Delete "${dept.name}"? It will be removed from all employees.`)) return;
    try {
      await deleteDepartment(dept._id);
      loadAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete department');
    }
  };

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h1>Team</h1>
          <p className="subtitle">Manage your employees and the departments they belong to.</p>
        </div>
      </div>

      {/* Tabs + contextual action (action stays in a fixed position) */}
      <div className="tm-bar">
        <div className="tm-tabs">
          <button className={`tm-tab ${tab === 'members' ? 'tm-tab--active' : ''}`} onClick={() => setTab('members')}>
            <LuUsers size={15} /> Members <span className="tm-tab-count">{employees.length}</span>
          </button>
          <button className={`tm-tab ${tab === 'departments' ? 'tm-tab--active' : ''}`} onClick={() => setTab('departments')}>
            <LuLayers size={15} /> Departments <span className="tm-tab-count">{departments.length}</span>
          </button>
        </div>
        <div className="tm-actions">
          <button className="btn-secondary" onClick={() => { setEditDept(null); setShowDeptModal(true); }}>
            <LuPlus size={15} /> New Department
          </button>
          <button className="btn-primary" onClick={() => setShowInvite(true)}>
            <LuUserPlus size={15} /> Invite Employee
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : tab === 'members' ? (
        <>
          {/* Department filter chips */}
          <div className="tm-filter-row">
            <button className={`tm-chip ${deptFilter === 'all' ? 'tm-chip--active' : ''}`} onClick={() => setDeptFilter('all')}>
              All
            </button>
            {departments.map((d) => (
              <button
                key={d._id}
                className={`tm-chip ${deptFilter === d.name ? 'tm-chip--active' : ''}`}
                onClick={() => setDeptFilter(d.name)}
              >
                {d.name} <span className="tm-chip-count">{d.memberCount}</span>
              </button>
            ))}
            <button className={`tm-chip ${deptFilter === '__none__' ? 'tm-chip--active' : ''}`} onClick={() => setDeptFilter('__none__')}>
              Unassigned
            </button>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Departments</th>
                  <th>Active</th>
                  <th>Completed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No employees here.</td></tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp._id}>
                      <td style={{ fontWeight: 600 }}>{emp.name || <span style={{ color: 'var(--text-muted)' }}>Pending</span>}</td>
                      <td>{emp.email}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {emp.departments?.length > 0
                            ? emp.departments.map((d) => <span key={d} className="category-tag">{d}</span>)
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </div>
                      </td>
                      <td>{emp.activeTasks}</td>
                      <td>{emp.completedTasks}</td>
                      <td>
                        <div className="action-cell-inner">
                          <button className="btn-sm btn-secondary" onClick={() => setAssignFor(emp)}>Manage</button>
                          <Link to={`/admin/employees/${emp._id}`} className="btn-sm btn-secondary">Profile</Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Departments tab */
        departments.length === 0 ? (
          <div className="tm-empty">
            <LuLayers size={36} />
            <p>No departments yet.</p>
            <button className="btn-primary" onClick={() => { setEditDept(null); setShowDeptModal(true); }}>
              <LuPlus size={15} /> Create your first department
            </button>
          </div>
        ) : (
          <div className="tm-dept-grid">
            {departments.map((d) => (
              <div key={d._id} className="card tm-dept-card">
                <div className="tm-dept-head">
                  <span className="tm-dept-icon"><LuLayers size={18} /></span>
                  <div className="tm-dept-actions">
                    <button className="btn-icon" title="Edit" onClick={() => { setEditDept(d); setShowDeptModal(true); }}>
                      <LuPencil size={14} />
                    </button>
                    <button className="btn-icon" title="Delete" onClick={() => handleDeleteDept(d)}>
                      <LuTrash2 size={14} />
                    </button>
                  </div>
                </div>
                <h3 className="tm-dept-name">{d.name}</h3>
                {d.description && <p className="tm-dept-desc">{d.description}</p>}
                <span className="tm-dept-count">
                  <LuUsers size={13} /> {d.memberCount} member{d.memberCount !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {showInvite && (
        <InviteModal
          departments={departments}
          onClose={() => setShowInvite(false)}
          onInvited={loadAll}
        />
      )}
      {assignFor && (
        <AssignModal
          employee={assignFor}
          departments={departments}
          onClose={() => setAssignFor(null)}
          onSaved={handleAssigned}
        />
      )}
      {showDeptModal && (
        <DeptModal
          dept={editDept}
          onClose={() => { setShowDeptModal(false); setEditDept(null); }}
          onSaved={handleDeptSaved}
        />
      )}
    </div>
  );
}
