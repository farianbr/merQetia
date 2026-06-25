const mongoose = require('mongoose');
const meetingSchema = require('./meetingSchema');

// Human-friendly, searchable ticket code (e.g. TKT-AB12CD). Excludes ambiguous
// characters (0/O, 1/I) so codes are easy to read out and type.
const TICKET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateTicketCode = () => {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += TICKET_ALPHABET[Math.floor(Math.random() * TICKET_ALPHABET.length)];
  }
  return `TKT-${code}`;
};

// A single entry in a ticket's conversation thread. Either the client (ticket
// owner) or the staff member who accepted the ticket can post.
const messageSchema = new mongoose.Schema(
  {
    sender:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, trim: true, default: '' },
    senderRole: { type: String, enum: ['client', 'staff'], required: true },
    body:       { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

const supportRequestSchema = new mongoose.Schema(
  {
    // Human-readable, searchable/trackable ticket identifier
    ticketId: {
      type: String,
      unique: true,
      index: true,
      trim: true,
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Snapshot of client identity at submission time (survives account edits)
    clientName:  { type: String, trim: true, default: '' },
    clientEmail: { type: String, trim: true, default: '' },

    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },

    // Conversation thread between the client and the staff member who accepted
    // the ticket. The opening `message` above is the first thing said; replies
    // back and forth live here.
    messages: { type: [messageSchema], default: [] },

    status: {
      type: String,
      enum: ['open', 'accepted', 'resolved'],
      default: 'open',
    },

    // Staff member who accepted (claimed) the ticket
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },

    // Scheduled meetings (a ticket may have several over its lifetime) — each is
    // a Google Calendar event with a Meet link. Past/cancelled ones stay for
    // history; a new one can only be booked when none is currently active.
    meetings: { type: [meetingSchema], default: [] },
  },
  { timestamps: true }
);

supportRequestSchema.index({ status: 1, createdAt: -1 });

// Assign a unique ticket code before validation. Mongoose 9 pre hooks must be
// `async function()` (the callback `function(next)` style throws).
supportRequestSchema.pre('validate', async function () {
  if (this.ticketId) return;
  // Retry on the (rare) chance of a collision against the unique index.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateTicketCode();
    const exists = await this.constructor.exists({ ticketId: candidate });
    if (!exists) {
      this.ticketId = candidate;
      return;
    }
  }
  // Fallback: append a timestamp fragment to guarantee uniqueness.
  this.ticketId = `${generateTicketCode()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
});

module.exports = mongoose.model('SupportRequest', supportRequestSchema);
