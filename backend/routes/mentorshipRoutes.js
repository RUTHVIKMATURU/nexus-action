const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentDetails,
  updateLogStatus
} = require('../controllers/mentorshipController');

// Map endpoints to controller functions
router.get('/students', getStudents);
router.get('/students/:id', getStudentDetails);
router.patch('/logs/:id', updateLogStatus);

module.exports = router;
