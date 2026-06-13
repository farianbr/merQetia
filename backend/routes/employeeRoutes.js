const express = require('express');
const router = express.Router();
const { invite, register, getEmployees, getEmployeeById } = require('../controllers/employeeController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { validateInvite, validateEmployeeRegister } = require('../middlewares/validators');

// Admin gets list of all employees
router.get('/', protect, authorize('admin'), getEmployees);

// Admin sends invite email
router.post('/invite', protect, authorize('admin'), validateInvite, invite);

// Employee completes registration via invite token (public)
router.post('/register', validateEmployeeRegister, register);

// Admin — single employee profile
router.get('/:id', protect, authorize('admin'), getEmployeeById);

module.exports = router;
