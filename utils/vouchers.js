const QRCode = require('qrcode');
const JsBarcode = require('jsbarcode');
const { createCanvas } = require('canvas');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { Voucher, User } = require('../models');
const { captureAuditLog, AUDIT_ACTIONS } = require('./audit');
const logger = require('./logger');

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'localhost',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
};

let transporter = null;

// Initialize email transporter
function initializeEmailTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransporter(emailConfig);
  }
  return transporter;
}

/**
 * Generate a unique voucher code
 */
function generateVoucherCode(type = 'reward') {
  const prefix = {
    'reward': 'RW',
    'premium_wifi': 'PW',
    'staff_wifi': 'SW',
    'promotional': 'PR'
  }[type] || 'VC';

  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  return `${prefix}${timestamp}${random}`;
}

/**
 * Generate QR code for voucher
 */
async function generateQRCode(voucherCode, additionalData = {}) {
  try {
    const qrData = {
      code: voucherCode,
      type: 'lslt_voucher',
      timestamp: Date.now(),
      ...additionalData
    };

    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });

    return qrCodeDataURL;
  } catch (error) {
    logger.error('Error generating QR code', {
      error: error.message,
      voucherCode
    });
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate barcode for voucher
 */
async function generateBarcode(voucherCode) {
  try {
    const canvas = createCanvas(200, 50);
    JsBarcode(canvas, voucherCode, {
      format: "CODE128",
      width: 2,
      height: 40,
      displayValue: true,
      fontSize: 12
    });

    return canvas.toDataURL();
  } catch (error) {
    logger.error('Error generating barcode', {
      error: error.message,
      voucherCode
    });
    throw new Error('Failed to generate barcode');
  }
}

/**
 * Generate voucher with QR code and barcode
 */
async function generateVoucher(options) {
  try {
    const {
      type,
      userId,
      staffId,
      value,
      description,
      validityDays = 30,
      receiptNumber,
      saleAmount
    } = options;

    // Generate unique code
    const code = generateVoucherCode(type);
    
    // Calculate expiry date
    const expiryDate = moment().add(validityDays, 'days').toDate();

    // Generate QR code and barcode
    const qrCode = await generateQRCode(code, { 
      type, 
      value, 
      userId,
      expiryDate: expiryDate.toISOString()
    });
    
    const barcode = await generateBarcode(code);

    // Create voucher in database
    const voucher = await Voucher.create({
      code,
      type,
      userId,
      staffId,
      value,
      description,
      expiryDate,
      qrCode,
      barcode,
      receiptNumber,
      saleAmount
    });

    logger.info('Voucher generated successfully', {
      voucherId: voucher.id,
      code,
      type,
      userId,
      staffId,
      validityDays
    });

    await captureAuditLog(
      AUDIT_ACTIONS.VOUCHER_CREATED,
      'voucher',
      voucher.id,
      userId,
      staffId,
      null,
      null,
      {
        code,
        type,
        value,
        validityDays,
        receiptNumber,
        saleAmount
      }
    );

    return {
      id: voucher.id,
      code,
      type,
      value,
      description,
      expiryDate,
      qrCode,
      barcode,
      isRedeemed: false
    };

  } catch (error) {
    logger.error('Error generating voucher', {
      error: error.message,
      options
    });
    throw error;
  }
}

/**
 * Redeem voucher by code
 */
async function redeemVoucher(voucherCode, staffId, ipAddress = null, userAgent = null) {
  try {
    // Find voucher
    const voucher = await Voucher.findOne({
      where: { code: voucherCode },
      include: [
        {
          model: User,
          as: 'user',
          required: false
        }
      ]
    });

    if (!voucher) {
      return {
        success: false,
        error: 'Voucher not found',
        message: 'Invalid voucher code'
      };
    }

    // Check if already redeemed
    if (voucher.isRedeemed) {
      return {
        success: false,
        error: 'Voucher already redeemed',
        message: 'This voucher has already been used',
        redeemedAt: voucher.redeemedAt,
        redeemedBy: voucher.redeemedBy
      };
    }

    // Check if expired
    if (moment().isAfter(moment(voucher.expiryDate))) {
      return {
        success: false,
        error: 'Voucher expired',
        message: 'This voucher has expired',
        expiryDate: voucher.expiryDate
      };
    }

    // Mark as redeemed
    await voucher.update({
      isRedeemed: true,
      redeemedAt: new Date(),
      redeemedBy: staffId
    });

    logger.info('Voucher redeemed successfully', {
      voucherId: voucher.id,
      code: voucherCode,
      type: voucher.type,
      value: voucher.value,
      userId: voucher.userId,
      staffId,
      ipAddress
    });

    await captureAuditLog(
      AUDIT_ACTIONS.VOUCHER_REDEEMED,
      'voucher',
      voucher.id,
      voucher.userId,
      staffId,
      ipAddress,
      userAgent,
      {
        code: voucherCode,
        type: voucher.type,
        value: voucher.value,
        originalExpiryDate: voucher.expiryDate
      }
    );

    return {
      success: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        type: voucher.type,
        value: voucher.value,
        description: voucher.description,
        redeemedAt: voucher.redeemedAt,
        user: voucher.user ? {
          name: voucher.user.name,
          email: voucher.user.email,
          loyaltyTier: voucher.user.loyaltyTier
        } : null
      }
    };

  } catch (error) {
    logger.error('Error redeeming voucher', {
      error: error.message,
      voucherCode,
      staffId
    });

    await captureAuditLog(
      'VOUCHER_REDEEM_ERROR',
      'voucher',
      null,
      null,
      staffId,
      ipAddress,
      userAgent,
      {
        error: error.message,
        voucherCode
      },
      'error'
    );

    throw error;
  }
}

