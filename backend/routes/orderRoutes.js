const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { placeOrder, getOrders, getOrder, assign, getMyAssignments, accept, reject, submitReview, confirm, changeRequest, forceComplete, postMessage, postUpdate, streamOrderFile, getParticipants, setDeliveryDate, resetStatus, scheduleMeeting, rescheduleMeeting, cancelMeeting } = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validateOrder, validateAssign } = require('../middlewares/validators');
const { upload, persistUploads } = require('../middlewares/upload');

const orderFilePrefix = (req) => `orders/${req.params.id}`;

// Placing an order triggers an AI summary call — bound how often a client can do
// it to keep AI usage (and cost) from being abused.
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many orders placed. Please try again later.' },
});

// Employee — view their assigned orders (must be before /:id to avoid route conflict)
router.get('/my-assignments', protect, authorize('employee'), getMyAssignments);

// Client places an order
router.post('/', protect, authorize('client'), orderLimiter, validateOrder, placeOrder);

// Admin sees all; Client sees own — handled inside controller
router.get('/', protect, authorize('admin', 'client'), getOrders);

// Single order — admin, owning client, or assigned employee
router.get('/:id', protect, authorize('admin', 'client', 'employee'), getOrder);

// Admin assigns employee to a placed order
router.patch('/:id/assign', protect, authorize('admin'), validateAssign, assign);

// Employee accepts an assigned order (must provide deliveryDate)
router.patch('/:id/accept', protect, authorize('employee'), accept);

// Employee rejects an assigned order
router.patch('/:id/reject', protect, authorize('employee'), reject);

// Employee submits an in-progress order for client review
router.patch('/:id/submit-review', protect, authorize('employee'), submitReview);

// Client confirms delivered work (review → completed)
router.patch('/:id/confirm', protect, authorize('client'), confirm);

// Client requests changes on work in review (review → accepted)
router.patch('/:id/request-changes', protect, authorize('client'), changeRequest);

// Admin force-completes an order, overriding client confirmation
router.patch('/:id/force-complete', protect, authorize('admin'), forceComplete);

// Client or employee posts a message in the order conversation
router.post('/:id/messages', protect, authorize('client', 'employee'), upload.array('files', 5), persistUploads(orderFilePrefix), postMessage);

// Admin or employee posts an internal update (admin ↔ employee only)
router.post('/:id/updates', protect, authorize('admin', 'employee'), upload.array('files', 5), persistUploads(orderFilePrefix), postUpdate);

// Stream a private attachment (authorized per-order; client-chat vs staff-only updates enforced inside)
router.get('/:id/files/:filename', protect, authorize('admin', 'employee', 'client'), streamOrderFile);

// Admin or assigned employee — staff that can be @mentioned on this order's updates
router.get('/:id/participants', protect, authorize('admin', 'employee'), getParticipants);

// Assigned employee — schedule / reschedule / cancel a video meeting with the client
router.post('/:id/meetings', protect, authorize('employee'), scheduleMeeting);
router.patch('/:id/meetings/:meetingId', protect, authorize('employee'), rescheduleMeeting);
router.delete('/:id/meetings/:meetingId', protect, authorize('employee'), cancelMeeting);

// Admin overrides delivery date on an accepted order
router.patch('/:id/delivery-date', protect, authorize('admin'), setDeliveryDate);

// Admin resets status (rejected → placed, completed → accepted)
router.patch('/:id/reset-status', protect, authorize('admin'), resetStatus);

module.exports = router;
