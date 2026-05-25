const {
  getRevenue,
  getExpenses,
  getProfitSummary,
  getOrderStats,
  getTopServices,
} = require('../services/reportService');

/**
 * GET /api/reports/revenue
 * Admin only — total paid invoice revenue
 * Query: ?startDate=2026-01-01&endDate=2026-12-31
 */
const revenue = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getRevenue({ startDate, endDate });
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/expenses
 * Admin only — total expenses (manual + internal service costs)
 */
const expenses = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getExpenses({ startDate, endDate });
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/summary
 * Admin only — full P&L: revenue, expenses, profit, profit margin
 */
const summary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getProfitSummary({ startDate, endDate });
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/orders
 * Admin only — order count breakdown by status
 */
const orderStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getOrderStats({ startDate, endDate });
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/top-services
 * Admin only — top services by order count
 * Query: ?limit=5
 */
const topServices = async (req, res, next) => {
  try {
    const { startDate, endDate, limit } = req.query;
    const data = await getTopServices({ startDate, endDate, limit: parseInt(limit) || 5 });
    res.status(200).json({ success: true, topServices: data });
  } catch (err) {
    next(err);
  }
};

module.exports = { revenue, expenses, summary, orderStats, topServices };