/**
 * Send welcome email with voucher
 */
async function sendWelcomeEmail(user, voucher) {
  try {
    const transporter = initializeEmailTransporter();

    const subject = user.language === 'es' ? 
      '¡Bienvenido a nuestra red WiFi!' : 
      'Welcome to our WiFi network!';

    const htmlContent = generateWelcomeEmailHTML(user, voucher);
    const textContent = generateWelcomeEmailText(user, voucher);

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@lslt-portal.local',
      to: user.email,
      subject,
      text: textContent,
      html: htmlContent,
      attachments: [
        {
          filename: 'voucher-qr.png',
          content: voucher.qrCode.split(',')[1],
          encoding: 'base64',
          cid: 'voucher-qr'
        }
      ]
    };

    const result = await transporter.sendMail(mailOptions);

    logger.info('Welcome email sent successfully', {
      userId: user.id,
      email: user.email,
      voucherId: voucher.id,
      messageId: result.messageId
    });

    await captureAuditLog(
      'WELCOME_EMAIL_SENT',
      'user',
      user.id,
      user.id,
      null,
      null,
      null,
      {
        email: user.email,
        voucherId: voucher.id,
        messageId: result.messageId
      }
    );

    return result;

  } catch (error) {
    logger.error('Error sending welcome email', {
      error: error.message,
      userId: user.id,
      email: user.email
    });
    throw error;
  }
}

/**
 * Generate welcome email HTML content
 */
