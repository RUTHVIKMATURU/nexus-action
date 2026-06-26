const mongoose = require('mongoose');

const mentorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    trim: true
  },
  skills: {
    type: [String],
    default: []
  },
  availability: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  strict: true
});

module.exports = mongoose.model('Mentor', mentorSchema);
