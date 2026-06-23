const Order = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Invoice = require('../models/Invoice');
const { generateOrderSummary } = require('./aiService');
const { generateInvoice } = require('./invoiceService');
const { sendOrderConfirmation, sendNewOrderAdminAlert, sendOrderAssignedEmployee } = require('./emailService');
const { emitToUser, emitToAdmins } = require('../socket');

const STATUS_LABEL = {
  placed: 'Placed',
  assigned: 'Assigned',
  accepted: 'In Progress',
  review: 'In Review',
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
  })
    // Push the new notification live to the recipient's open sessions
    .then((notif) => emitToUser(userId, 'notification:new', notif.toObject()))
    .catch(() => {});
};

/**
 * Push a populated order to everyone involved (client, assigned employee, admins)
 * so their open lists / detail pages update without a refresh.
 */
const broadcastOrder = (order, event = 'order:updated') => {
  const payload = { orderId: order._id.toString(), order };
  const clientId = order.clientId?._id || order.clientId;
  const employeeId = order.assignedEmployee?._id || order.assignedEmployee;
  emitToUser(clientId, event, payload);
  if (employeeId) emitToUser(employeeId, event, payload);
  emitToAdmins(event, payload);
};

const POPULATE_ORDER = [
  { path: 'clientId', select: 'name email' },
  { path: 'services', select: 'name price department' },
  { path: 'assignedEmployee', select: 'name email' },
  { path: 'messages.sender', select: 'name' },
  { path: 'updates.sender', select: 'name' },
  { path: 'updates.mentions', select: 'name' },
];

/**
 * Resolve the staff who participate in an order's internal updates:
 * all admins plus the assigned employee. Used to power @mentions and to
 * validate that a mention targets a real participant.
 */
const getOrderParticipants = async (order) => {
  const admins = await User.find({ role: 'admin' }).select('name role');
  const participants = admins.map((a) => ({ _id: a._id, name: a.name, role: a.role }));

  if (order.assignedEmployee) {
    const empId = order.assignedEmployee._id || order.assignedEmployee;
    if (!participants.some((p) => p._id.toString() === empId.toString())) {
      const emp = await User.findById(empId).select('name role');
      if (emp) participants.push({ _id: emp._id, name: emp.name, role: emp.role });
    }
  }

  return participants;
};

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

  // Notify all admins about the new order (fire-and-forget)
  User.find({ role: 'admin' }).select('_id name email').then((admins) => {
    const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
    const serviceNames = services.map((s) => s.name).join(', ');
    sendNewOrderAdminAlert({
      admins,
      clientName: client.name,
      services: services.map((s) => ({ name: s.name })),
      orderId: order._id,
      orderNum,
    });
    admins.forEach((admin) =>
      pushNotification(
        admin._id,
        order._id,
        orderNum,
        'status',
        'New Order',
        `New order ${orderNum} placed by ${client.name} for: ${serviceNames}. Needs employee assignment.`
      )
    );
  }).catch(() => {});

  // Surface the new order live on admin lists (fire-and-forget)
  Order.findById(order._id).populate(POPULATE_ORDER)
    .then((populated) => { if (populated) broadcastOrder(populated, 'order:created'); })
    .catch(() => {});

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
      .populate('updates.sender', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Order.countDocuments(filter),
  ]);

  return { orders, pagination: { total, page, pages: Math.ceil(total / limit) } };
};

/**
 * Get orders belonging to a specific client — attaches the primary invoice
 * (type=full, or most recent) to each order so clients can see payment status.
 */
