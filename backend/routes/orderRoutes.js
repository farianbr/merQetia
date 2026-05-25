const express = require('express');
const router = express.Router();
const { placeOrder, getOrders, getOrder, assign, getMyAssignments, accept, reject, complete, postMessage } = require('../controllers/orderController');
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

// Employee marks an accepted order as completed
router.patch('/:id/complete', protect, authorize('employee'), complete);

// Client or employee posts a message in the order conversation
router.post('/:id/messages', protect, authorize('client', 'employee'), upload.array('files', 5), postMessage);

module.exports = router;
