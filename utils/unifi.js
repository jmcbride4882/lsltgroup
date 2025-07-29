const axios = require('axios');
const https = require('https');
const { captureAuditLog, AUDIT_ACTIONS } = require('./audit');
const logger = require('./logger');

// UniFi Controller configuration
const UNIFI_CONFIG = {
  host: process.env.UNIFI_HOST || '192.168.1.1',
  port: process.env.UNIFI_PORT || '443',
  username: process.env.UNIFI_USERNAME || 'admin',
  password: process.env.UNIFI_PASSWORD || '',
  site: process.env.UNIFI_SITE || 'default',
  strictSSL: process.env.UNIFI_STRICT_SSL === 'true'
};

// Create axios instance with custom config for UniFi
const unifiAPI = axios.create({
  baseURL: `https://${UNIFI_CONFIG.host}:${UNIFI_CONFIG.port}`,
  timeout: 10000,
  httpsAgent: new https.Agent({
    rejectUnauthorized: UNIFI_CONFIG.strictSSL
  }),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Cookie jar for session management
let unifiCookies = '';
let lastLoginTime = 0;
const LOGIN_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Login to UniFi Controller
 */
async function loginToUniFi() {
  try {
    const currentTime = Date.now();
    
    // Check if we have a valid session
    if (unifiCookies && (currentTime - lastLoginTime) < LOGIN_TIMEOUT) {
      return true;
    }

    logger.info('Logging into UniFi Controller', {
      host: UNIFI_CONFIG.host,
      username: UNIFI_CONFIG.username
    });

    const response = await unifiAPI.post('/api/login', {
      username: UNIFI_CONFIG.username,
      password: UNIFI_CONFIG.password,
      remember: false
    });

    if (response.status === 200) {
      // Extract cookies from response
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        unifiCookies = cookies.map(cookie => cookie.split(';')[0]).join('; ');
        lastLoginTime = currentTime;
        
        // Set default cookie header for future requests
        unifiAPI.defaults.headers.common['Cookie'] = unifiCookies;
        
        logger.info('Successfully logged into UniFi Controller');
        return true;
      }
    }

    throw new Error('Login failed - no cookies received');

  } catch (error) {
    logger.error('Failed to login to UniFi Controller', {
      error: error.message,
      host: UNIFI_CONFIG.host,
      username: UNIFI_CONFIG.username
    });

    await captureAuditLog(
      AUDIT_ACTIONS.UNIFI_API_ERROR,
      'unifi',
      null,
      null,
      null,
      null,
      null,
      {
        action: 'login',
        error: error.message,
        host: UNIFI_CONFIG.host
      },
      'error'
    );

    return false;
  }
}

/**
 * Ensure we're logged in before making API calls
 */
async function ensureLogin() {
  const isLoggedIn = await loginToUniFi();
  if (!isLoggedIn) {
    throw new Error('Failed to authenticate with UniFi Controller');
  }
}

/**
 * Authorize device for internet access
 */
async function authorizeDevice(macAddress, userId = null, duration = 24 * 60 * 60) {
  try {
    await ensureLogin();

    logger.info('Authorizing device on UniFi', {
      macAddress,
      userId,
      duration
    });

    // Add device to authorized clients
    const response = await unifiAPI.post(`/api/s/${UNIFI_CONFIG.site}/cmd/stamgr`, {
      cmd: 'authorize-guest',
      mac: macAddress,
      minutes: Math.floor(duration / 60),
      up: 750 * 1024 * 1024, // 750MB upload limit for free tier
      down: 750 * 1024 * 1024, // 750MB download limit for free tier
      bytes: 750 * 1024 * 1024 // Total data limit
    });

    if (response.status === 200) {
      logger.info('Device authorized successfully', {
        macAddress,
        userId,
        response: response.data
      });

      await captureAuditLog(
        AUDIT_ACTIONS.UNIFI_DEVICE_ALLOWED,
        'device',
        macAddress,
        userId,
        null,
        null,
        null,
        {
          macAddress,
          duration,
          dataLimit: '750MB',
          action: 'authorize'
        }
      );

      return {
        success: true,
        message: 'Device authorized for internet access',
        dataLimit: '750MB',
        duration: duration
      };
    }

    throw new Error('Authorization request failed');

  } catch (error) {
    logger.error('Failed to authorize device', {
      error: error.message,
      macAddress,
      userId
    });

    await captureAuditLog(
      AUDIT_ACTIONS.UNIFI_API_ERROR,
      'device',
      macAddress,
      userId,
      null,
      null,
      null,
      {
        action: 'authorize',
        error: error.message,
        macAddress
      },
      'error'
    );

    throw error;
  }
}

/**
 * Block device from network access
 */
async function blockDevice(macAddress, reason = 'Security violation') {
  try {
    await ensureLogin();

    logger.info('Blocking device on UniFi', {
      macAddress,
      reason
    });

    // Block device using firewall rule
    const response = await unifiAPI.post(`/api/s/${UNIFI_CONFIG.site}/rest/firewallrule`, {
      name: `LSLT_BLOCK_${macAddress.replace(/:/g, '')}`,
      ruleset: 'LAN_IN',
      rule_index: 2000,
      action: 'drop',
      protocol: 'all',
      enabled: true,
      src_mac_address: macAddress,
      logging: true
    });

    if (response.status === 200) {
      logger.info('Device blocked successfully', {
        macAddress,
        reason,
        ruleId: response.data?.data?.[0]?._id
      });

      await captureAuditLog(
        AUDIT_ACTIONS.UNIFI_DEVICE_BLOCKED,
        'device',
        macAddress,
        null,
        null,
        null,
        null,
        {
          macAddress,
          reason,
          action: 'block',
          ruleId: response.data?.data?.[0]?._id
        }
      );

      return {
        success: true,
        message: 'Device blocked from network access',
        ruleId: response.data?.data?.[0]?._id
      };
    }

    throw new Error('Block request failed');

  } catch (error) {
    logger.error('Failed to block device', {
      error: error.message,
      macAddress,
      reason
    });

    await captureAuditLog(
      AUDIT_ACTIONS.UNIFI_API_ERROR,
      'device',
      macAddress,
      null,
      null,
      null,
      null,
      {
        action: 'block',
        error: error.message,
        macAddress,
        reason
      },
      'error'
    );

    throw error;
  }
}

/**
 * Unblock device (remove firewall rule)
 */
async function unblockDevice(macAddress) {
  try {
    await ensureLogin();

    logger.info('Unblocking device on UniFi', { macAddress });

    // Find existing firewall rule
    const rulesResponse = await unifiAPI.get(`/api/s/${UNIFI_CONFIG.site}/rest/firewallrule`);
    const rules = rulesResponse.data?.data || [];
    
    const blockRule = rules.find(rule => 
      rule.name === `LSLT_BLOCK_${macAddress.replace(/:/g, '')}` ||
      rule.src_mac_address === macAddress
    );

    if (blockRule) {
      // Delete the firewall rule
      const deleteResponse = await unifiAPI.delete(
        `/api/s/${UNIFI_CONFIG.site}/rest/firewallrule/${blockRule._id}`
      );

      if (deleteResponse.status === 200) {
        logger.info('Device unblocked successfully', {
          macAddress,
          ruleId: blockRule._id
        });

        await captureAuditLog(
          AUDIT_ACTIONS.UNIFI_DEVICE_ALLOWED,
          'device',
          macAddress,
          null,
          null,
          null,
          null,
          {
            macAddress,
            action: 'unblock',
            ruleId: blockRule._id
          }
        );

        return {
          success: true,
          message: 'Device unblocked and network access restored'
        };
      }
    } else {
      logger.warn('No block rule found for device', { macAddress });
      return {
        success: true,
        message: 'Device was not blocked or rule already removed'
      };
    }

  } catch (error) {
    logger.error('Failed to unblock device', {
      error: error.message,
      macAddress
    });

    await captureAuditLog(
      AUDIT_ACTIONS.UNIFI_API_ERROR,
      'device',
      macAddress,
      null,
      null,
      null,
      null,
      {
        action: 'unblock',
        error: error.message,
        macAddress
      },
      'error'
    );

    throw error;
  }
}

/**
 * Get device information from UniFi
 */
async function getDeviceInfo(macAddress) {
  try {
    await ensureLogin();

    // Get client information
    const response = await unifiAPI.get(`/api/s/${UNIFI_CONFIG.site}/stat/sta`);
    const clients = response.data?.data || [];
    
    const device = clients.find(client => 
      client.mac?.toLowerCase() === macAddress.toLowerCase()
    );

    if (device) {
      return {
        macAddress: device.mac,
        ip: device.ip,
        hostname: device.hostname || device.name,
        isOnline: device.is_wired || device.is_wireless,
        signalStrength: device.rssi,
        dataUsage: {
          rx_bytes: device.rx_bytes || 0,
          tx_bytes: device.tx_bytes || 0,
          total: (device.rx_bytes || 0) + (device.tx_bytes || 0)
        },
        connectedSince: device.first_seen ? new Date(device.first_seen * 1000) : null,
        lastSeen: device.last_seen ? new Date(device.last_seen * 1000) : null,
        apMac: device.ap_mac,
        channel: device.channel,
        network: device.network
      };
    }

    return null;

  } catch (error) {
    logger.error('Failed to get device info', {
      error: error.message,
      macAddress
    });
    return null;
  }
}

/**
 * Set premium WiFi access (higher data limits)
 */
async function setPremiumAccess(macAddress, userId, durationHours = 24) {
  try {
    await ensureLogin();

    logger.info('Setting premium WiFi access', {
      macAddress,
      userId,
      durationHours
    });

    // Authorize with higher limits for premium users
    const response = await unifiAPI.post(`/api/s/${UNIFI_CONFIG.site}/cmd/stamgr`, {
      cmd: 'authorize-guest',
      mac: macAddress,
      minutes: durationHours * 60,
      up: 5 * 1024 * 1024 * 1024, // 5GB upload for premium
      down: 5 * 1024 * 1024 * 1024, // 5GB download for premium
      bytes: 5 * 1024 * 1024 * 1024 // 5GB total data limit
    });

    if (response.status === 200) {
      logger.info('Premium access granted successfully', {
        macAddress,
        userId,
        dataLimit: '5GB',
        duration: durationHours
      });

      await captureAuditLog(
        AUDIT_ACTIONS.UNIFI_DEVICE_ALLOWED,
        'device',
        macAddress,
        userId,
        null,
        null,
        null,
        {
          macAddress,
          userId,
          accessType: 'premium',
          dataLimit: '5GB',
          duration: durationHours
        }
      );

      return {
        success: true,
        message: 'Premium WiFi access granted',
        dataLimit: '5GB',
        duration: durationHours
      };
    }

    throw new Error('Premium access request failed');

  } catch (error) {
    logger.error('Failed to set premium access', {
      error: error.message,
      macAddress,
      userId
    });

    throw error;
  }
}

/**
 * Get network statistics
 */
async function getNetworkStats() {
  try {
    await ensureLogin();

    // Get site statistics
    const statsResponse = await unifiAPI.get(`/api/s/${UNIFI_CONFIG.site}/stat/health`);
    const clientsResponse = await unifiAPI.get(`/api/s/${UNIFI_CONFIG.site}/stat/sta`);
    
    const stats = statsResponse.data?.data || [];
    const clients = clientsResponse.data?.data || [];

    const wanStats = stats.find(s => s.subsystem === 'wan') || {};
    const wlanStats = stats.find(s => s.subsystem === 'wlan') || {};

    return {
      connectedClients: clients.length,
      onlineClients: clients.filter(c => c.is_wired || c.is_wireless).length,
      totalDataUsage: clients.reduce((total, client) => 
        total + (client.rx_bytes || 0) + (client.tx_bytes || 0), 0
      ),
      wanStatus: wanStats.status || 'unknown',
      wlanStatus: wlanStats.status || 'unknown',
      uptime: wanStats.uptime || 0,
      clients: clients.map(client => ({
        mac: client.mac,
        ip: client.ip,
        hostname: client.hostname || client.name,
        isOnline: client.is_wired || client.is_wireless,
        dataUsage: (client.rx_bytes || 0) + (client.tx_bytes || 0)
      }))
    };

  } catch (error) {
    logger.error('Failed to get network stats', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Test UniFi connection
 */
async function testConnection() {
  try {
    const isConnected = await loginToUniFi();
    
    if (isConnected) {
      // Try to get basic site info
      const response = await unifiAPI.get(`/api/s/${UNIFI_CONFIG.site}/stat/health`);
      
      return {
        success: true,
        message: 'Successfully connected to UniFi Controller',
        controllerVersion: response.data?.meta?.server_version,
        site: UNIFI_CONFIG.site,
        host: UNIFI_CONFIG.host
      };
    }

    return {
      success: false,
      message: 'Failed to connect to UniFi Controller'
    };

  } catch (error) {
    logger.error('UniFi connection test failed', {
      error: error.message,
      host: UNIFI_CONFIG.host
    });

    return {
      success: false,
      message: error.message,
      host: UNIFI_CONFIG.host
    };
  }
}

/**
 * Create guest WiFi voucher (for premium access)
 */
async function createGuestVoucher(duration = 24, dataLimit = 5) {
  try {
    await ensureLogin();

    const response = await unifiAPI.post(`/api/s/${UNIFI_CONFIG.site}/cmd/hotspot`, {
      cmd: 'create-voucher',
      expire: duration * 60, // Convert hours to minutes
      n: 1, // Number of vouchers
      quota: dataLimit * 1024, // Convert GB to MB
      note: `LSLT Premium WiFi - ${duration}h / ${dataLimit}GB`
    });

    if (response.status === 200 && response.data?.data?.length > 0) {
      const voucher = response.data.data[0];
      
      logger.info('Guest voucher created', {
        voucherCode: voucher.code,
        duration,
        dataLimit
      });

      return {
        success: true,
        voucherCode: voucher.code,
        duration,
        dataLimit,
        expiresAt: new Date(Date.now() + duration * 60 * 60 * 1000)
      };
    }

    throw new Error('Voucher creation failed');

  } catch (error) {
    logger.error('Failed to create guest voucher', {
      error: error.message,
      duration,
      dataLimit
    });
    throw error;
  }
}

module.exports = {
  loginToUniFi,
  authorizeDevice,
  blockDevice,
  unblockDevice,
  getDeviceInfo,
  setPremiumAccess,
  getNetworkStats,
  testConnection,
  createGuestVoucher,
  UNIFI_CONFIG
};