const getClientOrders = async ({ clientId, page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find({ clientId })
      .populate('services', 'name price department')
      .populate('assignedEmployee', 'name email')
      .populate('messages.sender', 'name')
      .populate('updates.sender', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Order.countDocuments({ clientId }),
  ]);

  // Attach primary invoice to each order
  const orderIds = orders.map((o) => o._id);
  const invoices = await Invoice.find({ orderId: { $in: orderIds } })
    .select('orderId status paidAt amount invoiceNumber type')
    .sort({ createdAt: 1 });

  const invoiceByOrder = {};
  for (const inv of invoices) {
    const key = inv.orderId.toString();
    // Full invoice takes priority; otherwise keep first (oldest = auto-generated)
    if (!invoiceByOrder[key] || inv.type === 'full') {
      invoiceByOrder[key] = inv;
    }
  }

  const ordersWithInvoice = orders.map((o) => {
    const obj = o.toObject();
    obj.invoice = invoiceByOrder[o._id.toString()] || null;
    return obj;
  });

  return { orders: ordersWithInvoice, pagination: { total, page, pages: Math.ceil(total / limit) } };
};

/**
 * Get a single order by ID
 */
const getOrderById = async (id) => {
  const order = await Order.findById(id)
    .populate('clientId', 'name email')
    .populate('services', 'name price department questions')
    .populate('assignedEmployee', 'name email')
    .populate('messages.sender', 'name')
    .populate('updates.sender', 'name');

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
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Order Assigned', `Your order ${orderNum} has been assigned to an employee. They will review and respond shortly.`);
  pushNotification(employeeId, order._id, orderNum, 'status', 'New Order Assigned to You', `Order ${orderNum} from a client has been assigned to you. Please review and accept or decline.`);

  // Email the assigned employee (fire-and-forget)
  Promise.all([
    order.populate('services', 'name'),
    User.findById(employeeId).select('name email'),
    User.findById(order.clientId).select('name'),
  ]).then(([populatedOrderWithServices, employee, client]) => {
    sendOrderAssignedEmployee({
      employee,
      clientName: client?.name || 'Client',
      services: (populatedOrderWithServices.services || []).map((s) => ({ name: s.name })),
      orderNum,
    });
  }).catch(() => {});

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
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
  const fmtDelivery = new Date(deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Order In Progress', `Your order ${orderNum} has been accepted and is now in progress. Estimated delivery: ${fmtDelivery}.`);
  User.find({ role: 'admin' }).select('_id').then((admins) => {
    admins.forEach((a) => pushNotification(a._id, order._id, orderNum, 'status', 'Order Accepted by Employee', `Order ${orderNum} has been accepted by the assigned employee. Delivery date set to ${fmtDelivery}.`));
  }).catch(() => {});

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
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
  const rejectBody = reason
    ? `Your order ${orderNum} was declined by the employee. Reason: ${reason}. Admin will arrange reassignment.`
    : `Your order ${orderNum} was declined by the employee. Admin will arrange reassignment.`;
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Order Declined', rejectBody);
  User.find({ role: 'admin' }).select('_id').then((admins) => {
    const adminBody = reason
      ? `Order ${orderNum} was rejected by the employee. Reason: ${reason}.`
      : `Order ${orderNum} was rejected by the employee. No reason provided.`;
    admins.forEach((a) => pushNotification(a._id, order._id, orderNum, 'status', 'Order Rejected by Employee', adminBody));
  }).catch(() => {});

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
};

/**
 * Employee submits finished work for client review — accepted → review
 */
const submitForReview = async (orderId, employeeId) => {
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
    const err = new Error('Only in-progress orders can be submitted for review');
    err.statusCode = 400;
    throw err;
  }

  order.status = 'review';
  order.revisionNote = null; // clear any prior change request
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Order Ready for Review', `Your order ${orderNum} is ready for review. Please confirm completion or request changes.`);
  User.find({ role: 'admin' }).select('_id').then((admins) => {
    admins.forEach((a) => pushNotification(a._id, order._id, orderNum, 'status', 'Order Submitted for Review', `Order ${orderNum} has been submitted for client review by the assigned employee.`));
  }).catch(() => {});

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
};

/**
 * Client confirms the delivered work — review → completed
 */
