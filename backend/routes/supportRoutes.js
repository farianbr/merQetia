const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const {
  createRequest, listMyRequests, listRequests, acceptRequest,
  updateStatus, postMessage, scheduleMeeting, rescheduleMeeting, cancelMeeting,
} = require('../controllers/supportController');

const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many support requests. Please try again later.' },
});

// Client — open a support ticket
router.post('/contact', protect, authorize('client'), supportLimiter, createRequest);
// Client — track their own tickets
router.get('/my', protect, authorize('client'), listMyRequests);

// Conversation — the ticket owner or the staff member who accepted it can post
router.post('/:id/messages', protect, authorize('client', 'admin', 'employee'), postMessage);

// Admin & employee — manage support requests
router.get('/', protect, authorize('admin', 'employee'), listRequests);
router.patch('/:id/accept', protect, authorize('admin', 'employee'), acceptRequest);
router.patch('/:id/status', protect, authorize('admin', 'employee'), updateStatus);
router.post('/:id/meetings', protect, authorize('admin', 'employee'), scheduleMeeting);
router.patch('/:id/meetings/:meetingId', protect, authorize('admin', 'employee'), rescheduleMeeting);
router.delete('/:id/meetings/:meetingId', protect, authorize('admin', 'employee'), cancelMeeting);

module.exports = router;
