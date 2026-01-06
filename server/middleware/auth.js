const jwt = require('jsonwebtoken');

// Authentication middleware for JWT token verification
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
    console.log('🔐 Auth middleware called for:', req.path);
    const authHeader = String(req.header('Authorization') || '');
    const hasBearer = authHeader.startsWith('Bearer ');
    const token = hasBearer ? authHeader.slice('Bearer '.length) : '';

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    console.log('Auth middleware - decoded userId:', decoded.userId);

    // Get user from Supabase
    const { data: user, error: userError } = await getSupabaseClient()
      .from('users')
      .select('id, email, first_name, last_name, avatar, bio, website, location, social_links, email_verified, created_at')
      .eq('id', decoded.userId)
      .single();

    if (user) {
      // Create combined name field for compatibility
      user.name = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.first_name || user.last_name || 'User';
    }

    console.log('Auth middleware - Supabase query result:', { user: user ? user.email : null, error: userError });

    if (userError || !user) {
      console.log('Auth middleware - user not found, returning 401');
      return res.status(401).json({ error: 'User not found' });
    }

    // Check email verification status
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email verification required',
        emailVerified: false,
        message: 'Please verify your email address before accessing this feature.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ error: 'Invalid token', details: error.message });
  }
};

module.exports = auth;

