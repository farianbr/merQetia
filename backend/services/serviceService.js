const Service = require('../models/Service');

/**
 * Create a new service
 */
const createService = async (data) => {
  const service = await Service.create(data);
  return service;
};

/**
 * Get all active services with optional pagination and department filter
 */
const getAllServices = async ({ page = 1, limit = 20, department } = {}) => {
  const filter = {};
  if (department) filter.department = department;

  const skip = (page - 1) * limit;

  const [services, total] = await Promise.all([
    Service.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Service.countDocuments(filter),
  ]);

  return {
    services,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get a single service by ID
 */
const getServiceById = async (id) => {
  const service = await Service.findById(id);
  if (!service) {
    const err = new Error('Service not found');
    err.statusCode = 404;
    throw err;
  }
  return service;
};

/**
 * Update a service by ID
 */
const updateService = async (id, data) => {
  const service = await Service.findByIdAndUpdate(id, data, {
    new: true,           // Return updated document
    runValidators: true, // Run schema validators on update
  });
  if (!service) {
    const err = new Error('Service not found');
    err.statusCode = 404;
    throw err;
  }
  return service;
};

/**
 * Delete a service by ID
 */
const deleteService = async (id) => {
  const service = await Service.findByIdAndDelete(id);
  if (!service) {
    const err = new Error('Service not found');
    err.statusCode = 404;
    throw err;
  }
  return service;
};

module.exports = { createService, getAllServices, getServiceById, updateService, deleteService };
