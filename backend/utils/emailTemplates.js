/**
 * HTML email template for order confirmation.
 * @param {Object} params
 * @param {string} params.clientName
 * @param {string} params.invoiceNumber
 * @param {string} params.orderDate
 * @param {Array}  params.services   - [{ name, price }]
 * @param {number} params.totalPrice
 * @returns {string} HTML string
 */
const orderConfirmationHTML = ({ clientName, invoiceNumber, orderDate, services, totalPrice }) => {
  const serviceRows = services
    .map(
      (s) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;">${s.name}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;text-align:right;">$${s.price.toFixed(2)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1f2937;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#4f46e5;padding:32px 40px;">
              <span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                mer<span style="color:#c7d2fe;">Qetia</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Order Confirmed!</h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
                Hi ${clientName}, your order has been received and is being processed.
              </p>

              <!-- Meta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 20px;font-size:13px;color:#6b7280;">Invoice Number</td>
                  <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#4f46e5;text-align:right;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Order Date</td>
                  <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#111827;text-align:right;border-top:1px solid #e5e7eb;">${orderDate}</td>
                </tr>
              </table>

              <!-- Services -->
              <p style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;margin-bottom:8px;">Services Ordered</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f3f4f6;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Service</th>
                    <th style="padding:10px 16px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Price</th>
                  </tr>
                </thead>
                <tbody>${serviceRows}</tbody>
                <tfoot>
                  <tr style="background:#f9fafb;">
                    <td style="padding:12px 16px;font-weight:700;font-size:15px;">Total</td>
                    <td style="padding:12px 16px;font-weight:700;font-size:15px;text-align:right;color:#4f46e5;">$${totalPrice.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>

              <p style="color:#6b7280;font-size:14px;line-height:1.6;margin-bottom:28px;">
                Your invoice is attached to this email as a PDF. Our team will review your order and get started shortly. 
                You can track your order status at any time from your dashboard.
              </p>

              <p style="color:#9ca3af;font-size:13px;">
                If you have any questions, reply to this email and we'll be happy to help.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} merQetia — All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
};

module.exports = { orderConfirmationHTML };
