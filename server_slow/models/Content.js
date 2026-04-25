const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace'
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace'
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContentFolder',
    default: null
  },
  tags: [{
    type: String
  }],
  category: {
    type: String,
    default: 'general'
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['video', 'article', 'podcast', 'transcript'],
    required: true
  },
  originalFile: {
    url: String,
    filename: String,
    size: Number,
    duration: Number // for videos/audio
  },
  musicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Music'
  },
  processingOptions: {
    effects: [String],
    textOverlay: {
      text: String,
      position: String,
      fontSize: Number,
      fontColor: String
    },
    watermark: String
  },
  title: String,
  description: String,
  transcript: String,
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed'],
    default: 'uploading'
  },
  generatedContent: {
    shortVideos: [{
      url: String,
      thumbnail: String,
      duration: Number,
      caption: String,
      platform: String,
      highlight: Boolean
    }],
    socialPosts: [{
      platform: String,
      content: String,
      hashtags: [String],
      mediaUrl: String
    }],
    quoteCards: [{
      imageUrl: String,
      quote: String,
      author: String,
      style: String
    }],
    blogSummary: String,
    viralIdeas: [{
      title: String,
      description: String,
      platform: String
    }],
    creativeBrief: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    editorState: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  analytics: {
    views: Number,
    engagement: Number,
    bestPerforming: String,
    usageCount: {
      type: Number,
      default: 0
    }
  },
  abTest: {
    testId: String,
    variant: {
      type: String,
      enum: ['A', 'B']
    }
  },
  sharedWith: [{
    userId: {
      type: String,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['view', 'edit'],
      default: 'view'
    },
    sharedAt: Date,
    sharedBy: {
      type: String,
      ref: 'User'
    }
  }],

  isPublic: {
    type: Boolean,
    default: false
  },
  isTemplate: {
    type: Boolean,
    default: false,
    index: true
  },
  pipeline: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: null
    },
    assets: {
      type: Map,
      of: [{
        type: {
          type: String
        },
        content: String,
        caption: String,
        hashtags: [String],
        url: String,
        thumbnail: String,
        duration: Number,
        platform: String,
        format: String
      }]
    },
    performance: {
      type: Map,
      of: [{
        assetId: String,
        predictedEngagement: Number,
        predictedReach: Number,
        score: Number,
        recommendations: [String]
      }]
    },
    recycling: {
      isRecyclable: Boolean,
      evergreenScore: Number,
      plan: {
        suggestedFrequency: String,
        platforms: [String]
      }
    },
    analytics: {
      trackingEnabled: Boolean,
      platforms: [String],
      metrics: [String]
    },
    distribution: {
      scheduled: [{
        platform: String,
        postId: mongoose.Schema.Types.ObjectId,
        status: String
      }],
      platforms: [String],
      totalScheduled: Number
    },
    variations: {
      type: Map,
      of: [{
        content: String,
        hashtags: [String],
        variationType: String,
        hook: String,
        platform: String,
        performance: {
          score: Number,
          engagement: Number,
          reach: Number
        }
      }]
    },
    refreshed: {
      type: Map,
      of: [{
        content: String,
        hashtags: [String],
        optimization: {
          basedOnPerformance: Boolean,
          averageEngagement: Number,
          averageReach: Number,
          recommendations: [String]
        },
        trendOptimized: Boolean
      }]
    },
    refreshedAt: Date,
    abTests: {
      type: Map,
      of: {
        testGroups: [{
          variant: String,
          content: String,
          hashtags: [String],
          performance: Object
        }],
        status: String,
        createdAt: Date,
        results: Object
      }
    },
    completedAt: Date,
    steps: [{
      step: String,
      status: String,
      data: Object
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  timelineBranches: [{
    name: String, // e.g. 'client-review', 'v2-experiment'
    editorState: mongoose.Schema.Types.Mixed,
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  syncVersion: {
    type: Number,
    default: 1
  }
});

// Indexes for better query performance
// Optimized indexes for common queries
contentSchema.index({ userId: 1, createdAt: -1 });
contentSchema.index({ userId: 1, status: 1, createdAt: -1 }); // User's content by status
contentSchema.index({ userId: 1, type: 1, createdAt: -1 }); // User's content by type
contentSchema.index({ status: 1, createdAt: -1 }); // All content by status
contentSchema.index({ type: 1, status: 1 }); // Content by type and status
contentSchema.index({ userId: 1, isArchived: 1, createdAt: -1 }); // User's archived content
contentSchema.index({ userId: 1, isFavorite: 1 }); // User's favorites
contentSchema.index({ 'tags': 1 }); // Content by tags
contentSchema.index({ folderId: 1 }); // Content in folders

// Index in Elasticsearch after save and trigger multi-language sync
contentSchema.post('save', async function (doc) {
  // Elastic indexing
  const es = this.isNew ? 
    require('../middleware/elasticsearchIndexer').indexContent(doc) : 
    require('../middleware/elasticsearchIndexer').updateContentIndex(doc);
  
  // Sync Engine triggering
  const SyncEngine = require('../services/SyncEngine');
  const sync = SyncEngine.syncContent(doc._id).catch(err => {
    console.error('[ContentModel] Failed to trigger sync engine', { contentId: doc._id, error: err.message });
  });

  await Promise.all([es, sync]);
});

// Remove from Elasticsearch on delete
contentSchema.post('remove', async function (doc) {
  const { deleteContentIndex } = require('../middleware/elasticsearchIndexer');
  await deleteContentIndex(doc._id);
});

contentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  
  // High-performance change detection for sync versioning
  if (!this.isNew) {
    const mod = this.modifiedPaths();
    const syncPulsePaths = ['title', 'description', 'transcript', 'body'];
    const hasSyncPulse = syncPulsePaths.some(p => mod.includes(p));
    
    if (hasSyncPulse) {
      this.syncVersion = (this.syncVersion || 1) + 1;
      console.log(`[ContentModel] Sync pulse detected. Incrementing version to ${this.syncVersion} for ${this._id}`);
    }
  }
  next();
});

module.exports = mongoose.model('Content', contentSchema);

