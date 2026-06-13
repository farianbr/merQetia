const Department = require('../models/Department');
const User = require('../models/User');

const DEFAULT_DEPARTMENTS = ['Creative', 'Strategy', 'Media Buying'];

/**
 * Ensure the default departments exist the first time the collection is read.
 * Keeps legacy installs working without a separate migration script.
 */
async function seedDefaults() {
  const count = await Department.estimatedDocumentCount();
  if (count > 0) return;
  await Department.insertMany(
    DEFAULT_DEPARTMENTS.map((name) => ({ name })),
    { ordered: false },
  ).catch(() => {}); // ignore races / dup-key on concurrent boots
}

/**
 * GET /api/departments
 * Admin/employee — list departments with member counts.
 */
const list = async (req, res, next) => {
  try {
    await seedDefaults();

    const departments = await Department.find().sort({ name: 1 }).lean();

    // Member count per department name (departments stored as names on users)
    const counts = await User.aggregate([
      { $match: { role: 'employee' } },
      { $unwind: { path: '$departments', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$departments', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));

    const result = departments.map((d) => ({
      ...d,
      memberCount: countMap[d.name] || 0,
    }));

    res.status(200).json({ success: true, departments: result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/departments
 * Admin — create a department.
 */
const create = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Department name is required' });

    const exists = await Department.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (exists) return res.status(409).json({ success: false, message: 'A department with that name already exists' });

    const dept = await Department.create({ name, description });
    res.status(201).json({ success: true, department: dept });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/departments/:id
 * Admin — rename / edit a department. Renames cascade to employees.
 */
const update = async (req, res, next) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });

    const newName = req.body.name !== undefined ? String(req.body.name).trim() : dept.name;
    if (!newName) return res.status(400).json({ success: false, message: 'Department name is required' });

    if (newName.toLowerCase() !== dept.name.toLowerCase()) {
      const clash = await Department.findOne({ name: new RegExp(`^${newName}$`, 'i'), _id: { $ne: dept._id } });
      if (clash) return res.status(409).json({ success: false, message: 'A department with that name already exists' });

      // Cascade the rename onto every employee carrying the old name
      const oldName = dept.name;
      await User.updateMany(
        { role: 'employee', departments: oldName },
        { $set: { 'departments.$[el]': newName } },
        { arrayFilters: [{ el: oldName }] },
      );
      dept.name = newName;
    }

    if (req.body.description !== undefined) dept.description = String(req.body.description).trim();

    await dept.save();
    res.status(200).json({ success: true, department: dept });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/departments/:id
 * Admin — delete a department and pull it from all employees.
 */
const remove = async (req, res, next) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });

    await User.updateMany(
      { role: 'employee', departments: dept.name },
      { $pull: { departments: dept.name } },
    );
    await dept.deleteOne();

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, create, update, remove };
