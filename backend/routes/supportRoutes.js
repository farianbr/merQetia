const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const {
  createRequest, listRequests, updateStatus, replyToRequest,
} = require('../controllers/supportController');

const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many support requests. Please try again later.' },
});

// Client — submit a support message or meeting request
router.post('/contact', protect, authorize('client'), supportLimiter, createRequest);

// Admin & employee — manage support requests
router.get('/', protect, authorize('admin', 'employee'), listRequests);
router.patch('/:id/status', protect, authorize('admin', 'employee'), updateStatus);
router.post('/:id/reply', protect, authorize('admin', 'employee'), replyToRequest);

module.exports = router;
