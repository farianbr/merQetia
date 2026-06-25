/**
 * Brand palette + email building blocks. The header carries the full merQetia
 * wordmark as a CID-embedded PNG (cid:mqlogo) — the white lockup, since the
 * header sits on the deep navy surface. CID embedding renders without the
 * recipient having to "show images" and without relying on SVG support.
 * See emailService.LOGO_ATTACHMENT.
 */
const BRAND = {
  navy: '#08303d',        // deep teal-navy surface (header/footer)
  accent: '#1f8cb4',      // Pacific Cyan (white-text safe — links, totals, CTA)
  accentBright: '#33a8d1',
  green: '#84de89',
  vanilla: '#f1dd9e',
  lavender: '#c9a3d4',
  offWhite: '#f1f1f0',
  ink: '#0f2b35',
  muted: '#5a6c73',
  hair: '#e4e6e3',
};

const FONT = "'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
const FONT_DISPLAY = "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";

/** Euro money formatter — €1,234.56 */
const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const money = (n) => eur.format(Number(n) || 0);

/** Full white wordmark lockup for the dark navy header. */
const headerWordmark = `<img src="cid:mqlogo" alt="merQetia" height="30" style="display:block;border:0;outline:none;height:30px;width:auto;"/>`;

/** Thin brand gradient rule that sits under the navy header. */
const brandRule = `<tr><td style="height:5px;line-height:5px;font-size:0;background:linear-gradient(90deg,${BRAND.navy} 0%,${BRAND.accentBright} 38%,${BRAND.green} 64%,${BRAND.vanilla} 84%,${BRAND.lavender} 100%);">&nbsp;</td></tr>`;

/** Shared head + outer shell open/close so all emails stay consistent. */
const shellHead = `<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />`;

const CONTACT_EMAIL = process.env.SUPPORT_EMAIL || 'info@merqetia.nl';
const CONTACT_PHONE = process.env.CONTACT_PHONE || '';

const footer = `
  <tr><td style="background:${BRAND.offWhite};padding:22px 40px;border-top:1px solid ${BRAND.hair};text-align:center;">
    <p style="margin:0;font-size:12px;color:${BRAND.muted};">© ${new Date().getFullYear()} merQetia — All rights reserved.</p>
    <p style="margin:6px 0 0;font-size:11px;color:${BRAND.muted};">Lingestraat 11, 1316 CN Almere · <a href="https://www.merqetia.nl" style="color:${BRAND.accent};text-decoration:none;">www.merQetia.nl</a></p>
    <p style="margin:4px 0 0;font-size:11px;color:${BRAND.muted};">
      <a href="mailto:${CONTACT_EMAIL}" style="color:${BRAND.accent};text-decoration:none;">${CONTACT_EMAIL}</a>${CONTACT_PHONE ? ` · ${CONTACT_PHONE}` : ''}
    </p>
  </td></tr>`;

/**
 * Shared branded shell. Wraps body content (a string of <tr>… table rows or a
 * single <tr><td>…</td></tr>) in the standard navy header + brand rule + footer
 * card so every email looks identical. `bodyInner` should be the inner HTML of
 * the white body cell (the `<td style="padding:40px;">` contents).
 */
const shell = (bodyInner) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${shellHead}</head>
<body style="margin:0;padding:0;background:${BRAND.offWhite};font-family:${FONT};color:${BRAND.ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.offWhite};padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(8,48,61,0.08);">
        <tr><td style="background:${BRAND.navy};padding:32px 40px;">${headerWordmark}</td></tr>
        ${brandRule}
        <tr><td style="padding:40px;">${bodyInner}</td></tr>
        ${footer}
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const heading = (text) =>
  `<h2 style="margin:0 0 8px;font-size:23px;color:${BRAND.navy};font-family:${FONT_DISPLAY};letter-spacing:-.01em;">${text}</h2>`;
