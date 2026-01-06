const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { authLimiter } = require('../middleware/enhancedRateLimiter');
const { authRateLimiter } = require('../middleware/security');
const { validateRegister, validateLogin } = require('../validators/authValidator');
const { sendWelcomeEmail } = require('../services/emailService');
// const { logSecurityEvent } = require('../services/securityAuditService');
const logger = require('../utils/logger');
const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Apply rate limiting to auth routes
// In local development, avoid locking yourself out while testing login/register.
if (process.env.NODE_ENV === 'production') {
  router.use(authLimiter);
}

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
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user in Supabase
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        subscription: {
          status: 'trial',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7-day trial
        }
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Supabase insert error', { error: insertError });
      return res.status(500).json({ success: false, error: 'Failed to create user' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    logger.info('User registered', { email: user.email, userId: user.id });
    
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
          id: user.id,
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
    console.log('Login attempt for:', req.body.email);

    const { email, password } = req.body;

    // Find user in Supabase
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (findError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Check password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );


    // Temporarily disable security logging to debug suspicious error
    // await logSecurityEvent({
    //   userId: user.id,
    //   eventType: 'login',
    //   severity: 'low',
    //   ipAddress: req.ip,
    //   userAgent: req.get('user-agent'),
    //   details: { action: 'successful_login' },
    // });

    // Update last login in Supabase
    await supabase
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        login_attempts: 0
      })
      .eq('id', user.id);

    logger.info('User logged in successfully', { email: user.email, userId: user.id });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
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
  // Prevent any caching / 304 Not Modified behavior for auth state.

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

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

