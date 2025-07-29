const { Device, Staff, User } = require('../models');
const { captureAuditLog, AUDIT_ACTIONS } = require('../utils/audit');
const logger = require('../utils/logger');

// In-memory store for tracking attempts (in production, use Redis)
const attemptStore = new Map();
const blockedIps = new Set();

// Configuration
const MAX_FAILED_ATTEMPTS = 3;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_DEVICE_REGISTRATIONS_PER_IP = 5;
const MAX_DEVICE_REGISTRATIONS_WINDOW = 60 * 60 * 1000; // 1 hour

/**
 * Abuse detection and prevention middleware
 */
const abuseMiddleware = async (req, res, next) => {
  const clientIp = req.ip;
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;
  const method = req.method;

  try {
    // Skip abuse detection for health checks and static assets
    if (path === '/health' || path.startsWith('/static') || path.startsWith('/assets')) {
      return next();
    }

    // Check if IP is already blocked
    if (isIpBlocked(clientIp)) {
      logger.warn('Blocked IP attempting access', {
        ip: clientIp,
        path,
        method,
        userAgent
      });

      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'request',
        null,
        null,
        null,
        clientIp,
        userAgent,
        {
          reason: 'Blocked IP attempted access',
          path,
          method
        },
        'warning'
      );

      return res.status(403).json({ 
        error: 'Access denied due to suspicious activity. Please try again later.' 
      });
    }

    // Check for suspicious patterns
    const suspiciousActivity = await detectSuspiciousActivity(req);
    if (suspiciousActivity.isSuspicious) {
      logger.warn('Suspicious activity detected', {
        ip: clientIp,
        path,
        method,
        userAgent,
        reason: suspiciousActivity.reason
      });

      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'request',
        null,
        null,
        null,
        clientIp,
        userAgent,
        {
          reason: suspiciousActivity.reason,
          path,
          method,
          details: suspiciousActivity.details
        },
        'warning'
      );

      // Temporarily block IP for suspicious activity
      if (suspiciousActivity.shouldBlock) {
        blockIp(clientIp, suspiciousActivity.reason);
        return res.status(429).json({ 
          error: 'Too many requests. Please try again later.' 
        });
      }
    }

    // Track request for pattern analysis
    trackRequest(req);

    next();

  } catch (error) {
    logger.error('Error in abuse detection middleware', {
      error: error.message,
      ip: clientIp,
      path
    });
    
    // Don't block on middleware errors
    next();
  }
};

/**
 * Track failed authentication attempts
 */
const trackFailedAttempt = async (identifier, type, req, details = {}) => {
  const clientIp = req.ip;
  const key = `${type}:${identifier}`;
  const now = Date.now();

  // Clean old attempts
  cleanOldAttempts();

  // Get current attempts
  let attempts = attemptStore.get(key) || [];
  
  // Remove attempts outside the window
  attempts = attempts.filter(attempt => now - attempt.timestamp < ATTEMPT_WINDOW);
  
  // Add new attempt
  attempts.push({
    timestamp: now,
    ip: clientIp,
    userAgent: req.get('User-Agent'),
    details
  });

  attemptStore.set(key, attempts);

  logger.warn(`Failed ${type} attempt tracked`, {
    identifier,
    type,
    attemptCount: attempts.length,
    ip: clientIp,
    details
  });

  await captureAuditLog(
    `FAILED_${type.toUpperCase()}_ATTEMPT`,
    type,
    identifier,
    type === 'user' ? identifier : null,
    type === 'staff' ? identifier : null,
    clientIp,
    req.get('User-Agent'),
    {
      attemptCount: attempts.length,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      ...details
    },
    'warning'
  );

  // Check if should block
  if (attempts.length >= MAX_FAILED_ATTEMPTS) {
    await handleExcessiveFailedAttempts(identifier, type, req, attempts);
    return true; // Should block
  }

  return false; // Don't block yet
};

/**
 * Handle excessive failed attempts
 */
