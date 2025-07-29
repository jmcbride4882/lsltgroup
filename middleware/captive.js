const logger = require('../utils/logger');
const { Device, User } = require('../models');
const { captureAuditLog, AUDIT_ACTIONS } = require('../utils/audit');

/**
 * Captive portal detection middleware
 * Handles various captive portal detection requests from different operating systems
 */
const captivePortalMiddleware = async (req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;
  const method = req.method;

  // List of known captive portal detection URLs
  const captivePortalPaths = [
    '/generate_204',
    '/hotspot-detect.html',
    '/library/test/success.html',
    '/connectivity-check.html',
    '/connecttest.txt',
    '/redirect',
    '/success.txt',
    '/ncsi.txt'
  ];

  // List of known captive portal user agents
  const captivePortalUserAgents = [
    'CaptiveNetworkSupport',
    'Microsoft NCSI',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18363',
    'wispr'
  ];

  // Check if this is a captive portal detection request
  const isCaptivePortalRequest = 
    captivePortalPaths.includes(path) ||
    captivePortalUserAgents.some(agent => userAgent.includes(agent)) ||
    path.includes('hotspot') ||
    path.includes('captive') ||
    path.includes('connectivity');

  if (isCaptivePortalRequest) {
    logger.info('Captive portal detection request', {
      path,
      method,
      userAgent,
      ip: req.ip,
      headers: req.headers
    });

    // Extract device information
    const macAddress = extractDeviceInfo(req);
    
    await captureAuditLog(
      'CAPTIVE_PORTAL_DETECTED',
      'device',
      macAddress,
      null,
      null,
      req.ip,
      userAgent,
      {
        path,
        method,
        detectionType: 'automatic'
      }
    );

    // Handle different captive portal detection methods
    switch (path) {
      case '/generate_204':
        // Android/Chrome connectivity check
        return handleAndroidCaptivePortal(req, res, macAddress);
        
      case '/hotspot-detect.html':
        // iOS captive portal detection
        return handleIOSCaptivePortal(req, res, macAddress);
        
      case '/library/test/success.html':
        // Apple captive portal detection
        return handleAppleCaptivePortal(req, res, macAddress);
        
      case '/connecttest.txt':
      case '/ncsi.txt':
        // Windows connectivity check
        return handleWindowsCaptivePortal(req, res, macAddress);
        
      default:
        // Generic captive portal detection
        return handleGenericCaptivePortal(req, res, macAddress);
    }
  }

  // Not a captive portal request, continue to next middleware
  next();
};

/**
 * Extract device information from request
 */
function extractDeviceInfo(req) {
  // Try to extract MAC address from various sources
  const macSources = [
    req.headers['x-client-mac'],
    req.headers['x-forwarded-mac'],
    req.headers['mac-address'],
    req.headers['x-real-mac']
  ];

  for (const mac of macSources) {
    if (mac && isValidMacAddress(mac)) {
      return mac;
    }
  }

  // If no MAC available, use IP address as identifier
  return req.ip || req.connection?.remoteAddress;
}

/**
 * Validate MAC address format
 */
function isValidMacAddress(mac) {
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
}

/**
 * Handle Android/Chrome captive portal detection
 */
async function handleAndroidCaptivePortal(req, res, macAddress) {
  try {
    // Check if device is already authorized
    const isAuthorized = await checkDeviceAuthorization(macAddress, req.ip);
    
    if (isAuthorized) {
      // Device is authorized, return 204 (no captive portal)
      logger.info('Authorized device accessing Android captive portal check', {
        macAddress,
        ip: req.ip
      });
      return res.status(204).end();
    } else {
      // Device needs authorization, trigger captive portal
      logger.info('Unauthorized device triggering Android captive portal', {
        macAddress,
        ip: req.ip
      });
      return res.redirect(302, `/portal?device=${encodeURIComponent(macAddress)}&source=android`);
    }
  } catch (error) {
    logger.error('Error handling Android captive portal', {
      error: error.message,
      macAddress,
      ip: req.ip
    });
    return res.status(302).redirect('/portal?source=android');
  }
}

/**
 * Handle iOS captive portal detection
 */
