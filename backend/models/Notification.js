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
    // Team chat notifications set channelId.
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
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
      enum: ['status', 'message', 'support', 'team'],
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

// Auto-remove notifications older than 7 days (TTL index). Changing this value
// on an existing collection also requires reconciling the live index — see
// ensureNotificationTTL in config/db.js.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
