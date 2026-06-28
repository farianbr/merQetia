const mongoose = require('mongoose');

/**
 * A single payment/transaction within an expense's history.
 * Recurring expenses (payroll, subscriptions) accumulate one per billing cycle;
 * one-time expenses typically have a single entry.
 */
const transactionSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    method: {
      type: String,
      trim: true,
      maxlength: [60, 'Method cannot exceed 60 characters'],
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [300, 'Notes cannot exceed 300 characters'],
      default: null,
    },
  },
  { timestamps: true }
);

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    // 'tooling'/'marketing'/'other' kept for backwards compatibility with
    // historic records; new expenses use payroll / subscription / one-time.
    type: {
      type: String,
      enum: ['payroll', 'subscription', 'one-time', 'tooling', 'marketing', 'other'],
      required: [true, 'Type is required'],
    },
    // Total spent on this expense — always kept in sync with the sum of
    // transactions (see pre-save hook). Reports aggregate on this field.
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
      default: 0,
    },
    // Primary date — mirrors the earliest transaction date.
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    billingCycle: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'yearly', 'one-time'],
      default: 'one-time',
    },
    status: {
      type: String,
      enum: ['active', 'cancelled'],
      default: 'active',
    },
    // ── Payroll ──
    employeeName: {
      type: String,
      trim: true,
      maxlength: [120, 'Employee name cannot exceed 120 characters'],
      default: null,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // ── Subscription ──
    vendor: {
      type: String,
      trim: true,
      maxlength: [120, 'Vendor cannot exceed 120 characters'],
      default: null,
    },
    renewalDate: {
      type: Date,
      default: null,
    },
    // ── One-time / general ──
    category: {
      type: String,
      trim: true,
      maxlength: [60, 'Category cannot exceed 60 characters'],
      default: null,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    transactions: {
      type: [transactionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

/**
 * Keep `amount` (used by reporting) and `date` in sync with the transaction
 * history. Mongoose 9: pre-save hooks must be `async function()` — the
 * callback (`next`) style throws "next is not a function".
 */
expenseSchema.pre('save', async function () {
  if (Array.isArray(this.transactions) && this.transactions.length > 0) {
    this.amount = this.transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    this.date = this.transactions.reduce(
      (min, t) => (t.date < min ? t.date : min),
      this.transactions[0].date
    );
  }
});

module.exports = mongoose.model('Expense', expenseSchema);