async function handleIOSCaptivePortal(req, res, macAddress) {
  try {
    const isAuthorized = await checkDeviceAuthorization(macAddress, req.ip);
    
    if (isAuthorized) {
      // Return success HTML for iOS
      const successHtml = `
        <HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>
      `;
      return res.status(200).send(successHtml);
    } else {
      // Redirect to captive portal
      return res.redirect(302, `/portal?device=${encodeURIComponent(macAddress)}&source=ios`);
    }
  } catch (error) {
    logger.error('Error handling iOS captive portal', {
      error: error.message,
      macAddress,
      ip: req.ip
    });
    return res.status(302).redirect('/portal?source=ios');
  }
}

/**
 * Handle Apple captive portal detection
 */
async function handleAppleCaptivePortal(req, res, macAddress) {
  try {
    const isAuthorized = await checkDeviceAuthorization(macAddress, req.ip);
    
    if (isAuthorized) {
      const successHtml = `
        <HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>
      `;
      return res.status(200).send(successHtml);
    } else {
      return res.redirect(302, `/portal?device=${encodeURIComponent(macAddress)}&source=apple`);
    }
  } catch (error) {
    logger.error('Error handling Apple captive portal', {
      error: error.message,
      macAddress,
      ip: req.ip
    });
    return res.status(302).redirect('/portal?source=apple');
  }
}

/**
 * Handle Windows captive portal detection
 */
async function handleWindowsCaptivePortal(req, res, macAddress) {
  try {
    const isAuthorized = await checkDeviceAuthorization(macAddress, req.ip);
    
    if (isAuthorized) {
      // Return expected content for Windows
      return res.status(200).send('Microsoft Connect Test');
    } else {
      return res.redirect(302, `/portal?device=${encodeURIComponent(macAddress)}&source=windows`);
    }
  } catch (error) {
    logger.error('Error handling Windows captive portal', {
      error: error.message,
      macAddress,
      ip: req.ip
    });
    return res.status(302).redirect('/portal?source=windows');
  }
}

/**
 * Handle generic captive portal detection
 */
async function handleGenericCaptivePortal(req, res, macAddress) {
  try {
    const isAuthorized = await checkDeviceAuthorization(macAddress, req.ip);
    
    if (isAuthorized) {
      return res.status(200).send('OK');
    } else {
      return res.redirect(302, `/portal?device=${encodeURIComponent(macAddress)}&source=generic`);
    }
  } catch (error) {
    logger.error('Error handling generic captive portal', {
      error: error.message,
      macAddress,
      ip: req.ip
    });
    return res.status(302).redirect('/portal?source=generic');
  }
}

/**
 * Check if device is authorized for internet access
 */
async function checkDeviceAuthorization(macAddress, ipAddress) {
  try {
    if (!macAddress || !isValidMacAddress(macAddress)) {
      return false;
    }

    // Find device in database
    const device = await Device.findOne({
      where: { macAddress },
      include: [
        {
          model: User,
          as: 'user',
          required: false
        }
      ]
    });

    if (!device) {
      logger.info('Unknown device attempting access', {
        macAddress,
        ipAddress
      });
      return false;
    }

    // Check if device is blocked
    if (device.isBlocked) {
      logger.warn('Blocked device attempting access', {
        macAddress,
        ipAddress,
        blockReason: device.blockReason
      });
      
      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'device',
        device.id,
        device.userId,
        null,
        ipAddress,
        null,
        {
          reason: 'Blocked device attempted access',
          macAddress,
          blockReason: device.blockReason
        },
        'warning'
      );
      
      return false;
    }

    // Check if user is blocked
    if (device.user && device.user.isBlocked) {
      logger.warn('Device of blocked user attempting access', {
        macAddress,
        ipAddress,
        userId: device.userId,
        blockReason: device.user.blockReason
      });
      
      await captureAuditLog(
        AUDIT_ACTIONS.SECURITY_ALERT,
        'user',
        device.userId,
        device.userId,
        null,
        ipAddress,
        null,
        {
          reason: 'Blocked user device attempted access',
          macAddress,
          blockReason: device.user.blockReason
        },
        'warning'
      );
      
      return false;
    }

    // Check if device is active and within session
    if (device.isActive) {
      // Update last seen timestamp
      await device.update({
        lastSeen: new Date()
      });

      logger.info('Authorized device accessing internet', {
        macAddress,
        ipAddress,
        userId: device.userId,
        deviceId: device.id
      });

      return true;
    }

    return false;

  } catch (error) {
    logger.error('Error checking device authorization', {
      error: error.message,
      macAddress,
      ipAddress
    });
    return false;
  }
}

module.exports = captivePortalMiddleware;