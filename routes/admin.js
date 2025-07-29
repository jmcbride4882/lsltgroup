const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, Device, Staff, Voucher, Reward, AuditLog, Setting } = require('../models');
const { getSettingsByCategory, setSetting, updateSettings, resetSettings, testEmailConfig, testUniFiConfig } = require('../utils/settings');
const { captureAuditLog, AUDIT_ACTIONS, getAuditLogs, getAuditStats } = require('../utils/audit');
const { getTierStatistics, awardManualReward } = require('../utils/loyalty');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Get admin dashboard statistics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalDevices,
      activeDevices,
      totalVouchers,
      redeemedVouchers,
      tierStats
    ] = await Promise.all([
      User.count(),
      User.count({ where: { lastVisit: { [require('sequelize').Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      Device.count(),
      Device.count({ where: { isActive: true } }),
      Voucher.count(),
      Voucher.count({ where: { isRedeemed: true } }),
      getTierStatistics()
    ]);

    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      devices: {
        total: totalDevices,
        active: activeDevices,
        inactive: totalDevices - activeDevices
      },
      vouchers: {
        total: totalVouchers,
        redeemed: redeemedVouchers,
        pending: totalVouchers - redeemedVouchers
      },
      loyalty: tierStats
    };

    await captureAuditLog(
      AUDIT_ACTIONS.ADMIN_LOGIN,
      'admin',
      null,
      null,
      req.staff.id,
      req.ip,
      req.get('User-Agent'),
      { action: 'dashboard_view' }
    );

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting dashboard stats', {
      error: error.message,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

/**
 * Get all settings
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettingsByCategory();

    await captureAuditLog(
      AUDIT_ACTIONS.ADMIN_CONFIG_CHANGE,
      'setting',
      null,
      null,
      req.staff.id,
      req.ip,
      req.get('User-Agent'),
      { action: 'view_settings' }
    );

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    logger.error('Error getting settings', {
      error: error.message,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

/**
 * Get settings by category
 */
router.get('/settings/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const settings = await getSettingsByCategory(category);

    res.json({
      success: true,
      data: settings[category] || {}
    });

  } catch (error) {
    logger.error('Error getting settings by category', {
      error: error.message,
      category: req.params.category,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

/**
 * Update single setting
 */
router.put('/settings/:category/:key', [
  body('value').exists().withMessage('Value is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { category, key } = req.params;
    const { value } = req.body;

    const result = await setSetting(category, key, value, req.staff.id);

    res.json({
      success: true,
      data: result,
      message: result.requiresRestart ? 
        'Setting updated. System restart required.' : 
        'Setting updated successfully.'
    });

  } catch (error) {
    logger.error('Error updating setting', {
      error: error.message,
      category: req.params.category,
      key: req.params.key,
      staffId: req.staff.id
    });
    res.status(400).json({ error: error.message });
  }
});

/**
 * Update multiple settings
 */
router.put('/settings', [
  body('settings').isArray().withMessage('Settings must be an array'),
  body('settings.*.category').notEmpty().withMessage('Category is required'),
  body('settings.*.key').notEmpty().withMessage('Key is required'),
  body('settings.*.value').exists().withMessage('Value is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { settings } = req.body;
    const result = await updateSettings(settings, req.staff.id);

    res.json({
      success: true,
      data: result,
      message: result.requiresRestart.length > 0 ? 
        `${result.updated} settings updated. System restart required for: ${result.requiresRestart.join(', ')}` : 
        `${result.updated} settings updated successfully.`
    });

  } catch (error) {
    logger.error('Error updating multiple settings', {
      error: error.message,
      staffId: req.staff.id
    });
    res.status(400).json({ error: error.message });
  }
});

/**
 * Reset settings to defaults
 */
router.post('/settings/reset', [
  body('category').optional().isString().withMessage('Category must be a string')
], async (req, res) => {
  try {
    const { category } = req.body;
    const result = await resetSettings(category, req.staff.id);

    res.json({
      success: true,
      data: result,
      message: result.requiresRestart.length > 0 ? 
        `${result.resetCount} settings reset. System restart required for: ${result.requiresRestart.join(', ')}` : 
        `${result.resetCount} settings reset successfully.`
    });

  } catch (error) {
    logger.error('Error resetting settings', {
      error: error.message,
      category: req.body.category,
      staffId: req.staff.id
    });
    res.status(400).json({ error: error.message });
  }
});

/**
 * Test email configuration
 */
router.post('/settings/test-email', async (req, res) => {
  try {
    const result = await testEmailConfig();

    await captureAuditLog(
      AUDIT_ACTIONS.ADMIN_CONFIG_CHANGE,
      'setting',
      null,
      null,
      req.staff.id,
      req.ip,
      req.get('User-Agent'),
      {
        action: 'test_email_config',
        result: result.success
      }
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error testing email config', {
      error: error.message,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to test email configuration' });
  }
});

/**
 * Test UniFi configuration
 */
router.post('/settings/test-unifi', async (req, res) => {
  try {
    const result = await testUniFiConfig();

    await captureAuditLog(
      AUDIT_ACTIONS.ADMIN_CONFIG_CHANGE,
      'setting',
      null,
      null,
      req.staff.id,
      req.ip,
      req.get('User-Agent'),
      {
        action: 'test_unifi_config',
        result: result.success
      }
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error testing UniFi config', {
      error: error.message,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to test UniFi configuration' });
  }
});

/**
 * Get all users with pagination and filtering
 */
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      tier = '',
      blocked = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Apply filters
    if (search) {
      whereClause[require('sequelize').Op.or] = [
        { name: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { email: { [require('sequelize').Op.iLike]: `%${search}%` } }
      ];
    }

    if (tier) {
      whereClause.loyaltyTier = tier;
    }

    if (blocked !== '') {
      whereClause.isBlocked = blocked === 'true';
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Device,
          as: 'devices',
          where: { isActive: true },
          required: false
        },
        {
          model: Voucher,
          as: 'vouchers',
          where: { isRedeemed: false },
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          loyaltyTier: user.loyaltyTier,
          visitCount: user.visitCount,
          lastVisit: user.lastVisit,
          isBlocked: user.isBlocked,
          blockReason: user.blockReason,
          deviceCount: user.devices?.length || 0,
          activeVouchers: user.vouchers?.length || 0,
          createdAt: user.createdAt
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error getting users', {
      error: error.message,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to load users' });
  }
});

/**
 * Block/unblock user
 */
router.put('/users/:userId/block', [
  body('isBlocked').isBoolean().withMessage('isBlocked must be boolean'),
  body('reason').optional().isString().withMessage('Reason must be string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId } = req.params;
    const { isBlocked, reason } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({
      isBlocked,
      blockReason: isBlocked ? reason : null
    });

    await captureAuditLog(
      isBlocked ? AUDIT_ACTIONS.USER_BLOCKED : AUDIT_ACTIONS.USER_UNBLOCKED,
      'user',
      userId,
      userId,
      req.staff.id,
      req.ip,
      req.get('User-Agent'),
      {
        reason,
        action: isBlocked ? 'blocked' : 'unblocked'
      }
    );

    res.json({
      success: true,
      message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`
    });

  } catch (error) {
    logger.error('Error blocking/unblocking user', {
      error: error.message,
      userId: req.params.userId,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

/**
 * Get audit logs
 */
router.get('/audit', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action = '',
      entityType = '',
      severity = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const filters = {};
    if (action) filters.action = action;
    if (entityType) filters.entityType = entityType;
    if (severity) filters.severity = severity;
    if (startDate && endDate) {
      filters.startDate = new Date(startDate);
      filters.endDate = new Date(endDate);
    }

    const result = await getAuditLogs(
      filters,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error getting audit logs', {
      error: error.message,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
});

/**
 * Get audit statistics
 */
router.get('/audit/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await getAuditStats(start, end);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting audit stats', {
      error: error.message,
      staffId: req.staff.id
    });
    res.status(500).json({ error: 'Failed to load audit statistics' });
  }
});

/**
 * Award manual reward to user
 */
router.post('/users/:userId/reward', [
  body('value').notEmpty().withMessage('Reward value is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('validityDays').isInt({ min: 1 }).withMessage('Validity days must be positive integer'),
  body('reason').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId } = req.params;
    const { value, description, validityDays, reason } = req.body;

    const voucher = await awardManualReward(
      userId,
      { value, description, validityDays, reason },
      req.staff.id
    );

    res.json({
      success: true,
      data: voucher,
      message: 'Reward awarded successfully'
    });

  } catch (error) {
    logger.error('Error awarding manual reward', {
      error: error.message,
      userId: req.params.userId,
      staffId: req.staff.id
    });
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;