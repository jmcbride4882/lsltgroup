const { AuditLog } = require('../models');
const logger = require('./logger');

/**
 * Capture audit log entry for system actions
 * @param {string} action - Action performed (e.g., 'USER_SIGNUP', 'VOUCHER_REDEEM')
 * @param {string} entityType - Type of entity (e.g., 'user', 'voucher', 'device')
 * @param {string} entityId - ID of the entity
 * @param {string} userId - ID of the user (if applicable)
 * @param {string} staffId - ID of the staff member (if applicable)
 * @param {string} ipAddress - IP address of the request
 * @param {string} userAgent - User agent string
 * @param {object} details - Additional details as JSON
 * @param {string} severity - Severity level ('info', 'warning', 'error', 'critical')
 */
async function captureAuditLog(action, entityType, entityId = null, userId = null, staffId = null, ipAddress = null, userAgent = null, details = null, severity = 'info') {
  try {
    // Create audit log entry
    await AuditLog.create({
      action,
      entityType,
      entityId,
      userId,
      staffId,
      ipAddress,
      userAgent,
      details,
      severity
    });

    // Also log to Winston for backup and monitoring
    logger.info('Audit Log', {
      action,
      entityType,
      entityId,
      userId,
      staffId,
      ipAddress,
      userAgent: userAgent ? userAgent.substring(0, 200) : null, // Truncate long user agents
      details,
      severity,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // If audit logging fails, log the error but don't break the application
    logger.error('Failed to create audit log entry', {
      error: error.message,
      action,
      entityType,
      entityId,
      userId,
      staffId
    });
  }
}

/**
 * Get audit logs with filtering and pagination
 * @param {object} filters - Filter criteria
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 50)
 * @param {string} sortBy - Sort field (default: 'createdAt')
 * @param {string} sortOrder - Sort order ('ASC' or 'DESC', default: 'DESC')
 */
async function getAuditLogs(filters = {}, page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'DESC') {
  try {
    const offset = (page - 1) * limit;
    const whereClause = {};

    // Apply filters
    if (filters.action) {
      whereClause.action = filters.action;
    }
    if (filters.entityType) {
      whereClause.entityType = filters.entityType;
    }
    if (filters.userId) {
      whereClause.userId = filters.userId;
    }
    if (filters.staffId) {
      whereClause.staffId = filters.staffId;
    }
    if (filters.severity) {
      whereClause.severity = filters.severity;
    }
    if (filters.startDate && filters.endDate) {
      whereClause.createdAt = {
        [require('sequelize').Op.between]: [filters.startDate, filters.endDate]
      };
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder]],
      limit,
      offset,
      raw: false
    });

    return {
      logs: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    };

  } catch (error) {
    logger.error('Failed to retrieve audit logs', {
      error: error.message,
      filters,
      page,
      limit
    });
    throw error;
  }
}

/**
 * Get audit log statistics for dashboard
 * @param {Date} startDate - Start date for statistics
 * @param {Date} endDate - End date for statistics
 */
async function getAuditStats(startDate, endDate) {
  try {
    const { Op } = require('sequelize');
    const sequelize = require('../models').sequelize;

    const whereClause = {};
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [startDate, endDate]
      };
    }

    // Get total counts by action
    const actionStats = await AuditLog.findAll({
      where: whereClause,
      attributes: [
        'action',
        [sequelize.fn('COUNT', sequelize.col('action')), 'count']
      ],
      group: ['action'],
      order: [[sequelize.fn('COUNT', sequelize.col('action')), 'DESC']],
      raw: true
    });

    // Get severity distribution
    const severityStats = await AuditLog.findAll({
      where: whereClause,
      attributes: [
        'severity',
        [sequelize.fn('COUNT', sequelize.col('severity')), 'count']
      ],
      group: ['severity'],
      raw: true
    });

    // Get hourly activity for charts
    const hourlyStats = await sequelize.query(`
      SELECT 
        strftime('%H', createdAt) as hour,
        COUNT(*) as count
      FROM AuditLogs 
      WHERE createdAt BETWEEN ? AND ?
      GROUP BY hour
      ORDER BY hour
    `, {
      replacements: [startDate, endDate],
      type: sequelize.QueryTypes.SELECT
    });

    return {
      actionStats,
      severityStats,
      hourlyStats,
      period: { startDate, endDate }
    };

  } catch (error) {
    logger.error('Failed to get audit statistics', {
      error: error.message,
      startDate,
      endDate
    });
    throw error;
  }
}

