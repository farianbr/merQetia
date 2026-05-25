const {
  getAllInvoices,
  getClientInvoices,
  getInvoiceById,
  markAsPaid,
  createPartialInvoice,
} = require('../services/invoiceService');
const { generatePDF } = require('../utils/pdfGenerator');

/**
 * GET /api/invoices
 * Admin — all invoices; Client — own invoices (via their orders)
 */
const getInvoices = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;

    let result;

    if (req.user.role === 'admin') {
      result = await getAllInvoices({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
      });
    } else {
      result = await getClientInvoices({
        clientId: req.user.id,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      });
    }

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/invoices/:id
 * Admin — any invoice; Client — only their own
 */
const getInvoice = async (req, res, next) => {
  try {
    const invoice = await getInvoiceById(req.params.id);

    // Ownership check for clients
    if (req.user.role === 'client') {
      const orderClientId = invoice.orderId?.clientId?._id?.toString();
      if (orderClientId !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.status(200).json({ success: true, invoice });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/invoices/:id/pay
 * Admin only — mark an invoice as paid
 */
const pay = async (req, res, next) => {
  try {
    const invoice = await markAsPaid(req.params.id);
    res.status(200).json({ success: true, invoice });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/invoices
 * Admin only — create a partial or advance invoice for an order
 */
const createInvoice = async (req, res, next) => {
  try {
    const { orderId, amount, type, notes } = req.body;

    if (!orderId || amount == null || !type) {
      return res.status(400).json({ success: false, message: 'orderId, amount, and type are required' });
    }

    if (!['advance', 'partial'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be "advance" or "partial" for manual invoices' });
    }

    const invoice = await createPartialInvoice({ orderId, amount, type, notes });
    res.status(201).json({ success: true, invoice });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/invoices/:id/pdf
 * Admin or owning Client — download invoice as PDF
 */
const downloadPDF = async (req, res, next) => {
  try {
    const invoice = await getInvoiceById(req.params.id);

    // Ownership check for clients
    if (req.user.role === 'client') {
      const orderClientId = invoice.orderId?.clientId?._id?.toString();
      if (orderClientId !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const pdfBuffer = await generatePDF(invoice);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

module.exports = { getInvoices, getInvoice, pay, createInvoice, downloadPDF };
