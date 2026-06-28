const express = require('express');
const router = express.Router();
const { create, getAll, getOne, update, remove, addTx, removeTx } = require('../controllers/expenseController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validateExpense, validateTransaction } = require('../middlewares/validators');

// All expense routes are admin only
router.use(protect, authorize('admin'));

router.post('/', validateExpense, create);
router.get('/', getAll);
router.get('/:id', getOne);
router.put('/:id', validateExpense, update);
router.delete('/:id', remove);

// Transaction history
router.post('/:id/transactions', validateTransaction, addTx);
router.delete('/:id/transactions/:txId', removeTx);

module.exports = router;
