const express = require('express');
const { body, validationResult } = require('express-validator');
const moment = require('moment');
const { User, Device, Visit, Voucher, Reward } = require('../models');
const { generateToken, hashPassword, comparePassword, extractMacAddress } = require('../middleware/auth');
const { captureAuditLog, AUDIT_ACTIONS } = require('../utils/audit');
const { trackFailedAttempt, clearFailedAttempts } = require('../middleware/abuse');
const logger = require('../utils/logger');
const { generateVoucher, sendWelcomeEmail } = require('../utils/vouchers');
const { calculateLoyaltyTier, checkRewards } = require('../utils/loyalty');

const router = express.Router();

/**
 * Guest signup route for captive portal
 * POST /api/auth/signup
 */
router.post('/signup', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth required'),
  body('language').optional().isIn(['en', 'es']).withMessage('Language must be en or es'),
  body('marketingConsent').isBoolean().withMessage('Marketing consent must be boolean'),
  body('termsAccepted').equals('true').withMessage('Terms and conditions must be accepted')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, email, dateOfBirth, language = 'en', marketingConsent = false } = req.body;
    const macAddress = extractMacAddress(req);
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;

    // Validate MAC address
    if (!macAddress) {
      return res.status(400).json({
        error: 'Device identification required',
        message: 'Unable to identify your device. Please ensure you are connected to the guest WiFi network.'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      // User exists, check if this is a returning visit with new device
      if (existingUser.isBlocked) {
        await captureAuditLog(
          AUDIT_ACTIONS.SECURITY_ALERT,
          'user',
          existingUser.id,
          existingUser.id,
          null,
          ipAddress,
          userAgent,
          { reason: 'Blocked user attempted signup with new device', email },
          'warning'
        );
        
        return res.status(403).json({
          error: 'Account access restricted',
          message: 'Your account has been temporarily restricted. Please contact staff for assistance.'
        });
      }

      // Check if device already exists for this user
      const existingDevice = await Device.findOne({
        where: { macAddress, userId: existingUser.id }
      });

      if (existingDevice) {
        // Device already registered, just login
        return handleExistingDeviceLogin(existingUser, existingDevice, req, res);
      } else {
        // New device for existing user
        return handleNewDeviceForExistingUser(existingUser, macAddress, userAgent, req, res);
      }
    }

    // Validate date of birth (must be at least 13 years old)
    const age = moment().diff(moment(dateOfBirth), 'years');
    if (age < 13) {
      return res.status(400).json({
        error: 'Age requirement not met',
        message: 'You must be at least 13 years old to use this service.'
      });
    }

    // Check if device is already registered to another user
    const existingDevice = await Device.findOne({ where: { macAddress } });
    if (existingDevice) {
      const deviceUser = await User.findByPk(existingDevice.userId);
      if (deviceUser && deviceUser.email !== email) {
        return res.status(409).json({
          error: 'Device already registered',
          message: 'This device is already registered to another account. Please use the login option or contact staff.',
          suggestion: 'Try logging in with your existing account'
        });
      }
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      dateOfBirth,
      language,
      marketingConsent,
      visitCount: 1,
      loyaltyTier: 'Bronze',
      lastVisit: new Date()
    });

    // Create device record
    const device = await Device.create({
      macAddress,
      userId: user.id,
      userAgent,
      isActive: true,
      lastSeen: new Date()
    });

    // Create initial visit record
    const visit = await Visit.create({
      userId: user.id,
      deviceId: device.id,
      sessionStart: new Date(),
      ipAddress
    });

    // Generate welcome voucher if user opted in to marketing
    let welcomeVoucher = null;
    if (marketingConsent) {
      welcomeVoucher = await generateVoucher({
        type: 'reward',
        userId: user.id,
        value: 'Free Welcome Drink',
        description: 'Welcome to our WiFi network! Enjoy a complimentary beverage on us.',
        validityDays: 30
      });
    }

    // Check for immediate rewards (signup bonus)
    const rewards = await checkRewards(user.id, 'signup');

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      type: 'guest',
      email: user.email,
      name: user.name,
      language: user.language,
      loyaltyTier: user.loyaltyTier
    });

    // Log successful signup
    await captureAuditLog(
      AUDIT_ACTIONS.USER_SIGNUP,
      'user',
      user.id,
      user.id,
      null,
      ipAddress,
      userAgent,
      {
        email,
        language,
        marketingConsent,
        deviceMac: macAddress,
        welcomeVoucherGenerated: !!welcomeVoucher
      }
    );

    logger.info('New user signup completed', {
      userId: user.id,
      email,
      deviceMac: macAddress,
      ipAddress,
      marketingConsent
    });

    // Send welcome email if opted in
    if (marketingConsent && welcomeVoucher) {
      try {
        await sendWelcomeEmail(user, welcomeVoucher);
      } catch (emailError) {
        logger.error('Failed to send welcome email', {
          error: emailError.message,
          userId: user.id,
          email
        });
        // Don't fail the signup if email fails
      }
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: language === 'es' ? 
        '¡Bienvenido! Su cuenta ha sido creada exitosamente.' : 
        'Welcome! Your account has been created successfully.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        language: user.language,
        loyaltyTier: user.loyaltyTier,
        visitCount: user.visitCount,
        marketingConsent: user.marketingConsent
      },
      device: {
        id: device.id,
        isActive: device.isActive
      },
      visit: {
        id: visit.id,
        sessionStart: visit.sessionStart
      },
      vouchers: welcomeVoucher ? [welcomeVoucher] : [],
      rewards,
      token,
      nextSteps: {
        wifiAccess: 'Your device is now authorized for WiFi access',
        dataLimit: '750MB included with free tier',
        loyaltyInfo: 'Visit 5 times to unlock Silver tier benefits'
      }
    });

  } catch (error) {
    logger.error('Error in user signup', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      ip: req.ip
    });

    await captureAuditLog(
      'SIGNUP_ERROR',
      'user',
      null,
      null,
      null,
      req.ip,
      req.get('User-Agent'),
      { error: error.message, email: req.body.email },
      'error'
    );

    res.status(500).json({
      error: 'Registration failed',
      message: 'Unable to complete registration. Please try again or contact staff for assistance.'
    });
  }
});

