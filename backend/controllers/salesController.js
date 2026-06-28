const Lead = require('../models/Lead');
const SalesInteraction = require('../models/SalesInteraction');

const VALID_STATUSES = ['approved', 'rejected'];

/**
 * @desc    Fetch all leads
 * @route   GET /api/sales/leads
 * @access  Protected
 */
const getLeads = async (req, res) => {
  try {
    const leads = await Lead.find().select('-__v').sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: leads.length,
      data: leads
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve leads',
      error: error.message
    });
  }
};

/**
 * @desc    Fetch a single lead by ID, populated with their SalesInteraction history
 * @route   GET /api/sales/leads/:id
 * @access  Protected
 */
const getLeadDetails = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).select('-__v');

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Fetch all interactions linked to this lead
    const interactions = await SalesInteraction.find({ leadId: lead._id })
      .select('-__v')
      .sort({ timestamp: -1 });

    return res.status(200).json({
      success: true,
      data: {
        ...lead.toObject(),
        interactions
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Lead not found (invalid ID format)'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead details',
      error: error.message
    });
  }
};

/**
 * @desc    Update the workflow status of a SalesInteraction to 'approved' or 'rejected'
 * @route   PATCH /api/sales/interactions/:id/status
 * @access  Protected
 */
const updateActionStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required in the request body'
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    const updatedInteraction = await SalesInteraction.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updatedInteraction) {
      return res.status(404).json({
        success: false,
        message: 'Sales interaction not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedInteraction
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Sales interaction not found (invalid ID format)'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update interaction status',
      error: error.message
    });
  }
};
/**
 * @desc    Create a new SalesInteraction (register an incoming event)
 * @route   POST /api/sales/interactions
 * @access  Protected
 */
const createInteraction = async (req, res) => {
  try {
    const { leadId, rawTranscript } = req.body;

    if (!leadId || !rawTranscript) {
      return res.status(400).json({
        success: false,
        message: 'leadId and rawTranscript are required'
      });
    }

    // Validate that the lead exists
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    const newInteraction = await SalesInteraction.create({
      leadId,
      rawTranscript,
      status: 'pending_review'
    });

    return res.status(201).json({
      success: true,
      data: newInteraction
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Lead not found (invalid ID format)'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create sales interaction',
      error: error.message
    });
  }
};

module.exports = {
  getLeads,
  getLeadDetails,
  updateActionStatus,
  createInteraction
};
