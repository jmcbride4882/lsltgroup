const moment = require('moment');
const { User, Reward, Voucher, Visit } = require('../models');
const { generateVoucher } = require('./vouchers');
const { captureAuditLog, AUDIT_ACTIONS } = require('./audit');
const logger = require('./logger');

// Loyalty tier thresholds
const LOYALTY_TIERS = {
  Bronze: { minVisits: 0, maxVisits: 4, benefits: ['WiFi Access', '750MB Data'] },
  Silver: { minVisits: 5, maxVisits: 14, benefits: ['WiFi Access', '1.5GB Data', '10% Discounts'] },
  Gold: { minVisits: 15, maxVisits: 29, benefits: ['WiFi Access', '3GB Data', '15% Discounts', 'Priority Support'] },
  Platinum: { minVisits: 30, maxVisits: 999, benefits: ['WiFi Access', 'Unlimited Data', '20% Discounts', 'VIP Support', 'Exclusive Events'] }
};

// Default rewards configuration
const DEFAULT_REWARDS = [
  {
    name: 'Welcome Bonus',
    nameEs: 'Bono de Bienvenida',
    description: 'Free drink for new customers who opt in to marketing',
    descriptionEs: 'Bebida gratis para nuevos clientes que acepten marketing',
    triggerType: 'visit_count',
    triggerValue: 1,
    rewardType: 'voucher',
    value: 'Free Welcome Drink',
    maxPerWeek: 1,
    validityDays: 30
  },
  {
    name: 'Silver Tier Upgrade',
    nameEs: 'Ascenso a Nivel Plata',
    description: 'Congratulations on reaching Silver tier!',
    descriptionEs: '¡Felicidades por alcanzar el nivel Plata!',
    triggerType: 'tier_upgrade',
    triggerValue: 5,
    rewardType: 'voucher',
    value: 'Free Pastry',
    maxPerWeek: 1,
    validityDays: 30
  },
  {
    name: 'Gold Tier Upgrade',
    nameEs: 'Ascenso a Nivel Oro',
    description: 'Welcome to Gold tier - enjoy premium benefits!',
    descriptionEs: '¡Bienvenido al nivel Oro - disfruta de beneficios premium!',
    triggerType: 'tier_upgrade',
    triggerValue: 15,
    rewardType: 'voucher',
    value: 'Free Lunch Combo',
    maxPerWeek: 1,
    validityDays: 30
  },
  {
    name: 'Platinum Tier Upgrade',
    nameEs: 'Ascenso a Nivel Platino',
    description: 'Platinum status achieved - you are our VIP customer!',
    descriptionEs: '¡Estado Platino alcanzado - eres nuestro cliente VIP!',
    triggerType: 'tier_upgrade',
    triggerValue: 30,
    rewardType: 'voucher',
    value: 'Free Dinner for Two',
    maxPerWeek: 1,
    validityDays: 30
  },
  {
    name: 'Frequent Visitor',
    nameEs: 'Visitante Frecuente',
    description: 'Thanks for being a loyal customer!',
    descriptionEs: '¡Gracias por ser un cliente leal!',
    triggerType: 'visit_count',
    triggerValue: 10,
    rewardType: 'voucher',
    value: '10% Discount',
    maxPerWeek: 1,
    validityDays: 14
  },
  {
    name: 'Birthday Special',
    nameEs: 'Especial de Cumpleaños',
    description: 'Happy Birthday! Enjoy this special treat on us.',
    descriptionEs: '¡Feliz Cumpleaños! Disfruta este regalo especial de nuestra parte.',
    triggerType: 'birthday',
    triggerValue: null,
    rewardType: 'voucher',
    value: 'Birthday Dessert',
    maxPerWeek: 1,
    validityDays: 7
  }
];

/**
 * Calculate loyalty tier based on visit count
 */
function calculateLoyaltyTier(visitCount) {
  for (const [tier, config] of Object.entries(LOYALTY_TIERS)) {
    if (visitCount >= config.minVisits && visitCount <= config.maxVisits) {
      return tier;
    }
  }
  return 'Bronze'; // Default fallback
}

/**
 * Get tier benefits
 */
function getTierBenefits(tier) {
  return LOYALTY_TIERS[tier]?.benefits || LOYALTY_TIERS.Bronze.benefits;
}

/**
 * Calculate progress to next tier
 */
