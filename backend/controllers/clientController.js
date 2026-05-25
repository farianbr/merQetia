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

module.exports = { dashboard };
