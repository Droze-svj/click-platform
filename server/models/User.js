const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true
  },
  whopUserId: {
    type: String,
    unique: true,
    sparse: true
  },
  subscription: {
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'trial'],
      default: 'trial'
    },
    plan: {
      type: String,
      enum: ['monthly', 'annual'],
      default: 'monthly'
    },
    startDate: Date,
    endDate: Date,
    whopSubscriptionId: String
  },
  niche: {
    type: String,
    enum: ['health', 'finance', 'education', 'technology', 'lifestyle', 'business', 'entertainment', 'other'],
    default: 'other'
  },
  brandSettings: {
    primaryColor: String,
    secondaryColor: String,
    logo: String,
    font: String
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  permissions: [{
    type: String
  }],
  membershipPackage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPackage'
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: String,
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  ssoProviders: [{
    type: String
  }],
  ssoId: String,
  // OAuth connections
  oauth: {
    twitter: {
      accessToken: String,
      refreshToken: String,
      connected: { type: Boolean, default: false },
      connectedAt: Date,
      lastRefreshed: Date,
      codeVerifier: String, // Temporary, for OAuth flow
      state: String, // Temporary, for OAuth flow
    },
    linkedin: {
      accessToken: String,
      refreshToken: String,
      connected: { type: Boolean, default: false },
      connectedAt: Date,
    },
    facebook: {
      accessToken: String,
      refreshToken: String,
      connected: { type: Boolean, default: false },
      connectedAt: Date,
    },
    youtube: {
      accessToken: String,
      refreshToken: String,
      connected: { type: Boolean, default: false },
      connectedAt: Date,
      expiresAt: Date,
      platformUserId: String,
      platformUsername: String,
      channelId: String,
      state: String, // Temporary, for OAuth flow
    },
    tiktok: {
      accessToken: String,
      refreshToken: String,
      connected: { type: Boolean, default: false },
      connectedAt: Date,
      expiresAt: Date,
      platformUserId: String,
      platformUsername: String,
      state: String, // Temporary, for OAuth flow
    },
    instagram: {
      accessToken: String,
      refreshToken: String,
      connected: { type: Boolean, default: false },
      connectedAt: Date,
    }
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },
  usage: {
    videosProcessed: { type: Number, default: 0 },
    contentGenerated: { type: Number, default: 0 },
    quotesCreated: { type: Number, default: 0 },
    postsScheduled: { type: Number, default: 0 },
    scriptsGenerated: { type: Number, default: 0 },
    musicFiles: { type: Number, default: 0 }
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referralStats: {
    totalReferrals: { type: Number, default: 0 },
    activeReferrals: { type: Number, default: 0 },
    totalRewards: { type: Number, default: 0 }
  },
  referralRewardCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromoCode'
  },
  // Privacy & GDPR Compliance
  privacy: {
    dataConsent: {
      type: Boolean,
      default: false
    },
    dataConsentDate: Date,
    marketingConsent: {
      type: Boolean,
      default: false
    },
    marketingConsentDate: Date,
    analyticsConsent: {
      type: Boolean,
      default: true
    },
    cookiesConsent: {
      type: Boolean,
      default: false
    },
    dataSharing: {
      type: Boolean,
      default: false
    }
  },
  anonymizedAt: Date,
  dataExportRequestedAt: Date,
  dataDeletionRequestedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Optimized indexes for common queries
// Note: email and whopUserId already have unique: true in field definition, so no need to index again
userSchema.index({ 'subscription.status': 1, 'subscription.endDate': 1 }); // Active subscriptions
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 }); // Recently active users
userSchema.index({ role: 1 }); // Users by role
userSchema.index({ 'subscription.status': 1, createdAt: -1 }); // Users by subscription status

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Increment login attempts
userSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

module.exports = mongoose.model('User', userSchema);

