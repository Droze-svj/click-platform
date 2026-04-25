// Value Tracking Hooks
// Auto-update value tracking when posts are published

const { updateValueTrackingOnPost } = require('./automatedValueTrackingService');
const logger = require('../utils/logger');

/**
 * Initialize value tracking hooks
 */
function initializeValueTrackingHooks() {
  try {
    const ScheduledPost = require('../models/ScheduledPost');

    // Hook when post is saved with analytics
    ScheduledPost.schema.post('save', async function(doc) {
      if (this.status === 'posted' && this.analytics) {
        try {
          await updateValueTrackingOnPost(this._id, this.analytics);
        } catch (error) {
          logger.warn('Error updating value tracking on post save', { error: error.message });
        }
      }
    });

    logger.info('Value tracking hooks initialized');
  } catch (error) {
    logger.error('Error initializing value tracking hooks', { error: error.message });
  }
}

/**
 * Manual update trigger (call this when analytics are updated)
 */
async function triggerValueTrackingUpdate(postId, analytics) {
  try {
    await updateValueTrackingOnPost(postId, analytics);
  } catch (error) {
    logger.warn('Error triggering value tracking update', { error: error.message, postId });
  }
}

module.exports = {
  initializeValueTrackingHooks,
  triggerValueTrackingUpdate
};

