const express = require('express');
const router = express.Router();
const { placeOrder, getOrders, getOrder, assign, getMyAssignments, accept, reject, submitReview, confirm, changeRequest, forceComplete, postMessage, postUpdate, getParticipants, setDeliveryDate, resetStatus } = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validateOrder, validateAssign } = require('../middlewares/validators');
const { upload } = require('../middlewares/upload');

// Employee — view their assigned orders (must be before /:id to avoid route conflict)
router.get('/my-assignments', protect, authorize('employee'), getMyAssignments);

// Client places an order
router.post('/', protect, authorize('client'), validateOrder, placeOrder);

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
router.post('/:id/messages', protect, authorize('client', 'employee'), upload.array('files', 5), postMessage);

// Admin or employee posts an internal update (admin ↔ employee only)
router.post('/:id/updates', protect, authorize('admin', 'employee'), upload.array('files', 5), postUpdate);

// Admin or assigned employee — staff that can be @mentioned on this order's updates
router.get('/:id/participants', protect, authorize('admin', 'employee'), getParticipants);

// Admin overrides delivery date on an accepted order
router.patch('/:id/delivery-date', protect, authorize('admin'), setDeliveryDate);

// Admin resets status (rejected → placed, completed → accepted)
router.patch('/:id/reset-status', protect, authorize('admin'), resetStatus);

module.exports = router;
