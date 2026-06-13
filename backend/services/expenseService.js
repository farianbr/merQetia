const Expense = require('../models/Expense');

/**
 * Create a new expense record
 */
const createExpense = async (data) => {
  const expense = await Expense.create(data);
  return expense;
};

/**
 * Get all expenses with optional filters and pagination
 */
const getAllExpenses = async ({ page = 1, limit = 20, type, startDate, endDate } = {}) => {
  const filter = {};

  if (type) filter.type = type;

  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .populate('relatedOrder', 'totalPrice status')
      .skip(skip)
      .limit(limit)
      .sort({ date: -1 }),
    Expense.countDocuments(filter),
  ]);

  return { expenses, pagination: { total, page, pages: Math.ceil(total / limit) } };
};

/**
 * Get a single expense by ID
 */
const getExpenseById = async (id) => {
  const expense = await Expense.findById(id).populate('relatedOrder', 'totalPrice status');
  if (!expense) {
    const err = new Error('Expense not found');
    err.statusCode = 404;
    throw err;
  }
  return expense;
};

/**
 * Update an expense by ID
 */
const updateExpense = async (id, data) => {
  const expense = await Expense.findByIdAndUpdate(id, data, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!expense) {
    const err = new Error('Expense not found');
    err.statusCode = 404;
    throw err;
  }
  return expense;
};

/**
 * Delete an expense by ID
 */
const deleteExpense = async (id) => {
  const expense = await Expense.findByIdAndDelete(id);
  if (!expense) {
    const err = new Error('Expense not found');
    err.statusCode = 404;
    throw err;
  }
  return expense;
};

module.exports = { createExpense, getAllExpenses, getExpenseById, updateExpense, deleteExpense };
