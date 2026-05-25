const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, updateAvatar } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadAvatar } = require('../middlewares/upload');
const { validateRegister, validateLogin } = require('../middlewares/validators');

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

// Protected routes
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/avatar', protect, (req, res, next) => {
  uploadAvatar(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, updateAvatar);

module.exports = router;
