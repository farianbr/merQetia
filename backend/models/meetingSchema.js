const mongoose = require('mongoose');

/**
 * A scheduled video meeting, embedded in a parent document (support ticket or
 * order). A parent can hold several over its lifetime — past ones stay for
 * history. Shared so support and orders behave identically.
 *
 *   status 'scheduled' — active/booked (may be upcoming, ongoing, or past).
 *   status 'cancelled' — the meeting was called off; kept for the record.
 */
const meetingSchema = new mongoose.Schema(
  {
    scheduledAt:     { type: Date, default: null },
    bookedAt:        { type: Date, default: null }, // when (re)scheduled — orders it in the thread
    durationMins:    { type: Number, default: null },
    eventId:         { type: String, default: '' },
    meetingLink:     { type: String, default: '' }, // Google Meet join URL
    htmlLink:        { type: String, default: '' }, // Google Calendar event URL
    provider:        { type: String, default: '' }, // e.g. 'google'
    note:            { type: String, default: '', maxlength: 500 },
    scheduledByName: { type: String, default: '' },
    status:          { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled' },
  },
  { timestamps: true }
);

module.exports = meetingSchema;
