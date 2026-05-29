const {
  createOrder,
  getAllOrders,
  getClientOrders,
  getOrderById,
  assignEmployee,
  acceptOrder,
  rejectOrder,
  completeOrder,
  addMessage,
  addUpdate,
  getEmployeeOrders,
} = require('../services/orderService');

/**
 * POST /api/orders
 * Client only — place a new order
 */
const placeOrder = async (req, res, next) => {
  try {
    const { services, answers } = req.body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ success: false, message: 'services must be a non-empty array of service IDs' });
    }

    const order = await createOrder({
      clientId: req.user.id,
      serviceIds: services,
      answers: answers || {},
    });

    res.status(201).json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders
 * Admin — view all orders; Client — view own orders
 */
const getOrders = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;

    let result;

    if (req.user.role === 'admin') {
      result = await getAllOrders({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
      });
    } else {
      result = await getClientOrders({
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
 * GET /api/orders/:id
 * Admin can view any order; Client can only view their own; Employee can view their assigned
 */
const getOrder = async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);

    if (req.user.role === 'client' && order.clientId._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (req.user.role === 'employee' && (!order.assignedEmployee || order.assignedEmployee._id.toString() !== req.user.id.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/assign
 * Admin only — assign an employee to a placed order
 */
const assign = async (req, res, next) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'employeeId is required' });
    }

    const order = await assignEmployee(req.params.id, employeeId);
    res.status(200).json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/my-assignments
 * Employee only — view orders assigned to them
 */
const getMyAssignments = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;

    const result = await getEmployeeOrders({
      employeeId: req.user.id,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
    });

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/accept
 * Employee only — accept an assigned order, provide deliveryDate
 */
const accept = async (req, res, next) => {
  try {
    const { deliveryDate } = req.body;

    if (!deliveryDate) {
      return res.status(400).json({ success: false, message: 'deliveryDate is required' });
    }

    const order = await acceptOrder(req.params.id, req.user.id, deliveryDate);
    res.status(200).json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/reject
 * Employee only — reject an assigned order
 */
const reject = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await rejectOrder(req.params.id, req.user.id, reason);
    res.status(200).json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/complete
 * Employee only — mark an accepted order as completed
 */
const complete = async (req, res, next) => {
  try {
    const order = await completeOrder(req.params.id, req.user.id);
    res.status(200).json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/:id/messages
 * Client or Employee — post a message in the order conversation
 */
const postMessage = async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    const files = req.files || [];

    if (!text && files.length === 0) {
      return res.status(400).json({ success: false, message: 'Message text or at least one attachment is required' });
    }

    const attachments = files.map((f) => ({
      originalName: f.originalname,
      filename: f.filename,
      url: `/uploads/orders/${req.params.id}/${f.filename}`,
      mimetype: f.mimetype,
      size: f.size,
    }));

    const order = await addMessage(req.params.id, req.user.id, req.user.role, text, attachments);
    res.status(201).json({ success: true, messages: order.messages });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/:id/updates
 * Admin or assigned employee — post an internal update (separate from client chat)
 */
const postUpdate = async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    const files = req.files || [];

    if (!text && files.length === 0) {
      return res.status(400).json({ success: false, message: 'Update text or at least one attachment is required' });
    }

    const attachments = files.map((f) => ({
      originalName: f.originalname,
      filename: f.filename,
      url: `/uploads/orders/${req.params.id}/${f.filename}`,
      mimetype: f.mimetype,
      size: f.size,
    }));

    const order = await addUpdate(req.params.id, req.user.id, req.user.role, text, attachments);
    res.status(201).json({ success: true, updates: order.updates });
  } catch (err) {
    next(err);
  }
};

module.exports = { placeOrder, getOrders, getOrder, assign, getMyAssignments, accept, reject, complete, postMessage, postUpdate };

