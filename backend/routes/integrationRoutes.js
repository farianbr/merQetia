const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const {
  googleStatus, googleAuthUrl, googleCallback, googleDisconnect,
} = require('../controllers/integrationController');

// Admin manages the org-level Google Calendar connection
router.get('/google/status', protect, authorize('admin'), googleStatus);
router.get('/google/auth-url', protect, authorize('admin'), googleAuthUrl);
router.post('/google/disconnect', protect, authorize('admin'), googleDisconnect);

// OAuth redirect target — public (Google redirects the browser), state-validated
router.get('/google/callback', googleCallback);

module.exports = router;
