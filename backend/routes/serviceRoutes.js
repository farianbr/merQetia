const express = require('express');
const router = express.Router();
const { create, getAll, getOne, update, remove } = require('../controllers/serviceController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validateService } = require('../middlewares/validators');

// Public — clients can browse services
router.get('/', getAll);
router.get('/:id', getOne);

// Admin only — manage services
router.post('/', protect, authorize('admin'), validateService, create);
router.put('/:id', protect, authorize('admin'), validateService, update);
router.delete('/:id', protect, authorize('admin'), remove);

module.exports = router;
