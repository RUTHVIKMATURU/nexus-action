const express = require('express');
const router = express.Router();
const { verifyFirebaseToken } = require('../middleware/authMiddleware');
const {
  getStudents,
  getStudentDetails,
  updateLogStatus,
  createLog
} = require('../controllers/mentorshipController');

// Protect all routes with Firebase authentication
router.use(verifyFirebaseToken);

// Map endpoints to controller functions
router.get('/students', getStudents);
router.get('/students/:id', getStudentDetails);
router.post('/logs', createLog);
router.patch('/logs/:id', updateLogStatus);

module.exports = router;
