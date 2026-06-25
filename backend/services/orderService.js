const Order = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Invoice = require('../models/Invoice');
const { generateOrderSummary } = require('./aiService');
const { generateInvoice } = require('./invoiceService');
const { sendOrderConfirmation, sendNewOrderAdminAlert, sendOrderAssignedEmployee, sendGenericNotification } = require('./emailService');
const meetingService = require('./meetingService');
const { emitToUser, emitToAdmins } = require('../socket');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const STATUS_LABEL = {
  placed: 'Placed',
  assigned: 'Assigned',
  accepted: 'In Progress',
  review: 'In Review',
  rejected: 'Rejected',
  completed: 'Completed',
};

const ROLE_HOME = { admin: '/admin', employee: '/employee', client: '/dashboard' };

/**
 * Notify a user about an order event, honouring their per-event preferences for
 * each channel. Sends an in-app notification (unless they opted out) and, if
 * they opted into email for that event, a generic notification email.
 * Fire-and-forget (non-blocking, never throws).
 *
 * @param {string} key   - notification event key (see User.NOTIFICATION_KEYS)
 * @param {Object} [opts]
 * @param {boolean} [opts.email=true] - set false when a dedicated email already
 *        covers this event (new order alert / assignment) to avoid double-sending.
 */
const notify = (userId, orderId, orderNum, type, typeLabel, body, key, { email = true } = {}) => {
  User.findById(userId)
    .select('name email role notificationPrefs')
    .then((u) => {
      if (!u) return;
      const prefs = u.notificationPrefs || {};

      // In-app (default on unless explicitly disabled)
      if (prefs.inApp?.[key] !== false) {
        Notification.create({ userId, orderId, type, typeLabel, title: `Order ${orderNum}`, body })
          .then((notif) => emitToUser(userId, 'notification:new', notif.toObject()))
          .catch(() => {});
      }

      // Email (opt-in: only when explicitly enabled)
      if (email && prefs.email?.[key] === true) {
        const home = ROLE_HOME[u.role] || '/dashboard';
        const ctaUrl = (key === 'mentions' || key === 'teamUpdates')
          ? `${FRONTEND_URL}${home}?openUpdate=${orderId}`
          : `${FRONTEND_URL}${home}`;
        sendGenericNotification({
          to: u.email,
          recipientName: u.name,
          subject: `${typeLabel} — order ${orderNum}`,
          heading: typeLabel,
          message: body,
          orderNum,
          ctaLabel: 'Open Dashboard',
          ctaUrl,
        });
      }
    })
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
    const serviceAnswers = answers[service._id.toString()] || {};
    const allowed = new Set(service.questions || []);

    // Reject any answer key that doesn't correspond to a real question on this
    // service. This stops a client from injecting arbitrary Q&A pairs that would
    // otherwise be assembled verbatim into the AI prompt.
    for (const key of Object.keys(serviceAnswers)) {
      if (!allowed.has(key)) {
        missing.push(`Unexpected answer "${key}" (service: ${service.name})`);
      }
    }

    for (const question of allowed) {
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
  User.find({ role: 'admin' }).select('_id name email notificationPrefs').then((admins) => {
    const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
    const serviceNames = services.map((s) => s.name).join(', ');
    // Email only the admins who have the new-order email enabled.
    const emailAdmins = admins.filter((a) => a.notificationPrefs?.email?.newOrder === true);
    if (emailAdmins.length) {
      sendNewOrderAdminAlert({
        admins: emailAdmins,
        clientName: client.name,
        services: services.map((s) => ({ name: s.name })),
        orderId: order._id,
        orderNum,
      });
    }
    admins.forEach((admin) =>
      notify(
        admin._id,
        order._id,
        orderNum,
        'status',
        'New Order',
        `New order ${orderNum} placed by ${client.name} for: ${serviceNames}. Needs employee assignment.`,
        'newOrder',
        { email: false } // dedicated rich email sent above
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

  const ordersWithInvoice = await attachPrimaryInvoice(orders);

  return { orders: ordersWithInvoice, pagination: { total, page, pages: Math.ceil(total / limit) } };
};

/**
 * Attach each order's primary invoice (the "full" invoice, or the oldest
 * auto-generated one) so callers can surface payment status. Returns plain
 * objects with an `invoice` field (or null).
 */
const attachPrimaryInvoice = async (orders) => {
  const orderIds = orders.map((o) => o._id);
  const invoices = await Invoice.find({ orderId: { $in: orderIds } })
    .select('orderId status paidAt amount invoiceNumber type')
    .sort({ createdAt: 1 });

  const invoiceByOrder = {};
  for (const inv of invoices) {
    const key = inv.orderId.toString();
    if (!invoiceByOrder[key] || inv.type === 'full') {
      invoiceByOrder[key] = inv;
    }
  }

  return orders.map((o) => {
    const obj = o.toObject();
    obj.invoice = invoiceByOrder[o._id.toString()] || null;
    return obj;
  });
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

  const ordersWithInvoice = await attachPrimaryInvoice(orders);

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
 * Admin assigns an employee to an order. Allowed while the order is unaccepted:
 *   placed   → assigned (first assignment)
 *   assigned → assigned (reassign to a different employee before they accept)
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

  if (order.status !== 'placed' && order.status !== 'assigned') {
    const err = new Error('Orders can only be (re)assigned before they are accepted');
    err.statusCode = 400;
    throw err;
  }

  const previousEmployeeId = order.assignedEmployee;
  if (previousEmployeeId && previousEmployeeId.toString() === employeeId.toString()) {
    const err = new Error('This employee is already assigned to the order');
    err.statusCode = 400;
    throw err;
  }
  const isReassignment = !!previousEmployeeId;

  order.assignedEmployee = employeeId;
  order.status = 'assigned';
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  // Notify the previously-assigned employee that the order was reassigned away.
  if (isReassignment) {
    notify(previousEmployeeId, order._id, orderNum, 'status', 'Order Reassigned', `Order ${orderNum} has been reassigned to another employee and is no longer in your queue.`, 'reassigned');
  }
  notify(order.clientId, order._id, orderNum, 'status', 'Order Assigned', `Your order ${orderNum} has been assigned to an employee. They will review and respond shortly.`, 'orderAssigned');
  notify(employeeId, order._id, orderNum, 'status', 'New Order Assigned to You', `Order ${orderNum} from a client has been assigned to you. Please review and accept or decline.`, 'newAssignment', { email: false }); // dedicated rich email sent below

  // Email the assigned employee (fire-and-forget)
  Promise.all([
    order.populate('services', 'name'),
    User.findById(employeeId).select('name email notificationPrefs'),
    User.findById(order.clientId).select('name'),
  ]).then(([populatedOrderWithServices, employee, client]) => {
    if (employee?.notificationPrefs?.email?.newAssignment !== true) return;
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
  notify(order.clientId, order._id, orderNum, 'status', 'Order In Progress', `Your order ${orderNum} has been accepted and is now in progress. Estimated delivery: ${fmtDelivery}.`, 'orderInProgress');
  User.find({ role: 'admin' }).select('_id').then((admins) => {
    admins.forEach((a) => notify(a._id, order._id, orderNum, 'status', 'Order Accepted by Employee', `Order ${orderNum} has been accepted by the assigned employee. Delivery date set to ${fmtDelivery}.`, 'orderAccepted'));
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
  notify(order.clientId, order._id, orderNum, 'status', 'Order Declined', rejectBody, 'orderDeclined');
  User.find({ role: 'admin' }).select('_id').then((admins) => {
    const adminBody = reason
      ? `Order ${orderNum} was rejected by the employee. Reason: ${reason}.`
      : `Order ${orderNum} was rejected by the employee. No reason provided.`;
    admins.forEach((a) => notify(a._id, order._id, orderNum, 'status', 'Order Rejected by Employee', adminBody, 'orderRejected'));
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
  // Record the submission in the conversation so all parties see the milestone
  // inline (mirrors how change requests are preserved).
  order.messages.push({
    sender: employeeId,
    senderRole: 'employee',
    kind: 'review-submitted',
    text: '',
  });
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  notify(order.clientId, order._id, orderNum, 'status', 'Order Ready for Review', `Your order ${orderNum} is ready for review. Please confirm completion or request changes.`, 'orderReview');
  User.find({ role: 'admin' }).select('_id').then((admins) => {
    admins.forEach((a) => notify(a._id, order._id, orderNum, 'status', 'Order Submitted for Review', `Order ${orderNum} has been submitted for client review by the assigned employee.`, 'orderSubmitted'));
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
    notify(order.assignedEmployee, order._id, orderNum, 'status', 'Order Completed', `The client has confirmed and completed order ${orderNum}. Great work!`, 'orderCompleted');
  }
  User.find({ role: 'admin' }).select('_id').then((admins) => {
    admins.forEach((a) => notify(a._id, order._id, orderNum, 'status', 'Order Completed', `Order ${orderNum} has been confirmed and completed by the client.`, 'orderCompleted'));
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
  // Persist every change request in the conversation as a special message so
  // the full revision history is preserved (not just the latest note).
  order.messages.push({
    sender: clientId,
    senderRole: 'client',
    kind: 'change-request',
    text: note || '',
  });
  await order.save();

  const orderNum = `#${order._id.toString().slice(-6).toUpperCase()}`;
  const body = note
    ? `The client requested changes on order ${orderNum}: "${note.slice(0, 120)}"`
    : `The client requested changes on order ${orderNum}.`;
  if (order.assignedEmployee) {
    notify(order.assignedEmployee, order._id, orderNum, 'status', 'Changes Requested', body, 'changesRequested');
  }
  User.find({ role: 'admin' }).select('_id').then((admins) => {
    admins.forEach((a) => notify(a._id, order._id, orderNum, 'status', 'Changes Requested', body, 'changesRequested'));
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
  notify(order.clientId, order._id, orderNum, 'status', 'Order Completed', `Your order ${orderNum} has been marked as completed.`, 'orderCompleted');
  if (order.assignedEmployee) {
    notify(order.assignedEmployee, order._id, orderNum, 'status', 'Order Completed', `Order ${orderNum} has been marked as completed by an admin.`, 'orderCompleted');
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
    notify(order.clientId, order._id, orderNum, 'message', 'New Message from Employee', body, 'messages');
  } else if (senderRole === 'client' && order.assignedEmployee) {
    const body = text
      ? `Client sent a message on order ${orderNum}: "${text.slice(0, 80)}"`
      : `Client shared ${attachments.length} file${attachments.length > 1 ? 's' : ''} on order ${orderNum}.`;
    notify(order.assignedEmployee, order._id, orderNum, 'message', 'New Message from Client', body, 'messages');
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
    mentionIds.forEach((uid) =>
      notify(uid, order._id, orderNum, 'message', 'You were mentioned', mentionBody, 'mentions'),
    );
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
        .forEach((a) =>
          notify(a._id, order._id, orderNum, 'message', 'New Update from Employee', body, 'teamUpdates'),
        );
    }).catch(() => {});
  } else if (senderRole === 'admin' && order.assignedEmployee && !mentionedSet.has(order.assignedEmployee.toString())) {
    const body = text
      ? `Admin posted an update on order ${orderNum}: "${text.slice(0, 80)}"`
      : `Admin shared ${attachments.length} file${attachments.length > 1 ? 's' : ''} on order ${orderNum}.`;
    notify(order.assignedEmployee, order._id, orderNum, 'message', 'New Update from Admin', body, 'teamUpdates');
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
  notify(order.clientId, order._id, orderNum, 'status', 'Delivery Date Updated', `Your delivery date has been updated to ${new Date(deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, 'deliveryUpdated');
  if (order.assignedEmployee) {
    notify(order.assignedEmployee, order._id, orderNum, 'status', 'Delivery Date Updated', 'Admin has updated the delivery date for this order', 'deliveryUpdated');
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
  notify(order.clientId, order._id, orderNum, 'status', 'Order Status Updated', `Your order status has been updated`, 'statusReset');

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
};

/* ── Order meetings ─────────────────────────────────────────────────────────
   The assigned employee can schedule video meetings with the client, mirroring
   the support-ticket flow: a Google Calendar event with a Meet link, a branded
   email invite, and an in-app notification. Meetings live on order.meetings. */

const orderNumFor = (order) => `#${order._id.toString().slice(-6).toUpperCase()}`;
const orderServiceName = (order) => (order.services || []).map((s) => s.name).join(', ') || 'Order';

// Validate/normalise a requested meeting time. Throws (statusCode 400) on bad input.
const parseMeetingTime = (scheduledAt, durationMins) => {
  const when = new Date(scheduledAt);
  if (!scheduledAt || isNaN(when.getTime())) {
    const err = new Error('A valid meeting date/time is required');
    err.statusCode = 400;
    throw err;
  }
  if (when.getTime() <= Date.now()) {
    const err = new Error('The meeting time must be in the future');
    err.statusCode = 400;
    throw err;
  }
  const duration = Number(durationMins) > 0 ? Math.min(Number(durationMins), 480) : 30;
  return { when, duration };
};

// Load an order and assert the caller is the assigned employee and the
// conversation is open (accepted/review/completed).
const loadOrderForMeeting = async (orderId, employeeId) => {
  const order = await Order.findById(orderId).populate('clientId', 'name email').populate('services', 'name');
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
  if (!['accepted', 'review', 'completed'].includes(order.status)) {
    const err = new Error('Meetings can only be scheduled once the order is in progress');
    err.statusCode = 400;
    throw err;
  }
  return order;
};

const meetingEventArgs = (order, note) => ({
  summary: `merQetia · ${orderServiceName(order)}`,
  description: [
    `Order: ${orderNumFor(order)}`,
    `Client: ${order.clientId?.name || ''} (${order.clientId?.email || ''})`,
    note ? `\nNotes: ${note}` : '',
  ].join('\n'),
});

const scheduleOrderMeeting = async (orderId, employeeId, { scheduledAt, durationMins, note }) => {
  const { when, duration } = parseMeetingTime(scheduledAt, durationMins);
  const order = await loadOrderForMeeting(orderId, employeeId);

  if (meetingService.hasActiveMeeting(order.meetings)) {
    const err = new Error('A meeting is already scheduled. Reschedule or cancel it before booking another.');
    err.statusCode = 409;
    throw err;
  }

  const employee = await User.findById(employeeId).select('name email');
  const meeting = await meetingService.createMeeting({
    ...meetingEventArgs(order, note),
    when,
    durationMins: duration,
    note,
    scheduledByName: employee?.name || '',
    attendees: [order.clientId?.email, employee?.email],
  });

  order.meetings.push(meeting);
  await order.save();
  const saved = order.meetings[order.meetings.length - 1];

  const orderNum = orderNumFor(order);
  const whenStr = meetingService.fmtWhen(when);
  meetingService.sendMeetingEmail({
    to: order.clientId?.email,
    kind: 'scheduled',
    clientName: order.clientId?.name,
    ticketId: orderNum,
    refLabel: 'Order',
    subject: orderServiceName(order),
    whenStr,
    durationMins: duration,
    meetingLink: saved.meetingLink,
    htmlLink: saved.htmlLink,
    note,
  });
  notify(order.clientId, order._id, orderNum, 'status', 'Meeting Scheduled', `A meeting on order ${orderNum} is set for ${whenStr}. A calendar invite with the video link has been emailed to you.`, 'orderMeeting', { email: false });

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
};

const rescheduleOrderMeeting = async (orderId, employeeId, meetingId, { scheduledAt, durationMins, note }) => {
  const { when, duration } = parseMeetingTime(scheduledAt, durationMins);
  const order = await loadOrderForMeeting(orderId, employeeId);

  const meeting = order.meetings.id(meetingId);
  if (!meeting || meeting.status === 'cancelled') {
    const err = new Error('Meeting not found');
    err.statusCode = 404;
    throw err;
  }

  const employee = await User.findById(employeeId).select('email');
  await meetingService.rescheduleMeeting(meeting, {
    ...meetingEventArgs(order, note),
    when,
    durationMins: duration,
    note,
    attendees: [order.clientId?.email, employee?.email],
  });
  await order.save();

  const orderNum = orderNumFor(order);
  const whenStr = meetingService.fmtWhen(when);
  meetingService.sendMeetingEmail({
    to: order.clientId?.email,
    kind: 'updated',
    clientName: order.clientId?.name,
    ticketId: orderNum,
    refLabel: 'Order',
    subject: orderServiceName(order),
    whenStr,
    durationMins: duration,
    meetingLink: meeting.meetingLink,
    htmlLink: meeting.htmlLink,
    note,
  });
  notify(order.clientId, order._id, orderNum, 'status', 'Meeting Rescheduled', `Your meeting on order ${orderNum} has been moved to ${whenStr}. An updated calendar invite has been emailed to you.`, 'orderMeeting', { email: false });

  const populated = await order.populate(POPULATE_ORDER);
  broadcastOrder(populated);
  return populated;
};

const cancelOrderMeeting = async (orderId, employeeId, meetingId) => {
  const order = await loadOrderForMeeting(orderId, employeeId);

  const meeting = order.meetings.id(meetingId);
  if (!meeting || meeting.status === 'cancelled') {
    const err = new Error('Meeting not found');
    err.statusCode = 404;
    throw err;
  }

  await meetingService.cancelMeeting(meeting);
  await order.save();

  const orderNum = orderNumFor(order);
  meetingService.sendMeetingEmail({
    to: order.clientId?.email,
    kind: 'cancelled',
    clientName: order.clientId?.name,
    ticketId: orderNum,
    refLabel: 'Order',
    subject: orderServiceName(order),
  });
  notify(order.clientId, order._id, orderNum, 'status', 'Meeting Cancelled', `Your meeting on order ${orderNum} has been cancelled.`, 'orderMeeting', { email: false });

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
  scheduleOrderMeeting,
  rescheduleOrderMeeting,
  cancelOrderMeeting,
};
