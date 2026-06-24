const fs = require('fs');
const path = require('path');

/**
 * The full merQetia wordmark (dark lockup, for the white invoice page),
 * inlined as a base64 data URI so it always renders in the headless-Chrome
 * PDF without depending on network/file access. Loaded once at module init.
 */
const LOGO_DATA_URI = (() => {
  try {
    const buf = fs.readFileSync(path.join(__dirname, '..', 'assets', 'merqetia-wordmark-dark.png'));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
})();

/* ── Brand palette (merQetia guideline) ───────────────────────── */
const BRAND = {
  navy: '#08303d',
  cyan: '#1f8cb4',
  cyanBright: '#33a8d1',
  green: '#84de89',
  vanilla: '#f1dd9e',
  lavender: '#c9a3d4',
  offWhite: '#f1f1f0',
  ink: '#0f2b35',
  muted: '#5a6c73',
  hair: '#e4e6e3',
};

/* Company details (from letterhead). */
const COMPANY = {
  name: 'merQetia',
  email: 'info@merQetia.com',
  phone: '+31 6 1468 8733',
  web: 'www.merQetia.nl',
  address: 'Lingestraat 11, 1316 CN Almere',
  iban: 'NL63 INGB 0113 5871 47',
  kvk: '98070304',
};

/** Euro money formatter — €1,234.56 */
const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const money = (n) => eur.format(Number(n) || 0);

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
        <td style="text-align:right;">${money(s.price)}</td>
      </tr>`
    )
    .join('');

  const issuedDate = new Date(invoice.createdAt).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const paidDate = invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString('en-GB', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: ${BRAND.navy}; --cyan: ${BRAND.cyan}; --ink: ${BRAND.ink};
      --muted: ${BRAND.muted}; --hair: ${BRAND.hair}; --off: ${BRAND.offWhite};
    }
    html, body { height: 100%; }
    body {
      font-family: 'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: var(--ink); font-size: 13.5px; line-height: 1.5;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .display { font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: -.01em; }

    .sheet { position: relative; min-height: 100%; padding: 56px 56px 120px; }

    /* Top brand hairline */
    .top-rule { position: absolute; top: 0; left: 0; right: 0; height: 6px;
      background: linear-gradient(90deg, ${BRAND.navy} 0%, ${BRAND.cyanBright} 38%, ${BRAND.green} 64%, ${BRAND.vanilla} 84%, ${BRAND.lavender} 100%); }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 44px; }
    .brand-logo { height: 40px; width: auto; display: block; }

    .invoice-meta { text-align: right; }
    .invoice-meta .label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--muted); }
    .invoice-meta h2 { font-size: 24px; font-weight: 700; color: var(--navy); margin: 2px 0 8px; }
    .status-badge {
      display: inline-block; padding: 5px 16px; border-radius: 999px;
      font-size: 11px; font-weight: 700; letter-spacing: .6px;
      color: white; background: ${statusColor};
    }

    .parties { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 32px; }
    .party { max-width: 48%; }
    .party h4 { font-size: 10.5px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--cyan); margin-bottom: 8px; font-weight: 700; }
    .party p { color: var(--ink); font-size: 14px; font-weight: 600; }
    .party .sub { color: var(--muted); font-size: 12.5px; font-weight: 400; margin-top: 2px; }
    .party.to { text-align: right; }

    .dates { display: flex; gap: 14px; margin-bottom: 30px; }
    .date-item { flex: 1; background: var(--off); border: 1px solid var(--hair); border-radius: 12px; padding: 12px 16px; }
    .date-item label { font-size: 10px; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); display: block; margin-bottom: 4px; }
    .date-item span { font-size: 13.5px; color: var(--ink); font-weight: 600; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 26px; }
    thead th {
      padding: 11px 14px; text-align: left; font-size: 10.5px; text-transform: uppercase;
      letter-spacing: .8px; color: var(--muted); font-weight: 700;
      border-bottom: 2px solid var(--navy);
    }
    thead th:last-child { text-align: right; }
    tbody tr { border-bottom: 1px solid var(--hair); }
    tbody td { padding: 12px 14px; color: var(--ink); font-size: 13.5px; }

    .total-section { display: flex; justify-content: flex-end; }
    .total-box { width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13.5px; color: var(--muted); }
    .total-row.final {
      border-top: 2px solid var(--navy); margin-top: 8px; padding-top: 12px;
      font-size: 17px; font-weight: 700; color: var(--navy);
    }
    .total-row.final .amt { color: var(--cyan); }

    .notes { margin-top: 28px; background: var(--off); border: 1px solid var(--hair); border-left: 3px solid ${BRAND.cyanBright}; border-radius: 10px; padding: 14px 18px; color: var(--ink); font-size: 13px; }
    .notes strong { color: var(--navy); }

    /* Footer band with company / payment details */
    .footer {
      position: absolute; left: 0; right: 0; bottom: 0;
      background: var(--navy); color: rgba(255,255,255,.82);
      padding: 22px 56px; display: flex; justify-content: space-between; gap: 24px;
      font-size: 11px; line-height: 1.7;
    }
    .footer .col strong { color: #fff; display: block; font-size: 11.5px; letter-spacing: .3px; margin-bottom: 2px; }
    .footer .thanks { font-family: 'Space Grotesk', sans-serif; color: #fff; font-weight: 600; font-size: 13px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top-rule"></div>

    <div class="header">
      <img class="brand-logo" src="${LOGO_DATA_URI}" alt="merQetia" />
      <div class="invoice-meta">
        <div class="label">Invoice</div>
        <h2 class="display">${invoice.invoiceNumber}</h2>
        <span class="status-badge">${statusLabel}</span>
      </div>
    </div>

    <div class="parties">
      <div class="party from">
        <h4>From</h4>
        <p>${COMPANY.name}</p>
        <p class="sub">${COMPANY.address}</p>
        <p class="sub">${COMPANY.email}</p>
        <p class="sub">${COMPANY.web}</p>
      </div>
      <div class="party to">
        <h4>Billed To</h4>
        <p>${client?.name || 'N/A'}</p>
        <p class="sub">${client?.email || ''}</p>
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
          <span>${money(invoice.amount)}</span>
        </div>
        <div class="total-row final">
          <span>Total Due</span>
          <span class="amt">${money(invoice.amount)}</span>
        </div>
      </div>
    </div>

    ${invoice.notes ? `<div class="notes"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}

    <div class="footer">
      <div class="col">
        <span class="thanks">Thank you for your business.</span>
      </div>
      <div class="col">
        <strong>Payment</strong>
        IBAN ${COMPANY.iban}<br/>
        KVK ${COMPANY.kvk}
      </div>
      <div class="col">
        <strong>Contact</strong>
        ${COMPANY.phone}<br/>
        ${COMPANY.email}
      </div>
    </div>
  </div>
</body>
</html>`;
};

module.exports = { generateInvoiceHTML };
