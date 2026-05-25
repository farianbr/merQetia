const express = require('express');
const router = express.Router();
const { revenue, expenses, summary, orderStats, topServices } = require('../controllers/reportController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

// All report routes are admin only
router.use(protect, authorize('admin'));

router.get('/revenue', revenue);
router.get('/expenses', expenses);
router.get('/summary', summary);
router.get('/orders', orderStats);
router.get('/top-services', topServices);

module.exports = router;
