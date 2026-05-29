const { sendEmail } = require('../utils/mailer');
const { generatePDF } = require('../utils/pdfGenerator');
const { orderConfirmationHTML, newOrderAdminHTML, orderAssignedEmployeeHTML } = require('../utils/emailTemplates');
const { getInvoiceById } = require('./invoiceService');

/**
 * Send an order confirmation email with the invoice PDF attached.
 * This is non-critical — a failure here must NOT break the order flow.
 *
 * @param {Object} params
 * @param {Object} params.order   - Populated order document
 * @param {Object} params.invoice - Invoice document (needs invoiceNumber & _id)
 * @param {Object} params.client  - { name, email }
 */
const sendOrderConfirmation = async ({ order, invoice, client }) => {
  try {
    // Fetch fully populated invoice for PDF generation
    const populatedInvoice = await getInvoiceById(invoice._id.toString());

    const pdfBuffer = await generatePDF(populatedInvoice);

    const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const services = (order.services || []).map((s) => ({
      name: s.name || 'Service',
      price: s.price || 0,
    }));

    const html = orderConfirmationHTML({
      clientName: client.name,
      invoiceNumber: invoice.invoiceNumber,
      orderDate,
      services,
      totalPrice: order.totalPrice,
    });

    await sendEmail({
      to: client.email,
      subject: `Order Confirmed — ${invoice.invoiceNumber}`,
      html,
      attachments: [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (err) {
    // Log but do not throw — email failure must not fail the order
    console.error('[Email] Failed to send order confirmation:', err.message);
  }
};

/**
 * Notify all admins that a new order has been placed and needs assignment.
 * Fire-and-forget — never throws.
 */
const sendNewOrderAdminAlert = async ({ admins, clientName, services, orderId, orderNum }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const html = newOrderAdminHTML({ clientName, services, orderNum, frontendUrl });
  for (const admin of admins) {
    sendEmail({
      to: admin.email,
      subject: `New Order ${orderNum} — Assign Employee`,
      html,
    }).catch((err) => console.error('[Email] Failed to send admin alert:', err.message));
  }
};

/**
 * Notify an employee that an order has been assigned to them.
 * Fire-and-forget — never throws.
 */
const sendOrderAssignedEmployee = async ({ employee, clientName, services, orderNum }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const html = orderAssignedEmployeeHTML({ employeeName: employee.name, clientName, services, orderNum, frontendUrl });
  sendEmail({
    to: employee.email,
    subject: `Order ${orderNum} Assigned to You`,
    html,
  }).catch((err) => console.error('[Email] Failed to send employee assignment email:', err.message));
};

module.exports = { sendOrderConfirmation, sendNewOrderAdminAlert, sendOrderAssignedEmployee };
