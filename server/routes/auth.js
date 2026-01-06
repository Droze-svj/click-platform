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
        },
        login_attempts: 0
      })
      .select('id, email, name, subscription, niche, avatar, bio, website, location, social_links, email_verified, created_at')
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

    logger.info('User registered successfully', { email: user.email, userId: user.id });

    // Send welcome email (async, don't wait for it)
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      logger.error('Failed to send welcome email', { error: emailError.message, email: user.email });
      // Don't fail registration if email fails
    }
    
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
    const { email, password } = req.body;

    // Find user in Supabase
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, name, password, subscription, niche, login_attempts, last_login_at')
      .eq('email', email.toLowerCase())
      .single();

    if (findError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Check if account is locked (too many failed attempts)
    if (user.login_attempts >= 5) {
      return res.status(423).json({ success: false, error: 'Account temporarily locked due to too many failed login attempts' });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      // Increment login attempts
      await supabase
        .from('users')
        .update({
          login_attempts: (user.login_attempts || 0) + 1
        })
        .eq('id', user.id);

      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Successful login - reset attempts and update last login
    await supabase
      .from('users')
      .update({
        login_attempts: 0,
        last_login_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '30d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    logger.info('User logged in successfully', { email: user.email, userId: user.id });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: userWithoutPassword
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
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
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      subscription: req.user.subscription,
      niche: req.user.niche,
      avatar: req.user.avatar,
      bio: req.user.bio,
      website: req.user.website,
      location: req.user.location,
      social_links: req.user.social_links,
      email_verified: req.user.email_verified,
      created_at: req.user.created_at
    }
  });
});

module.exports = router;