/**
 * Guest login route for returning users
 * POST /api/auth/login
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('dateOfBirth').isISO8601().withMessage('Date of birth required for verification')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, dateOfBirth } = req.body;
    const macAddress = extractMacAddress(req);
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;

    if (!macAddress) {
      return res.status(400).json({
        error: 'Device identification required',
        message: 'Unable to identify your device. Please ensure you are connected to the guest WiFi network.'
      });
    }

    // Find user by email and DOB
    const user = await User.findOne({ 
      where: { email },
      include: [
        {
          model: Device,
          as: 'devices',
          where: { isActive: true },
          required: false
        }
      ]
    });

    if (!user) {
      await trackFailedAttempt(email, 'user', req, { reason: 'User not found' });
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or date of birth is incorrect, or account does not exist.',
        suggestion: 'Try signing up if you are a new user'
      });
    }

    // Verify date of birth
    if (!moment(user.dateOfBirth).isSame(moment(dateOfBirth), 'day')) {
      await trackFailedAttempt(user.id, 'user', req, { reason: 'Incorrect date of birth' });
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or date of birth is incorrect.'
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'user',
        user.id,
        user.id,
        null,
        ipAddress,
        userAgent,
        { reason: 'Blocked user attempted login', email },
        'warning'
      );

      return res.status(403).json({
        error: 'Account restricted',
        message: 'Your account has been temporarily restricted. Please contact staff for assistance.',
        blockReason: user.blockReason
      });
    }

    // Check device limit (default 2 devices per user)
    const activeDeviceCount = user.devices ? user.devices.length : 0;
    const maxDevices = 2; // This should be configurable

    // Check if this device already exists for user
    let device = await Device.findOne({
      where: { macAddress, userId: user.id }
    });

    if (!device) {
      // New device
      if (activeDeviceCount >= maxDevices) {
        return res.status(409).json({
          error: 'Device limit exceeded',
          message: `You have reached your device limit (${maxDevices}). Please remove an old device to add this one.`,
          currentDevices: user.devices.map(d => ({
            id: d.id,
            name: d.deviceName || 'Unknown Device',
            lastSeen: d.lastSeen
          })),
          suggestion: 'Remove an old device first'
        });
      }

      // Create new device
      device = await Device.create({
        macAddress,
        userId: user.id,
        userAgent,
        isActive: true,
        lastSeen: new Date()
      });
    } else {
      // Existing device - reactivate if needed
      if (!device.isActive || device.isBlocked) {
        if (device.isBlocked) {
          return res.status(403).json({
            error: 'Device blocked',
            message: 'This device has been blocked. Please contact staff for assistance.',
            blockReason: device.blockReason
          });
        }

        await device.update({
          isActive: true,
          lastSeen: new Date()
        });
      }
    }

    // Update user last visit and increment visit count
    const newVisitCount = user.visitCount + 1;
    const newLoyaltyTier = calculateLoyaltyTier(newVisitCount);
    
    await user.update({
      lastVisit: new Date(),
      visitCount: newVisitCount,
      loyaltyTier: newLoyaltyTier
    });

    // Create visit record
    const visit = await Visit.create({
      userId: user.id,
      deviceId: device.id,
      sessionStart: new Date(),
      ipAddress
    });

    // Check for loyalty rewards
    const rewards = await checkRewards(user.id, 'visit', { 
      visitCount: newVisitCount,
      tierUpgrade: newLoyaltyTier !== user.loyaltyTier 
    });

    // Clear any failed login attempts
    clearFailedAttempts(user.id, 'user');

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      type: 'guest',
      email: user.email,
      name: user.name,
      language: user.language,
      loyaltyTier: newLoyaltyTier
    });

    // Log successful login
    await captureAuditLog(
      AUDIT_ACTIONS.USER_LOGIN,
      'user',
      user.id,
      user.id,
      null,
      ipAddress,
      userAgent,
      {
        email,
        deviceMac: macAddress,
        visitCount: newVisitCount,
        loyaltyTier: newLoyaltyTier,
        newDevice: !device.createdAt || moment(device.createdAt).isAfter(moment().subtract(1, 'minute'))
      }
    );

    logger.info('User login successful', {
      userId: user.id,
      email,
      deviceMac: macAddress,
      visitCount: newVisitCount,
      loyaltyTier: newLoyaltyTier
    });

    res.json({
      success: true,
      message: user.language === 'es' ? 
        `¡Bienvenido de nuevo, ${user.name}!` : 
        `Welcome back, ${user.name}!`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        language: user.language,
        loyaltyTier: newLoyaltyTier,
        visitCount: newVisitCount,
        marketingConsent: user.marketingConsent
      },
      device: {
        id: device.id,
        isActive: device.isActive
      },
      visit: {
        id: visit.id,
        sessionStart: visit.sessionStart
      },
      rewards,
      token,
      loyaltyProgress: {
        currentTier: newLoyaltyTier,
        visitsToNextTier: calculateVisitsToNextTier(newVisitCount),
        totalVisits: newVisitCount
      }
    });

  } catch (error) {
    logger.error('Error in user login', {
      error: error.message,
      stack: error.stack,
      email: req.body.email,
      ip: req.ip
    });

    await captureAuditLog(
      'LOGIN_ERROR',
      'user',
      null,
      null,
      null,
      req.ip,
      req.get('User-Agent'),
      { error: error.message, email: req.body.email },
      'error'
    );

    res.status(500).json({
      error: 'Login failed',
      message: 'Unable to complete login. Please try again or contact staff for assistance.'
    });
  }
});

/**
 * Handle existing device login
 */
