const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Every distinct notification event a user can receive. Each is an independent
// preference key so users can opt in/out of each one per channel. Keep this in
// sync with the frontend NotificationPrefs definitions.
const NOTIFICATION_KEYS = [
  // Admin-facing
  'newOrder', 'orderAccepted', 'orderRejected', 'orderSubmitted',
  // Employee-facing
  'newAssignment', 'reassigned',
  // Client-facing
  'orderAssigned', 'orderInProgress', 'orderReview', 'orderDeclined', 'statusReset',
  // Shared lifecycle
  'changesRequested', 'orderCompleted', 'deliveryUpdated',
  // Conversation / collaboration
  'messages', 'mentions', 'teamUpdates',
  // Support center
  'supportUpdate',     // client: their ticket was accepted / replied / scheduled
  'newSupportTicket',  // staff: a client submitted a new support ticket
];

// Emails that already existed (and so default ON); everything else is opt-in.
const EMAIL_DEFAULT_ON = new Set(['newOrder', 'newAssignment']);

const buildPrefChannel = (defaultFor) => {
  const channel = {};
  for (const key of NOTIFICATION_KEYS) {
    const def = typeof defaultFor === 'function' ? defaultFor(key) : defaultFor;
    channel[key] = { type: Boolean, default: def };
  }
  return channel;
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries by default
    },
    role: {
      type: String,
      enum: ['client', 'admin', 'employee'],
      default: 'client',
    },
    // Departments this employee belongs to (employee role only).
    // Stored as department names; the set is managed dynamically via the
    // Department collection, so no fixed enum here.
    departments: {
      type: [String],
      default: [],
    },
    // Client contact + address details (client role only)
    phone: {
      type: String,
      trim: true,
      maxlength: [30, 'Phone cannot exceed 30 characters'],
      default: '',
    },
    address: {
      street:     { type: String, trim: true, maxlength: 120, default: '' },
      city:       { type: String, trim: true, maxlength: 80,  default: '' },
      state:      { type: String, trim: true, maxlength: 80,  default: '' },
      postalCode: { type: String, trim: true, maxlength: 20,  default: '' },
      country:    { type: String, trim: true, maxlength: 80,  default: '' },
    },
    avatar: {
      type: String,
      default: null,
    },
    // Admin dashboard column preferences
    dashboardPrefs: {
      colOrder:    { type: [String], default: [] },
      visibleCols: { type: [String], default: [] },
      sortCol:     { type: String,   default: null },
      sortDir:     { type: String,   default: 'asc' },
    },
    // Used for employee invite flow
    isInvited: {
      type: Boolean,
      default: false,
    },
    // Per-event notification opt-in/out preferences, split by channel
    // (email / in-app). Every distinct notification type is independently
    // controllable so users get the most granular control. In-app defaults on
    // for everything; email defaults on only for the two pre-existing
    // transactional emails (new order alert, new assignment) and off for the
    // rest so we don't suddenly fill inboxes.
    notificationPrefs: {
      email: buildPrefChannel((k) => EMAIL_DEFAULT_ON.has(k)),
      inApp: buildPrefChannel(true),
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare plain password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
User.NOTIFICATION_KEYS = NOTIFICATION_KEYS;

module.exports = User;
