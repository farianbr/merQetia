import { useEffect, useState } from 'react';
import { getInvoices, downloadPDF } from '../../api/invoices';
import PaymentModal from '../../components/PaymentModal';
import { LuDownload, LuCreditCard, LuReceipt } from 'react-icons/lu';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const TYPE_LABEL = { full: 'Full', advance: 'Advance', partial: 'Partial' };

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export default function ClientInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const fetchInvoices = async () => {
    try {
      const r = await getInvoices();
      setInvoices(r.data.invoices || r.data || []);
    } catch {
      setError('Failed to load invoices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

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

  const paidInvoices = invoices.filter((i) => i.status === 'paid');
  const unpaidInvoices = invoices.filter((i) => i.status === 'unpaid');
  const totalPaid = paidInvoices.reduce((s, i) => s + i.amount, 0);
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + i.amount, 0);

  if (loading) return <div className="loading">Loading invoices…</div>;

  return (
    <div className="page">
      <div>
        <h1>Invoices</h1>
        <p className="subtitle">Your billing history and payment records.</p>
      </div>

      {error && <p className="page-error">{error}</p>}

      <div className="inv-summary-bar">
        <div className="inv-summary-item">
          <span className="inv-summary-label">Paid</span>
          <span className="inv-summary-val inv-summary-val--paid">{usd.format(totalPaid)}</span>
        </div>
        <div className="inv-summary-sep" />
        <div className="inv-summary-item">
          <span className="inv-summary-label">Outstanding</span>
          <span className={`inv-summary-val ${totalOutstanding > 0 ? 'inv-summary-val--unpaid' : ''}`}>
            {usd.format(totalOutstanding)}
          </span>
        </div>
        <div className="inv-summary-sep" />
        <div className="inv-summary-item">
          <span className="inv-summary-label">Total invoices</span>
          <span className="inv-summary-val">{invoices.length}</span>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="inv-empty">
          <LuReceipt size={36} color="#d1d5db" />
          <p>No invoices yet.</p>
        </div>
      ) : (
        <div className="inv-card-list">
          {invoices.map((inv) => {
            const isPaid = inv.status === 'paid';
            const orderRef = inv.orderId?._id
              ? inv.orderId._id.toString().slice(-6).toUpperCase()
              : typeof inv.orderId === 'string'
              ? inv.orderId.slice(-6).toUpperCase()
              : null;

            return (
              <div key={inv._id} className={`inv-card ${isPaid ? 'inv-card--paid' : 'inv-card--unpaid'}`}>
                <div className="inv-card-left">
                  <span className={`inv-status-dot ${isPaid ? 'inv-status-dot--paid' : 'inv-status-dot--unpaid'}`} />
                  <div className="inv-card-info">
                    <span className="inv-card-num">{inv.invoiceNumber}</span>
                    {orderRef && (
                      <span className="inv-card-order">Order #{orderRef}</span>
                    )}
                  </div>
                </div>

                <div className="inv-card-meta">
                  <span className="inv-type-tag">{TYPE_LABEL[inv.type] || inv.type}</span>
                  <span className="inv-card-date">{fmtDate(inv.createdAt)}</span>
                  {isPaid && inv.paidAt && (
                    <span className="inv-paid-date">Paid {fmtDate(inv.paidAt)}</span>
                  )}
                </div>

                <div className="inv-card-right">
                  <span className="inv-card-amount">{usd.format(inv.amount)}</span>
                  <span className={`badge ${isPaid ? 'badge-green' : 'badge-yellow'}`}>
                    {isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                  <div className="inv-card-actions">
                    <button
                      className="inv-action-btn"
                      title="Download PDF"
                      disabled={downloading === inv._id}
                      onClick={() => handleDownload(inv)}
                    >
                      <LuDownload size={14} />
                    </button>
                    {!isPaid && (
                      <button
                        className="btn-primary btn-sm inv-pay-btn"
                        onClick={() => setPayingInvoice(inv)}
                      >
                        <LuCreditCard size={13} />
                        Pay Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {payingInvoice && (
        <PaymentModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onPaid={() => {
            setPayingInvoice(null);
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}
