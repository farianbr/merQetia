import { useEffect, useState } from 'react';
import { getInvoices, markAsPaid, downloadPDF } from '../../api/invoices';
import { useAuth } from '../../context/AuthContext';

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(null);

  const fetchInvoices = () =>
    getInvoices().then((r) => setInvoices(r.data.invoices || r.data));

  useEffect(() => { fetchInvoices(); }, []);

  const handleMarkPaid = async (id) => {
    try {
      await markAsPaid(id);
      fetchInvoices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark paid');
    }
  };

  const handleDownload = async (id, invoiceNumber) => {
    try {
      setDownloading(id);
      const res = await downloadPDF(id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download PDF');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="page">
      <div>
        <h1>Invoices</h1>
        <p className="subtitle">Your billing history and payment status.</p>
      </div>
      {error && <p className="error-msg">{error}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Order #</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv._id}>
              <td>{inv.invoiceNumber}</td>
              <td>
                {inv.orderId?._id
                  ? `#${inv.orderId._id.toString().slice(-6).toUpperCase()}`
                  : inv.orderId
                  ? `#${inv.orderId.toString().slice(-6).toUpperCase()}`
                  : '—'}
              </td>
              <td>${inv.amount?.toFixed(2)}</td>
              <td>
                <span className={`badge ${inv.status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>
                  {inv.status}
                </span>
              </td>
              <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
              <td className="action-cell">
                <button
                  className="btn-sm btn-secondary"
                  disabled={downloading === inv._id}
                  onClick={() => handleDownload(inv._id, inv.invoiceNumber)}
                >
                  {downloading === inv._id ? '...' : 'PDF'}
                </button>
                {user.role === 'admin' && inv.status === 'unpaid' && (
                  <button className="btn-sm btn-primary" onClick={() => handleMarkPaid(inv._id)}>
                    Mark Paid
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
