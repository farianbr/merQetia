const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Generate a signed JWT token for a user
 */
const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Register a new client account
 * Employees cannot self-register — they require an admin invitation
 */
const registerClient = async ({ name, email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('Email is already registered');
    err.statusCode = 409;
    throw err;
  }
  
  const user = await User.create({ name, email, password, role: 'client' });
  const token = generateToken(user._id, user.role);
  
  return {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
};

/**
 * Login any user (client, admin, employee)
 */
const loginUser = async ({ email, password }) => {
  // Explicitly select password (it's excluded by default)
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const token = generateToken(user._id, user.role);

  // Return the full sanitized user (incl. dashboardPrefs/notificationPrefs) so
  // the client has everything on login. Otherwise an in-app logout→login leaves
  // the stored user without dashboardPrefs (getMe only runs on a hard reload),
  // and dashboards re-init from defaults — wiping saved column choices.
  const safeUser = user.toObject();
  delete safeUser.password;

  return { token, user: safeUser };
};

module.exports = { registerClient, loginUser };
