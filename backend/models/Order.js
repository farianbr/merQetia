const mongoose = require('mongoose');
const meetingSchema = require('./meetingSchema');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['client', 'employee', 'admin'], required: true },
    // 'message'          = normal chat
    // 'change-request'   = client-requested revision (rendered specially)
    // 'review-submitted' = employee submitted work for client review (rendered specially)
    kind: { type: String, enum: ['message', 'change-request', 'review-submitted'], default: 'message' },
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
    // Video meetings the assigned employee schedules with the client. A new one
    // can only be booked while none is active; past/cancelled ones stay for history.
    meetings: {
      type: [meetingSchema],
      default: [],
    },
    statusHistory: {
      type: [
        {
          status: { type: String },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Stamp every status change (including the initial 'placed' on create) so the
// lifecycle tracker can show when each stage was reached.
orderSchema.pre('save', async function () {
  if (this.isModified('status')) {
    this.statusHistory.push({ status: this.status, at: new Date() });
  }
});

module.exports = mongoose.model('Order', orderSchema);
