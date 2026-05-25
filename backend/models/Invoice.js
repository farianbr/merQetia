const mongoose = require('mongoose');

/**
 * Counter schema — tracks the last used invoice number.
 * Stored as a separate document so increments are atomic.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "invoiceNumber"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

const invoiceSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    type: {
      type: String,
      enum: ['full', 'advance', 'partial'],
      default: 'full',
    },
    status: {
      type: String,
      enum: ['paid', 'unpaid'],
      default: 'unpaid',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: null,
      maxlength: [300, 'Notes cannot exceed 300 characters'],
    },
  },
  { timestamps: true }
);

/**
 * Auto-generate invoice number before saving a new document.
 * Format: INV-00001, INV-00002, ...
 */
invoiceSchema.pre('save', async function () {
  if (!this.isNew) return;

  const counter = await Counter.findByIdAndUpdate(
    'invoiceNumber',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.invoiceNumber = `INV-${String(counter.seq).padStart(5, '0')}`;
});

module.exports = mongoose.model('Invoice', invoiceSchema);
