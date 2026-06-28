const Invoice = require('../models/Invoice');
const Order = require('../models/Order');

/**
 * Generate a full invoice for a given order.
 * Called automatically when an order is placed.
 */
const generateInvoice = async (orderId, amount, type = 'full') => {
  const invoice = await Invoice.create({ orderId, amount, type });
  return invoice;
};

/**
 * Get all invoices — admin view with optional filters and pagination
 */
const getAllInvoices = async ({ page = 1, limit = 20, status } = {}) => {
  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate({ path: 'orderId', select: 'totalPrice status', populate: { path: 'clientId', select: 'name email' } })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Invoice.countDocuments(filter),
  ]);

  return { invoices, pagination: { total, page, pages: Math.ceil(total / limit) } };
};

/**
 * Get all invoices for a specific client (via their orders)
 */
const getClientInvoices = async ({ clientId, page = 1, limit = 20 }) => {
  // First get all order IDs belonging to this client
  const orders = await Order.find({ clientId }).select('_id');
  const orderIds = orders.map((o) => o._id);

  const filter = { orderId: { $in: orderIds } };
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate('orderId', 'totalPrice status createdAt')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Invoice.countDocuments(filter),
  ]);

  return { invoices, pagination: { total, page, pages: Math.ceil(total / limit) } };
};

/**
 * Get a single invoice by ID
 */
const getInvoiceById = async (id) => {
  const invoice = await Invoice.findById(id).populate({
    path: 'orderId',
    select: 'totalPrice status answers services createdAt',
    populate: [
      { path: 'clientId', select: 'name email' },
      { path: 'services', select: 'name price department' },
    ],
  });

  if (!invoice) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    throw err;
  }

  return invoice;
};

/**
 * Mark an invoice as paid
 */
const markAsPaid = async (id) => {
  const invoice = await Invoice.findById(id);

  if (!invoice) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    throw err;
  }

  if (invoice.status === 'paid') {
    const err = new Error('Invoice is already marked as paid');
    err.statusCode = 400;
    throw err;
  }

  invoice.status = 'paid';
  invoice.paidAt = new Date();
  await invoice.save();

  return invoice;
};

/**
 * Client-initiated demo payment — verifies ownership then marks paid.
 * No real card processing; this is a placeholder for Stripe integration.
 */
const clientPayInvoice = async (invoiceId, clientId) => {
  const invoice = await Invoice.findById(invoiceId).populate({
    path: 'orderId',
    select: 'clientId',
  });

  if (!invoice) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    throw err;
  }

  const orderClientId = invoice.orderId?.clientId?.toString();
  if (orderClientId !== clientId.toString()) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  if (invoice.status === 'paid') {
    const err = new Error('Invoice is already paid');
    err.statusCode = 400;
    throw err;
  }

  invoice.status = 'paid';
  invoice.paidAt = new Date();
  await invoice.save();

  return invoice;
};

/**
 * Void (delete) an unpaid invoice — admin only.
 * The auto-generated full invoice for an order cannot be voided while the
 * order is still active; only admin-created partial/advance invoices or full
 * invoices on cancelled orders should be deleted via this path.
 */
const voidInvoice = async (invoiceId) => {
  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    throw err;
  }

  if (invoice.status === 'paid') {
    const err = new Error('Paid invoices cannot be voided');
    err.statusCode = 400;
    throw err;
  }

  await Invoice.deleteOne({ _id: invoiceId });
  return { voided: true };
};

/**
 * Create a partial/advance invoice for an order (admin use)
 */
const createPartialInvoice = async ({ orderId, amount, type, notes }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  // The combined value of all invoices for an order may not exceed its total.
  const existing = await Invoice.find({ orderId }).select('amount');
  const alreadyInvoiced = existing.reduce((sum, inv) => sum + inv.amount, 0);
  const remaining = order.totalPrice - alreadyInvoiced;

  if (amount > remaining) {
    const err = new Error(
      remaining <= 0
        ? 'This order is already fully invoiced'
        : `Invoice amount cannot exceed the remaining billable amount of €${remaining.toFixed(2)}`
    );
    err.statusCode = 400;
    throw err;
  }

  const invoice = await Invoice.create({ orderId, amount, type, notes });
  return invoice;
};

module.exports = {
  generateInvoice,
  getAllInvoices,
  getClientInvoices,
  getInvoiceById,
  markAsPaid,
  clientPayInvoice,
  voidInvoice,
  createPartialInvoice,
};
