const mongoose = require('mongoose');
const meetingSchema = require('./meetingSchema');

/**
 * One message in a team channel. Unlike order conversations (bounded subdocs on
 * the order), a channel's history is unbounded, so messages live in their own
 * collection with a compound index for cursor pagination.
 *
 *   kind 'message' — normal chat (text and/or attachments, optional @mentions).
 *   kind 'meeting' — a scheduled video meeting, rendered inline as an event.
 */
const teamMessageSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['admin', 'employee'], required: true },
    kind: { type: String, enum: ['message', 'meeting'], default: 'message' },
    text: { type: String, maxlength: [2000, 'Message cannot exceed 2000 characters'], default: '' },
    // @mentioned individuals and department names (resolved at post time).
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mentionDepartments: [{ type: String }],
    attachments: [
      {
        originalName: { type: String },
        filename: { type: String },
        url: { type: String },
        mimetype: { type: String },
        size: { type: Number },
      },
    ],
    // Populated only for kind 'meeting'.
    meeting: { type: meetingSchema, default: null },
    meetingAttendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Cursor pagination: newest-first within a channel.
teamMessageSchema.index({ channel: 1, createdAt: -1 });

module.exports = mongoose.model('TeamMessage', teamMessageSchema);