const handleExcessiveFailedAttempts = async (identifier, type, req, attempts) => {
  const clientIp = req.ip;

  logger.error(`Excessive failed ${type} attempts detected`, {
    identifier,
    type,
    attemptCount: attempts.length,
    ip: clientIp,
    timeWindow: ATTEMPT_WINDOW / 1000 / 60 + ' minutes'
  });

  // Block the entity based on type
  if (type === 'device') {
    await blockDevice(identifier, 'Excessive failed authentication attempts', req);
  } else if (type === 'staff') {
    await blockStaff(identifier, 'Excessive failed login attempts', req);
  } else if (type === 'user') {
    await blockUser(identifier, 'Excessive failed login attempts', req);
  }

  // Also temporarily block the IP
  blockIp(clientIp, `Excessive failed ${type} attempts`);

  await captureAuditLog(
    AUDIT_ACTIONS.SECURITY_ALERT,
    type,
    identifier,
    type === 'user' ? identifier : null,
    type === 'staff' ? identifier : null,
    clientIp,
    req.get('User-Agent'),
    {
      reason: `Blocked due to excessive failed ${type} attempts`,
      attemptCount: attempts.length,
      timeWindow: ATTEMPT_WINDOW,
      action: 'auto_blocked'
    },
    'critical'
  );
};

/**
 * Block device in database
 */
const blockDevice = async (macAddress, reason, req) => {
  try {
    const device = await Device.findOne({ where: { macAddress } });
    if (device) {
      await device.update({
        isBlocked: true,
        blockReason: reason,
        failedAttempts: device.failedAttempts + 1
      });

      logger.error('Device blocked due to abuse', {
        deviceId: device.id,
        macAddress,
        reason,
        ip: req.ip
      });
    }
  } catch (error) {
    logger.error('Error blocking device', {
      error: error.message,
      macAddress,
      reason
    });
  }
};

/**
 * Block staff member in database
 */
const blockStaff = async (staffId, reason, req) => {
  try {
    const staff = await Staff.findByPk(staffId);
    if (staff) {
      await staff.update({
        isBlocked: true,
        failedAttempts: staff.failedAttempts + 1
      });

      logger.error('Staff member blocked due to abuse', {
        staffId,
        email: staff.email,
        reason,
        ip: req.ip
      });
    }
  } catch (error) {
    logger.error('Error blocking staff', {
      error: error.message,
      staffId,
      reason
    });
  }
};

/**
 * Block user in database
 */
const blockUser = async (userId, reason, req) => {
  try {
    const user = await User.findByPk(userId);
    if (user) {
      await user.update({
        isBlocked: true,
        blockReason: reason
      });

      logger.error('User blocked due to abuse', {
        userId,
        email: user.email,
        reason,
        ip: req.ip
      });
    }
  } catch (error) {
    logger.error('Error blocking user', {
      error: error.message,
      userId,
      reason
    });
  }
};

/**
 * Block IP address temporarily
 */
const blockIp = (ip, reason) => {
  blockedIps.add(ip);
  
  // Unblock after duration
  setTimeout(() => {
    blockedIps.delete(ip);
    logger.info('IP unblocked after timeout', { ip, reason });
  }, BLOCK_DURATION);

  logger.warn('IP blocked temporarily', { 
    ip, 
    reason, 
    duration: BLOCK_DURATION / 1000 + ' seconds' 
  });
};

/**
 * Check if IP is currently blocked
 */
const isIpBlocked = (ip) => {
  return blockedIps.has(ip);
};

/**
 * Detect suspicious activity patterns
 */
