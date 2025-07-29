const { Setting } = require('../models');
const { captureAuditLog, AUDIT_ACTIONS } = require('./audit');
const logger = require('./logger');

// Default system settings
const DEFAULT_SETTINGS = {
  // System Configuration
  system: {
    siteName: {
      value: 'LSLT WiFi Portal',
      dataType: 'string',
      description: 'Name of the site displayed to users',
      isEditable: true,
      requiresRestart: false
    },
    dataLimit: {
      value: '750',
      dataType: 'number',
      description: 'Default data limit in MB for free tier',
      isEditable: true,
      requiresRestart: false
    },
    premiumDataLimit: {
      value: '5120',
      dataType: 'number',
      description: 'Data limit in MB for premium tier',
      isEditable: true,
      requiresRestart: false
    },
    maxDevicesPerUser: {
      value: '2',
      dataType: 'number',
      description: 'Maximum devices allowed per user',
      isEditable: true,
      requiresRestart: false
    },
    sessionTimeout: {
      value: '1440',
      dataType: 'number',
      description: 'Session timeout in minutes',
      isEditable: true,
      requiresRestart: false
    }
  },

  // UniFi Dream Machine Settings
  unifi: {
    host: {
      value: '192.168.1.1',
      dataType: 'string',
      description: 'UniFi Controller IP address',
      isEditable: true,
      requiresRestart: true,
      validation: { pattern: '^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$' }
    },
    port: {
      value: '443',
      dataType: 'number',
      description: 'UniFi Controller port',
      isEditable: true,
      requiresRestart: true
    },
    username: {
      value: 'admin',
      dataType: 'string',
      description: 'UniFi Controller username',
      isEditable: true,
      requiresRestart: true
    },
    password: {
      value: '',
      dataType: 'password',
      description: 'UniFi Controller password',
      isEditable: true,
      requiresRestart: true
    },
    site: {
      value: 'default',
      dataType: 'string',
      description: 'UniFi site name',
      isEditable: true,
      requiresRestart: true
    },
    strictSSL: {
      value: 'false',
      dataType: 'boolean',
      description: 'Verify SSL certificates',
      isEditable: true,
      requiresRestart: true
    }
  },

  // Email Configuration
  email: {
    smtpHost: {
      value: '',
      dataType: 'string',
      description: 'SMTP server hostname',
      isEditable: true,
      requiresRestart: true
    },
    smtpPort: {
      value: '587',
      dataType: 'number',
      description: 'SMTP server port',
      isEditable: true,
      requiresRestart: true
    },
    smtpSecure: {
      value: 'false',
      dataType: 'boolean',
      description: 'Use secure connection (TLS)',
      isEditable: true,
      requiresRestart: true
    },
    smtpUser: {
      value: '',
      dataType: 'string',
      description: 'SMTP username',
      isEditable: true,
      requiresRestart: true
    },
    smtpPassword: {
      value: '',
      dataType: 'password',
      description: 'SMTP password',
      isEditable: true,
      requiresRestart: true
    },
    fromEmail: {
      value: 'noreply@lslt-portal.local',
      dataType: 'string',
      description: 'From email address',
      isEditable: true,
      requiresRestart: true,
      validation: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' }
    },
    fromName: {
      value: 'LSLT WiFi Portal',
      dataType: 'string',
      description: 'From name for emails',
      isEditable: true,
      requiresRestart: false
    }
  },

  // Loyalty Program Settings
  loyalty: {
    bronzeMinVisits: {
      value: '0',
      dataType: 'number',
      description: 'Minimum visits for Bronze tier',
      isEditable: true,
      requiresRestart: false
    },
    silverMinVisits: {
      value: '5',
      dataType: 'number',
      description: 'Minimum visits for Silver tier',
      isEditable: true,
      requiresRestart: false
    },
    goldMinVisits: {
      value: '15',
      dataType: 'number',
      description: 'Minimum visits for Gold tier',
      isEditable: true,
      requiresRestart: false
    },
    platinumMinVisits: {
      value: '30',
      dataType: 'number',
      description: 'Minimum visits for Platinum tier',
      isEditable: true,
      requiresRestart: false
    },
    maxRewardsPerWeek: {
      value: '3',
      dataType: 'number',
      description: 'Maximum rewards per user per week',
      isEditable: true,
      requiresRestart: false
    },
    voucherValidityDays: {
      value: '30',
      dataType: 'number',
      description: 'Default voucher validity in days',
      isEditable: true,
      requiresRestart: false
    }
  },

  // Branding Settings
  branding: {
    logoUrl: {
      value: '/assets/logo.png',
      dataType: 'string',
      description: 'Logo URL or path',
      isEditable: true,
      requiresRestart: false
    },
    primaryColor: {
      value: '#2563eb',
      dataType: 'string',
      description: 'Primary brand color (hex)',
      isEditable: true,
      requiresRestart: false,
      validation: { pattern: '^#[0-9A-Fa-f]{6}$' }
    },
    secondaryColor: {
      value: '#64748b',
      dataType: 'string',
      description: 'Secondary brand color (hex)',
      isEditable: true,
      requiresRestart: false,
      validation: { pattern: '^#[0-9A-Fa-f]{6}$' }
    },
    welcomeMessageEn: {
      value: 'Welcome to our WiFi network! Connect and earn loyalty rewards.',
      dataType: 'string',
      description: 'Welcome message (English)',
      isEditable: true,
      requiresRestart: false
    },
    welcomeMessageEs: {
      value: '¡Bienvenido a nuestra red WiFi! Conéctate y gana recompensas de lealtad.',
      dataType: 'string',
      description: 'Welcome message (Spanish)',
      isEditable: true,
      requiresRestart: false
    },
    termsUrl: {
      value: '/terms',
      dataType: 'string',
      description: 'Terms and Conditions URL',
      isEditable: true,
      requiresRestart: false
    },
    privacyUrl: {
      value: '/privacy',
      dataType: 'string',
      description: 'Privacy Policy URL',
      isEditable: true,
      requiresRestart: false
    }
  },

  // Security Settings
  security: {
    maxFailedAttempts: {
      value: '3',
      dataType: 'number',
      description: 'Max failed login attempts before blocking',
      isEditable: true,
      requiresRestart: true
    },
    blockDuration: {
      value: '15',
      dataType: 'number',
      description: 'Block duration in minutes',
      isEditable: true,
      requiresRestart: true
    },
    jwtSecret: {
      value: process.env.JWT_SECRET || 'change-this-secret',
      dataType: 'password',
      description: 'JWT signing secret',
      isEditable: true,
      requiresRestart: true
    },
    sessionDuration: {
      value: '24',
      dataType: 'number',
      description: 'JWT token duration in hours',
      isEditable: true,
      requiresRestart: true
    },
    enableRateLimit: {
      value: 'true',
      dataType: 'boolean',
      description: 'Enable API rate limiting',
      isEditable: true,
      requiresRestart: true
    }
  },

  // Network Settings
  network: {
    captivePortalIP: {
      value: '192.168.4.1',
      dataType: 'string',
      description: 'Captive portal IP address',
      isEditable: true,
      requiresRestart: true,
      validation: { pattern: '^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$' }
    },
    guestInterface: {
      value: 'wlan1',
      dataType: 'string',
      description: 'Guest network interface',
      isEditable: true,
      requiresRestart: true
    },
    dnsServer1: {
      value: '8.8.8.8',
      dataType: 'string',
      description: 'Primary DNS server',
      isEditable: true,
      requiresRestart: false,
      validation: { pattern: '^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$' }
    },
    dnsServer2: {
      value: '8.8.4.4',
      dataType: 'string',
      description: 'Secondary DNS server',
      isEditable: true,
      requiresRestart: false,
      validation: { pattern: '^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$' }
    }
  }
};

