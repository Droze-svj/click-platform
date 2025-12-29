const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter');
const { authRateLimiter } = require('../middleware/security');
const { validateRegister, validateLogin } = require('../validators/authValidator');
const { sendWelcomeEmail } = require('../services/emailService');
const { logSecurityEvent, detectSuspiciousActivity } = require('../services/securityAuditService');
const logger = require('../utils/logger');
const router = express.Router();

// Apply rate limiting to auth routes
router.use(authLimiter);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 */
router.post('/register',
  authRateLimiter, validateRegister, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = new User({
      email,
      password,
      name,
      subscription: {
        status: 'trial',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7-day trial
      }
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Log security event
    await logSecurityEvent({
      userId: user._id,
      eventType: 'login',
      severity: 'low',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { action: 'registration' },
    });

    logger.info('User registered', { email: user.email, userId: user._id });
    
    // Send welcome email (async, don't wait for it)
    sendWelcomeEmail(user.email, user.name).catch(err => {
      logger.error('Failed to send welcome email', { error: err.message, email: user.email });
    });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          subscription: user.subscription
        }
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login',
  authRateLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Log failed login
      await logSecurityEvent({
        userId: user._id,
        eventType: 'login_failed',
        severity: 'medium',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { reason: 'Invalid password' },
      });

      // Check for suspicious activity
      const suspicious = await detectSuspiciousActivity(user._id, req.ip, 'login_failed');
      if (suspicious.suspicious) {
        logger.warn('Suspicious activity detected', { userId: user._id, suspicious });
      }

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check for suspicious activity before successful login
    const suspicious = await detectSuspiciousActivity(user._id, req.ip, 'login');
    if (suspicious.suspicious) {
      await logSecurityEvent({
        userId: user._id,
        eventType: 'suspicious_activity',
        severity: suspicious.reason === 'Multiple failed login attempts' ? 'high' : 'medium',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: suspicious,
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Log successful login
    await logSecurityEvent({
      userId: user._id,
      eventType: 'login',
      severity: 'low',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { suspicious: suspicious.suspicious },
    });

    // Update last login
    user.lastLogin = new Date();
    user.loginAttempts = 0;
    await user.save();

    logger.info('User logged in', { email: user.email, userId: user._id });
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          subscription: user.subscription,
          niche: user.niche
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current user
router.get('/me', require('../middleware/auth'), async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      subscription: req.user.subscription,
      niche: req.user.niche,
      brandSettings: req.user.brandSettings,
      usage: req.user.usage
    }
  });
});

module.exports = router;