const cta = (url, label) =>
  `<a href="${url}" style="display:inline-block;background:${BRAND.accent};color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;">${label}</a>`;

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
        <td style="padding:10px 16px;border-bottom:1px solid ${BRAND.hair};">${s.name}</td>
        <td style="padding:10px 16px;border-bottom:1px solid ${BRAND.hair};text-align:right;">${money(s.price)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${shellHead}</head>
<body style="margin:0;padding:0;background:${BRAND.offWhite};font-family:${FONT};color:${BRAND.ink};">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.offWhite};padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(8,48,61,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND.navy};padding:32px 40px;">
              ${headerWordmark}
            </td>
          </tr>
          ${brandRule}

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;font-size:23px;color:${BRAND.navy};font-family:${FONT_DISPLAY};letter-spacing:-.01em;">Order Confirmed</h2>
              <p style="margin:0 0 24px;color:${BRAND.muted};font-size:15px;">
                Hi ${clientName}, your order has been received and is being processed.
              </p>

              <!-- Meta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.offWhite};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 20px;font-size:13px;color:${BRAND.muted};">Invoice Number</td>
                  <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.accent};text-align:right;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;font-size:13px;color:${BRAND.muted};border-top:1px solid ${BRAND.hair};">Order Date</td>
                  <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.ink};text-align:right;border-top:1px solid ${BRAND.hair};">${orderDate}</td>
                </tr>
              </table>

              <!-- Services -->
              <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${BRAND.accent};margin-bottom:8px;">Services Ordered</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.hair};border-radius:12px;overflow:hidden;margin-bottom:24px;">
                <thead>
                  <tr style="background:${BRAND.offWhite};">
                    <th style="padding:10px 16px;text-align:left;font-size:12px;color:${BRAND.muted};font-weight:600;">Service</th>
                    <th style="padding:10px 16px;text-align:right;font-size:12px;color:${BRAND.muted};font-weight:600;">Price</th>
                  </tr>
                </thead>
                <tbody>${serviceRows}</tbody>
                <tfoot>
                  <tr style="background:${BRAND.offWhite};">
                    <td style="padding:12px 16px;font-weight:700;font-size:15px;color:${BRAND.navy};">Total</td>
                    <td style="padding:12px 16px;font-weight:700;font-size:15px;text-align:right;color:${BRAND.accent};">${money(totalPrice)}</td>
                  </tr>
                </tfoot>
              </table>

              <p style="color:${BRAND.muted};font-size:14px;line-height:1.6;margin-bottom:28px;">
                Your invoice is attached to this email as a PDF. Our team will review your order and get started shortly.
                You can track your order status at any time from your dashboard.
              </p>

              <p style="color:${BRAND.muted};font-size:13px;">
                If you have any questions, reply to this email and we'll be happy to help.
              </p>
            </td>
          </tr>

          ${footer}

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
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${shellHead}</head>
<body style="margin:0;padding:0;background:${BRAND.offWhite};font-family:${FONT};color:${BRAND.ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.offWhite};padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(8,48,61,0.08);">
        <tr><td style="background:${BRAND.navy};padding:32px 40px;">
          ${headerWordmark}
        </td></tr>
        ${brandRule}
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;font-size:23px;color:${BRAND.navy};font-family:${FONT_DISPLAY};letter-spacing:-.01em;">New Order — Action Required</h2>
          <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;">A new order has been placed by <strong>${clientName}</strong> and is waiting for an employee to be assigned.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.offWhite};border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:14px 20px;font-size:13px;color:${BRAND.muted};">Order</td>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.accent};text-align:right;">${orderNum}</td></tr>
            <tr><td style="padding:14px 20px;font-size:13px;color:${BRAND.muted};border-top:1px solid ${BRAND.hair};">Client</td>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.ink};text-align:right;border-top:1px solid ${BRAND.hair};">${clientName}</td></tr>
          </table>
          <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${BRAND.accent};margin-bottom:8px;">Services</p>
          <ul style="margin:0 0 28px;padding-left:20px;color:${BRAND.ink};font-size:14px;">${serviceList}</ul>
          <a href="${assignUrl}" style="display:inline-block;background:${BRAND.accent};color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;">Assign Employee →</a>
        </td></tr>
        ${footer}
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
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${shellHead}</head>
<body style="margin:0;padding:0;background:${BRAND.offWhite};font-family:${FONT};color:${BRAND.ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.offWhite};padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(8,48,61,0.08);">
        <tr><td style="background:${BRAND.navy};padding:32px 40px;">
          ${headerWordmark}
        </td></tr>
        ${brandRule}
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;font-size:23px;color:${BRAND.navy};font-family:${FONT_DISPLAY};letter-spacing:-.01em;">New Order Assigned to You</h2>
          <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;">Hi <strong>${employeeName}</strong>, a new order from <strong>${clientName}</strong> has been assigned to you. Please review and accept or decline it.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.offWhite};border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:14px 20px;font-size:13px;color:${BRAND.muted};">Order</td>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.accent};text-align:right;">${orderNum}</td></tr>
            <tr><td style="padding:14px 20px;font-size:13px;color:${BRAND.muted};border-top:1px solid ${BRAND.hair};">Client</td>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.ink};text-align:right;border-top:1px solid ${BRAND.hair};">${clientName}</td></tr>
          </table>
          <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${BRAND.accent};margin-bottom:8px;">Services</p>
          <ul style="margin:0 0 28px;padding-left:20px;color:${BRAND.ink};font-size:14px;">${serviceList}</ul>
          <a href="${viewUrl}" style="display:inline-block;background:${BRAND.accent};color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;">View Assignment →</a>
        </td></tr>
        ${footer}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/**
 * Generic notification email — used for message / mention / update alerts that
 * the recipient has opted into receiving by email. Keeps the brand shell but
 * stays lightweight (heading + message + optional CTA).
 */
