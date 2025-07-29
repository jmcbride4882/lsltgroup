const express = require('express');
const { body, validationResult } = require('express-validator');
const { Campaign } = require('../models');
const { captureAuditLog, AUDIT_ACTIONS } = require('../utils/audit');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Get all campaigns
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'all',
      type = 'all',
      search = ''
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Apply filters
    if (status !== 'all') {
      whereClause.status = status;
    }

    if (type !== 'all') {
      whereClause.type = type;
    }

    if (search) {
      whereClause[require('sequelize').Op.or] = [
        { name: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { description: { [require('sequelize').Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: campaigns } = await Campaign.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: campaigns,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error getting campaigns', {
      error: error.message,
      staffId: req.staff?.id
    });
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

/**
 * Create new campaign
 */
router.post('/', [
  body('name').notEmpty().withMessage('Campaign name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('type').isIn(['welcome', 'loyalty', 'email', 'wifi', 'seasonal', 'referral'])
    .withMessage('Invalid campaign type'),
  body('targetAudience').notEmpty().withMessage('Target audience is required'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date'),
  body('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      name,
      description,
      type,
      targetAudience,
      startDate,
      endDate,
      settings = {}
    } = req.body;

    const campaign = await Campaign.create({
      name,
      description,
      type,
      targetAudience,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      settings,
      status: 'draft',
      createdBy: req.staff.id,
      stats: {
        impressions: 0,
        conversions: 0,
        successRate: 0
      }
    });

    await captureAuditLog(
      AUDIT_ACTIONS.ADMIN_CONFIG_CHANGE,
      'campaign',
      campaign.id,
      null,
      req.staff.id,
      req.ip,
      req.get('User-Agent'),
      {
        action: 'create_campaign',
        name,
        type,
        targetAudience
      }
    );

    res.status(201).json({
      success: true,
      data: campaign,
      message: 'Campaign created successfully'
    });

  } catch (error) {
    logger.error('Error creating campaign', {
      error: error.message,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

/**
 * Update campaign status
 */
router.put('/:campaignId/status', [
  body('status').isIn(['draft', 'active', 'paused', 'completed'])
    .withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { campaignId } = req.params;
    const { status } = req.body;

    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const oldStatus = campaign.status;
    await campaign.update({ status });

    await captureAuditLog(
      AUDIT_ACTIONS.ADMIN_CONFIG_CHANGE,
      'campaign',
      campaign.id,
      null,
      req.staff.id,
      req.ip,
      req.get('User-Agent'),
      {
        action: 'update_campaign_status',
        oldStatus,
        newStatus: status,
        campaignName: campaign.name
      }
    );

    res.json({
      success: true,
      data: campaign,
      message: `Campaign ${status === 'active' ? 'activated' : status} successfully`
    });

  } catch (error) {
    logger.error('Error updating campaign status', {
      error: error.message,
      campaignId: req.params.campaignId,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to update campaign status' });
  }
});

/**
 * Delete campaign
 */
router.delete('/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Don't allow deletion of active campaigns
    if (campaign.status === 'active') {
      return res.status(400).json({ 
        error: 'Cannot delete active campaign. Pause it first.' 
      });
    }

    const campaignName = campaign.name;
    await campaign.destroy();

    await captureAuditLog(
      AUDIT_ACTIONS.ADMIN_CONFIG_CHANGE,
      'campaign',
      campaignId,
      null,
      req.staff.id,
      req.ip,
      req.get('User-Agent'),
      {
        action: 'delete_campaign',
        campaignName
      }
    );

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting campaign', {
      error: error.message,
      campaignId: req.params.campaignId,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

/**
 * Get campaign details
 */
router.get('/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({
      success: true,
      data: campaign
    });

  } catch (error) {
    logger.error('Error getting campaign details', {
      error: error.message,
      campaignId: req.params.campaignId,
      staffId: req.staff?.id
    });
    res.status(500).json({ error: 'Failed to load campaign details' });
  }
});

/**
 * Update campaign
 */
router.put('/:campaignId', [
  body('name').optional().notEmpty().withMessage('Campaign name cannot be empty'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('type').optional().isIn(['welcome', 'loyalty', 'email', 'wifi', 'seasonal', 'referral'])
    .withMessage('Invalid campaign type'),
  body('targetAudience').optional().notEmpty().withMessage('Target audience cannot be empty'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date'),
  body('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { campaignId } = req.params;
    const updateData = req.body;

    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Convert date strings to Date objects if provided
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    await campaign.update(updateData);

    await captureAuditLog(
      AUDIT_ACTIONS.ADMIN_CONFIG_CHANGE,
      'campaign',
      campaign.id,
      null,
      req.staff.id,
      req.ip,
      req.get('User-Agent'),
      {
        action: 'update_campaign',
        campaignName: campaign.name,
        updates: Object.keys(updateData)
      }
    );

    res.json({
      success: true,
      data: campaign,
      message: 'Campaign updated successfully'
    });

  } catch (error) {
    logger.error('Error updating campaign', {
      error: error.message,
      campaignId: req.params.campaignId,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

module.exports = router;