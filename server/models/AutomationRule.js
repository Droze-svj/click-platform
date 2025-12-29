// Automation Rule Model
// Pro mode workflow automation

const mongoose = require('mongoose');

const automationRuleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  // Trigger
  trigger: {
    type: {
      type: String,
      enum: ['event', 'schedule', 'condition', 'webhook'],
      required: true
    },
    event: {
      type: String,
      enum: [
        'content_created',
        'content_published',
        'content_approved',
        'scheduled',
        'performance_threshold',
        'scenes_detected',
        'scene_key_moment',
        'video_uploaded',
        'scenes_processed'
      ]
    },
    schedule: {
      frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
      time: String,
      timezone: String
    },
    condition: mongoose.Schema.Types.Mixed,
    webhook: {
      url: String,
      method: { type: String, enum: ['GET', 'POST'], default: 'POST' }
    }
  },
  // Conditions
  conditions: [{
    field: String,
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in', 'has_audio_tag', 'audio_energy_range']
    },
    value: mongoose.Schema.Types.Mixed,
    // Audio-specific condition fields
    audioCriteria: {
      requireSpeech: Boolean,
      minSpeechConfidence: Number,
      requireHighEnergy: Boolean,
      minEnergy: Number,
      skipSilence: Boolean,
      maxSilenceRatio: Number,
      skipNoise: Boolean,
      requireTopicChange: Boolean,
      audioTags: [String],
      excludeTags: [String]
    }
  }],
  // Actions
  actions: [{
    type: {
      type: String,
      enum: [
        'create_content',
        'update_content',
        'publish_content',
        'schedule_content',
        'send_notification',
        'assign_task',
        'update_status',
        'webhook',
        'email',
        'detect_scenes',
        'create_clips_from_scenes',
        'generate_captions_for_scenes',
        'create_carousel_from_scenes',
        'tag_key_moments',
        'export_scene_analytics',
        'create_clips_with_audio_criteria',
        'skip_segments_by_audio',
        'generate_music_for_scenes'
      ],
      required: true
    },
    config: mongoose.Schema.Types.Mixed
  }],
  // Status
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  // Execution stats
  stats: {
    executions: { type: Number, default: 0 },
    successes: { type: Number, default: 0 },
    failures: { type: Number, default: 0 },
    lastExecuted: Date,
    lastError: String
  },
  // Analytics
  analytics: {
    executions: [{
      timestamp: Date,
      duration: Number,
      scenesProcessed: Number,
      scenesFiltered: Number,
      clipsCreated: Number,
      success: Boolean,
      criteria: mongoose.Schema.Types.Mixed,
      adaptiveThresholds: mongoose.Schema.Types.Mixed
    }],
    summary: {
      totalExecutions: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
      averageDuration: { type: Number, default: 0 },
      averageScenesProcessed: { type: Number, default: 0 },
      averageScenesFiltered: { type: Number, default: 0 },
      averageClipsCreated: { type: Number, default: 0 },
      lastExecution: Date
    }
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

automationRuleSchema.index({ userId: 1, enabled: 1 });
automationRuleSchema.index({ 'trigger.type': 1, enabled: 1 });

automationRuleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AutomationRule', automationRuleSchema);


