const mongoose = require('mongoose');

/**
 * A team chat channel. Membership is NOT stored here — it's derived from roles
 * and department assignments (see services/teamService.channelMemberIds):
 *
 *   kind 'org'        — the org-wide "merQetia" channel: every admin + employee.
 *   kind 'department' — one per Department: that department's employees only
 *                       (admins are deliberately excluded).
 *
 * Exactly one org channel exists, and at most one channel per department
 * (enforced by the unique index below). The display name is derived at read
 * time ('merQetia' for org, the department's current name otherwise) so a
 * department rename needs no channel update.
 */
const channelSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['org', 'department'], required: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
  },
  { timestamps: true }
);

// One channel per department; one org channel (department null). A partial
// unique index keeps the org row (null department) from colliding with itself
// across versions of MongoDB that treat multiple nulls as duplicates.
channelSchema.index(
  { department: 1 },
  { unique: true, partialFilterExpression: { department: { $type: 'objectId' } } }
);
channelSchema.index(
  { kind: 1 },
  { unique: true, partialFilterExpression: { kind: 'org' } }
);

module.exports = mongoose.model('Channel', channelSchema);
