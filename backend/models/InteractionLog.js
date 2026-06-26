const mongoose = require('mongoose');

const interactionLogSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  summary: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  status: {
    type: String,
    enum: ['pending_review', 'completed'],
    default: 'pending_review',
    required: true
  }
}, {
  timestamps: true,
  strict: true
});

module.exports = mongoose.model('InteractionLog', interactionLogSchema);
