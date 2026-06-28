const express = require('express');
const router = express.Router();
const { events } = require('../controllers/calendarController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

// Calendar aggregation (orders, deadlines, meetings). Open to admins and
// employees — results are scoped to the requester inside the service.
router.use(protect, authorize('admin', 'employee'));

router.get('/', events);

module.exports = router;