async function handleExistingDeviceLogin(user, device, req, res) {
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');

  // Update device last seen
  await device.update({ lastSeen: new Date() });

  // Create visit record
  const visit = await Visit.create({
    userId: user.id,
    deviceId: device.id,
    sessionStart: new Date(),
    ipAddress
  });

  // Update user visit count
  const newVisitCount = user.visitCount + 1;
  const newLoyaltyTier = calculateLoyaltyTier(newVisitCount);
  
  await user.update({
    lastVisit: new Date(),
    visitCount: newVisitCount,
    loyaltyTier: newLoyaltyTier
  });

  // Check for rewards
  const rewards = await checkRewards(user.id, 'visit', { 
    visitCount: newVisitCount,
    tierUpgrade: newLoyaltyTier !== user.loyaltyTier 
  });

  const token = generateToken({
    id: user.id,
    type: 'guest',
    email: user.email,
    name: user.name,
    language: user.language,
    loyaltyTier: newLoyaltyTier
  });

  await captureAuditLog(
    AUDIT_ACTIONS.USER_LOGIN,
    'user',
    user.id,
    user.id,
    null,
    ipAddress,
    userAgent,
    {
      email: user.email,
      deviceMac: device.macAddress,
      visitCount: newVisitCount,
      returningDevice: true
    }
  );

  return res.json({
    success: true,
    message: user.language === 'es' ? 
      `¡Bienvenido de nuevo, ${user.name}!` : 
      `Welcome back, ${user.name}!`,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      language: user.language,
      loyaltyTier: newLoyaltyTier,
      visitCount: newVisitCount,
      marketingConsent: user.marketingConsent
    },
    device: {
      id: device.id,
      isActive: device.isActive
    },
    visit: {
      id: visit.id,
      sessionStart: visit.sessionStart
    },
    rewards,
    token
  });
}

/**
 * Handle new device for existing user
 */
async function handleNewDeviceForExistingUser(user, macAddress, userAgent, req, res) {
  const ipAddress = req.ip;

  // Check device limit
  const activeDevices = await Device.count({
    where: { userId: user.id, isActive: true }
  });

  const maxDevices = 2; // Configurable
  if (activeDevices >= maxDevices) {
    return res.status(409).json({
      error: 'Device limit exceeded',
      message: `You have reached your device limit (${maxDevices}). Please remove an old device to add this one.`,
      suggestion: 'Use the existing account login and manage your devices'
    });
  }

  // Create new device
  const device = await Device.create({
    macAddress,
    userId: user.id,
    userAgent,
    isActive: true,
    lastSeen: new Date()
  });

  return handleExistingDeviceLogin(user, device, req, res);
}

/**
 * Calculate visits needed for next tier
 */
function calculateVisitsToNextTier(visitCount) {
  if (visitCount < 5) return 5 - visitCount; // Bronze to Silver
  if (visitCount < 15) return 15 - visitCount; // Silver to Gold
  if (visitCount < 30) return 30 - visitCount; // Gold to Platinum
  return 0; // Already at highest tier
}

module.exports = router;