import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder, assignEmployee } from '../../api/orders';
import { getEmployees } from '../../api/admin';
import OrderTimeline from '../../components/OrderTimeline';
import { LuUserPlus } from 'react-icons/lu';
import ChatAttachments from '../../components/ChatAttachments';
import ImageLightbox from '../../components/ImageLightbox';

function fmtTime(iso) {
  const d = new Date(iso);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}${M}${D}-${h}${m}`;
}

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


export default function AdminOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Assign state
  const [assigning, setAssigning] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const chatBottomRef = useRef(null);

  const fetchOrder = useCallback(async () => {
    try {
      const r = await getOrder(id);
      setOrder(r.data.order);
    } catch (err) {
      setError(err.response?.data?.message || 'Order not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  useEffect(() => {
    getEmployees().then((r) => setEmployees(r.data.employees || []));
  }, []);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [order?.messages?.length]);

  const handleAssign = async () => {
    if (!selectedEmployee) return;
    setAssignLoading(true);
    setAssignError('');
    try {
      await assignEmployee(id, selectedEmployee);
      setAssigning(false);
      setSelectedEmployee('');
      fetchOrder();
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Assignment failed');
    } finally {
      setAssignLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading order…</div>;
  if (error) return (
    <div className="page">
      <p className="error-msg">{error}</p>
      <button className="btn-secondary" onClick={() => navigate('/admin/orders')}>← Back to Orders</button>
    </div>
  );

  const shortId = order._id.slice(-8).toUpperCase();
  const departments = [...new Set((order.services || []).map((s) => s.department).filter(Boolean))];
  const isConvoOpen = order.status === 'accepted' || order.status === 'completed';

  return (
    <div className="page adp-page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <button className="btn-link" onClick={() => navigate('/admin/orders')}>← Orders</button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{shortId}</span>
      </div>

      {/* ── Section 1: Details ── */}
      <div className="adp-section">
        {/* Header row */}
        <div className="adp-header">
          <div className="adp-header-left">
            <h1 className="adp-title">Order <span className="adp-id">#{shortId}</span></h1>
            <p className="adp-placed">Placed {new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <span className="badge badge--lg" style={{ background: STATUS_COLORS[getDisplayStatus(order)] }}>
            {STATUS_LABEL[getDisplayStatus(order)] || order.status}
          </span>
        </div>

        {/* Info grid */}
        <div className="adp-info-grid">
          <div className="adp-info-card">
            <span className="adp-info-label">Client</span>
            <span className="adp-info-value">{order.clientId?.name || '—'}</span>
            {order.clientId?.email && <span className="adp-info-sub">{order.clientId.email}</span>}
          </div>
          <div className="adp-info-card">
            <span className="adp-info-label">Department</span>
            <span className="adp-info-value">{departments.join(', ') || '—'}</span>
          </div>
          <div className="adp-info-card">
            <span className="adp-info-label">Total</span>
            <span className="adp-info-value adp-info-price">${order.totalPrice?.toFixed(2)}</span>
          </div>
          <div className="adp-info-card">
            <span className="adp-info-label">Order Date</span>
            <span className="adp-info-value">{new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="adp-info-card">
            <span className="adp-info-label">Delivery Date</span>
            <span className="adp-info-value">
              {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : '—'}
            </span>
          </div>
          <div className="adp-info-card">
            <span className="adp-info-label">Assigned Employee</span>
            <span className="adp-info-value">{order.assignedEmployee?.name || '—'}</span>
            {order.assignedEmployee?.email && (
              <span className="adp-info-sub">{order.assignedEmployee.email}</span>
            )}
          </div>
        </div>

        {/* Timeline */}
        <OrderTimeline status={order.status} />

        {/* Assign Employee CTA */}
        {order.status === 'placed' && (
          <div className="adp-assign-cta">
            {!assigning ? (
              <button className="btn-primary adp-assign-btn" onClick={() => setAssigning(true)}>
                <LuUserPlus size={15} strokeWidth={2.5} />
                Assign Employee
              </button>
            ) : (
              <div className="adp-assign-panel">
                <p className="adp-assign-heading">Select an employee to assign this order</p>
                {assignError && <p className="error-msg">{assignError}</p>}
                <div className="adp-assign-row">
                  <select
                    className="input"
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                  >
                    <option value="">Select employee…</option>
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>{emp.name} — {emp.email}</option>
                    ))}
                  </select>
                  <button className="btn-primary" onClick={handleAssign} disabled={!selectedEmployee || assignLoading}>
                    {assignLoading ? 'Assigning…' : 'Confirm'}
                  </button>
                  <button className="btn-secondary" onClick={() => { setAssigning(false); setAssignError(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {order.status === 'rejected' && order.rejectionReason && (
          <div className="adp-rejection-box">
            <strong>Rejection reason:</strong> {order.rejectionReason}
          </div>
        )}

        {/* Services */}
        <div className="adp-subsection">
          <h2 className="adp-subsection-title">Services</h2>
          <div className="adp-services-list">
            {(order.services || []).map((s) => (
              <div className="adp-service-item" key={s._id}>
                <div className="adp-service-left">
                  <span className="adp-service-name">{s.name}</span>
                  <span className="category-tag">{s.department}</span>
                </div>
                <span className="adp-service-price">${s.price?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Client answers */}
        {order.answers && Object.keys(order.answers).length > 0 && (
          <div className="adp-subsection">
            <h2 className="adp-subsection-title">Client Answers</h2>
            {(order.services || []).map((svc) => {
              const svcAnswers = order.answers[svc._id];
              if (!svcAnswers || Object.keys(svcAnswers).length === 0) return null;
              return (
                <div key={svc._id} className="adp-answers-group">
                  <p className="adp-answers-service">{svc.name}</p>
                  {Object.entries(svcAnswers).map(([q, a]) => (
                    <div className="adp-qa" key={q}>
                      <span className="adp-question">{q}</span>
                      <span className="adp-answer">{String(a)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* AI Summary */}
        {order.summary && (
          <div className="adp-subsection">
            <h2 className="adp-subsection-title">AI Summary</h2>
            <p className="adp-summary-text">{order.summary}</p>
          </div>
        )}
      </div>

      {/* ── Section 2: Conversation ── */}
      <div className="adp-section">
        <div className="adp-conv-header">
          <h2 className="adp-subsection-title" style={{ margin: 0 }}>Conversation</h2>
          {order.messages?.length > 0 && (
            <span className="adp-msg-count">
              {order.messages.length} message{order.messages.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!isConvoOpen ? (
          <p className="adp-conv-placeholder">
            Conversation opens once the employee accepts the order.
          </p>
        ) : (
          <>
            <div className="chat-window chat-window--detail">
              {(!order.messages || order.messages.length === 0) && (
                <p className="chat-empty">No messages yet.</p>
              )}
              {order.messages?.map((msg) => (
                <div key={msg._id} className={`chat-bubble chat-bubble--${msg.senderRole}`}>
                  <span className="chat-sender">
                    {msg.sender?.name || '—'}
                    <span className="chat-role-tag"> · {msg.senderRole}</span>
                  </span>
                  {msg.text && <p>{msg.text}</p>}
                  <ChatAttachments
                    attachments={msg.attachments}
                    onImageClick={(src, name) => setLightbox({ src, name })}
                  />
                  <span className="chat-time">{fmtTime(msg.createdAt)}</span>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            <p className="chat-closed">Admin view — read only.</p>
          </>
        )}
      </div>

      {lightbox && (
        <ImageLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
