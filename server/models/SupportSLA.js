// Support SLA Model
// Track SLAs for priority agency support

const mongoose = require('mongoose');

const supportSLASchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tier: {
    type: String,
    enum: ['standard', 'priority', 'dedicated', 'enterprise'],
    required: true
  },
  // SLA targets
  targets: {
    firstResponse: {
      minutes: { type: Number, required: true }, // Target response time in minutes
      priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' }
    },
    resolution: {
      hours: { type: Number }, // Target resolution time in hours
      priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' }
    },
    availability: {
      percentage: { type: Number, default: 99.9 }, // Uptime target
      hours: { type: String, default: '24/7' } // Support hours
    }
  },
  // Current performance
  performance: {
    firstResponse: {
      average: Number, // Average response time in minutes
      onTime: { type: Number, default: 0 }, // Percentage of tickets responded to on time
      total: { type: Number, default: 0 }
    },
    resolution: {
      average: Number, // Average resolution time in hours
      onTime: { type: Number, default: 0 }, // Percentage resolved on time
      total: { type: Number, default: 0 }
    }
  },
  // Dedicated support
  dedicated: {
    accountManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    onboarding: {
      completed: { type: Boolean, default: false },
      completedAt: Date,
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  },
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

supportSLASchema.index({ userId: 1, isActive: 1 });
supportSLASchema.index({ tier: 1, isActive: 1 });

supportSLASchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('SupportSLA', supportSLASchema);


