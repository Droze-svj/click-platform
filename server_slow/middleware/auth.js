const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getDevUserObjectId, allowDevMode: computeAllowDevMode } = require('../utils/devUser');
const { getDatabaseHealth } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Enhanced Authentication Middleware (Unified Mongoose Architecture)
 * Validates JWT tokens against the production MongoDB database.
 * Supports frictionless development sessions for localhost.
 */
const auth = async (req, res, next) => {
  try {
    const allowDevMode = computeAllowDevMode(req);
    const authHeader = String(req.header('Authorization') || '');
    const hasBearer = authHeader.startsWith('Bearer ');
    const token = hasBearer ? authHeader.slice('Bearer '.length) : '';

    // Enhanced logging for development/localhost
    if (allowDevMode) {
      const path = req.path || req.url || '';
      if (!token) {
        logger.debug('🔧 [Auth] No token provided for:', path);
      } else {
        const isDevToken = token.startsWith('dev-jwt-token-');
        logger.debug('🔧 [Auth] Token received for:', path, { isDevToken });
      }
    }

    if (!token) {
      // frictionless development sessions for localhost
      // Allows testing 401s by passing X-Force-Auth-Check
      const forceCheck = req.header('X-Force-Auth-Check') === 'true';
      if (allowDevMode && !forceCheck) {
        logger.warn('🔧 [Auth] Automatically attaching mock admin for localhost dev session.');
        req.user = {
          _id: getDevUserObjectId('dev-user-123'),
          id: 'dev-user-123',
          email: 'admin@example.com',
          role: 'admin',
          subscription: { status: 'active', tier: 'elite' },
          isDevUser: true
        };
        return next();
      }
      return res.status(401).json({ error: 'No token provided' });
    }

    let decoded;
    if (allowDevMode && token.startsWith('dev-jwt-token-')) {
      decoded = {
        userId: 'dev-user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
      };
    } else {
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token', details: err.message });
      }
    }

    // Determine which user ID to use (handle mock dev IDs)
    const rawUserId = decoded.userId;
    const devObjectId = getDevUserObjectId(rawUserId);
    const userId = devObjectId || rawUserId;

    // Get user from MongoDB (Mongoose) - Primary Legacy/Dev Source
    let user = null;
    const health = getDatabaseHealth();
    const isDbConnected = health.status === 'connected';
    const isMongoConnected = health.mongodb;

    if (mongoose.Types.ObjectId.isValid(userId)) {
      if (isMongoConnected) {
        user = await User.findById(userId).select('-password');
      } else if (allowDevMode) {
        logger.warn('🔧 [Auth] Database not connected. Skipping lookup and using mock fallback for dev.');
      }
    }

    // Fallback to Supabase - Primary Production Source
    if (!user && isDbConnected) {
      const { supabase, isSupabaseConfigured } = require('../config/supabase');
      if (isSupabaseConfigured()) {
        try {
          const { data, error: sbError } = await supabase
            .from('users')
            .select('id, email, first_name, last_name, subscription, niche, avatar, bio, website, location, social_links, email_verified, created_at')
            .eq('id', userId)
            .single();
          
          if (data && !sbError) {
            user = data;
            // Map Supabase fields to Mongoose-style fields for compatibility
            user._id = data.id;
            user.name = `${data.first_name} ${data.last_name}`;
          }
        } catch (sbCatchError) {
          logger.warn('🔧 [Auth] Supabase lookup failed', { error: sbCatchError.message });
        }
      }
    }

    if (!user) {
      if (allowDevMode && devObjectId) {
        // Frictionless dev user attachment with stable ID
        req.user = {
          _id: devObjectId,
          id: rawUserId,
          email: 'admin@example.com',
          role: 'admin',
          subscription: { status: 'active', tier: 'elite' },
          isDevUser: true
        };
        req.allowDevMode = true;
        return next();
      }
      return res.status(401).json({ error: 'User not found in production database' });
    }

    // Attach user to request
    req.user = user;
    req.allowDevMode = allowDevMode;

    // Check email verification (skipped in dev mode)
    if (!user.email_verified && !allowDevMode) {
      return res.status(403).json({
        error: 'Email verification required',
        emailVerified: false,
        message: 'Please verify your email address before accessing this feature.'
      });
    }

    // Log successful auth in development or localhost
    if (allowDevMode) {
      logger.debug('🔧 [Auth] Authentication successful', { userId: user._id, email: user.email });
    }

    next();
  } catch (error) {
    logger.error('🔧 [Auth] Authentication failed', { error: error.message });
    return res.status(401).json({ error: 'Authentication failed', details: error.message });
  }
};

module.exports = auth;
module.exports.authenticate = auth;
module.exports.authenticateToken = auth;
