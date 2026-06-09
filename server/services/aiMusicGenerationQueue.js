// AI Music Generation Queue Service
// Manages generation queue and concurrent processing

const logger = require('../utils/logger');
const MusicGeneration = require('../models/MusicGeneration');

// Bound the status-polling loop so a stuck/never-completing job can't reschedule
// itself forever. ~10 min at 5s intervals (120 attempts) or an absolute
// deadline, whichever comes first.
const POLL_INTERVAL_MS = parseInt(process.env.MUSIC_POLL_INTERVAL_MS || '5000', 10);
const POLL_MAX_ATTEMPTS = parseInt(process.env.MUSIC_POLL_MAX_ATTEMPTS || '120', 10);
const POLL_DEADLINE_MS = parseInt(process.env.MUSIC_POLL_DEADLINE_MS || '600000', 10);

/**
 * Generation queue manager
 */
class GenerationQueue {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.processingQueue = new Map(); // provider -> Set of generationIds
    this.pendingQueue = [];
    this.processing = false;
  }

  /**
   * Add generation to queue
   */
  async enqueue(generationId, provider, priority = 0) {
    // Dedupe: never queue a generation that's already pending or in-flight.
    // Two near-simultaneous requests for the same id would otherwise spawn
    // duplicate polling loops (wasted provider calls / double charges).
    const alreadyPending = this.pendingQueue.find(item => item.generationId === generationId);
    if (alreadyPending) {
      logger.info('Generation already queued, skipping duplicate', { generationId, provider });
      return alreadyPending;
    }
    for (const inFlight of this.processingQueue.values()) {
      if (inFlight.has(generationId)) {
        logger.info('Generation already processing, skipping duplicate', { generationId, provider });
        return { generationId, provider, priority, addedAt: Date.now(), alreadyProcessing: true };
      }
    }

    const queueItem = {
      generationId,
      provider,
      priority,
      addedAt: Date.now()
    };

    this.pendingQueue.push(queueItem);
    this.pendingQueue.sort((a, b) => b.priority - a.priority);

    logger.info('Generation added to queue', { generationId, provider, priority });

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }

    return queueItem;
  }

  /**
   * Process queue
   */
  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.pendingQueue.length > 0) {
      // Get providers with available slots
      const availableProviders = this.getAvailableProviders();

      if (availableProviders.length === 0) {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Find next item for available provider
      const queueItem = this.pendingQueue.find(item => 
        availableProviders.includes(item.provider)
      );

      if (!queueItem) {
        // No items for available providers, wait
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Remove from pending queue
      const index = this.pendingQueue.indexOf(queueItem);
      this.pendingQueue.splice(index, 1);

      // Add to processing queue
      if (!this.processingQueue.has(queueItem.provider)) {
        this.processingQueue.set(queueItem.provider, new Set());
      }
      this.processingQueue.get(queueItem.provider).add(queueItem.generationId);

      // Process generation (fire and forget). Seed the poll budget.
      this.processGeneration(queueItem.generationId, queueItem.provider, { attempt: 0, startedAt: Date.now() })
        .catch(error => {
          logger.error('Generation processing error', {
            error: error.message,
            generationId: queueItem.generationId
          });
        });
    }

    this.processing = false;
  }

  /**
   * Get providers with available slots
   */
  getAvailableProviders() {
    const allProviders = ['mubert', 'soundraw'];
    return allProviders.filter(provider => {
      const processing = this.processingQueue.get(provider);
      return !processing || processing.size < this.maxConcurrent;
    });
  }

  /**
   * Process single generation
   */
  async processGeneration(generationId, provider, poll = { attempt: 0, startedAt: Date.now() }) {
    try {
      const { checkGenerationStatus } = require('./aiMusicGenerationService');
      const generation = await MusicGeneration.findById(generationId);

      if (!generation || generation.status !== 'processing') {
        this.removeFromProcessing(provider, generationId);
        return;
      }

      // Poll status
      const status = await checkGenerationStatus(generationId);

      if (status.status === 'completed') {
        this.removeFromProcessing(provider, generationId);
        logger.info('Generation completed', { generationId, provider });
      } else if (status.status === 'failed') {
        this.removeFromProcessing(provider, generationId);
        logger.warn('Generation failed', { generationId, provider, error: status.error });
      } else {
        // Still processing. Stop polling once we exhaust the attempt budget or
        // cross the overall deadline — otherwise a never-completing job would
        // reschedule itself indefinitely.
        const attempt = (poll.attempt || 0) + 1;
        const elapsed = Date.now() - (poll.startedAt || Date.now());
        if (attempt >= POLL_MAX_ATTEMPTS || elapsed >= POLL_DEADLINE_MS) {
          this.removeFromProcessing(provider, generationId);
          logger.warn('Generation polling timed out', { generationId, provider, attempt, elapsedMs: elapsed });
          try {
            generation.status = 'failed';
            generation.error = 'Generation timed out while polling provider status';
            await generation.save();
          } catch (saveErr) {
            logger.warn('Failed to mark generation timed-out', { generationId, error: saveErr.message });
          }
          return;
        }
        const t = setTimeout(() => {
          this.processGeneration(generationId, provider, { attempt, startedAt: poll.startedAt });
        }, POLL_INTERVAL_MS);
        if (typeof t.unref === 'function') t.unref();
      }
    } catch (error) {
      logger.error('Error processing generation', {
        error: error.message,
        generationId,
        provider
      });
      this.removeFromProcessing(provider, generationId);
    }
  }

  /**
   * Remove from processing queue
   */
  removeFromProcessing(provider, generationId) {
    const processing = this.processingQueue.get(provider);
    if (processing) {
      processing.delete(generationId);
      if (processing.size === 0) {
        this.processingQueue.delete(provider);
      }
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    const status = {};
    this.processingQueue.forEach((set, provider) => {
      status[provider] = {
        processing: set.size,
        pending: this.pendingQueue.filter(item => item.provider === provider).length
      };
    });
    return status;
  }
}

// Global queue instance
const generationQueue = new GenerationQueue({ maxConcurrent: 5 });

/**
 * Queue generation for processing
 */
async function queueGeneration(generationId, provider, priority = 0) {
  return await generationQueue.enqueue(generationId, provider, priority);
}

/**
 * Get queue status
 */
function getQueueStatus() {
  return generationQueue.getQueueStatus();
}

module.exports = {
  GenerationQueue,
  queueGeneration,
  getQueueStatus
};







