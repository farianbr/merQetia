const { inviteEmployee, registerEmployee } = require('../services/inviteService');

/**
 * POST /api/employees/invite
 * Admin only — send invite email to a new employee
 */
const invite = async (req, res, next) => {
  try {
    const { email, name, departments } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }

    const result = await inviteEmployee({ email, name, departments });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/employees/register
 * Public — employee completes registration via invite token
 */
const register = async (req, res, next) => {
  try {
    const { token, name, password } = req.body;

    if (!token || !name || !password) {
      return res.status(400).json({ success: false, message: 'token, name, and password are required' });
    }

    const result = await registerEmployee({ token, name, password });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/employees
 * Admin only — list all employees
 */
const getEmployees = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const Order = require('../models/Order');

    const employees = await User.find({ role: 'employee' })
      .select('name email departments isInvited createdAt avatar')
      .lean();

    const employeeIds = employees.map((e) => e._id);

    const [activeCounts, completedCounts] = await Promise.all([
      Order.aggregate([
        { $match: { assignedEmployee: { $in: employeeIds }, status: { $in: ['assigned', 'accepted'] } } },
        { $group: { _id: '$assignedEmployee', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { assignedEmployee: { $in: employeeIds }, status: 'completed' } },
        { $group: { _id: '$assignedEmployee', count: { $sum: 1 } } },
      ]),
    ]);

    const activeMap = Object.fromEntries(activeCounts.map((r) => [r._id.toString(), r.count]));
    const completedMap = Object.fromEntries(completedCounts.map((r) => [r._id.toString(), r.count]));

    const result = employees.map((e) => ({
      ...e,
      activeTasks: activeMap[e._id.toString()] || 0,
      completedTasks: completedMap[e._id.toString()] || 0,
    }));

    res.status(200).json({ success: true, employees: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/employees/:id
 * Admin only — single employee profile with assigned orders
 */
const getEmployeeById = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const Order = require('../models/Order');

    const employee = await User.findOne({ _id: req.params.id, role: 'employee' })
      .select('name email departments avatar createdAt')
      .lean();

    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const orders = await Order.find({ assignedEmployee: req.params.id })
      .populate('services', 'name')
      .populate('clientId', 'name email')
      .select('_id status createdAt totalPrice deliveryDate services clientId')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, employee, orders });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/employees/:id/departments
 * Admin only — set the departments an employee belongs to.
 */
const updateDepartments = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { departments } = req.body;

    if (!Array.isArray(departments)) {
      return res.status(400).json({ success: false, message: 'departments must be an array' });
    }
    const clean = [...new Set(departments.map((d) => String(d).trim()).filter(Boolean))];

    const employee = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'employee' },
      { departments: clean },
      { new: true },
    ).select('name email departments');

    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    res.status(200).json({ success: true, employee });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/employees/:id/public
 * Client only — a limited employee profile, scoped to the orders the requesting
 * client owns that are assigned to this employee. Powers clickable employee
 * names on the client dashboard. Access is denied unless the client shares at
 * least one order with the employee; no contact email is exposed.
 */
const getEmployeeForClient = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const Order = require('../models/Order');

    const orders = await Order.find({ assignedEmployee: req.params.id, clientId: req.user.id })
      .populate('services', 'name')
      .select('_id status createdAt totalPrice deliveryDate services')
      .sort({ createdAt: -1 })
      .lean();

    if (orders.length === 0) {
      return res.status(403).json({ success: false, message: 'You can only view employees working on your orders.' });
    }

    const employee = await User.findOne({ _id: req.params.id, role: 'employee' })
      .select('name departments avatar createdAt')
      .lean();

    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    res.status(200).json({ success: true, employee, orders });
  } catch (err) {
    next(err);
  }
};

module.exports = { invite, register, getEmployees, getEmployeeById, updateDepartments, getEmployeeForClient };