/**
 * Initialize default settings in database
 */
async function initializeSettings() {
  try {
    for (const [category, settings] of Object.entries(DEFAULT_SETTINGS)) {
      for (const [key, config] of Object.entries(settings)) {
        const existingSetting = await Setting.findOne({
          where: { category, key }
        });

        if (!existingSetting) {
          await Setting.create({
            category,
            key,
            value: config.value,
            dataType: config.dataType,
            description: config.description,
            isEditable: config.isEditable,
            requiresRestart: config.requiresRestart,
            validation: config.validation || null
          });
        }
      }
    }

    logger.info('Settings initialized successfully');
  } catch (error) {
    logger.error('Error initializing settings', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Get setting value by category and key
 */
async function getSetting(category, key, defaultValue = null) {
  try {
    const setting = await Setting.findOne({
      where: { category, key }
    });

    if (setting) {
      // Convert value based on data type
      switch (setting.dataType) {
        case 'number':
          return parseInt(setting.value) || 0;
        case 'boolean':
          return setting.value === 'true';
        case 'json':
          return JSON.parse(setting.value || '{}');
        default:
          return setting.value;
      }
    }

    return defaultValue;
  } catch (error) {
    logger.error('Error getting setting', {
      error: error.message,
      category,
      key
    });
    return defaultValue;
  }
}

/**
 * Set setting value
 */
async function setSetting(category, key, value, staffId = null) {
  try {
    const setting = await Setting.findOne({
      where: { category, key }
    });

    if (!setting) {
      throw new Error(`Setting not found: ${category}.${key}`);
    }

    if (!setting.isEditable) {
      throw new Error(`Setting is not editable: ${category}.${key}`);
    }

    // Validate value based on data type
    let processedValue = value;
    switch (setting.dataType) {
      case 'number':
        processedValue = parseInt(value).toString();
        if (isNaN(processedValue)) {
          throw new Error('Invalid number value');
        }
        break;
      case 'boolean':
        processedValue = Boolean(value).toString();
        break;
      case 'json':
        if (typeof value === 'object') {
          processedValue = JSON.stringify(value);
        }
        break;
      default:
        processedValue = String(value);
    }

    // Apply validation if specified
    if (setting.validation && setting.validation.pattern) {
      const regex = new RegExp(setting.validation.pattern);
      if (!regex.test(processedValue)) {
        throw new Error('Value does not match required pattern');
      }
    }

    const oldValue = setting.value;
    await setting.update({ value: processedValue });

    await captureAuditLog(
      AUDIT_ACTIONS.ADMIN_CONFIG_CHANGE,
      'setting',
      setting.id,
      null,
      staffId,
      null,
      null,
      {
        category,
        key,
        oldValue,
        newValue: processedValue,
        requiresRestart: setting.requiresRestart
      }
    );

    logger.info('Setting updated', {
      category,
      key,
      oldValue,
      newValue: processedValue,
      staffId,
      requiresRestart: setting.requiresRestart
    });

    return {
      success: true,
      requiresRestart: setting.requiresRestart,
      setting: {
        id: setting.id,
        category,
        key,
        value: processedValue,
        dataType: setting.dataType,
        description: setting.description,
        requiresRestart: setting.requiresRestart
      }
    };

  } catch (error) {
    logger.error('Error setting value', {
      error: error.message,
      category,
      key,
      value
    });
    throw error;
  }
}

/**
 * Get all settings by category
 */
async function getSettingsByCategory(category = null) {
  try {
    const whereClause = category ? { category } : {};
    
    const settings = await Setting.findAll({
      where: whereClause,
      order: [['category', 'ASC'], ['key', 'ASC']]
    });

    // Group by category
    const grouped = {};
    settings.forEach(setting => {
      if (!grouped[setting.category]) {
        grouped[setting.category] = {};
      }

      let value = setting.value;
      // Convert value based on data type for display
      switch (setting.dataType) {
        case 'number':
          value = parseInt(setting.value) || 0;
          break;
        case 'boolean':
          value = setting.value === 'true';
          break;
        case 'json':
          try {
            value = JSON.parse(setting.value || '{}');
          } catch {
            value = {};
          }
          break;
      }

      grouped[setting.category][setting.key] = {
        id: setting.id,
        value,
        dataType: setting.dataType,
        description: setting.description,
        isEditable: setting.isEditable,
        requiresRestart: setting.requiresRestart,
        validation: setting.validation
      };
    });

    return grouped;
  } catch (error) {
    logger.error('Error getting settings by category', {
      error: error.message,
      category
    });
    throw error;
  }
}

/**
 * Update multiple settings at once
 */
async function updateSettings(updates, staffId = null) {
  try {
    const results = [];
    const requiresRestart = new Set();

    for (const update of updates) {
      const { category, key, value } = update;
      
      const result = await setSetting(category, key, value, staffId);
      results.push(result);
      
      if (result.requiresRestart) {
        requiresRestart.add(`${category}.${key}`);
      }
    }

    return {
      success: true,
      updated: results.length,
      requiresRestart: Array.from(requiresRestart),
      results
    };

  } catch (error) {
    logger.error('Error updating multiple settings', {
      error: error.message,
      updates
    });
    throw error;
  }
}

/**
 * Reset settings to defaults
 */
async function resetSettings(category = null, staffId = null) {
  try {
    const settingsToReset = category ? 
      { [category]: DEFAULT_SETTINGS[category] } : 
      DEFAULT_SETTINGS;

    let resetCount = 0;
    const requiresRestart = new Set();

    for (const [cat, settings] of Object.entries(settingsToReset)) {
      for (const [key, config] of Object.entries(settings)) {
        const result = await setSetting(cat, key, config.value, staffId);
        resetCount++;
        
        if (result.requiresRestart) {
          requiresRestart.add(`${cat}.${key}`);
        }
      }
    }

    await captureAuditLog(
      AUDIT_ACTIONS.ADMIN_CONFIG_CHANGE,
      'setting',
      null,
      null,
      staffId,
      null,
      null,
      {
        action: 'reset_settings',
        category,
        resetCount,
        requiresRestart: Array.from(requiresRestart)
      }
    );

    return {
      success: true,
      resetCount,
      requiresRestart: Array.from(requiresRestart)
    };

  } catch (error) {
    logger.error('Error resetting settings', {
      error: error.message,
      category
    });
    throw error;
  }
}

/**
 * Test email configuration
 */
async function testEmailConfig() {
  try {
    const emailSettings = await getSettingsByCategory('email');
    const settings = emailSettings.email;

    if (!settings.smtpHost.value) {
      throw new Error('SMTP host not configured');
    }

    // Import nodemailer dynamically to test
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: settings.smtpHost.value,
      port: settings.smtpPort.value,
      secure: settings.smtpSecure.value,
      auth: settings.smtpUser.value ? {
        user: settings.smtpUser.value,
        pass: settings.smtpPassword.value
      } : undefined
    });

    await transporter.verify();

    return {
      success: true,
      message: 'Email configuration is valid'
    };

  } catch (error) {
    logger.error('Email configuration test failed', {
      error: error.message
    });
    
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Test UniFi connection
 */
async function testUniFiConfig() {
  try {
    const unifiSettings = await getSettingsByCategory('unifi');
    const settings = unifiSettings.unifi;

    if (!settings.host.value) {
      throw new Error('UniFi host not configured');
    }

    // Import UniFi utilities to test
    const { testConnection } = require('./unifi');
    
    const result = await testConnection();
    
    return result;

  } catch (error) {
    logger.error('UniFi configuration test failed', {
      error: error.message
    });
    
    return {
      success: false,
      message: error.message
    };
  }
}

module.exports = {
  initializeSettings,
  getSetting,
  setSetting,
  getSettingsByCategory,
  updateSettings,
  resetSettings,
  testEmailConfig,
  testUniFiConfig,
  DEFAULT_SETTINGS
};