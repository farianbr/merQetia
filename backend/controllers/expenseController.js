const {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} = require('../services/expenseService');

/**
 * POST /api/expenses
 * Admin only — log a new expense
 */
const create = async (req, res, next) => {
  try {
    const { title, amount, type, date, notes, relatedOrder } = req.body;

    if (!title || amount == null || !type) {
      return res.status(400).json({ success: false, message: 'title, amount, and type are required' });
    }

    const expense = await createExpense({ title, amount, type, date, notes, relatedOrder });
    res.status(201).json({ success: true, expense });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/expenses
 * Admin only — list with optional ?type= ?startDate= ?endDate= ?page= ?limit=
 */
const getAll = async (req, res, next) => {
  try {
    const { page, limit, type, startDate, endDate } = req.query;

    const result = await getAllExpenses({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      type,
      startDate,
      endDate,
    });

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/expenses/:id
 * Admin only
 */
const getOne = async (req, res, next) => {
  try {
    const expense = await getExpenseById(req.params.id);
    res.status(200).json({ success: true, expense });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/expenses/:id
 * Admin only
 */
const update = async (req, res, next) => {
  try {
    const expense = await updateExpense(req.params.id, req.body);
    res.status(200).json({ success: true, expense });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/expenses/:id
 * Admin only
 */
const remove = async (req, res, next) => {
  try {
    await deleteExpense(req.params.id);
    res.status(200).json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, getAll, getOne, update, remove };