const genericNotificationHTML = ({ recipientName, heading, message, orderNum, ctaUrl, ctaLabel }) => {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const orderRow = orderNum
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.offWhite};border-radius:12px;margin-bottom:24px;">
         <tr><td style="padding:14px 20px;font-size:13px;color:${BRAND.muted};">Order</td>
             <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.accent};text-align:right;">${orderNum}</td></tr>
       </table>`
    : '';
  const cta = ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;background:${BRAND.accent};color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;">${ctaLabel || 'View →'}</a>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${shellHead}</head>
<body style="margin:0;padding:0;background:${BRAND.offWhite};font-family:${FONT};color:${BRAND.ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.offWhite};padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(8,48,61,0.08);">
        <tr><td style="background:${BRAND.navy};padding:32px 40px;">
          ${headerWordmark}
        </td></tr>
        ${brandRule}
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;font-size:23px;color:${BRAND.navy};font-family:${FONT_DISPLAY};letter-spacing:-.01em;">${heading}</h2>
          <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;">${greeting}</p>
          <p style="margin:0 0 24px;color:${BRAND.ink};font-size:15px;line-height:1.6;">${message}</p>
          ${orderRow}
          ${cta}
          <p style="color:${BRAND.muted};font-size:12px;margin-top:28px;">
            You're receiving this because you opted into email notifications. You can change this anytime in your account settings.
          </p>
        </td></tr>
        ${footer}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/**
 * Branded employee invitation email.
 */
const employeeInviteHTML = ({ inviteLink }) => shell(`
  ${heading('You\'re invited to merQetia')}
  <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;">An admin has invited you to join <strong>merQetia</strong> as a team member. Click below to complete your registration — the link expires in 48 hours.</p>
  ${cta(inviteLink, 'Accept Invitation →')}
  <p style="color:${BRAND.muted};font-size:12px;margin-top:28px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
`);

/**
 * Branded meeting email — scheduled, rescheduled, or cancelled. Carries the
 * Google Meet join link and a link to the calendar event when available.
 * @param {'scheduled'|'updated'|'cancelled'} kind
 */
const meetingHTML = ({ kind = 'scheduled', clientName, ticketId, refLabel = 'Ticket', subject, whenStr, durationMins, meetingLink, htmlLink, note }) => {
  const copy = {
    scheduled: { h: 'Your meeting is scheduled', lead: 'We\'ve scheduled a meeting with you. The details are below — a calendar invite has also been sent to your email.' },
    updated:   { h: 'Your meeting was rescheduled', lead: 'Your meeting has been moved to a new time. The updated details are below.' },
    cancelled: { h: 'Your meeting was cancelled', lead: 'Your scheduled meeting has been cancelled. Reach out any time to arrange a new one.' },
  }[kind] || {};

  const detailRow = (label, value) => `
    <tr><td style="padding:14px 20px;font-size:13px;color:${BRAND.muted};border-top:1px solid ${BRAND.hair};">${label}</td>
        <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.ink};text-align:right;border-top:1px solid ${BRAND.hair};">${value}</td></tr>`;

  const detailTable = kind === 'cancelled' ? '' : `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.offWhite};border-radius:12px;margin:0 0 24px;">
      <tr><td style="padding:14px 20px;font-size:13px;color:${BRAND.muted};">${refLabel}</td>
          <td style="padding:14px 20px;font-size:13px;font-weight:600;color:${BRAND.accent};text-align:right;">${ticketId}</td></tr>
      ${detailRow('Subject', subject || '—')}
      ${detailRow('When', whenStr)}
      ${detailRow('Duration', `${durationMins} min`)}
    </table>`;

  return shell(`
    ${heading(copy.h)}
    <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;">Hi ${clientName || 'there'}, ${copy.lead}</p>
    ${detailTable}
    ${note ? `<p style="margin:0 0 24px;color:${BRAND.ink};font-size:14px;line-height:1.6;"><strong>Notes:</strong> ${note}</p>` : ''}
    ${kind !== 'cancelled' && meetingLink ? cta(meetingLink, 'Join Meeting →') : ''}
    ${kind !== 'cancelled' && htmlLink ? `<p style="margin:16px 0 0;font-size:13px;"><a href="${htmlLink}" style="color:${BRAND.accent};text-decoration:none;">View in calendar</a></p>` : ''}
  `);
};

module.exports = {
  orderConfirmationHTML,
  newOrderAdminHTML,
  orderAssignedEmployeeHTML,
  genericNotificationHTML,
  employeeInviteHTML,
  meetingHTML,
};