const confirmOrder = async (orderId, clientId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (order.clientId.toString() !== clientId.toString()) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  if (order.status !== 'review') {
    const err = new Error('Only orders in review can be confirmed');
    err.statusCode = 400;
    throw err;
  }

  order.status = 'completed';
  order.revisionNote = null;
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  if (order.assignedEmployee) {
    pushNotification(order.assignedEmployee, order._id, orderNum, 'status', 'Order Completed', `The client has confirmed and completed order ${orderNum}. Great work!`);
  }
  User.find({ role: 'admin' }).select('_id').then((admins) => {
    admins.forEach((a) => pushNotification(a._id, order._id, orderNum, 'status', 'Order Completed', `Order ${orderNum} has been confirmed and completed by the client.`));
  }).catch(() => {});

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
};

/**
 * Client requests changes on submitted work — review → accepted (back in progress)
 */
const requestChanges = async (orderId, clientId, note) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (order.clientId.toString() !== clientId.toString()) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  if (order.status !== 'review') {
    const err = new Error('Only orders in review can have changes requested');
    err.statusCode = 400;
    throw err;
  }

  order.status = 'accepted';
  order.revisionNote = note || null;
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  const body = note
    ? `The client requested changes on order ${orderNum}: "${note.slice(0, 120)}"`
    : `The client requested changes on order ${orderNum}.`;
  if (order.assignedEmployee) {
    pushNotification(order.assignedEmployee, order._id, orderNum, 'status', 'Changes Requested', body);
  }
  User.find({ role: 'admin' }).select('_id').then((admins) => {
    admins.forEach((a) => pushNotification(a._id, order._id, orderNum, 'status', 'Changes Requested', body));
  }).catch(() => {});

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
};

/**
 * Admin force-completes an order, overriding client confirmation
 * (e.g. unresponsive client) — accepted | review → completed
 */
const adminForceComplete = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (!['accepted', 'review'].includes(order.status)) {
    const err = new Error('Only in-progress or in-review orders can be force-completed');
    err.statusCode = 400;
    throw err;
  }

  order.status = 'completed';
  order.revisionNote = null;
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Order Completed', `Your order ${orderNum} has been marked as completed.`);
  if (order.assignedEmployee) {
    pushNotification(order.assignedEmployee, order._id, orderNum, 'status', 'Order Completed', `Order ${orderNum} has been marked as completed by an admin.`);
  }

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
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

  if (!['accepted', 'review', 'completed'].includes(order.status)) {
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

  // Notify the other party (employee → notify client; client → notify employee)
  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  if (senderRole === 'employee') {
    const body = text
      ? `Your employee sent a message on order ${orderNum}: "${text.slice(0, 80)}"`
      : `Your employee shared ${attachments.length} file${attachments.length > 1 ? 's' : ''} on order ${orderNum}.`;
    pushNotification(order.clientId, order._id, orderNum, 'message', 'New Message from Employee', body);
  } else if (senderRole === 'client' && order.assignedEmployee) {
    const body = text
      ? `Client sent a message on order ${orderNum}: "${text.slice(0, 80)}"`
      : `Client shared ${attachments.length} file${attachments.length > 1 ? 's' : ''} on order ${orderNum}.`;
    pushNotification(order.assignedEmployee, order._id, orderNum, 'message', 'New Message from Client', body);
  }

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
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
      .populate('updates.sender', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Order.countDocuments(filter),
  ]);

  return { orders, pagination: { total, page, pages: Math.ceil(total / limit) } };
};

/**
 * Add an internal update (admin ↔ employee only)
 */
