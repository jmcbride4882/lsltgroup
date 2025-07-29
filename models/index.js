const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'data', 'lslt_portal.db'),
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Define all models according to specification

// Users table - Guest WiFi customers
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  language: {
    type: DataTypes.ENUM('en', 'es'),
    defaultValue: 'en'
  },
  marketingConsent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  visitCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  loyaltyTier: {
    type: DataTypes.ENUM('Bronze', 'Silver', 'Gold', 'Platinum'),
    defaultValue: 'Bronze'
  },
  lastVisit: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  blockReason: {
    type: DataTypes.STRING,
    allowNull: true
  },
  familyGroupId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  paranoid: true, // Soft delete support
  indexes: [
    { fields: ['email'] },
    { fields: ['dateOfBirth'] },
    { fields: ['loyaltyTier'] },
    { fields: ['familyGroupId'] }
  ]
});

// Devices table - Track user devices and enforce limits
const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  macAddress: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  deviceName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  dataUsed: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  isBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  blockReason: {
    type: DataTypes.STRING,
    allowNull: true
  },
  failedAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  indexes: [
    { fields: ['macAddress'] },
    { fields: ['userId'] },
    { fields: ['isActive'] },
    { fields: ['isBlocked'] }
  ]
});

// Visits table - Track user visits for loyalty calculation
const Visit = sequelize.define('Visit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  deviceId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Device,
      key: 'id'
    }
  },
  sessionStart: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  sessionEnd: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dataUsed: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  indexes: [
    { fields: ['userId'] },
    { fields: ['deviceId'] },
    { fields: ['sessionStart'] }
  ]
});

// Vouchers table - All types of vouchers (rewards, premium WiFi, staff WiFi)
const Voucher = sequelize.define('Voucher', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.ENUM('reward', 'premium_wifi', 'staff_wifi', 'promotional'),
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  },
  staffId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isRedeemed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  redeemedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  redeemedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  qrCode: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  receiptNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  saleAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  }
}, {
  indexes: [
    { fields: ['code'] },
    { fields: ['type'] },
    { fields: ['userId'] },
    { fields: ['isRedeemed'] },
    { fields: ['expiryDate'] }
  ]
});

// Rewards table - Loyalty rewards configuration
const Reward = sequelize.define('Reward', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nameEs: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  descriptionEs: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  triggerType: {
    type: DataTypes.ENUM('visit_count', 'tier_upgrade', 'birthday', 'referral'),
    allowNull: false
  },
  triggerValue: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  rewardType: {
    type: DataTypes.ENUM('voucher', 'discount', 'premium_wifi', 'points'),
    allowNull: false
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false
  },
  maxPerWeek: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  validityDays: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  }
}, {
  indexes: [
    { fields: ['triggerType'] },
    { fields: ['isActive'] }
  ]
});

// Staff table - Staff and manager accounts
const Staff = sequelize.define('Staff', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  pin: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('staff', 'manager', 'admin'),
    defaultValue: 'staff'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  failedAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  vouchersToday: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastVoucherDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  }
}, {
  indexes: [
    { fields: ['email'] },
    { fields: ['role'] },
    { fields: ['isActive'] }
  ]
});

// Audit Log table - All system actions
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  entityType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  entityId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  staffId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true
  },
  severity: {
    type: DataTypes.ENUM('info', 'warning', 'error', 'critical'),
    defaultValue: 'info'
  }
}, {
  indexes: [
    { fields: ['action'] },
    { fields: ['entityType'] },
    { fields: ['userId'] },
    { fields: ['staffId'] },
    { fields: ['createdAt'] },
    { fields: ['severity'] }
  ]
});

// Printers table - Manage connected printers
const Printer = sequelize.define('Printer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('receipt', 'a4', 'label'),
    allowNull: false
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  port: {
    type: DataTypes.INTEGER,
    defaultValue: 9100
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastTest: {
    type: DataTypes.DATE,
    allowNull: true
  },
  testResult: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  settings: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  indexes: [
    { fields: ['type'] },
    { fields: ['isActive'] },
    { fields: ['isDefault'] }
  ]
});

// Family Groups table - Group family members for rewards
const FamilyGroup = sequelize.define('FamilyGroup', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  headUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  maxMembers: {
    type: DataTypes.INTEGER,
    defaultValue: 6
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  indexes: [
    { fields: ['headUserId'] },
    { fields: ['isActive'] }
  ]
});

// Sites table - Multi-site support
const Site = sequelize.define('Site', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  timezone: {
    type: DataTypes.STRING,
    defaultValue: 'America/New_York'
  },
  branding: {
    type: DataTypes.JSON,
    allowNull: true
  },
  settings: {
    type: DataTypes.JSON,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  indexes: [
    { fields: ['isActive'] }
  ]
});

// Campaigns table - Marketing campaigns
const Campaign = sequelize.define('Campaign', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('email', 'sms', 'notification'),
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  contentEs: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  targetSegment: {
    type: DataTypes.JSON,
    allowNull: true
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'sent', 'cancelled'),
    defaultValue: 'draft'
  },
  recipientCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  successCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  indexes: [
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['scheduledAt'] }
  ]
});

// Settings table - Store all configurable system settings
const Setting = sequelize.define('Setting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  category: {
    type: DataTypes.ENUM('system', 'unifi', 'email', 'loyalty', 'branding', 'network', 'printers', 'security'),
    allowNull: false
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  dataType: {
    type: DataTypes.ENUM('string', 'number', 'boolean', 'json', 'password'),
    defaultValue: 'string'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isEditable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  requiresRestart: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  validation: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  indexes: [
    { fields: ['category'] },
    { fields: ['key'] },
    { unique: true, fields: ['category', 'key'] }
  ]
});

// Define associations
User.hasMany(Device, { foreignKey: 'userId', as: 'devices' });
Device.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Visit, { foreignKey: 'userId', as: 'visits' });
Visit.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Device.hasMany(Visit, { foreignKey: 'deviceId', as: 'visits' });
Visit.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });

User.hasMany(Voucher, { foreignKey: 'userId', as: 'vouchers' });
Voucher.belongsTo(User, { foreignKey: 'userId', as: 'user' });

FamilyGroup.belongsTo(User, { foreignKey: 'headUserId', as: 'head' });
User.belongsTo(FamilyGroup, { foreignKey: 'familyGroupId', as: 'familyGroup' });

module.exports = {
  sequelize,
  User,
  Device,
  Visit,
  Voucher,
  Reward,
  Staff,
  AuditLog,
  Printer,
  FamilyGroup,
  Site,
  Campaign,
  Setting
};