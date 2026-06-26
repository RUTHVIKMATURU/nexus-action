const Student = require('../models/Student');
const InteractionLog = require('../models/InteractionLog');

/**
 * @desc    Get all students
 * @route   GET /api/students
 * @access  Public
 */
const getStudents = async (req, res) => {
  try {
    const students = await Student.find({});
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
    const { id } = req.params;
    const student = await Student.findById(id).populate('interactionLogs');
    
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
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['pending_review', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updatedLog = await InteractionLog.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
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
    return res.status(500).json({
      success: false,
      message: 'Failed to update interaction log status',
      error: error.message
    });
  }
};

module.exports = {
  getStudents,
  getStudentDetails,
  updateLogStatus
};