function generateWelcomeEmailHTML(user, voucher) {
  const isSpanish = user.language === 'es';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isSpanish ? 'Bienvenido' : 'Welcome'}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
            .welcome-text { font-size: 18px; color: #333; margin-bottom: 20px; }
            .voucher-section { background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .voucher-title { font-size: 20px; font-weight: bold; color: #1e40af; margin-bottom: 15px; }
            .voucher-value { font-size: 24px; font-weight: bold; color: #059669; margin-bottom: 15px; }
            .qr-code { margin: 20px 0; }
            .voucher-code { font-family: monospace; font-size: 16px; background-color: #e5e7eb; padding: 8px 12px; border-radius: 4px; margin: 10px 0; }
            .expiry-info { font-size: 14px; color: #6b7280; margin-top: 15px; }
            .loyalty-info { background-color: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">LSLT WiFi Portal</div>
                <h1 class="welcome-text">
                    ${isSpanish ? `¡Hola ${user.name}!` : `Hello ${user.name}!`}
                </h1>
            </div>
            
            <p>${isSpanish ? 
                'Gracias por registrarte en nuestra red WiFi. ¡Estamos emocionados de tenerte como parte de nuestra comunidad!' : 
                'Thank you for signing up for our WiFi network. We\'re excited to have you as part of our community!'
            }</p>
            
            <div class="voucher-section">
                <div class="voucher-title">
                    ${isSpanish ? '🎉 ¡Tu Voucher de Bienvenida!' : '🎉 Your Welcome Voucher!'}
                </div>
                <div class="voucher-value">${voucher.value}</div>
                <p>${voucher.description}</p>
                
                <div class="qr-code">
                    <img src="cid:voucher-qr" alt="QR Code" style="width: 200px; height: 200px;">
                </div>
                
                <div class="voucher-code">
                    ${isSpanish ? 'Código:' : 'Code:'} ${voucher.code}
                </div>
                
                <div class="expiry-info">
                    ${isSpanish ? 'Válido hasta:' : 'Valid until:'} ${moment(voucher.expiryDate).format('MMMM DD, YYYY')}
                </div>
            </div>
            
            <div class="loyalty-info">
                <h3>${isSpanish ? '🏆 Programa de Lealtad' : '🏆 Loyalty Program'}</h3>
                <p>${isSpanish ? 
                    'Estás en el nivel Bronce. Visítanos 5 veces para alcanzar el nivel Plata y desbloquear más beneficios.' : 
                    'You\'re at Bronze level. Visit us 5 times to reach Silver level and unlock more benefits.'
                }</p>
            </div>
            
            <p>${isSpanish ? 
                'Para canjear tu voucher, simplemente muestra este código QR o el código a cualquier miembro del personal.' : 
                'To redeem your voucher, simply show this QR code or the code to any staff member.'
            }</p>
            
            <div class="footer">
                <p>${isSpanish ? 
                    'Este es un email automático. Por favor no respondas a este mensaje.' : 
                    'This is an automated email. Please do not reply to this message.'
                }</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

/**
 * Generate welcome email text content
 */
function generateWelcomeEmailText(user, voucher) {
  const isSpanish = user.language === 'es';
  
  return `
${isSpanish ? `¡Hola ${user.name}!` : `Hello ${user.name}!`}

${isSpanish ? 
  'Gracias por registrarte en nuestra red WiFi. ¡Estamos emocionados de tenerte como parte de nuestra comunidad!' : 
  'Thank you for signing up for our WiFi network. We\'re excited to have you as part of our community!'
}

${isSpanish ? '🎉 ¡Tu Voucher de Bienvenida!' : '🎉 Your Welcome Voucher!'}

${voucher.value}
${voucher.description}

${isSpanish ? 'Código:' : 'Code:'} ${voucher.code}
${isSpanish ? 'Válido hasta:' : 'Valid until:'} ${moment(voucher.expiryDate).format('MMMM DD, YYYY')}

${isSpanish ? '🏆 Programa de Lealtad' : '🏆 Loyalty Program'}
${isSpanish ? 
  'Estás en el nivel Bronce. Visítanos 5 veces para alcanzar el nivel Plata y desbloquear más beneficios.' : 
  'You\'re at Bronze level. Visit us 5 times to reach Silver level and unlock more benefits.'
}

${isSpanish ? 
  'Para canjear tu voucher, simplemente muestra este código o el código QR a cualquier miembro del personal.' : 
  'To redeem your voucher, simply show this code or the QR code to any staff member.'
}

${isSpanish ? 
  'Este es un email automático. Por favor no respondas a este mensaje.' : 
  'This is an automated email. Please do not reply to this message.'
}
  `;
}

/**
 * Get user's active vouchers
 */
async function getUserVouchers(userId) {
  try {
    const vouchers = await Voucher.findAll({
      where: {
        userId,
        isRedeemed: false,
        expiryDate: {
          [require('sequelize').Op.gt]: new Date()
        }
      },
      order: [['createdAt', 'DESC']]
    });

    return vouchers.map(voucher => ({
      id: voucher.id,
      code: voucher.code,
      type: voucher.type,
      value: voucher.value,
      description: voucher.description,
      expiryDate: voucher.expiryDate,
      qrCode: voucher.qrCode,
      barcode: voucher.barcode,
      createdAt: voucher.createdAt
    }));

  } catch (error) {
    logger.error('Error getting user vouchers', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Expire old vouchers (cleanup job)
 */
async function expireOldVouchers() {
  try {
    const { Op } = require('sequelize');
    
    const expiredVouchers = await Voucher.findAll({
      where: {
        isRedeemed: false,
        expiryDate: {
          [Op.lt]: new Date()
        }
      }
    });

    for (const voucher of expiredVouchers) {
      await captureAuditLog(
        AUDIT_ACTIONS.VOUCHER_EXPIRED,
        'voucher',
        voucher.id,
        voucher.userId,
        null,
        null,
        null,
        {
          code: voucher.code,
          type: voucher.type,
          value: voucher.value,
          expiryDate: voucher.expiryDate
        }
      );
    }

    logger.info('Expired vouchers processed', {
      count: expiredVouchers.length
    });

    return expiredVouchers.length;

  } catch (error) {
    logger.error('Error expiring old vouchers', {
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  generateVoucher,
  redeemVoucher,
  sendWelcomeEmail,
  getUserVouchers,
  expireOldVouchers,
  generateVoucherCode,
  generateQRCode,
  generateBarcode
};