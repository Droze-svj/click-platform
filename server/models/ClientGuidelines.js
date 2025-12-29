// Client Guidelines Model
// Brand guidelines and content rules per client workspace

const mongoose = require('mongoose');

const clientGuidelinesSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true,
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  branding: {
    logo: String,
    logoVariations: [String],
    primaryColor: String,
    secondaryColor: String,
    accentColor: String,
    font: String,
    fontFamily: String,
    brandVoice: String,
    brandTone: {
      type: String,
      enum: ['professional', 'casual', 'friendly', 'authoritative', 'playful', 'serious', 'inspirational']
    },
    brandPersonality: [String] // e.g., ['innovative', 'trustworthy', 'approachable']
  },
  contentRules: {
    doNotUse: [String], // Words/phrases to avoid
    mustInclude: [String], // Words/phrases to include
    preferredHashtags: [String],
    hashtagStrategy: String,
    captionLength: {
      min: Number,
      max: Number
    },
    emojiUsage: {
      allowed: { type: Boolean, default: true },
      preferred: [String],
      avoid: [String]
    },
    linkPolicy: {
      allowed: { type: Boolean, default: true },
      required: { type: Boolean, default: false },
      domains: [String] // Allowed domains
    }
  },
  platformSpecific: {
    instagram: {
      postTypes: [String], // ['photo', 'video', 'carousel', 'reels', 'stories']
      preferredAspectRatios: [String],
      captionStyle: String
    },
    twitter: {
      threadStrategy: String,
      replyStrategy: String
    },
    linkedin: {
      articleStrategy: String,
      postLength: String
    },
    facebook: {
      postTypes: [String],
      engagementStrategy: String
    },
    tiktok: {
      videoLength: Number,
      musicStrategy: String
    },
    youtube: {
      videoLength: Number,
      thumbnailStrategy: String
    }
  },
  approvalRules: {
    requireApproval: { type: Boolean, default: true },
    approvers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      role: String
    }],
    autoApprove: {
      enabled: { type: Boolean, default: false },
      conditions: mongoose.Schema.Types.Mixed
    }
  },
  compliance: {
    disclaimers: [String],
    requiredDisclaimers: [String],
    regulatoryRequirements: [String],
    industrySpecific: mongoose.Schema.Types.Mixed
  },
  assets: {
    imageLibrary: [{
      url: String,
      tags: [String],
      category: String
    }],
    videoLibrary: [{
      url: String,
      tags: [String],
      category: String,
      duration: Number
    }],
    templateLibrary: [{
      templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContentTemplate'
      },
      category: String
    }]
  },
  workflows: [{
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalWorkflow'
    },
    isDefault: { type: Boolean, default: false }
  }],
  isActive: {
    type: Boolean,
    default: true
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

clientGuidelinesSchema.index({ workspaceId: 1, isActive: 1 });
clientGuidelinesSchema.index({ agencyWorkspaceId: 1 });

clientGuidelinesSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ClientGuidelines', clientGuidelinesSchema);


