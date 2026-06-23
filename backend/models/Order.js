const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['client', 'employee', 'admin'], required: true },
    text: { type: String, maxlength: [2000, 'Message cannot exceed 2000 characters'], default: '' },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    attachments: [
      {
        originalName: { type: String },
        filename: { type: String },
        url: { type: String },
        mimetype: { type: String },
        size: { type: Number },
      },
    ],
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Client is required'],
    },
    services: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'Order must include at least one service',
      },
    },
    answers: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['placed', 'assigned', 'accepted', 'review', 'rejected', 'completed'],
      default: 'placed',
    },
    assignedEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deliveryDate: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
    },
    revisionNote: {
      type: String,
      default: null,
      maxlength: [500, 'Revision note cannot exceed 500 characters'],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative'],
    },
    summary: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    updates: {
      type: [messageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
