const { getClientDashboard } = require('../services/clientService');
const mongoose = require('mongoose');

/**
 * GET /api/clients/dashboard
 * Client only — summary stats + recent orders
 */
const dashboard = async (req, res, next) => {
  try {
    // Convert string id to ObjectId for the aggregation pipeline
    const clientId = new mongoose.Types.ObjectId(req.user.id);
    const data = await getClientDashboard(clientId);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/clients
 * Admin only — list all clients with order counts
 */
const getAllClients = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const Order = require('../models/Order');

    const clients = await User.find({ role: 'client' })
      .select('name email avatar createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const clientIds = clients.map((c) => c._id);
    const counts = await Order.aggregate([
      { $match: { clientId: { $in: clientIds } } },
      { $group: { _id: '$clientId', total: { $sum: 1 }, active: { $sum: { $cond: [{ $in: ['$status', ['assigned', 'accepted', 'in_progress']] }, 1, 0] } } } },
    ]);
    const countMap = Object.fromEntries(counts.map((r) => [r._id.toString(), r]));

    const result = clients.map((c) => ({
      ...c,
      totalOrders: countMap[c._id.toString()]?.total || 0,
      activeOrders: countMap[c._id.toString()]?.active || 0,
    }));

    res.status(200).json({ success: true, clients: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/clients/:id
 * Admin only — single client profile with orders and invoices
 */
const getClientById = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const Order = require('../models/Order');
    const Invoice = require('../models/Invoice');

    const client = await User.findOne({ _id: req.params.id, role: 'client' })
      .select('name email avatar createdAt')
      .lean();

    if (!client) return res.status(404).json({ message: 'Client not found' });

    const orders = await Order.find({ clientId: req.params.id })
      .populate('services', 'name')
      .populate('assignedEmployee', 'name')
      .select('_id status createdAt totalPrice deliveryDate services assignedEmployee')
      .sort({ createdAt: -1 })
      .lean();

    const orderIds = orders.map((o) => o._id);
    const invoices = await Invoice.find({ orderId: { $in: orderIds } })
      .select('invoiceNumber amount status type createdAt paidAt')
      .lean();

    res.status(200).json({ success: true, client, orders, invoices });
  } catch (err) {
    next(err);
  }
};

module.exports = { dashboard, getAllClients, getClientById };