const addUpdate = async (orderId, senderId, senderRole, text, attachments = [], mentions = []) => {
  if (senderRole === 'client') {
    const err = new Error('Clients cannot post updates');
    err.statusCode = 403;
    throw err;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (senderRole === 'employee' && (!order.assignedEmployee || order.assignedEmployee.toString() !== senderId.toString())) {
    const err = new Error('You are not assigned to this order');
    err.statusCode = 403;
    throw err;
  }

  // Only allow mentioning real participants (admins + assigned employee), never self.
  const participants = await getOrderParticipants(order);
  const allowedIds = new Set(participants.map((p) => p._id.toString()));
  const mentionIds = [...new Set((mentions || []).map(String))].filter(
    (id) => allowedIds.has(id) && id !== senderId.toString(),
  );

  order.updates.push({ sender: senderId, senderRole, text, attachments, mentions: mentionIds });
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;

  // Notify mentioned participants directly.
  if (mentionIds.length) {
    const sender = await User.findById(senderId).select('name');
    const senderName = sender?.name || (senderRole === 'admin' ? 'An admin' : 'An employee');
    const mentionBody = text
      ? `${senderName} mentioned you in an update on order ${orderNum}: "${text.slice(0, 80)}"`
      : `${senderName} mentioned you in an update on order ${orderNum}.`;
    mentionIds.forEach((uid) => pushNotification(uid, order._id, orderNum, 'message', 'You were mentioned', mentionBody));
  }
  const mentionedSet = new Set(mentionIds);

  // Notify the other party (skip anyone already notified via a mention).
  if (senderRole === 'employee' && order.assignedEmployee) {
    const body = text
      ? `Employee posted an update on order ${orderNum}: "${text.slice(0, 80)}"`
      : `Employee shared ${attachments.length} file${attachments.length > 1 ? 's' : ''} on order ${orderNum}.`;
    // employee → notify all admins
    User.find({ role: 'admin' }).select('_id').then((admins) => {
      admins
        .filter((a) => !mentionedSet.has(a._id.toString()))
        .forEach((a) => pushNotification(a._id, order._id, orderNum, 'message', 'New Update from Employee', body));
    }).catch(() => {});
  } else if (senderRole === 'admin' && order.assignedEmployee && !mentionedSet.has(order.assignedEmployee.toString())) {
    const body = text
      ? `Admin posted an update on order ${orderNum}: "${text.slice(0, 80)}"`
      : `Admin shared ${attachments.length} file${attachments.length > 1 ? 's' : ''} on order ${orderNum}.`;
    pushNotification(order.assignedEmployee, order._id, orderNum, 'message', 'New Update from Admin', body);
  }

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
};

/**
 * List the staff a requester can @mention on an order's updates:
 * order participants (admins + assigned employee), excluding the requester.
 */
const listMentionableParticipants = async (orderId, requesterId, requesterRole) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (requesterRole === 'employee' && (!order.assignedEmployee || order.assignedEmployee.toString() !== requesterId.toString())) {
    const err = new Error('You are not assigned to this order');
    err.statusCode = 403;
    throw err;
  }

  const participants = await getOrderParticipants(order);
  return participants.filter((p) => p._id.toString() !== requesterId.toString());
};

/**
 * Admin overrides the delivery date on an accepted order
 */
const adminSetDeliveryDate = async (orderId, deliveryDate) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (order.status !== 'accepted') {
    const err = new Error('Delivery date can only be changed on orders that are in progress (accepted)');
    err.statusCode = 400;
    throw err;
  }

  order.deliveryDate = deliveryDate;
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Delivery Date Updated', `Your delivery date has been updated to ${new Date(deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
  if (order.assignedEmployee) {
    pushNotification(order.assignedEmployee, order._id, orderNum, 'status', 'Delivery Date Updated', 'Admin has updated the delivery date for this order');
  }

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
};

/**
 * Admin resets order status:
 *   rejected → placed (clears employee, rejectionReason, deliveryDate)
 *   completed → accepted (back in progress)
 */
const adminResetOrderStatus = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (order.status === 'rejected') {
    order.status = 'placed';
    order.assignedEmployee = null;
    order.rejectionReason = null;
    order.deliveryDate = null;
  } else if (order.status === 'completed') {
    order.status = 'accepted';
  } else {
    const err = new Error('Status can only be reset for rejected or completed orders');
    err.statusCode = 400;
    throw err;
  }

  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  pushNotification(order.clientId, order._id, orderNum, 'status', 'Order Status Updated', `Your order status has been updated`);

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
};

module.exports = {
  createOrder,
  getAllOrders,
  getClientOrders,
  getOrderById,
  assignEmployee,
  acceptOrder,
  rejectOrder,
  submitForReview,
  confirmOrder,
  requestChanges,
  adminForceComplete,
  addMessage,
  addUpdate,
  listMentionableParticipants,
  getEmployeeOrders,
  adminSetDeliveryDate,
  adminResetOrderStatus,
};
