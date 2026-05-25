const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    internalCost: {
      type: Number,
      required: [true, 'Internal cost is required'],
      min: [0, 'Internal cost cannot be negative'],
    },
    questions: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: 'A service cannot have more than 20 questions',
      },
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: {
        values: ['Creative', 'Strategy', 'Media Buying'],
        message: 'Department must be one of: Creative, Strategy, Media Buying',
      },
    },
    isActive: {
      type: Boolean,
      default: true, // Admin can soft-disable a service without deleting it
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
