const {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
} = require('../services/serviceService');

/**
 * POST /api/services
 * Admin only
 */
const create = async (req, res, next) => {
  try {
    const { name, description, price, internalCost, questions, department } = req.body;

    if (!name || !description || price == null || internalCost == null || !department) {
      return res.status(400).json({
        success: false,
        message: 'name, description, price, internalCost, and department are required',
      });
    }

    const service = await createService({ name, description, price, internalCost, questions, department });
    res.status(201).json({ success: true, service });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/services
 * Public — clients browse services
 */
const getAll = async (req, res, next) => {
  try {
    const { page, limit, department } = req.query;
    const result = await getAllServices({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      department,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/services/:id
 * Public
 */
const getOne = async (req, res, next) => {
  try {
    const service = await getServiceById(req.params.id);
    res.status(200).json({ success: true, service });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/services/:id
 * Admin only
 */
const update = async (req, res, next) => {
  try {
    const service = await updateService(req.params.id, req.body);
    res.status(200).json({ success: true, service });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/services/:id
 * Admin only
 */
const remove = async (req, res, next) => {
  try {
    await deleteService(req.params.id);
    res.status(200).json({ success: true, message: 'Service deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, getAll, getOne, update, remove };