function calculateTierProgress(visitCount) {
  const currentTier = calculateLoyaltyTier(visitCount);
  
  // Find next tier
  const tiers = Object.keys(LOYALTY_TIERS);
  const currentIndex = tiers.indexOf(currentTier);
  
  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    // Already at highest tier
    return {
      currentTier,
      nextTier: null,
      visitsToNext: 0,
      progressPercentage: 100
    };
  }

  const nextTier = tiers[currentIndex + 1];
  const nextTierMinVisits = LOYALTY_TIERS[nextTier].minVisits;
  const currentTierMinVisits = LOYALTY_TIERS[currentTier].minVisits;
  
  const visitsToNext = nextTierMinVisits - visitCount;
  const tierRange = nextTierMinVisits - currentTierMinVisits;
  const progressInTier = visitCount - currentTierMinVisits;
  const progressPercentage = tierRange > 0 ? (progressInTier / tierRange) * 100 : 100;

  return {
    currentTier,
    nextTier,
    visitsToNext: Math.max(0, visitsToNext),
    progressPercentage: Math.min(100, Math.max(0, progressPercentage))
  };
}

/**
 * Check for rewards based on user activity
 */
async function checkRewards(userId, triggerType, context = {}) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      logger.warn('User not found for reward check', { userId, triggerType });
      return [];
    }

    const earnedRewards = [];

    // Get active rewards for this trigger type
    const rewards = await Reward.findAll({
      where: {
        triggerType,
        isActive: true
      }
    });

    for (const reward of rewards) {
      const shouldAward = await shouldAwardReward(user, reward, context);
      
      if (shouldAward) {
        try {
          const voucherReward = await generateRewardVoucher(user, reward);
          earnedRewards.push(voucherReward);

          await captureAuditLog(
            'REWARD_EARNED',
            'reward',
            reward.id,
            userId,
            null,
            null,
            null,
            {
              rewardName: reward.name,
              triggerType,
              triggerValue: reward.triggerValue,
              voucherCode: voucherReward.code,
              context
            }
          );

          logger.info('Reward earned by user', {
            userId,
            rewardId: reward.id,
            rewardName: reward.name,
            voucherCode: voucherReward.code,
            triggerType,
            context
          });

        } catch (error) {
          logger.error('Error generating reward voucher', {
            error: error.message,
            userId,
            rewardId: reward.id,
            rewardName: reward.name
          });
        }
      }
    }

    return earnedRewards;

  } catch (error) {
    logger.error('Error checking rewards', {
      error: error.message,
      userId,
      triggerType,
      context
    });
    return [];
  }
}

/**
 * Determine if user should be awarded a specific reward
 */
async function shouldAwardReward(user, reward, context) {
  try {
    // Check trigger conditions
    switch (reward.triggerType) {
      case 'visit_count':
        if (user.visitCount !== reward.triggerValue) {
          return false;
        }
        break;

      case 'tier_upgrade':
        if (!context.tierUpgrade || user.visitCount !== reward.triggerValue) {
          return false;
        }
        break;

      case 'birthday':
        if (!isBirthdayToday(user.dateOfBirth)) {
          return false;
        }
        break;

      case 'referral':
        // Check if this is a referral trigger
        if (!context.referral) {
          return false;
        }
        break;

      default:
        return false;
    }

    // Check if user has already received this reward recently
    const recentReward = await checkRecentReward(user.id, reward);
    if (recentReward) {
      return false;
    }

    return true;

  } catch (error) {
    logger.error('Error checking if should award reward', {
      error: error.message,
      userId: user.id,
      rewardId: reward.id
    });
    return false;
  }
}

/**
 * Check if user has received this reward recently based on maxPerWeek
 */
async function checkRecentReward(userId, reward) {
  try {
    const { Op } = require('sequelize');
    const oneWeekAgo = moment().subtract(1, 'week').toDate();

    const recentVouchers = await Voucher.count({
      where: {
        userId,
        type: 'reward',
        value: reward.value,
        createdAt: {
          [Op.gte]: oneWeekAgo
        }
      }
    });

    return recentVouchers >= reward.maxPerWeek;

  } catch (error) {
    logger.error('Error checking recent rewards', {
      error: error.message,
      userId,
      rewardId: reward.id
    });
    return false;
  }
}

/**
 * Check if today is user's birthday
 */
function isBirthdayToday(dateOfBirth) {
  const today = moment();
  const birthday = moment(dateOfBirth);
  
  return today.month() === birthday.month() && today.date() === birthday.date();
}

/**
 * Generate reward voucher
 */
async function generateRewardVoucher(user, reward) {
  try {
    const description = user.language === 'es' ? reward.descriptionEs : reward.description;
    
    const voucherData = await generateVoucher({
      type: 'reward',
      userId: user.id,
      value: reward.value,
      description,
      validityDays: reward.validityDays
    });

    return voucherData;

  } catch (error) {
    logger.error('Error generating reward voucher', {
      error: error.message,
      userId: user.id,
      rewardId: reward.id
    });
    throw error;
  }
}

/**
 * Get user's loyalty summary
 */
