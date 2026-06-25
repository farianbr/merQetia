const mongoose = require('mongoose');

// Singleton-per-provider store for third-party integration credentials.
// Currently used for the org-level Google Calendar connection (one connected
// account whose calendar hosts scheduled client meetings).
const integrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ['google'],
    },
    // OAuth tokens as returned by the provider ({ access_token, refresh_token,
    // expiry_date, scope, token_type }). Mixed so we can persist verbatim.
    tokens: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    connectedEmail: { type: String, trim: true, default: '' },
    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Integration', integrationSchema);
