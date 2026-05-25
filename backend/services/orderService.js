const Order = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { generateOrderSummary } = require('./aiService');
const { generateInvoice } = require('./invoiceService');
const { sendOrderConfirmation } = require('./emailService');

const STATUS_LABEL = {
  placed: 'Pending',
  assigned: 'Assigned',
  accepted: 'In Progress',
  rejected: 'Rejected',
  completed: 'Completed',
};

/**
 * Push a notification to a user. Fire-and-forget (non-blocking).
 */
const pushNotification = (userId, orderId, orderNum, type, typeLabel, body) => {
  Notification.create({
    userId,
    orderId,
    type,
    typeLabel,
    title: `Order ${orderNum}`,
    body,
  }).catch(() => {});
};

const POPULATE_ORDER = [
  { path: 'clientId', select: 'name email' },
  { path: 'services', select: 'name price department' },
  { path: 'assignedEmployee', select: 'name email' },
  { path: 'messages.sender', select: 'name' },
];

/**
 * Validate that answers cover all required questions for every service.
 * answers shape: { "<serviceId>": { "Question text": "Answer text" } }
 */
const validateAnswers = (services, answers) => {
  const missing = [];

  for (const service of services) {
    if (!service.questions || service.questions.length === 0) continue;

    const serviceAnswers = answers[service._id.toString()] || {};

    for (const question of service.questions) {
      const answer = serviceAnswers[question];
      if (!answer || String(answer).trim() === '') {
        missing.push(`Missing answer for "${question}" (service: ${service.name})`);
      }
    }
  }

  return missing;
};

/**
 * Client places a new order — status: placed
 */
const createOrder = async ({ clientId, serviceIds, answers = {} }) => {
  const services = await Service.find({ _id: { $in: serviceIds }, isActive: true });

  if (services.length !== serviceIds.length) {
    const err = new Error('One or more services are invalid or inactive');
    err.statusCode = 400;
    throw err;
  }

  const missing = validateAnswers(services, answers);
  if (missing.length > 0) {
    const err = new Error(`Incomplete answers: ${missing.join('; ')}`);
    err.statusCode = 400;
    throw err;
  }

  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

  const summary = await generateOrderSummary(services, answers);

  const order = await Order.create({
    clientId,
    services: serviceIds,
    answers,
    totalPrice,
    summary,
    status: 'placed',
  });

  const invoice = await generateInvoice(order._id, totalPrice, 'full');
  const populatedOrder = { ...order.toObject(), services };
  const client = await User.findById(clientId).select('name email');
  await sendOrderConfirmation({ order: populatedOrder, invoice, client });

  return order;
};

/**
 * Get all orders - admin view with pagination
 */
const getAllOrders = async ({ page = 1, limit = 20, status } = {}) => {
  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('clientId', 'name email')
      .populate('services', 'name price department')
      .populate('assignedEmployee', 'name email')
      .populate('messages.sender', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Order.countDocuments(filter),
  ]);

  return { orders, pagination: { total, page, pages: Math.ceil(total / limit) } };
};

/**
 * Get orders belonging to a specific client
 */
const getClientOrders = async ({ clientId, page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find({ clientId })
      .populate('services', 'name price department')
      .populate('assignedEmployee', 'name email')
      .populate('messages.sender', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Order.countDocuments({ clientId }),
  ]);

  return { orders, pagination: { total, page, pages: Math.ceil(total / limit) } };
};

/**
 * Get a single order by ID
 */
const getOrderById = async (id) => {
  const order = await Order.findById(id)
    .populate('clientId', 'name email')
    .populate('services', 'name price department questions')
    .populate('assignedEmployee', 'name email')
    .populate('messages.sender', 'name');

  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  return order;
};

/**
 * Admin assigns an employee to an order (only placed → assigned)
 */
