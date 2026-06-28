const express = require('express');
const router = express.Router();
const { verifyFirebaseToken } = require('../middleware/authMiddleware');
const {
  getLeads,
  getLeadDetails,
  updateActionStatus,
  createInteraction
} = require('../controllers/salesController');

// Protect all routes with Firebase authentication
router.use(verifyFirebaseToken);

// RESTful endpoints
router.get('/leads', getLeads);
router.get('/leads/:id', getLeadDetails);
router.post('/interactions', createInteraction);
router.patch('/interactions/:id/status', updateActionStatus);

module.exports = router;
