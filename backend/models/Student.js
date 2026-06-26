const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
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
  currentYear: {
    type: Number,
    required: true
  },
  skills: {
    type: [String],
    default: []
  },
  interests: {
    type: [String],
    default: []
  }
}, {
  timestamps: true,
  strict: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual populate to link interaction logs to the student
studentSchema.virtual('interactionLogs', {
  ref: 'InteractionLog',
  localField: '_id',
  foreignField: 'studentId'
});

module.exports = mongoose.model('Student', studentSchema);
