const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      unique: true,
      trim: true,
      maxlength: [60, 'Department name cannot exceed 60 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [240, 'Description cannot exceed 240 characters'],
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', departmentSchema);
