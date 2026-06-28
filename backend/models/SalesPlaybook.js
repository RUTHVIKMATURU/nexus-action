const mongoose = require('mongoose');

const salesPlaybookSchema = new mongoose.Schema({
  scenarioName: {
    type: String,
    required: true,
    trim: true
  },
  targetIndustry: {
    type: String,
    required: true,
    trim: true
  },
  recommendedAction: {
    type: String,
    required: true,
    trim: true
  },
  discountCap: {
    type: Number,
    required: true
  }
}, {
  timestamps: true,
  strict: true
});

module.exports = mongoose.model('SalesPlaybook', salesPlaybookSchema);
