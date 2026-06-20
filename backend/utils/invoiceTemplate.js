/**
 * Generates an HTML string for an invoice.
 * @param {Object} invoice - Populated invoice document
 * @returns {string} HTML string
 */
const generateInvoiceHTML = (invoice) => {
  const order = invoice.orderId;
  const client = order?.clientId;
  const services = order?.services || [];

  const statusColor = invoice.status === 'paid' ? '#16a34a' : '#dc2626';
  const statusLabel = invoice.status.toUpperCase();

  const serviceRows = services
    .map(
      (s) => `
      <tr>
        <td>${s.name}</td>
        <td>${s.department}</td>
        <td style="text-align:right;">$${s.price.toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const issuedDate = new Date(invoice.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const paidDate = invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; padding: 48px; font-size: 14px; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    /* Logo lockup: wordmark stays neutral, only the gradient "Q" symbol
       carries brand color — per the logo do's. */
    .brand { display: flex; align-items: center; font-size: 28px; font-weight: 800; color: #0c3a46; letter-spacing: -0.5px; }
    .brand-q { height: 0.92em; width: auto; margin: 0 1px; }

    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 20px; font-weight: 700; color: #0e7490; margin-bottom: 4px; }
    .invoice-meta p { color: #6b7280; font-size: 13px; }

    .status-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: white;
      background: ${statusColor};
      margin-top: 6px;
    }

    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 28px 0; }

    .parties { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .party h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; margin-bottom: 8px; }
    .party p { color: #1f2937; font-size: 14px; font-weight: 500; }
    .party .sub { color: #6b7280; font-size: 13px; font-weight: 400; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    thead tr { background: #f3f4f6; }
    thead th { padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; }
    thead th:last-child { text-align: right; }
    tbody tr { border-bottom: 1px solid #f3f4f6; }
    tbody td { padding: 10px 12px; color: #374151; }

    .total-section { display: flex; justify-content: flex-end; }
    .total-box { width: 260px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #6b7280; }
    .total-row.final { border-top: 2px solid #e5e7eb; margin-top: 6px; padding-top: 10px; font-size: 16px; font-weight: 700; color: #1f2937; }

    .footer { margin-top: 48px; text-align: center; font-size: 12px; color: #9ca3af; }

    .dates { display: flex; gap: 40px; margin-bottom: 32px; }
    .date-item label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #9ca3af; display: block; margin-bottom: 4px; }
    .date-item span { font-size: 14px; color: #374151; font-weight: 500; }
  </style>
</head>
<body>

  <div class="header">
    <div class="brand">mer<svg class="brand-q" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="mqSym" x1="22" y1="20" x2="84" y2="92" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#a3e35a"/><stop offset="0.42" stop-color="#33c8f4"/><stop offset="0.72" stop-color="#4aa6f6"/><stop offset="1" stop-color="#9b78f6"/></linearGradient></defs><g stroke="url(#mqSym)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M34 24 H63 A14 14 0 0 1 77 38 V53"/><path d="M23 34 V63 A14 14 0 0 0 37 77 H60 L82 93"/></g></svg>etia</div>
    <div class="invoice-meta">
      <h2>${invoice.invoiceNumber}</h2>
      <p>Invoice</p>
      <span class="status-badge">${statusLabel}</span>
    </div>
  </div>

  <hr class="divider" />

  <div class="parties">
    <div class="party">
      <h4>Billed To</h4>
      <p>${client?.name || 'N/A'}</p>
      <p class="sub">${client?.email || ''}</p>
    </div>
    <div class="party" style="text-align:right;">
      <h4>From</h4>
      <p>merQetia</p>
      <p class="sub">billing@merqetia.com</p>
    </div>
  </div>

  <div class="dates">
    <div class="date-item">
      <label>Issue Date</label>
      <span>${issuedDate}</span>
    </div>
    <div class="date-item">
      <label>Paid On</label>
      <span>${paidDate}</span>
    </div>
    <div class="date-item">
      <label>Type</label>
      <span style="text-transform:capitalize;">${invoice.type}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Service</th>
        <th>Department</th>
        <th style="text-align:right;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${serviceRows}
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-box">
      <div class="total-row">
        <span>Subtotal</span>
        <span>$${invoice.amount.toFixed(2)}</span>
      </div>
      <div class="total-row final">
        <span>Total Due</span>
        <span>$${invoice.amount.toFixed(2)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes ? `<p style="margin-top:24px;color:#6b7280;font-size:13px;"><strong>Notes:</strong> ${invoice.notes}</p>` : ''}

  <div class="footer">
    <p>Thank you for your business — merQetia</p>
  </div>

</body>
</html>`;
};

module.exports = { generateInvoiceHTML };
