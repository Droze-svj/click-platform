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
    const authHeader = String(req.header('Authorization') || '');
    const hasBearer = authHeader.startsWith('Bearer ');
    const token = hasBearer ? authHeader.slice('Bearer '.length) : '';

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');

    // Get user from Supabase
    const supabase = getSupabaseClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, avatar, bio, website, location, social_links, email_verified, created_at')
      .eq('id', decoded.userId)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'User not found' });
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

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token', details: error.message });
  }
};

module.exports = auth;