const detectSuspiciousActivity = async (req) => {
  const clientIp = req.ip;
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;
  const method = req.method;

  // Check for common attack patterns
  const suspiciousPatterns = [
    // SQL injection attempts
    /('|(\')|(\%27)|(;)|(\%3B)/i,
    // XSS attempts
    /(<script|javascript:|onload=|onerror=)/i,
    // Path traversal
    /(\.\./|\.\.\\|%2e%2e)/i,
    // Command injection
    /(;|&&|\||`|\$\()/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(path) || pattern.test(req.query.toString())) {
      return {
        isSuspicious: true,
        shouldBlock: true,
        reason: 'Potential injection attack detected',
        details: { pattern: pattern.toString(), path, query: req.query }
      };
    }
  }

  // Check for rapid successive requests from same IP
  const recentRequests = getRecentRequests(clientIp);
  if (recentRequests > 50) { // More than 50 requests in the last minute
    return {
      isSuspicious: true,
      shouldBlock: true,
      reason: 'Rapid successive requests detected',
      details: { requestCount: recentRequests, timeWindow: '1 minute' }
    };
  }

  // Check for suspicious user agents
  const suspiciousUserAgents = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scanner/i,
    /curl/i,
    /wget/i
  ];

  for (const pattern of suspiciousUserAgents) {
    if (pattern.test(userAgent)) {
      return {
        isSuspicious: true,
        shouldBlock: false, // Don't auto-block bots, just log
        reason: 'Suspicious user agent detected',
        details: { userAgent }
      };
    }
  }

  // Check for device registration abuse
  if (path.includes('/api/auth/signup') || path.includes('/api/users')) {
    const recentRegistrations = await getRecentDeviceRegistrations(clientIp);
    if (recentRegistrations >= MAX_DEVICE_REGISTRATIONS_PER_IP) {
      return {
        isSuspicious: true,
        shouldBlock: true,
        reason: 'Excessive device registrations from IP',
        details: { registrationCount: recentRegistrations, maxAllowed: MAX_DEVICE_REGISTRATIONS_PER_IP }
      };
    }
  }

  return { isSuspicious: false };
};

/**
 * Track requests for pattern analysis
 */
const trackRequest = (req) => {
  const clientIp = req.ip;
  const key = `requests:${clientIp}`;
  const now = Date.now();

  let requests = attemptStore.get(key) || [];
  requests = requests.filter(timestamp => now - timestamp < 60000); // Last minute
  requests.push(now);

  attemptStore.set(key, requests);
};

/**
 * Get recent request count for IP
 */
const getRecentRequests = (ip) => {
  const key = `requests:${ip}`;
  const requests = attemptStore.get(key) || [];
  return requests.length;
};

/**
 * Get recent device registration count for IP
 */
const getRecentDeviceRegistrations = async (ip) => {
  try {
    const { Op } = require('sequelize');
    const oneHourAgo = new Date(Date.now() - MAX_DEVICE_REGISTRATIONS_WINDOW);

    const count = await Device.count({
      where: {
        createdAt: {
          [Op.gte]: oneHourAgo
        }
      },
      // Note: We don't track IP in device table, so this is a simplified check
      // In production, you might want to add an IP field to track registrations
    });

    return count;
  } catch (error) {
    logger.error('Error getting recent device registrations', {
      error: error.message,
      ip
    });
    return 0;
  }
};

/**
 * Clean old attempts from memory
 */
const cleanOldAttempts = () => {
  const now = Date.now();
  const cutoff = now - ATTEMPT_WINDOW;

  for (const [key, attempts] of attemptStore.entries()) {
    if (Array.isArray(attempts)) {
      const validAttempts = attempts.filter(attempt => attempt.timestamp > cutoff);
      if (validAttempts.length === 0) {
        attemptStore.delete(key);
      } else {
        attemptStore.set(key, validAttempts);
      }
    }
  }
};

/**
 * Clear failed attempts for identifier (after successful login)
 */
const clearFailedAttempts = (identifier, type) => {
  const key = `${type}:${identifier}`;
  attemptStore.delete(key);
  
  logger.info(`Cleared failed attempts for ${type}`, { identifier });
};

/**
 * Get failed attempt count for identifier
 */
const getFailedAttemptCount = (identifier, type) => {
  const key = `${type}:${identifier}`;
  const attempts = attemptStore.get(key) || [];
  const now = Date.now();
  
  return attempts.filter(attempt => now - attempt.timestamp < ATTEMPT_WINDOW).length;
};

// Clean up old attempts every 5 minutes
setInterval(cleanOldAttempts, 5 * 60 * 1000);

module.exports = {
  abuseMiddleware,
  trackFailedAttempt,
  clearFailedAttempts,
  getFailedAttemptCount,
  isIpBlocked,
  blockIp,
  blockDevice,
  blockStaff,
  blockUser
};