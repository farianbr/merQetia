const mongoose = require('mongoose');

const supportRequestSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Snapshot of client identity at submission time (survives account edits)
    clientName:  { type: String, trim: true, default: '' },
    clientEmail: { type: String, trim: true, default: '' },

    type: {
      type: String,
      enum: ['message', 'meeting'],
      default: 'message',
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },

    // Meeting requests only
    preferredDate: { type: String, trim: true, default: '' },
    preferredTime: { type: String, trim: true, default: '' },

    status: {
      type: String,
      enum: ['open', 'resolved'],
      default: 'open',
    },

    reply: {
      message:   { type: String, trim: true, maxlength: 4000, default: '' },
      repliedAt: { type: Date, default: null },
      repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  },
  { timestamps: true }
);

supportRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SupportRequest', supportRequestSchema);
