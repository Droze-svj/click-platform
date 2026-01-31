// AI Template Model
// Reusable AI prompts with guardrails and brand rules

const mongoose = require('mongoose');

const guardrailRuleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'avoid_phrase',
      'require_phrase',
      'tone_requirement',
      'length_requirement',
      'hashtag_requirement',
      'cta_requirement',
      'brand_voice',
      'style_requirement',
      'compliance_requirement'
    ],
    required: true
  },
  value: {
    type: String,
    required: true
  },
  description: String,
  severity: {
    type: String,
    enum: ['warning', 'error', 'block'],
    default: 'warning'
  }
});

const aiTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace'
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  // Base prompt
  prompt: {
    type: String,
    required: true
  },
  // System message/instructions
  systemMessage: String,
  // Guardrails and rules
  guardrails: [guardrailRuleSchema],
  // Brand style guidelines
  brandStyle: {
    tone: {
      type: String,
      enum: ['professional', 'casual', 'friendly', 'formal', 'humorous', 'authoritative', 'conversational'],
      default: 'professional'
    },
    voice: String, // Description of brand voice
    doUse: [String], // Phrases/words to use
    dontUse: [String], // Phrases/words to avoid
    alwaysInclude: [String], // Always include these elements
    neverInclude: [String], // Never include these elements
    ctaStyle: String, // CTA style preference
    hashtagStyle: String // Hashtag style preference
  },
  // Content rules
  contentRules: {
    minLength: Number,
    maxLength: Number,
    requireHashtags: { type: Boolean, default: false },
    minHashtags: Number,
    maxHashtags: Number,
    requireCTA: { type: Boolean, default: false },
    ctaPlacement: {
      type: String,
      enum: ['beginning', 'middle', 'end', 'anywhere'],
      default: 'end'
    }
  },
  // Platform-specific rules
  platformRules: {
    twitter: mongoose.Schema.Types.Mixed,
    linkedin: mongoose.Schema.Types.Mixed,
    facebook: mongoose.Schema.Types.Mixed,
    instagram: mongoose.Schema.Types.Mixed,
    youtube: mongoose.Schema.Types.Mixed,
    tiktok: mongoose.Schema.Types.Mixed
  },
  // Template settings
  settings: {
    temperature: { type: Number, min: 0, max: 2, default: 0.7 },
    maxTokens: { type: Number, default: 500 },
    topP: { type: Number, min: 0, max: 1, default: 1 },
    frequencyPenalty: { type: Number, min: -2, max: 2, default: 0 },
    presencePenalty: { type: Number, min: -2, max: 2, default: 0 }
  },
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date,
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

aiTemplateSchema.index({ agencyWorkspaceId: 1, clientWorkspaceId: 1 });
aiTemplateSchema.index({ agencyWorkspaceId: 1, isDefault: 1, isActive: 1 });

aiTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AITemplate', aiTemplateSchema);


