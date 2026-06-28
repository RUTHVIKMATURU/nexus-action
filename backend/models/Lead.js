const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  industry: {
    type: String,
    required: true,
    trim: true
  },
  estimatedBudget: {
    type: Number,
    required: true
  },
  currentVendor: {
    type: String,
    required: true,
    trim: true
  },
  decisionMaker: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true,
  strict: true
});

module.exports = mongoose.model('Lead', leadSchema);
