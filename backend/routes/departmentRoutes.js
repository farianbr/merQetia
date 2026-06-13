const express = require('express');
const router = express.Router();
const { list, create, update, remove } = require('../controllers/departmentController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

// Admin + employee can read the department list (used for grouping / display)
router.get('/', protect, authorize('admin', 'employee'), list);

// Admin manages departments
router.post('/', protect, authorize('admin'), create);
router.put('/:id', protect, authorize('admin'), update);
router.delete('/:id', protect, authorize('admin'), remove);

module.exports = router;
