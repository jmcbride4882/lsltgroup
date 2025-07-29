const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;

// Import models and utilities
const { sequelize } = require('./models');
const logger = require('./utils/logger');
const { captureAuditLog } = require('./utils/audit');
const { initializeSettings } = require('./utils/settings');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const staffRoutes = require('./routes/staff');
const adminRoutes = require('./routes/admin');
const voucherRoutes = require('./routes/vouchers');
const loyaltyRoutes = require('./routes/loyalty');
const printerRoutes = require('./routes/printers');
const unifiRoutes = require('./routes/unifi');
const campaignRoutes = require('./routes/campaigns');
const reportRoutes = require('./routes/reports');

// Import middleware
const authMiddleware = require('./middleware/auth');
const captiveMiddleware = require('./middleware/captive');
const abuseMiddleware = require('./middleware/abuse');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Configuration
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: NODE_ENV === 'production' ? 
    ['https://lslt-portal.local', 'https://192.168.1.1'] : 
    ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting - different rates for different endpoints
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    captureAuditLog('RATE_LIMIT_EXCEEDED', 'request', null, null, null, req.ip, req.get('User-Agent'), {
      path: req.path,
      method: req.method
    }, 'warning');
    res.status(429).json({ error: message });
  }
});

// Apply different rate limits
app.use('/api/auth', createRateLimit(15 * 60 * 1000, 10, 'Too many authentication attempts'));
app.use('/api/staff', createRateLimit(15 * 60 * 1000, 20, 'Too many staff actions'));
app.use('/api/admin', createRateLimit(15 * 60 * 1000, 50, 'Too many admin actions'));
app.use('/api', createRateLimit(15 * 60 * 1000, 100, 'Too many API requests'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Response', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });

  next();
});

// Captive portal detection middleware (for guest WiFi)
app.use(captiveMiddleware);

// Abuse detection middleware
app.use(abuseMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    environment: NODE_ENV
  });
});

// Captive portal detection endpoints
app.get('/generate_204', (req, res) => res.status(204).end());
app.get('/hotspot-detect.html', (req, res) => res.redirect('/portal'));
app.get('/library/test/success.html', (req, res) => res.redirect('/portal'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/staff', authMiddleware.validateStaff, staffRoutes);
app.use('/api/admin', authMiddleware.validateAdmin, adminRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/printers', authMiddleware.validateStaff, printerRoutes);
app.use('/api/unifi', authMiddleware.validateAdmin, unifiRoutes);
app.use('/api/campaigns', authMiddleware.validateAdmin, campaignRoutes);
app.use('/api/reports', authMiddleware.validateStaff, reportRoutes);

// Serve static files for the React frontend
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'frontend/dist')));
  
  // Handle React Router - send all non-API requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
  });
} else {
  // Development mode - serve from React dev server
  app.get('*', (req, res) => {
    res.json({
      message: 'LSLT Portal API Server',
      version: require('./package.json').version,
      endpoints: {
        portal: 'http://localhost:3000',
        api: `http://localhost:${PORT}/api`,
        docs: `http://localhost:${PORT}/api/docs`
      }
    });
  });
}

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  logger.info('Client connected to WebSocket', { socketId: socket.id });

  socket.on('join-staff-room', (staffId) => {
    socket.join(`staff-${staffId}`);
    logger.info('Staff joined room', { staffId, socketId: socket.id });
  });

  socket.on('join-admin-room', () => {
    socket.join('admin');
    logger.info('Admin joined room', { socketId: socket.id });
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected from WebSocket', { socketId: socket.id });
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  captureAuditLog('ERROR', 'server', null, null, null, req.ip, req.get('User-Agent'), {
    error: err.message,
    stack: err.stack,
    path: req.path
  }, 'error');

  if (NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ 
      error: err.message,
      stack: err.stack 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Database initialization and server startup
async function startServer() {
  try {
    // Create data directory if it doesn't exist
    await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true });
    await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });

    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Sync database models (create tables if they don't exist)
    if (NODE_ENV === 'development') {
      await sequelize.sync({ force: false, alter: true });
      logger.info('Database models synchronized');
    } else {
      await sequelize.sync({ force: false });
      logger.info('Database models loaded');
    }

    // Initialize default settings
    try {
      await initializeSettings();
      logger.info('Default settings initialized');
    } catch (error) {
      logger.warn('Failed to initialize settings', { error: error.message });
    }

    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`LSLT WiFi Loyalty Portal server started`, {
        port: PORT,
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
      });

      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    LSLT WiFi Loyalty Portal                 ║
║                                                              ║
║  Server running on: http://localhost:${PORT}                    ║
║  Environment: ${NODE_ENV.padEnd(47)} ║
║  Database: SQLite (./data/lslt_portal.db)                   ║
║                                                              ║
║  Guest Portal: http://localhost:${PORT}/portal                 ║
║  Staff Portal: http://localhost:${PORT}/staff                  ║
║  Admin Portal: http://localhost:${PORT}/admin                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    sequelize.close().then(() => {
      logger.info('Database connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    sequelize.close().then(() => {
      logger.info('Database connection closed');
      process.exit(0);
    });
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack
  });
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Export app and io for testing
module.exports = { app, server, io };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}