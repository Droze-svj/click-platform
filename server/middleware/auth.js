const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check subscription status
    if (user.subscription.status !== 'active' && user.subscription.status !== 'trial') {
      return res.status(403).json({ 
        error: 'Subscription required',
        subscriptionStatus: user.subscription.status
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Add subscription status check to auth middleware
const { checkSubscriptionStatus } = require('./subscriptionAccess');

// Enhanced auth middleware that also checks subscription
const authWithSubscription = (req, res, next) => {
  auth(req, res, (err) => {
    if (err) return next(err);
    checkSubscriptionStatus(req, res, next);
  });
};

module.exports = auth;
module.exports.authWithSubscription = authWithSubscription;

