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
      .select('name email departments isInvited createdAt')
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

module.exports = { invite, register, getEmployees };
