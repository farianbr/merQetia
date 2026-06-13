const express = require('express');
const router = express.Router();
const { dashboard, getAllClients, getClientById } = require('../controllers/clientController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

// Client dashboard summary
router.get('/dashboard', protect, authorize('client'), dashboard);

// Admin — list all clients
router.get('/', protect, authorize('admin'), getAllClients);

// Admin — single client profile
router.get('/:id', protect, authorize('admin'), getClientById);

module.exports = router;
