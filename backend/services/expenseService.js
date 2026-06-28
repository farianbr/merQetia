const Expense = require('../models/Expense');

const notFound = () => {
  const err = new Error('Expense not found');
  err.statusCode = 404;
  return err;
};

/**
 * Create a new expense record. Seeds an initial transaction from the supplied
 * amount/date so every expense starts with a history entry.
 */
const createExpense = async (data) => {
  const { transactions, amount, date, ...rest } = data;

  let txns;
  if (Array.isArray(transactions) && transactions.length > 0) {
    txns = transactions;
  } else if (amount != null && Number(amount) >= 0) {
    txns = [{ amount: Number(amount), date: date || new Date(), notes: 'Initial entry' }];
  } else {
    txns = [];
  }

  const expense = await Expense.create({ ...rest, date: date || new Date(), transactions: txns });
  return expense;
};

/**
 * Get all expenses with optional filters and pagination
 */
const getAllExpenses = async ({ page = 1, limit = 50, type, startDate, endDate } = {}) => {
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
      .populate('employee', 'name email')
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
  const expense = await Expense.findById(id)
    .populate('relatedOrder', 'totalPrice status')
    .populate('employee', 'name email');
  if (!expense) throw notFound();
  return expense;
};

// Fields an admin may edit directly; `amount`/`date` are derived from transactions.
const EDITABLE_FIELDS = [
  'title', 'type', 'billingCycle', 'status', 'employeeName', 'employee',
  'vendor', 'renewalDate', 'category', 'notes', 'relatedOrder',
];

/**
 * Update an expense's metadata (not its transactions).
 */
const updateExpense = async (id, data) => {
  const expense = await Expense.findById(id);
  if (!expense) throw notFound();

  EDITABLE_FIELDS.forEach((key) => {
    if (data[key] !== undefined) expense[key] = data[key];
  });

  await expense.save();
  return expense;
};

/**
 * Delete an expense by ID
 */
const deleteExpense = async (id) => {
  const expense = await Expense.findByIdAndDelete(id);
  if (!expense) throw notFound();
  return expense;
};

/**
 * Append a transaction (recorded payment) to an expense's history.
 */
const addTransaction = async (id, { amount, date, method, notes }) => {
  const expense = await Expense.findById(id);
  if (!expense) throw notFound();

  expense.transactions.push({
    amount: Number(amount),
    date: date || new Date(),
    method: method || null,
    notes: notes || null,
  });

  await expense.save();
  return expense;
};

/**
 * Remove a transaction from an expense's history.
 */
const deleteTransaction = async (id, txId) => {
  const expense = await Expense.findById(id);
  if (!expense) throw notFound();

  const tx = expense.transactions.id(txId);
  if (!tx) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }

  tx.deleteOne();
  await expense.save();
  return expense;
};

module.exports = {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  addTransaction,
  deleteTransaction,
};
