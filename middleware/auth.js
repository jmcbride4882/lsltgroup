const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Staff, Device } = require('../models');
const { captureAuditLog, AUDIT_ACTIONS } = require('../utils/audit');
const logger = require('../utils/logger');

// JWT Secret - in production this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'lslt-portal-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate JWT token for user/staff
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Hash password
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Extract MAC address from request headers or client info
 */
function extractMacAddress(req) {
  // Try to get MAC from various headers
  const macSources = [
    req.headers['x-client-mac'],
    req.headers['x-forwarded-mac'],
    req.headers['mac-address'],
    req.connection?.remoteAddress // Fallback to IP if MAC not available
  ];

  for (const mac of macSources) {
    if (mac && mac !== '::1' && mac !== '127.0.0.1') {
      return mac;
    }
  }

  return null;
}

/**
 * Middleware to validate JWT token for general authentication
 */
const validateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    req.user = decoded;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else {
      logger.error('Token validation error', { error: error.message });
      return res.status(500).json({ error: 'Authentication error' });
    }
  }
};

/**
 * Middleware to validate staff access
 */
const validateStaff = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    // Check if this is a staff token
    if (decoded.type !== 'staff') {
      return res.status(403).json({ error: 'Staff access required' });
    }

    // Verify staff still exists and is active
    const staff = await Staff.findByPk(decoded.id);
    if (!staff || !staff.isActive) {
      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'staff',
        decoded.id,
        null,
        decoded.id,
        req.ip,
        req.get('User-Agent'),
        { reason: 'Inactive staff attempted access' },
        'warning'
      );
      return res.status(403).json({ error: 'Staff account inactive' });
    }

    if (staff.isBlocked) {
      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'staff',
        decoded.id,
        null,
        decoded.id,
        req.ip,
        req.get('User-Agent'),
        { reason: 'Blocked staff attempted access' },
        'warning'
      );
      return res.status(403).json({ error: 'Staff account blocked' });
    }

    req.staff = staff;
    req.user = decoded;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else {
      logger.error('Staff token validation error', { error: error.message });
      return res.status(500).json({ error: 'Authentication error' });
    }
  }
};

/**
 * Middleware to validate admin access
 */
const validateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    // Check if this is a staff token with admin role
    if (decoded.type !== 'staff') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Verify staff exists and has admin role
    const staff = await Staff.findByPk(decoded.id);
    if (!staff || !staff.isActive) {
      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'staff',
        decoded.id,
        null,
        decoded.id,
        req.ip,
        req.get('User-Agent'),
        { reason: 'Inactive staff attempted admin access' },
        'critical'
      );
      return res.status(403).json({ error: 'Staff account inactive' });
    }

    if (staff.role !== 'admin' && staff.role !== 'manager') {
      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'staff',
        decoded.id,
        null,
        decoded.id,
        req.ip,
        req.get('User-Agent'),
        { reason: 'Insufficient privileges for admin access' },
        'critical'
      );
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    if (staff.isBlocked) {
      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'staff',
        decoded.id,
        null,
        decoded.id,
        req.ip,
        req.get('User-Agent'),
        { reason: 'Blocked admin attempted access' },
        'critical'
      );
      return res.status(403).json({ error: 'Admin account blocked' });
    }

    req.staff = staff;
    req.user = decoded;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else {
      logger.error('Admin token validation error', { error: error.message });
      return res.status(500).json({ error: 'Authentication error' });
    }
  }
};

/**
 * Middleware to validate guest user (for portal access)
 */
const validateGuest = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    // Check if this is a guest token
    if (decoded.type !== 'guest') {
      return res.status(403).json({ error: 'Guest access token required' });
    }

    // Verify user still exists and is not blocked
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(403).json({ error: 'User account not found' });
    }

    if (user.isBlocked) {
      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'user',
        decoded.id,
        decoded.id,
        null,
        req.ip,
        req.get('User-Agent'),
        { reason: 'Blocked user attempted access' },
        'warning'
      );
      return res.status(403).json({ error: 'User account blocked' });
    }

    req.guestUser = user;
    req.user = decoded;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else {
      logger.error('Guest token validation error', { error: error.message });
      return res.status(500).json({ error: 'Authentication error' });
    }
  }
};

/**
 * Middleware to check device limits and authorization
 */
const validateDevice = async (req, res, next) => {
  try {
    const macAddress = extractMacAddress(req);
    
    if (!macAddress) {
      return res.status(400).json({ error: 'Device MAC address required' });
    }

    // Check if device is blocked
    const device = await Device.findOne({ where: { macAddress } });
    
    if (device && device.isBlocked) {
      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'device',
        device.id,
        device.userId,
        null,
        req.ip,
        req.get('User-Agent'),
        { reason: 'Blocked device attempted access', macAddress },
        'warning'
      );
      return res.status(403).json({ error: 'Device is blocked' });
    }

    req.deviceMac = macAddress;
    req.device = device;
    next();

  } catch (error) {
    logger.error('Device validation error', { error: error.message });
    return res.status(500).json({ error: 'Device validation error' });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token, continue without authentication
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    req.user = decoded;
    next();

  } catch (error) {
    // Token exists but is invalid - continue without authentication
    next();
  }
};

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  extractMacAddress,
  validateToken,
  validateStaff,
  validateAdmin,
  validateGuest,
  validateDevice,
  optionalAuth
};