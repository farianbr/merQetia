const Order = require('../models/Order');

/**
 * Return a summary of the client's orders for their dashboard.
 * Includes: total orders, breakdown by status, and the 5 most recent orders.
 */
const getClientDashboard = async (clientId) => {
  const [statusCounts, recentOrders] = await Promise.all([
    // Group orders by status to get counts
    Order.aggregate([
      { $match: { clientId: clientId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    // 5 most recent orders with service and employee details
    Order.find({ clientId })
      .populate('services', 'name price department')
      .populate('assignedEmployee', 'name')
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  // Flatten the aggregation result into a readable object
  const byStatus = { pending: 0, assigned: 0, in_progress: 0, completed: 0 };
  for (const item of statusCounts) {
    byStatus[item._id] = item.count;
  }

  const totalOrders = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return { totalOrders, byStatus, recentOrders };
};

module.exports = { getClientDashboard };