async function getUserLoyaltySummary(userId) {
  try {
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Visit,
          as: 'visits',
          order: [['createdAt', 'DESC']],
          limit: 10
        },
        {
          model: Voucher,
          as: 'vouchers',
          where: {
            isRedeemed: false,
            expiryDate: {
              [require('sequelize').Op.gt]: new Date()
            }
          },
          required: false,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!user) {
      throw new Error('User not found');
    }

    const tierProgress = calculateTierProgress(user.visitCount);
    const benefits = getTierBenefits(user.loyaltyTier);

    // Calculate visit statistics
    const lastVisit = user.visits?.[0]?.createdAt;
    const visitDates = user.visits?.map(v => moment(v.createdAt).format('YYYY-MM-DD')) || [];
    const uniqueVisitDays = [...new Set(visitDates)].length;

    // Check for birthday rewards
    const isBirthday = isBirthdayToday(user.dateOfBirth);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        loyaltyTier: user.loyaltyTier,
        visitCount: user.visitCount,
        lastVisit,
        isBirthday
      },
      tierProgress,
      benefits,
      statistics: {
        totalVisits: user.visitCount,
        uniqueVisitDays,
        memberSince: user.createdAt,
        activeVouchers: user.vouchers?.length || 0
      },
      recentVisits: user.visits?.map(visit => ({
        date: visit.createdAt,
        sessionDuration: visit.sessionEnd ? 
          moment(visit.sessionEnd).diff(moment(visit.sessionStart), 'minutes') : null
      })) || [],
      activeVouchers: user.vouchers?.map(voucher => ({
        id: voucher.id,
        code: voucher.code,
        type: voucher.type,
        value: voucher.value,
        description: voucher.description,
        expiryDate: voucher.expiryDate,
        qrCode: voucher.qrCode
      })) || []
    };

  } catch (error) {
    logger.error('Error getting user loyalty summary', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Initialize default rewards in database
 */
async function initializeDefaultRewards() {
  try {
    for (const rewardData of DEFAULT_REWARDS) {
      const existingReward = await Reward.findOne({
        where: {
          name: rewardData.name,
          triggerType: rewardData.triggerType,
          triggerValue: rewardData.triggerValue
        }
      });

      if (!existingReward) {
        await Reward.create(rewardData);
        logger.info('Default reward created', { name: rewardData.name });
      }
    }

    logger.info('Default rewards initialization completed');

  } catch (error) {
    logger.error('Error initializing default rewards', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Get tier statistics for admin dashboard
 */
async function getTierStatistics() {
  try {
    const { User } = require('../models');
    const { Op } = require('sequelize');

    const stats = await User.findAll({
      attributes: [
        'loyaltyTier',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['loyaltyTier']
    });

    const tierStats = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0
    };

    stats.forEach(stat => {
      tierStats[stat.loyaltyTier] = parseInt(stat.dataValues.count) || 0;
    });

    return tierStats;
  } catch (error) {
    logger.error('Error getting tier statistics', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Award manual reward to user (admin function)
 */
async function awardManualReward(userId, rewardData, staffId = null) {
  try {
    const { User, Voucher } = require('../models');
    const { generateVoucher } = require('./vouchers');
    const { captureAuditLog, AUDIT_ACTIONS } = require('./audit');

    // Find the user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate voucher for the reward
    const voucher = await generateVoucher({
      userId: user.id,
      type: 'manual_reward',
      value: rewardData.value,
      description: rewardData.description || 'Manual reward from admin',
      validityDays: rewardData.validityDays || 30,
      metadata: {
        reason: rewardData.reason || 'Manual admin reward',
        awardedBy: staffId,
        isManual: true
      }
    });

    // Log the manual reward
    await captureAuditLog(
      AUDIT_ACTIONS.LOYALTY_REWARD_ISSUED,
      'voucher',
      voucher.id,
      userId,
      staffId,
      null,
      null,
      {
        type: 'manual_reward',
        value: rewardData.value,
        description: rewardData.description,
        reason: rewardData.reason,
        validityDays: rewardData.validityDays
      }
    );

    logger.info('Manual reward awarded', {
      userId,
      voucherId: voucher.id,
      value: rewardData.value,
      staffId
    });

    return voucher;

  } catch (error) {
    logger.error('Error awarding manual reward', {
      error: error.message,
      userId,
      rewardData
    });
    throw error;
  }
}

module.exports = {
  LOYALTY_TIERS,
  DEFAULT_REWARDS,
  calculateLoyaltyTier,
  getTierBenefits,
  calculateTierProgress,
  checkRewards,
  getUserLoyaltySummary,
  initializeDefaultRewards,
  getTierStatistics,
  awardManualReward
};