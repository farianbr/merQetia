import { useState } from 'react';
import { clientPayInvoice } from '../api/invoices';
import { LuCreditCard, LuLock, LuX, LuCircleCheck } from 'react-icons/lu';

const fmtCardNumber = (v) => {
  const digits = v.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

const fmtExpiry = (v) => {
  const digits = v.replace(/\D/g, '').slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function PaymentModal({ invoice, onClose, onPaid }) {
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const digits = card.replace(/\s/g, '');
    if (digits.length !== 16) return 'Card number must be 16 digits.';
    const parts = expiry.split('/');
    if (parts.length !== 2 || parts[0].length !== 2 || parts[1].length !== 2)
      return 'Enter expiry as MM/YY.';
    const expDate = new Date(2000 + parseInt(parts[1]), parseInt(parts[0]) - 1, 1);
    if (expDate < new Date()) return 'This card has expired.';
    if (cvv.length < 3) return 'CVV must be 3 or 4 digits.';
    if (!name.trim()) return 'Cardholder name is required.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErr = validate();
    if (validationErr) { setError(validationErr); return; }
    setError('');
    setSubmitting(true);
    try {
      await clientPayInvoice(invoice._id);
      setSuccess(true);
      setTimeout(() => { onPaid(); onClose(); }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-header">
          <div className="pm-header-title">
            <LuCreditCard size={17} />
            <span>Secure Payment</span>
          </div>
          <button className="pm-close-btn" onClick={onClose} aria-label="Close">
            <LuX size={16} />
          </button>
        </div>

        {success ? (
          <div className="pm-success">
            <div className="pm-success-icon">
              <LuCircleCheck size={44} color="#10b981" />
            </div>
            <p className="pm-success-title">Payment Successful!</p>
            <p className="pm-success-sub">{invoice.invoiceNumber} has been paid.</p>
          </div>
        ) : (
          <>
            <div className="pm-amount-block">
              <span className="pm-inv-num">{invoice.invoiceNumber}</span>
              <span className="pm-amount">{usd.format(invoice.amount)}</span>
            </div>

            <div className="pm-demo-hint">
              <LuLock size={11} />
              Demo mode — use any test card (e.g. 4242 4242 4242 4242, exp: 12/28; cvv: 123)
            </div>

            <form className="pm-form" onSubmit={handleSubmit}>
              <div className="pm-field">
                <label className="pm-label">Card Number</label>
                <input
                  className="input pm-input pm-input--mono"
                  type="text"
                  inputMode="numeric"
                  placeholder="1234 5678 9012 3456"
                  value={card}
                  onChange={(e) => setCard(fmtCardNumber(e.target.value))}
                  maxLength={19}
                  disabled={submitting}
                  autoComplete="cc-number"
                />
              </div>

              <div className="pm-row">
                <div className="pm-field">
                  <label className="pm-label">Expiry</label>
                  <input
                    className="input pm-input pm-input--mono"
                    type="text"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(fmtExpiry(e.target.value))}
                    maxLength={5}
                    disabled={submitting}
                    autoComplete="cc-exp"
                  />
                </div>
                <div className="pm-field">
                  <label className="pm-label">CVV</label>
                  <input
                    className="input pm-input pm-input--mono"
                    type="text"
                    inputMode="numeric"
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    disabled={submitting}
                    autoComplete="cc-csc"
                  />
                </div>
              </div>

              <div className="pm-field">
                <label className="pm-label">Cardholder Name</label>
                <input
                  className="input pm-input"
                  type="text"
                  placeholder="Full name on card"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  autoComplete="cc-name"
                />
              </div>

              {error && <p className="pm-error">{error}</p>}

              <button
                type="submit"
                className="btn-primary pm-pay-btn"
                disabled={submitting}
              >
                {submitting ? 'Processing…' : `Pay ${usd.format(invoice.amount)}`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
