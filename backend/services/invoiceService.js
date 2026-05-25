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
 * Create a partial/advance invoice for an order (admin use)
 */
const createPartialInvoice = async ({ orderId, amount, type, notes }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (amount > order.totalPrice) {
    const err = new Error('Invoice amount cannot exceed order total price');
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
  createPartialInvoice,
};
