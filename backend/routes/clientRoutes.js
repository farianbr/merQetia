const express = require('express');
const router = express.Router();
const { dashboard } = require('../controllers/clientController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

// Client dashboard summary
router.get('/dashboard', protect, authorize('client'), dashboard);

module.exports = router;
