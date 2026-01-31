const jwt = require('jsonwebtoken');

// Initialize Supabase client lazily
const getSupabaseClient = () => {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

const auth = async (req, res, next) => {
  try {
    // Check if running on localhost - declare once and reuse
    // Check both host header and x-forwarded-host (for proxy requests)
    // Also check the original URL or referer for localhost detection
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const referer = req.headers.referer || req.headers.origin || '';
    const forwardedFor = req.headers['x-forwarded-for'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || 
                        referer.includes('localhost') || referer.includes('127.0.0.1') ||
                        (typeof forwardedFor === 'string' && (forwardedFor.includes('127.0.0.1') || forwardedFor.includes('localhost')));
    // Always allow dev mode when NODE_ENV is not production OR when on localhost
    // If NODE_ENV is undefined/null/empty, treat as dev mode
    const nodeEnv = process.env.NODE_ENV;
    const allowDevMode = !nodeEnv || nodeEnv !== 'production' || isLocalhost;

    const authHeader = String(req.header('Authorization') || '');
    const hasBearer = authHeader.startsWith('Bearer ');
    const token = hasBearer ? authHeader.slice('Bearer '.length) : '';

    // Enhanced logging for development/localhost to help diagnose 401 errors
    if (allowDevMode || isLocalhost) {
      const path = req.path || req.url || '';
      if (!token) {
        console.warn('🔧 [Auth] No token provided for:', path, {
          hasAuthHeader: !!authHeader,
          authHeaderLength: authHeader.length,
          nodeEnv: process.env.NODE_ENV || 'undefined',
          allowDevMode,
          isLocalhost,
          headers: {
            authorization: req.headers.authorization ? 'present' : 'missing',
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-forwarded-host': req.headers['x-forwarded-host'],
            host: req.headers.host,
            referer: req.headers.referer
          }
        });
      } else {
        const isDevToken = token.startsWith('dev-jwt-token-');
        console.log('🔧 [Auth] Token received for:', path, {
          tokenPrefix: token.substring(0, 20) + '...',
          isDevToken,
          tokenLength: token.length,
          nodeEnv: process.env.NODE_ENV || 'undefined',
          allowDevMode,
          isLocalhost
        });
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Handle development mock tokens
    // Allow dev tokens in non-production OR when running on localhost
    let decoded;
    
    if (allowDevMode && token.startsWith('dev-jwt-token-')) {
      // Mock token for development - create decoded payload directly
      decoded = {
        userId: 'dev-user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      };
    } else {
      // Normal JWT verification
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    }

    // Get user from Supabase
    let user = null;
    let userError = null;

    try {
      const supabase = getSupabaseClient();
      const result = await supabase
        .from('users')
        .select('id, email, first_name, last_name, avatar, bio, website, location, social_links, email_verified, created_at')
        .eq('id', decoded.userId)
        .single();

      user = result.data;
      userError = result.error;
    } catch (supabaseErr) {
      console.log('Supabase not available for user lookup');
    }

    // Handle development users
    // Allow dev users in non-production OR when running on localhost
    if (userError || !user) {
      if (allowDevMode) {
        // Create development user from JWT token
        if (decoded.userId === 'dev-user-123') {
          user = {
            id: 'dev-user-123',
            email: 'admin@example.com',
            first_name: 'Admin',
            last_name: 'User',
            avatar: null,
            bio: null,
            website: null,
            location: null,
            social_links: null,
            email_verified: true,
            created_at: new Date().toISOString(),
            name: 'Admin User',
            subscription: {
              status: 'active',
              plan: 'monthly',
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            }
          };
        } else if (decoded.userId === 'test-user-456') {
          user = {
            id: 'test-user-456',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            avatar: null,
            bio: null,
            website: null,
            location: null,
            social_links: null,
            email_verified: true,
            created_at: new Date().toISOString(),
            name: 'Test User',
            subscription: {
              status: 'active',
              plan: 'monthly',
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            }
          };
        } else {
          return res.status(401).json({ error: 'User not found' });
        }
      } else {
        return res.status(401).json({ error: 'User not found' });
      }
    }

    // Create combined name field for compatibility
    user.name = user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.first_name || user.last_name || 'User';

    // Check email verification status
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email verification required',
        emailVerified: false,
        message: 'Please verify your email address before accessing this feature.'
      });
    }

    // Add _id as alias for id for MongoDB compatibility
    // Many routes expect req.user._id but Supabase uses id
    user._id = user.id;

    req.user = user;
    
    // Log successful auth in development or localhost
    if (allowDevMode) {
      const path = req.path || req.url || '';
      console.log('🔧 [Auth] Authentication successful for:', path, {
        userId: user.id,
        email: user.email,
        isDevUser: user.id.startsWith('dev-')
      });
    }
    
    next();
  } catch (error) {
    // Enhanced error logging for development/localhost
    const isLocalhostForErrorLogging = (req.headers.host || '').includes('localhost') || 
                                        (req.headers.host || '').includes('127.0.0.1');
    const allowDevModeForError = process.env.NODE_ENV !== 'production' || isLocalhostForErrorLogging;
    if (allowDevModeForError) {
      const path = req.path || req.url || '';
      console.error('🔧 [Auth] Authentication failed for:', path, {
        error: error.message,
        stack: error.stack
      });
    }
    return res.status(401).json({ error: 'Invalid token', details: error.message });
  }
};

module.exports = auth;
module.exports.authenticate = auth;
