const mongoose = require('mongoose');

/**
 * ComplianceRule — dedicated collection for per-workspace content compliance rules.
 *
 * Separating rules into their own collection enables:
 *  - Rule versioning and audit history
 *  - Enterprise-scale rule libraries (100s of rules per org)
 *  - Efficient index-based querying without inflating the Workspace document
 */
const complianceRuleSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  createdBy: {
    type: String, // userId
    required: true,
  },

  // ─── Rule Identity ──────────────────────────────────────────────────────────
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: [
      'brand_safety',    // competitor/off-brand keywords
      'profanity',       // explicit language
      'link_safety',     // malicious or blocked URLs
      'platform_policy', // per-platform content rules
      'legal',           // legal disclaimers or prohibited claims
      'custom',          // user-defined catch-all
    ],
    required: true,
    index: true,
  },

  // ─── Rule Logic ─────────────────────────────────────────────────────────────
  ruleType: {
    type: String,
    enum: ['keyword_block', 'keyword_require', 'url_block', 'regex', 'platform_limit'],
    required: true,
  },

  // Keyword lists (for keyword_block and keyword_require rules)
  keywords: [{
    type: String,
    trim: true,
    lowercase: true,
  }],

  // Regex pattern string (for regex rules)
  pattern: {
    type: String,
  },

  // Blocked URL domains (for url_block rules)
  blockedDomains: [{
    type: String,
    trim: true,
    lowercase: true,
  }],

  // Platform-specific constraints (for platform_limit rules)
  platformConstraints: {
    platform: {
      type: String,
      enum: ['tiktok', 'instagram', 'twitter', 'youtube', 'linkedin', 'facebook', 'all'],
    },
    maxCharacters: Number,
    maxHashtags: Number,
    allowedMentionCount: Number,
    noExternalLinks: Boolean,
    requiredDisclaimer: String,
  },

  // ─── Enforcement ────────────────────────────────────────────────────────────
  severity: {
    type: String,
    enum: ['info', 'warning', 'error'],
    default: 'warning',
  },
  action: {
    type: String,
    enum: ['warn', 'block', 'flag_for_review'],
    default: 'warn',
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },

  // ─── Scope ──────────────────────────────────────────────────────────────────
  appliesTo: {
    contentTypes: {
      type: [String],
      enum: ['video', 'article', 'podcast', 'transcript', 'all'],
      default: ['all'],
    },
    platforms: {
      type: [String],
      default: ['all'],
    },
  },

  // ─── Metadata ───────────────────────────────────────────────────────────────
  triggerCount: {
    type: Number,
    default: 0, // auto-incremented when rule fires
  },
  lastTriggeredAt: Date,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound index: most common query pattern — active rules for a workspace
complianceRuleSchema.index({ workspaceId: 1, isActive: 1, category: 1 });

complianceRuleSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ComplianceRule', complianceRuleSchema);
