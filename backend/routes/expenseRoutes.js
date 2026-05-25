const express = require('express');
const router = express.Router();
const { create, getAll, getOne, update, remove } = require('../controllers/expenseController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validateExpense } = require('../middlewares/validators');

// All expense routes are admin only
router.use(protect, authorize('admin'));

router.post('/', validateExpense, create);
router.get('/', getAll);
router.get('/:id', getOne);
router.put('/:id', validateExpense, update);
router.delete('/:id', remove);

module.exports = router;
