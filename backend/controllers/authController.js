const { registerClient, loginUser } = require('../services/authService');
const User = require('../models/User');

/**
 * POST /api/auth/register
 * Public — clients only
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email, and password are required' });
    }

    const result = await registerClient({ name, email, password });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Public — all roles
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const result = await loginUser({ email, password });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Protected — returns current user info from token
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, user });
  } catch (err) { next(err); }
};

/**
 * PUT /api/auth/profile
 * Protected — update name, email, or password
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, currentPassword, newPassword, phone, address } = req.body;
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name) user.name = name.trim().slice(0, 100);

    if (phone !== undefined) user.phone = String(phone).trim().slice(0, 30);

    if (address && typeof address === 'object') {
      const a = user.address || {};
      ['street', 'city', 'state', 'postalCode', 'country'].forEach((k) => {
        if (address[k] !== undefined) a[k] = String(address[k]).trim().slice(0, 120);
      });
      user.address = a;
    }

    if (email && email.toLowerCase() !== user.email) {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) return res.status(400).json({ success: false, message: 'Email already in use' });
      user.email = email.toLowerCase().trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required' });
      }
      const valid = await user.comparePassword(currentPassword);
      if (!valid) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      }
      user.password = newPassword;
    }

    await user.save();
    const updated = await User.findById(req.user.id);
    res.json({ success: true, user: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/auth/dashboard-prefs
 * Protected — save admin dashboard column/sort preferences
 */
const saveDashboardPrefs = async (req, res, next) => {
  try {
    const { colOrder, visibleCols, sortCol, sortDir } = req.body;
    await User.findByIdAndUpdate(req.user.id, {
      'dashboardPrefs.colOrder':    Array.isArray(colOrder)    ? colOrder    : [],
      'dashboardPrefs.visibleCols': Array.isArray(visibleCols) ? visibleCols : [],
      'dashboardPrefs.sortCol':     sortCol  || null,
      'dashboardPrefs.sortDir':     sortDir  || 'asc',
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/avatar
 * Protected — upload/replace profile photo
 */
const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.user.id, { avatar: avatarUrl }, { returnDocument: 'after' });
    res.json({ success: true, avatar: avatarUrl, user });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, updateProfile, updateAvatar, saveDashboardPrefs };
