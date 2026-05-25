const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Order = require('../models/Order');
const Service = require('../models/Service');

/**
 * Build a date range filter from optional startDate / endDate strings.
 */
const buildDateFilter = (field, startDate, endDate) => {
  if (!startDate && !endDate) return {};
  const range = {};
  if (startDate) range.$gte = new Date(startDate);
  if (endDate) range.$lte = new Date(endDate);
  return { [field]: range };
};

/**
 * Total revenue — sum of all PAID invoices in the period.
 */
const getRevenue = async ({ startDate, endDate } = {}) => {
  const dateFilter = buildDateFilter('paidAt', startDate, endDate);

  const result = await Invoice.aggregate([
    { $match: { status: 'paid', ...dateFilter } },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    totalRevenue: result[0]?.total ?? 0,
    paidInvoicesCount: result[0]?.count ?? 0,
  };
};

/**
 * Total expenses — combines:
 *  1. Manual expense records (from Expense collection)
 *  2. Internal costs of services on completed orders (what admin owes employees)
 */
const getExpenses = async ({ startDate, endDate } = {}) => {
  const expenseDateFilter = buildDateFilter('date', startDate, endDate);
  const orderDateFilter = buildDateFilter('createdAt', startDate, endDate);

  // Sum manual expense records
  const expenseResult = await Expense.aggregate([
    { $match: { ...expenseDateFilter } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  // Sum internalCost of services on completed orders
  const internalCostResult = await Order.aggregate([
    { $match: { status: 'completed', ...orderDateFilter } },
    { $unwind: '$services' },
    {
      $lookup: {
        from: 'services',
        localField: 'services',
        foreignField: '_id',
        as: 'serviceData',
      },
    },
    { $unwind: '$serviceData' },
    { $group: { _id: null, total: { $sum: '$serviceData.internalCost' } } },
  ]);

  const manualExpenses = expenseResult[0]?.total ?? 0;
  const internalCosts = internalCostResult[0]?.total ?? 0;

  return {
    manualExpenses,
    internalCosts,
    totalExpenses: manualExpenses + internalCosts,
    manualExpenseCount: expenseResult[0]?.count ?? 0,
  };
};

/**
 * Full P&L summary — revenue, expenses, and profit.
 */
const getProfitSummary = async ({ startDate, endDate } = {}) => {
  const [revenueData, expenseData] = await Promise.all([
    getRevenue({ startDate, endDate }),
    getExpenses({ startDate, endDate }),
  ]);

  const profit = revenueData.totalRevenue - expenseData.totalExpenses;

  return {
    revenue: revenueData.totalRevenue,
    paidInvoicesCount: revenueData.paidInvoicesCount,
    expenses: {
      manual: expenseData.manualExpenses,
      internalCosts: expenseData.internalCosts,
      total: expenseData.totalExpenses,
    },
    profit,
    profitMargin:
      revenueData.totalRevenue > 0
        ? ((profit / revenueData.totalRevenue) * 100).toFixed(2) + '%'
        : '0%',
  };
};

/**
 * Order stats breakdown — counts per status.
 */
const getOrderStats = async ({ startDate, endDate } = {}) => {
  const dateFilter = buildDateFilter('createdAt', startDate, endDate);

  const result = await Order.aggregate([
    { $match: { ...dateFilter } },
    { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$totalPrice' } } },
    { $sort: { _id: 1 } },
  ]);

  const stats = { pending: 0, assigned: 0, in_progress: 0, completed: 0 };
  let totalOrders = 0;

  for (const item of result) {
    stats[item._id] = item.count;
    totalOrders += item.count;
  }

  return { totalOrders, byStatus: stats };
};

/**
 * Top services by order count and revenue.
 */
const getTopServices = async ({ startDate, endDate, limit = 5 } = {}) => {
  const dateFilter = buildDateFilter('createdAt', startDate, endDate);

  const result = await Order.aggregate([
    { $match: { ...dateFilter } },
    { $unwind: '$services' },
    {
      $lookup: {
        from: 'services',
        localField: 'services',
        foreignField: '_id',
        as: 'serviceData',
      },
    },
    { $unwind: '$serviceData' },
    {
      $group: {
        _id: '$serviceData._id',
        name: { $first: '$serviceData.name' },
        department: { $first: '$serviceData.department' },
        orderCount: { $sum: 1 },
        revenue: { $sum: '$serviceData.price' },
      },
    },
    { $sort: { orderCount: -1 } },
    { $limit: limit },
  ]);

  return result;
};

module.exports = { getRevenue, getExpenses, getProfitSummary, getOrderStats, getTopServices };
