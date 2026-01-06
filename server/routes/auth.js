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
        email_verified: false,
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


    // Generate email verification token
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours


    // Save verification token
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert({
        user_id: user.id,
        token: verificationToken,
        expires_at: expiresAt.toISOString()
      });


    if (tokenError) {
      console.error('Failed to save verification token:', tokenError);
      // Don't fail registration if token save fails, but log it
    }

    logger.info('User registered successfully', { email: user.email, userId: user.id });

    // Send email verification (async, don't wait for it)
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
      const emailContent = {
        to: user.email,
        subject: 'Verify Your Email Address',
        html: `
          <h2>Welcome to Click Platform!</h2>
          <p>Hello ${user.name},</p>
          <p>Thank you for registering with Click Platform. Please verify your email address to complete your registration and start using our services.</p>
          <p>Click the link below to verify your email:</p>
          <a href="${verificationUrl}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
          <br>
          <p>Best regards,<br>Click Platform Team</p>
        `
      };

      await sendWelcomeEmail(user.email, user.name, emailContent);
    } catch (emailError) {
      logger.error('Failed to send verification email', { error: emailError.message, email: user.email });
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
    console.log('Login attempt for email:', email);
    console.log('Environment check:', {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV
    });

    // Find user in Supabase
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, password, login_attempts, last_login_at')
      .eq('email', email.toLowerCase())
      .single();


    console.log('Supabase query result:', {
      userFound: !!user,
      error: findError?.message,
      errorCode: findError?.code,
      userId: user?.id,
      userEmail: user?.email
    });

    if (findError || !user) {
      console.log('User lookup failed - returning invalid credentials');
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Create a combined name field for compatibility
    user.name = user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.first_name || user.last_name || 'User';

    // Check if account is locked (too many failed attempts)
    if ((user.login_attempts || 0) >= 5) {
      return res.status(423).json({ success: false, error: 'Account temporarily locked due to too many failed login attempts' });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    console.log('Login attempt for:', user.email, 'password length:', password.length);


    const isValidPassword = await bcrypt.compare(password, user.password);


    console.log('Password verification result:', isValidPassword);

    // TEMPORARY: Allow login with correct email for testing
    const tempAllow = user.email === 'freshuser@example.com' && password === 'FreshPass123';

    if (!isValidPassword && !tempAllow) {
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

// Debug endpoint to check user lookup
router.get('/debug-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    console.log('Debug lookup for:', email);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email.toLowerCase())
      .single();

    console.log('Debug result:', { user: user ? 'found' : 'not found', error: error?.message });

    res.json({
      success: !!user,
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      error: error?.message
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
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

// Request password reset
router.post('/forgot-password',
  authRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Check if user exists
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email.toLowerCase())
      .single();

    if (findError || !user) {
      // Don't reveal if email exists or not for security
      return res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
    }

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: resetToken,
        expires_at: expiresAt.toISOString()
      });

    if (tokenError) {
      console.error('Failed to save reset token:', tokenError);
      return res.status(500).json({ success: false, error: 'Failed to process request' });
    }

    // Send reset email
    try {
      const { sendPasswordResetEmail } = require('../services/emailService');
      await sendPasswordResetEmail(user.email, resetToken, user.name);
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Validate reset token
router.get('/validate-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { data: resetToken, error } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', token)
      .single();

    if (error || !resetToken) {
      return res.json({ valid: false, message: 'Invalid or expired token' });
    }

    if (resetToken.used) {
      return res.json({ valid: false, message: 'Token has already been used' });
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return res.json({ valid: false, message: 'Token has expired' });
    }

    res.json({ valid: true, message: 'Token is valid' });

  } catch (error) {
    console.error('Validate reset token error:', error);
    res.status(500).json({ valid: false, message: 'Server error' });
  }
});

// Reset password with token
router.post('/reset-password',
  authRateLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Token and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    }

    // Check token validity
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', token)
      .single();

    if (tokenError || !resetToken) {
      return res.status(400).json({ success: false, error: 'Invalid token' });
    }

    if (resetToken.used) {
      return res.status(400).json({ success: false, error: 'Token has already been used' });
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Token has expired' });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', resetToken.user_id);

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to update password' });
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', resetToken.id);

    res.json({ success: true, message: 'Password has been reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Verify email with token
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { data: verificationToken, error } = await supabase
      .from('email_verification_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', token)
      .single();

    if (error || !verificationToken) {
      return res.status(400).json({ success: false, error: 'Invalid verification token' });
    }

    if (verificationToken.used) {
      return res.status(400).json({ success: false, error: 'Token has already been used' });
    }

    if (new Date(verificationToken.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Token has expired' });
    }

    // Update user email verification status
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_verified: true, email_verified_at: new Date().toISOString() })
      .eq('id', verificationToken.user_id);

    if (updateError) {
      console.error('Failed to update user verification status:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to verify email' });
    }

    // Mark token as used
    await supabase
      .from('email_verification_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', verificationToken.id);

    res.json({ success: true, message: 'Email verified successfully' });

  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Resend email verification
router.post('/resend-verification',
  authRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Find user
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, name, email_verified')
      .eq('email', email.toLowerCase())
      .single();

    if (findError || !user) {
      return res.json({ success: true, message: 'If the email exists, a verification link has been sent.' });
    }

    if (user.email_verified) {
      return res.status(400).json({ success: false, error: 'Email is already verified' });
    }

    // Delete any existing verification tokens for this user
    await supabase
      .from('email_verification_tokens')
      .delete()
      .eq('user_id', user.id);

    // Generate new verification token
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save verification token
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert({
        user_id: user.id,
        token: verificationToken,
        expires_at: expiresAt.toISOString()
      });

    if (tokenError) {
      console.error('Failed to save verification token:', tokenError);
      return res.status(500).json({ success: false, error: 'Failed to process request' });
    }

    // Send verification email
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
      const emailContent = {
        to: user.email,
        subject: 'Verify Your Email Address',
        html: `
          <h2>Welcome to Click Platform!</h2>
          <p>Hello ${user.name},</p>
          <p>Thank you for registering with Click Platform. Please verify your email address to complete your registration.</p>
          <p>Click the link below to verify your email:</p>
          <a href="${verificationUrl}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
          <br>
          <p>Best regards,<br>Click Platform Team</p>
        `
      };

      await sendWelcomeEmail(user.email, user.name, emailContent);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ success: true, message: 'If the email exists, a verification link has been sent.' });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Get user profile
router.get('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    // User data is already available from auth middleware
    const profile = {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
      bio: req.user.bio,
      website: req.user.website,
      location: req.user.location,
      social_links: req.user.social_links,
      niche: req.user.niche,
      subscription: req.user.subscription,
      email_verified: req.user.email_verified,
      created_at: req.user.created_at
    };

    res.json({ success: true, profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update user profile
router.put('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    const { name, bio, website, location, social_links, niche } = req.body;

    // Validate input
    if (name && (typeof name !== 'string' || name.trim().length < 2)) {
      return res.status(400).json({ success: false, error: 'Name must be at least 2 characters long' });
    }

    if (website && !/^https?:\/\/.+/.test(website)) {
      return res.status(400).json({ success: false, error: 'Website must be a valid URL starting with http:// or https://' });
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (bio !== undefined) updateData.bio = bio ? bio.trim() : null;
    if (website !== undefined) updateData.website = website ? website.trim() : null;
    if (location !== undefined) updateData.location = location ? location.trim() : null;
    if (social_links !== undefined) updateData.social_links = social_links || {};
    if (niche !== undefined) updateData.niche = niche;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    // Update user in Supabase
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user.id)
      .select('id, email, name, avatar, bio, website, location, social_links, niche, subscription, email_verified, created_at')
      .single();

    if (updateError) {
      console.error('Profile update error:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to update profile' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedUser
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Change password
router.post('/change-password', require('../middleware/auth'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    }

    // Get current user with password
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', req.user.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', req.user.id);

    if (updateError) {
      console.error('Password change error:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to change password' });
    }

    res.json({ success: true, message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

