const mongoose = require('mongoose');

const salesInteractionSchema = new mongoose.Schema({
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true
  },
  rawTranscript: {
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
    default: 'pending_review',
    required: true
  }
}, {
  timestamps: true,
  strict: true
});

module.exports = mongoose.model('SalesInteraction', salesInteractionSchema);