const assignEmployee = async (orderId, employeeId) => {
  const employee = await User.findById(employeeId);
  if (!employee || employee.role !== 'employee') {
    const err = new Error('Employee not found or user is not an employee');
    err.statusCode = 400;
    throw err;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (order.status !== 'placed') {
    const err = new Error('Only placed orders can be assigned');
    err.statusCode = 400;
    throw err;
  }

  order.assignedEmployee = employeeId;
  order.status = 'assigned';
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Status Update', STATUS_LABEL.assigned);
  pushNotification(employeeId, order._id, orderNum, 'status', 'New Order Request', 'A new order has been assigned to you');

  return order.populate(POPULATE_ORDER);
};

/**
 * Employee accepts an assigned order — assigned → accepted, sets deliveryDate
 */
const acceptOrder = async (orderId, employeeId, deliveryDate) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (!order.assignedEmployee || order.assignedEmployee.toString() !== employeeId.toString()) {
    const err = new Error('You are not assigned to this order');
    err.statusCode = 403;
    throw err;
  }

  if (order.status !== 'assigned') {
    const err = new Error('Only assigned orders can be accepted');
    err.statusCode = 400;
    throw err;
  }

  order.status = 'accepted';
  order.deliveryDate = deliveryDate;
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Status Update', STATUS_LABEL.accepted);

  return order.populate(POPULATE_ORDER);
};

/**
 * Employee rejects an assigned order — assigned → rejected
 */
const rejectOrder = async (orderId, employeeId, reason) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (!order.assignedEmployee || order.assignedEmployee.toString() !== employeeId.toString()) {
    const err = new Error('You are not assigned to this order');
    err.statusCode = 403;
    throw err;
  }

  if (order.status !== 'assigned') {
    const err = new Error('Only assigned orders can be rejected');
    err.statusCode = 400;
    throw err;
  }

  order.status = 'rejected';
  order.rejectionReason = reason || null;
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Status Update', STATUS_LABEL.rejected);

  return order.populate(POPULATE_ORDER);
};

/**
 * Employee marks an accepted order as completed — accepted → completed
 */
const completeOrder = async (orderId, employeeId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (!order.assignedEmployee || order.assignedEmployee.toString() !== employeeId.toString()) {
    const err = new Error('You are not assigned to this order');
    err.statusCode = 403;
    throw err;
  }

  if (order.status !== 'accepted') {
    const err = new Error('Only accepted orders can be marked as completed');
    err.statusCode = 400;
    throw err;
  }

  order.status = 'completed';
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Status Update', STATUS_LABEL.completed);

  return order.populate(POPULATE_ORDER);
};

/**
 * Add a message to an order conversation (client or assigned employee only; admin can read)
 */
const addMessage = async (orderId, senderId, senderRole, text, attachments = []) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (order.status !== 'accepted' && order.status !== 'completed') {
    const err = new Error('Conversation is only available on accepted orders');
    err.statusCode = 400;
    throw err;
  }

  // Clients can only message their own order
  if (senderRole === 'client' && order.clientId.toString() !== senderId.toString()) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  // Employees can only message orders assigned to them
  if (senderRole === 'employee' && (!order.assignedEmployee || order.assignedEmployee.toString() !== senderId.toString())) {
    const err = new Error('You are not assigned to this order');
    err.statusCode = 403;
    throw err;
  }

  order.messages.push({ sender: senderId, senderRole, text, attachments });
  await order.save();

  // Notify the other party (employee → notify client; client/admin → notify client's employee)
  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  const bodyPreview = text ? text.slice(0, 80) : `${attachments.length} file${attachments.length > 1 ? 's' : ''} shared`;
  if (senderRole === 'employee' || senderRole === 'admin') {
    pushNotification(order.clientId, order._id, orderNum, 'message', 'New Message', bodyPreview);
  } else if (senderRole === 'client' && order.assignedEmployee) {
    pushNotification(order.assignedEmployee, order._id, orderNum, 'message', 'New Message', bodyPreview);
  }

  return order.populate(POPULATE_ORDER);
};

/**
 * Get orders assigned to a specific employee
 */
const getEmployeeOrders = async ({ employeeId, page = 1, limit = 20, status }) => {
  const filter = { assignedEmployee: employeeId };
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('clientId', 'name email')
      .populate('services', 'name price department')
      .populate('messages.sender', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Order.countDocuments(filter),
  ]);

  return { orders, pagination: { total, page, pages: Math.ceil(total / limit) } };
};

module.exports = {
  createOrder,
  getAllOrders,
  getClientOrders,
  getOrderById,
  assignEmployee,
  acceptOrder,
  rejectOrder,
  completeOrder,
  addMessage,
  getEmployeeOrders,
};
