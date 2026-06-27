const Student = require('../models/Student');
const InteractionLog = require('../models/InteractionLog');

/**
 * @desc    Get all students
 * @route   GET /api/students
 * @access  Public
 */
const getStudents = async (req, res) => {
  try {
    const students = await Student.find().select('-__v');
    return res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve students',
      error: error.message
    });
  }
};

/**
 * @desc    Get a single student by ID with their interaction log history populated
 * @route   GET /api/students/:id
 * @access  Public
 */
const getStudentDetails = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('logs');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Student not found (invalid ID format)'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve student details',
      error: error.message
    });
  }
};

/**
 * @desc    Update an interaction log's status
 * @route   PATCH /api/interaction-logs/:id
 * @access  Private/Admin
 */
const updateLogStatus = async (req, res) => {
  try {
    if (!req.body.status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const updatedLog = await InteractionLog.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!updatedLog) {
      return res.status(404).json({
        success: false,
        message: 'Interaction log not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedLog
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Interaction log not found (invalid ID format)'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update interaction log status',
      error: error.message
    });
  }
};

/**
 * @desc    Create a new interaction log
 * @route   POST /api/logs
 * @access  Private/Admin
 */
const createLog = async (req, res) => {
  try {
    const { studentId, summary, status } = req.body;
    
    if (!studentId || !summary) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and summary are required'
      });
    }

    const newLog = await InteractionLog.create({
      studentId,
      summary,
      status: status || 'completed'
    });

    return res.status(201).json({
      success: true,
      data: newLog
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create interaction log',
      error: error.message
    });
  }
};

module.exports = {
  getStudents,
  getStudentDetails,
  updateLogStatus,
  createLog
};
