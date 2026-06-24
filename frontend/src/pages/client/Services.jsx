import { useEffect, useState } from 'react';
import { getServices } from '../../api/services';
import { createOrder } from '../../api/orders';
import { useNavigate } from 'react-router-dom';
import { LuInfo } from 'react-icons/lu';

export default function ClientServices() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [ordering, setOrdering] = useState(null); // service being ordered
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getServices().then((r) => setServices(r.data.services || r.data));
  }, []);

  const openOrder = (svc) => {
    setOrdering(svc);
    setAnswers({});
    setError('');
  };

  const closeOrder = () => {
    setOrdering(null);
    setAnswers({});
    setError('');
  };

  const handleSubmitOrder = async () => {
    try {
      setSubmitting(true);
      setError('');
      const formattedAnswers = ordering.questions?.length
        ? { [ordering._id]: answers }
        : {};
      const r = await createOrder({ services: [ordering._id], answers: formattedAnswers });
      const newOrderId = r.data.order?._id || r.data._id;
      closeOrder();
      navigate('/orders', { state: { newOrderId } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const allAnswered = !ordering?.questions?.length ||
    ordering.questions.every((q) => answers[q]?.trim());

  return (
    <div className="client-page">
      <div className="section-header">
        <div>
          <h1>Our Services</h1>
          <p className="subtitle">Pick a service and place your order in minutes.</p>
        </div>
      </div>

      <div className="csc-grid">
        {services.filter((s) => s.isActive).map((s) => (
          <div className="card csc-card" key={s._id}>
            <div className="csc-accent" />
            <div className="csc-body">
              <h3 className="csc-name">{s.name}</h3>
              {s.description && <p className="csc-desc">{s.description}</p>}
              {s.questions?.length > 0 && (
                <p className="csc-questions-hint">
                  <LuInfo size={13} />
                  {s.questions.length} question{s.questions.length > 1 ? 's' : ''} to answer
                </p>
              )}
            </div>
            <div className="csc-footer">
              <span className="csc-price">€{s.price?.toFixed(2)}</span>
              <button className="csc-cta" onClick={() => openOrder(s)}>Order Now</button>
            </div>
          </div>
        ))}
      </div>

      {ordering && (
        <div className="modal-overlay" onClick={closeOrder}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="csc-modal-header">
              <div>
                <h2>{ordering.name}</h2>
                <p className="csc-modal-price">€{ordering.price?.toFixed(2)}</p>
              </div>
              <button type="button" className="svc-modal-close" onClick={closeOrder}>✕</button>
            </div>
            {ordering.description && (
              <p className="csc-modal-desc">{ordering.description}</p>
            )}

            {ordering.questions?.length > 0 && (
              <>
                <p className="csc-modal-qlabel">Answer a few questions so we can get started:</p>
                {ordering.questions.map((q, i) => (
                  <div className="form-group" key={i}>
                    <label>{q} <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      value={answers[q] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })}
                      placeholder="Your answer..."
                    />
                  </div>
                ))}
              </>
            )}

            {error && <p className="error-msg">{error}</p>}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeOrder}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleSubmitOrder}
                disabled={!allAnswered || submitting}
              >
                {submitting ? 'Placing order…' : `Confirm Order — €${ordering.price?.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