/**
 * Clean up old audit logs (older than retention period)
 * @param {number} retentionDays - Number of days to retain logs (default: 365)
 */
async function cleanupOldAuditLogs(retentionDays = 365) {
  try {
    const { Op } = require('sequelize');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deletedCount = await AuditLog.destroy({
      where: {
        createdAt: {
          [Op.lt]: cutoffDate
        }
      }
    });

    logger.info('Cleaned up old audit logs', {
      deletedCount,
      cutoffDate,
      retentionDays
    });

    return deletedCount;

  } catch (error) {
    logger.error('Failed to cleanup old audit logs', {
      error: error.message,
      retentionDays
    });
    throw error;
  }
}

/**
 * Audit log action constants
 */
const AUDIT_ACTIONS = {
  // User actions
  USER_SIGNUP: 'USER_SIGNUP',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  USER_BLOCKED: 'USER_BLOCKED',
  USER_UNBLOCKED: 'USER_UNBLOCKED',

  // Device actions
  DEVICE_REGISTERED: 'DEVICE_REGISTERED',
  DEVICE_BLOCKED: 'DEVICE_BLOCKED',
  DEVICE_UNBLOCKED: 'DEVICE_UNBLOCKED',
  DEVICE_REMOVED: 'DEVICE_REMOVED',

  // Voucher actions
  VOUCHER_CREATED: 'VOUCHER_CREATED',
  VOUCHER_REDEEMED: 'VOUCHER_REDEEMED',
  VOUCHER_EXPIRED: 'VOUCHER_EXPIRED',
  VOUCHER_CANCELLED: 'VOUCHER_CANCELLED',

  // Staff actions
  STAFF_LOGIN: 'STAFF_LOGIN',
  STAFF_LOGOUT: 'STAFF_LOGOUT',
  STAFF_VOUCHER_ISSUED: 'STAFF_VOUCHER_ISSUED',
  STAFF_WIFI_REQUESTED: 'STAFF_WIFI_REQUESTED',
  STAFF_BLOCKED: 'STAFF_BLOCKED',
  STAFF_UNBLOCKED: 'STAFF_UNBLOCKED',

  // Admin actions
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  ADMIN_CONFIG_CHANGE: 'ADMIN_CONFIG_CHANGE',
  ADMIN_USER_MANAGEMENT: 'ADMIN_USER_MANAGEMENT',
  ADMIN_REPORT_GENERATED: 'ADMIN_REPORT_GENERATED',
  ADMIN_CAMPAIGN_CREATED: 'ADMIN_CAMPAIGN_CREATED',
  ADMIN_CAMPAIGN_SENT: 'ADMIN_CAMPAIGN_SENT',

  // System actions
  SYSTEM_STARTUP: 'SYSTEM_STARTUP',
  SYSTEM_SHUTDOWN: 'SYSTEM_SHUTDOWN',
  DATABASE_BACKUP: 'DATABASE_BACKUP',
  DATABASE_RESTORE: 'DATABASE_RESTORE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SECURITY_ALERT: 'SECURITY_ALERT',

  // Printer actions
  PRINTER_TEST: 'PRINTER_TEST',
  PRINTER_ERROR: 'PRINTER_ERROR',
  RECEIPT_PRINTED: 'RECEIPT_PRINTED',

  // UniFi actions
  UNIFI_DEVICE_ALLOWED: 'UNIFI_DEVICE_ALLOWED',
  UNIFI_DEVICE_BLOCKED: 'UNIFI_DEVICE_BLOCKED',
  UNIFI_API_ERROR: 'UNIFI_API_ERROR'
};

module.exports = {
  captureAuditLog,
  getAuditLogs,
  getAuditStats,
  cleanupOldAuditLogs,
  AUDIT_ACTIONS
};