const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Order notifications set orderId; support notifications set supportId.
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    supportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportRequest',
      default: null,
    },
    // Explicit navigation target (used by support notifications); order
    // notifications fall back to orderId-based routing on the client.
    link: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['status', 'message', 'support'],
      required: true,
    },
    typeLabel: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      default: '',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Auto-remove notifications older than 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
