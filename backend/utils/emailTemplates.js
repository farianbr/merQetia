/**
 * Brand palette. The header carries the full merQetia wordmark as a
 * CID-embedded PNG (cid:mqlogo) — the white lockup, since the header sits on
 * the deep teal surface. CID embedding renders without the recipient having
 * to "show images" and without relying on SVG support. See
 * emailService.LOGO_ATTACHMENT.
 */
const BRAND = {
  deep: '#0c3a46', // deep teal surface (header/footer)
  accent: '#0e7490', // cyan accent on light backgrounds (links, totals, CTA)
};

/** Full white wordmark lockup for the dark teal header. */
const headerWordmark = `<img src="cid:mqlogo" alt="merQetia" height="30" style="display:block;border:0;outline:none;height:30px;width:auto;"/>`;

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
            <td style="background:${BRAND.deep};padding:32px 40px;">
              ${headerWordmark}
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
                  <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.accent};text-align:right;">${invoiceNumber}</td>
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
                    <td style="padding:12px 16px;font-weight:700;font-size:15px;text-align:right;color:${BRAND.accent};">$${totalPrice.toFixed(2)}</td>
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

/**
 * Email to admin when a new order is placed — prompts to assign an employee.
 */
const newOrderAdminHTML = ({ clientName, services, orderNum, orderId, frontendUrl }) => {
  const serviceList = services.map((s) => `<li style="padding:4px 0;">${s.name}</li>`).join('');
  const assignUrl = `${frontendUrl}/admin/orders/${orderId}`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:${BRAND.deep};padding:32px 40px;">
          ${headerWordmark}
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">New Order — Action Required</h2>
          <p style="margin:0 0 20px;color:#6b7280;font-size:15px;">A new order has been placed by <strong>${clientName}</strong> and is waiting for an employee to be assigned.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:14px 20px;font-size:13px;color:#6b7280;">Order</td>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.accent};text-align:right;">${orderNum}</td></tr>
            <tr><td style="padding:14px 20px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Client</td>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#111827;text-align:right;border-top:1px solid #e5e7eb;">${clientName}</td></tr>
          </table>
          <p style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;margin-bottom:8px;">Services</p>
          <ul style="margin:0 0 28px;padding-left:20px;color:#374151;font-size:14px;">${serviceList}</ul>
          <a href="${assignUrl}" style="display:inline-block;background:${BRAND.accent};color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">Assign Employee →</a>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} merQetia — All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/**
 * Email to employee when an order is assigned to them.
 */
const orderAssignedEmployeeHTML = ({ employeeName, clientName, services, orderNum, frontendUrl }) => {
  const serviceList = services.map((s) => `<li style="padding:4px 0;">${s.name}</li>`).join('');
  const viewUrl = `${frontendUrl}/employee`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:${BRAND.deep};padding:32px 40px;">
          ${headerWordmark}
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">New Order Assigned to You</h2>
          <p style="margin:0 0 20px;color:#6b7280;font-size:15px;">Hi <strong>${employeeName}</strong>, a new order from <strong>${clientName}</strong> has been assigned to you. Please review and accept or decline it.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:14px 20px;font-size:13px;color:#6b7280;">Order</td>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.accent};text-align:right;">${orderNum}</td></tr>
            <tr><td style="padding:14px 20px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Client</td>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#111827;text-align:right;border-top:1px solid #e5e7eb;">${clientName}</td></tr>
          </table>
          <p style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;margin-bottom:8px;">Services</p>
          <ul style="margin:0 0 28px;padding-left:20px;color:#374151;font-size:14px;">${serviceList}</ul>
          <a href="${viewUrl}" style="display:inline-block;background:${BRAND.accent};color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">View Assignment →</a>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} merQetia — All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

module.exports = { orderConfirmationHTML, newOrderAdminHTML, orderAssignedEmployeeHTML };
