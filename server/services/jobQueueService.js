// Background job queue service using BullMQ

const { Queue, Worker, QueueEvents } = require('bullmq');
// IORedis is a dependency of BullMQ, so we can access it through BullMQ's node_modules
// Try to require it, but if it fails, we'll fall back to connection strings
let IORedis = null;
try {
  IORedis = require('ioredis');
} catch (err) {
  
  
}
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

// Redis connection configuration
let redisConnection = null;
let redisIORedisInstance = null; // Cached IORedis instance for BullMQ
let redisOptionsCache = null;    // Parsed URL → ioredis options (for BullMQ Queue/Worker/QueueEvents)

/**
 * Parse a redis:// or rediss:// URL into a plain ioredis options object.
 * Used to hand BullMQ a clean options bag — when BullMQ duplicates the
 * connection internally for blocking commands, the duplicate inherits
 * these explicit fields instead of falling back to localhost defaults.
 */
function parseRedisUrlToOptions(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const opts = {
      host: u.hostname,
      port: parseInt(u.port, 10) || 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectTimeout: 10000,
      keepAlive: 15000,
    };
    if (u.username) opts.username = decodeURIComponent(u.username);
    if (u.password) opts.password = decodeURIComponent(u.password);
    if (u.pathname && u.pathname.length > 1) {
      const db = parseInt(u.pathname.slice(1), 10);
      if (!Number.isNaN(db)) opts.db = db;
    }
    if (u.protocol === 'rediss:') opts.tls = {};
    return opts;
  } catch (e) {
    logger.error('Failed to parse REDIS_URL into options', { error: e.message });
    return null;
  }
}

function isIORedisUsable(client) {
  if (!client || typeof client !== 'object') return false;
  // ioredis statuses: wait, connecting, connect, ready, close, end, reconnecting
  const status = client.status;
  return status === 'wait' || status === 'connecting' || status === 'connect' || status === 'ready' || status === 'reconnecting';
}

// Clear cached connection on module load in production
const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

// Force clear any cached connection on module load in production
if (isProduction) {
  redisConnection = null; // Clear any stale cached connection
}

function getRedisConnection() {
  // In production/staging, ALWAYS require REDIS_URL (no fallbacks)
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

  // Check if Redis is configured (validate non-empty strings)
  // IMPORTANT: Use process.env.REDIS_URL directly first to check raw value
  const rawRedisUrl = process.env.REDIS_URL;
  const redisUrl = rawRedisUrl?.trim();
  const redisHost = process.env.REDIS_HOST?.trim();

  // Log what we found for debugging
  logger.info('🔍 getRedisConnection() called', {
    hasRedisUrl: !!redisUrl,
    redisUrlLength: redisUrl?.length || 0,
    redisUrlPrefix: redisUrl ? redisUrl.substring(0, 30) + '...' : 'none',
    redisUrlFirstChars: redisUrl ? redisUrl.substring(0, 10) : 'none',
    redisUrlLastChars: redisUrl && redisUrl.length > 10 ? '...' + redisUrl.substring(redisUrl.length - 10) : 'none',
    hasRedisHost: !!redisHost,
    nodeEnv: process.env.NODE_ENV,
    isProduction,
    rawRedisUrlExists: !!rawRedisUrl,
    rawRedisUrlLength: rawRedisUrl?.length || 0,
    rawRedisUrlFirstChars: rawRedisUrl ? rawRedisUrl.substring(0, 20) : 'none',
    // Check for common issues
    hasQuotes: rawRedisUrl ? (rawRedisUrl.startsWith('"') || rawRedisUrl.startsWith("'")) : false,
    hasSpaces: rawRedisUrl ? rawRedisUrl.includes(' ') : false,
    cachedConnectionType: redisConnection ? typeof redisConnection : 'none',
    cachedConnectionIsLocalhost: redisConnection && typeof redisConnection === 'object'
      ? (redisConnection.host === 'localhost' || redisConnection.host === '127.0.0.1')
      : false
  });

  // In production/staging, REDIS_URL is REQUIRED
  if (isProduction) {
    if (!redisUrl || redisUrl === '') {
      logger.error('⚠️ REDIS_URL is REQUIRED in production/staging but is missing or empty.');
      logger.error('⚠️ REDIS_URL value:', redisUrl ? `"${redisUrl.substring(0, 30)}..." (length: ${redisUrl.length})` : 'NOT SET OR EMPTY');
      logger.error('⚠️ Workers will be disabled. Add REDIS_URL to Render.com environment variables.');
      // Clear any cached connection
      redisConnection = null;
      return null;
    }

    // Reject placeholder URLs (e.g. redis://placeholder-redis:6379 from .env templates)
    const isPlaceholder = redisUrl.includes('placeholder') || 
                         redisUrl.includes('username:password') || 
                         redisUrl.includes('host:port');
                         
    if (isPlaceholder) {
      logger.warn('⚠️ REDIS_URL appears to be a placeholder pattern. Set a real Redis URL in Render env vars. Workers disabled.');
      redisConnection = null;
      return null;
    }

    // Validate URL format in production
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      logger.error('⚠️ Invalid REDIS_URL format in production. Must start with redis:// or rediss://');
      logger.error('⚠️ REDIS_URL received:', redisUrl.substring(0, 50));
      logger.error('⚠️ Workers will be disabled until REDIS_URL is fixed.');
      redisConnection = null;
      return null;
    }

    // Reject localhost in production
    if (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost')) {
      logger.error('⚠️ REDIS_URL contains localhost/127.0.0.1 in production. This is not allowed.');
      logger.error('⚠️ Workers will be disabled. Use a cloud Redis service (Redis Cloud, etc.).');
      redisConnection = null;
      return null;
    }

    // Return cached options object if we already parsed it.
    // We pass an OPTIONS OBJECT (not an IORedis instance) to BullMQ, so when
    // BullMQ internally duplicates the connection for blocking commands, the
    // duplicate gets the same explicit host/port — instead of inheriting
    // default localhost from a lazy-connect IORedis instance.
    if (redisOptionsCache) {
      logger.info('Using cached Redis options (production)');
      return redisOptionsCache;
    }

    // Cache the connection string
    redisConnection = redisUrl;

    // CRITICAL: Create IORedis instance explicitly to prevent BullMQ from defaulting to localhost
    // BullMQ might create its own connection internally, so we create one explicitly and reuse it
    // Use lazyConnect: true to prevent blocking during server startup
    if (!IORedis) {
      // FAIL LOUD in production. Returning the URL string here causes BullMQ
      // to silently default to 127.0.0.1:6379 (its own internal IORedis can't
      // parse a bare string here), which produces a confusing ECONNREFUSED
      // crash loop instead of a clear "ioredis missing" error. Throwing
      // surfaces the real problem at boot — fix is to add ioredis to deps.
      logger.error('❌ FATAL: ioredis package is not installed. BullMQ workers cannot run without it.');
      logger.error('❌ Add `"ioredis": "^5.4.1"` to dependencies in package.json and rebuild.');
      throw new Error(
        'ioredis is not installed. BullMQ requires ioredis as a peer dependency. ' +
        'Add "ioredis": "^5.4.1" to package.json and rebuild the deploy.'
      );
    }

    try {
      // Build the parsed options object that we'll hand to BullMQ.
      // BullMQ accepts an options object as `connection` and creates its own
      // IORedis instances from it, calling .duplicate() internally for
      // blocking commands. When we hand it explicit host/port/password
      // fields (instead of an IORedis instance with a parsed URL), the
      // duplicate inherits the same explicit fields cleanly. This sidesteps
      // the long-standing BullMQ + lazyConnect IORedis duplicate bug that
      // produces the "❌ Worker trying to connect to localhost" pattern.
      const parsedOptions = parseRedisUrlToOptions(redisUrl);
      if (!parsedOptions) {
        logger.error('❌ FATAL: Could not parse REDIS_URL. Workers cannot run.');
        return null;
      }
      redisOptionsCache = {
        ...parsedOptions,
        retryStrategy: (times) => {
          if (times > 20) return null;
          return Math.min(times * 300, 3000);
        },
        enableOfflineQueue: true,
      };

      // We still create one IORedis instance for the rest of the app's
      // direct Redis usage (caching layer, etc.). It uses the SAME parsed
      // options so behavior is identical — BullMQ gets the options object,
      // everyone else gets the instance.
      redisIORedisInstance = new IORedis(redisUrl, {
        ...redisOptionsCache,
        // Eager connect (no lazyConnect) so by the time anything tries to
        // use the cached instance the URL is fully resolved.
        lazyConnect: false,
      });

      // Log connection events for debugging (but don't block on them)
      redisIORedisInstance.on('connect', () => {
        
        logger.info('IORedis instance connected');
      });

      redisIORedisInstance.on('error', (err) => {
        
        logger.warn('IORedis instance error (non-fatal)', { error: err.message });
      });

      redisIORedisInstance.on('ready', () => {
        
        logger.info('IORedis instance ready');
      });

      logger.info('✅ Created Redis options for BullMQ (production)', {
        host: redisOptionsCache.host,
        port: redisOptionsCache.port,
        hasPassword: !!redisOptionsCache.password,
        tls: !!redisOptionsCache.tls,
      });

      // Return the OPTIONS OBJECT — not the IORedis instance. BullMQ will
      // create its own IORedis instances from these options for both the
      // main connection and the duplicated blocking-command connection.
      return redisOptionsCache;
    } catch (err) {


      logger.error('Error creating IORedis instance / parsing Redis options', { error: err.message, stack: err.stack });
      // If we got the options object before the instance creation failed,
      // still return the options so BullMQ can connect. Workers will retry
      // the actual connection internally.
      if (redisOptionsCache) return redisOptionsCache;
      logger.warn('⚠️ Falling back to connection string');
      return redisConnection;
    }
  }

  // Development mode: Total Silence Shield
  // Do NOT attempt any Redis connection on localhost to prevent event loop starvation during large uploads.
  if (process.env.NODE_ENV !== 'production') {
    const isLocalhost = !redisUrl || redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1') || redisUrl.includes('placeholder');
    if (isLocalhost) {
      logger.info('🛡️ [JobQueue] Development Neutralization: Redis connection blocked for stability.');
      redisConnection = null;
      return null;
    }
  }

  // In production/staging, REDIS_URL is REQUIRED

  // Use REDIS_URL if available
  if (redisUrl && redisUrl !== '') {
    // Skip localhost in development to avoid crash loops when Redis isn't running
    if (process.env.NODE_ENV !== 'production' && (redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1'))) {
      logger.info('🔧 [BullMQ] Caching layer bypassed (Localhost Redis skipped in dev).');
      redisConnection = null;
      return null;
    }

    // Validate URL format
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      logger.error('⚠️ Invalid REDIS_URL format. Must start with redis:// or rediss://');
      logger.warn('⚠️ Workers will be disabled until REDIS_URL is fixed.');
      redisConnection = null;
      return null;
    }

    // Return cached IORedis instance if it is still usable
    if (redisIORedisInstance) {
      if (isIORedisUsable(redisIORedisInstance)) {
        logger.info('Using cached IORedis instance (development)');
        return redisIORedisInstance;
      }
      logger.warn('Cached IORedis instance is closed/unusable. Recreating connection...');
      try { redisIORedisInstance.disconnect(false); } catch (_) { /* ignore */ }
      redisIORedisInstance = null;
    }

    // Cache the connection string
    redisConnection = redisUrl;

    // Create IORedis instance for development too
    if (!IORedis) {
      logger.warn('⚠️ IORedis not available, using connection string instead');
      return redisConnection;
    }

    try {
      redisIORedisInstance = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: true, // Don't connect immediately
        connectTimeout: 10000,
        enableOfflineQueue: false,
      });
      logger.info('✅ Created IORedis instance for BullMQ (development)', {
        url: redisUrl.replace(/:[^:@]+@/, ':****@')
      });
      return redisIORedisInstance;
    } catch (err) {
      logger.error('Error creating IORedis instance', { error: err.message });
      return redisConnection; // Fallback to connection string
    }
  }

  // Fallback to individual config (development only)
  // CRITICAL: This should NEVER run in production
  if (isProduction) {
    logger.error('❌ FATAL: Attempted to use localhost fallback in production!');
    logger.error('❌ This should never happen. REDIS_URL must be set.');
    logger.error('❌ Clearing any cached connection and returning null.');
    redisConnection = null;
    return null;
  }

  logger.warn('⚠️ Using individual Redis config for job queue connection (development only)');
  logger.warn('⚠️ This should NOT happen in production!');

  // Return cached if same config
  if (redisConnection !== null && typeof redisConnection === 'object' &&
    redisConnection.host === (redisHost || 'localhost')) {
    return redisConnection;
  }

  redisConnection = {
    host: redisHost || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
  logger.warn('⚠️ Created localhost Redis connection - this will fail in production!');
  return redisConnection;
}

// Job queues
const queues = {};
const workers = {};
const queueEvents = {};

/**
 * Get or create a queue
 */
function getQueue(name) {
  const connection = getRedisConnection();
  if (!connection) {
    throw new Error('Redis not configured. Cannot create queue.');
  }

  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    // Set up queue events
    queueEvents[name] = new QueueEvents(name, { connection: connection });

    queueEvents[name].on('completed', ({ jobId }) => {
      logger.info('Job completed', { queue: name, jobId });
    });

    queueEvents[name].on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed', { queue: name, jobId, reason: failedReason });
      captureException(new Error(failedReason), {
        tags: { queue: name, jobId },
      });
    });

    queueEvents[name].on('progress', ({ jobId, data }) => {
      logger.debug('Job progress', { queue: name, jobId, progress: data });
    });
  }

  return queues[name];
}

/**
 * Add job to queue
 */
async function addJob(queueName, jobData, options = {}) {
  // Check if Redis is available before adding job
  const connection = getRedisConnection();
  
  if (!connection) {
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`🛡️ [JobQueue] Dev Fallback: Executing job ${queueName} in-process (No Redis)`);
      
      // Simulate BullMQ job object
      const simulatedJob = {
        id: `sim-${Date.now()}`,
        data: jobData.data || {},
        name: jobData.name || 'job',
        attemptsMade: 0,
        updateProgress: async (p) => {
          logger.info(`[JobProgress] ${queueName}:${simulatedJob.id} -> ${p}%`);
        },
        log: async (msg) => logger.info(`[JobLog] ${msg}`)
      };

      // Find the processor for this queue
      const { QUEUE_PROCESSORS } = require('../workers/index');
      const processor = QUEUE_PROCESSORS[queueName];

      if (processor) {
        // Execute in-process (background-ish)
        setImmediate(async () => {
          try {
            await processor(simulatedJob.data, simulatedJob);
            logger.info(`✅ [JobQueue] Dev Fallback Success: ${queueName}`);
          } catch (err) {
            logger.error(`❌ [JobQueue] Dev Fallback Error: ${queueName}`, { error: err.message });
          }
        });
        return simulatedJob;
      } else {
        logger.warn(`⚠️ [JobQueue] No processor found for ${queueName} in Dev Fallback`);
      }
    }
    
    logger.warn(`⚠️ Cannot add job to ${queueName} - Redis not configured`);
    throw new Error('Redis not configured. Cannot add job to queue.');
  }

  try {
    const queue = getQueue(queueName);
    const job = await queue.add(jobData.name || 'job', jobData.data || {}, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      attempts: options.attempts || 3,
      ...options,
    });

    logger.info('Job added to queue', {
      queue: queueName,
      jobId: job.id,
      priority: options.priority,
    });

    return job;
  } catch (error) {
    logger.error('Failed to add job', { queue: queueName, error: error.message });
    throw error;
  }
}

/**
 * Create worker for a queue
 */
function createWorker(queueName, processor, options = {}) {
  // Log immediately when function is called - use both console.log and logger
  const logMsg = `[createWorker] Called for ${queueName}`;
  
  logger.info(logMsg, {
    queueName,
    nodeEnv: process.env.NODE_ENV,
    redisUrlExists: !!process.env.REDIS_URL,
    redisUrlLength: process.env.REDIS_URL?.length || 0,
    redisUrlFirst30: process.env.REDIS_URL ? process.env.REDIS_URL.substring(0, 30) : 'NONE'
  });

  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

  // CRITICAL: In production, validate REDIS_URL BEFORE calling getRedisConnection()
  // This prevents any possibility of a cached localhost connection being returned
  if (isProduction) {
    
    const rawRedisUrl = process.env.REDIS_URL;
    const redisUrl = rawRedisUrl?.trim();

    logger.info(`🔍 Pre-validation for ${queueName}`, {
      hasRawRedisUrl: !!rawRedisUrl,
      rawRedisUrlLength: rawRedisUrl?.length || 0,
      hasTrimmedRedisUrl: !!redisUrl,
      trimmedRedisUrlLength: redisUrl?.length || 0,
      rawRedisUrlFirstChars: rawRedisUrl ? rawRedisUrl.substring(0, 20) : 'none',
      trimmedRedisUrlFirstChars: redisUrl ? redisUrl.substring(0, 20) : 'none'
    });

    if (!redisUrl || redisUrl === '') {
      logger.error(`❌ FATAL: REDIS_URL is missing or empty. Cannot create worker ${queueName}.`);
      logger.error(`❌ Raw REDIS_URL exists: ${!!rawRedisUrl}, length: ${rawRedisUrl?.length || 0}`);
      logger.error(`❌ Trimmed REDIS_URL exists: ${!!redisUrl}, length: ${redisUrl?.length || 0}`);
      return null;
    }

    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      logger.error(`❌ FATAL: REDIS_URL format invalid for ${queueName}. Must start with redis:// or rediss://`);
      logger.error(`❌ REDIS_URL received: ${redisUrl.substring(0, 50)}`);
      return null;
    }

    if (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost')) {
      logger.error(`❌ FATAL: REDIS_URL contains localhost for ${queueName}. Cannot create worker.`);
      logger.error(`❌ REDIS_URL: ${redisUrl.substring(0, 50)}`);
      return null;
    }
  }

  // Get Redis connection (will return null if not configured)
  const connection = getRedisConnection();

  // Skip worker creation if Redis is not configured
  if (!connection) {
    logger.warn(`⚠️ Skipping worker creation for ${queueName} - Redis not configured`);
    logger.warn(`⚠️ getRedisConnection() returned null for ${queueName}`);
    return null;
  }

  // CRITICAL: Additional safety checks before creating worker
  // Note: isProduction is already declared at the top of this function
  if (isProduction) {
    // IORedis: constructor.name may be 'Redis' or vary by environment; also check for IORedis-like shape
    const isIORedisInstance = connection && typeof connection === 'object' && (
      connection.constructor?.name === 'Redis' ||
      (connection.options && (typeof connection.connect === 'function' || connection.status !== undefined))
    );
    if (isIORedisInstance) {
      // It's an IORedis instance - check its options
      const options = connection.options || {};
      const host = options.host || options.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        logger.error(`⚠️ Rejecting IORedis instance with localhost host for ${queueName} in production`);
        logger.error(`⚠️ Host: ${host}`);
        return null;
      }
      // IORedis instance looks good
      logger.info(`✅ Using IORedis instance for ${queueName} (production)`);
    } else if (typeof connection === 'string') {
      // Must start with redis:// or rediss://
      if (!connection.startsWith('redis://') && !connection.startsWith('rediss://')) {
        logger.error(`⚠️ Invalid Redis connection string format for ${queueName} in production`);
        logger.error(`⚠️ Connection string prefix: ${connection.substring(0, 30)}`);
        return null;
      }

      // Must NOT contain localhost or 127.0.0.1
      if (connection.includes('127.0.0.1') || connection.includes('localhost')) {
        logger.error(`⚠️ Rejecting localhost connection for ${queueName} in production`);
        logger.error(`⚠️ Connection contains localhost/127.0.0.1`);
        return null;
      }
    } else if (
      connection &&
      typeof connection === 'object' &&
      typeof connection.host === 'string' &&
      typeof connection.port === 'number'
    ) {
      // Plain options object — what jobQueueService.getRedisConnection() returns
      // post-PR #15 so BullMQ can construct its own IORedis instances cleanly.
      if (connection.host === 'localhost' || connection.host === '127.0.0.1') {
        logger.error(`⚠️ Rejecting options object with localhost host for ${queueName} in production`);
        logger.error(`⚠️ Host: ${connection.host}`);
        return null;
      }
      logger.info(`✅ Using Redis options object for ${queueName} (production)`, {
        host: connection.host,
        port: connection.port,
      });
    } else {
      logger.error(`⚠️ Rejecting invalid connection type for ${queueName} in production`);
      logger.error(`⚠️ Connection type: ${typeof connection}, constructor: ${connection?.constructor?.name}`);
      return null;
    }
  } else {
    // Development: Additional safety checks
    if (typeof connection === 'object' && connection.host === 'localhost') {
      logger.warn(`⚠️ Using localhost connection for ${queueName} (development only)`);
    }

    if (typeof connection === 'string' && !connection.startsWith('redis://') && !connection.startsWith('rediss://')) {
      logger.error(`⚠️ Invalid Redis connection string format for ${queueName}`);
      logger.error(`⚠️ Connection string prefix: ${connection.substring(0, 20)}`);
      return null;
    }
  }

  // Final validation: Ensure connection is valid before creating Worker
  if (!connection) {
    logger.error(`❌ Cannot create worker ${queueName}: connection is null/undefined`);
    return null;
  }

  // In production, connection can be IORedis instance, options object, or string URL.
  if (isProduction) {
    const isIORedisByName = connection && typeof connection === 'object' && connection.constructor?.name === 'Redis';
    const isIORedisLike = connection && typeof connection === 'object' && connection.options && (typeof connection.connect === 'function' || connection.status !== undefined);
    const isIORedis = isIORedisByName || isIORedisLike;
    const isOptionsObject = connection && typeof connection === 'object' && !isIORedis && typeof connection.host === 'string' && typeof connection.port === 'number';
    const isString = typeof connection === 'string';

    if (!isIORedis && !isString && !isOptionsObject) {
      logger.error(`❌ Cannot create worker ${queueName}: connection is not IORedis instance, options object, or string in production`);
      logger.error(`❌ Connection type: ${typeof connection}, isIORedis: ${isIORedis}, isOptionsObject: ${isOptionsObject}`);
      return null;
    }
  }

  logger.info(`✅ Creating worker for ${queueName} with valid Redis connection`);

  if (workers[queueName]) {
    logger.warn('Worker already exists for queue', { queue: queueName });
    return workers[queueName];
  }

  try {
    // ABSOLUTE FINAL CHECK: Ensure connection is valid before passing to BullMQ
    // BullMQ will default to localhost if connection is undefined/null/invalid
    // This check happens BEFORE any Worker creation to prevent localhost connections

    // Log what we're about to check
    logger.info(`🔍 Final validation for ${queueName}`, {
      hasConnection: !!connection,
      connectionType: typeof connection,
      isProduction,
      connectionPreview: typeof connection === 'string'
        ? connection.substring(0, 50)
        : (connection ? JSON.stringify(connection).substring(0, 50) : 'null')
    });

    if (!connection) {
      logger.error(`❌ FATAL: Connection is null/undefined when creating Worker for ${queueName}`);
      logger.error(`❌ BullMQ would default to localhost. Aborting worker creation.`);
      logger.error(`❌ This should never happen. Check REDIS_URL in Render.com environment variables.`);
      return null;
    }

    // Check for localhost connection object (development fallback that shouldn't happen in production)
    if (typeof connection === 'object') {
      if (connection.host === 'localhost' || connection.host === '127.0.0.1') {
        logger.error(`❌ FATAL: Connection object contains localhost for ${queueName}`);
        logger.error(`❌ Connection object: ${JSON.stringify(connection)}`);
        logger.error(`❌ This should never happen in production. REDIS_URL must be set.`);
        if (isProduction) {
          logger.error(`❌ Aborting worker creation in production.`);
          return null;
        }
      }
    }

    // In production, connection can be IORedis instance or Redis URL string
    if (isProduction) {
      const isObj = connection && typeof connection === 'object';
      const isStr = typeof connection === 'string';
      if (!isObj && !isStr) {
        logger.error(`❌ FATAL: Invalid connection type for ${queueName}`);
        return null;
      }
      if (isStr && (!connection.startsWith('redis://') && !connection.startsWith('rediss://'))) {
        logger.error(`❌ FATAL: Invalid connection format for ${queueName} in production`);
        logger.error(`❌ Connection: ${connection.substring(0, 50)}`);
        logger.error(`❌ Must start with redis:// or rediss://`);
        logger.error(`❌ BullMQ would default to localhost. Aborting worker creation.`);
        return null;
      }

      if (isStr && (connection.includes('127.0.0.1') || connection.includes('localhost'))) {
        logger.error(`❌ FATAL: Connection contains localhost for ${queueName} in production`);
        return null;
      }
    }

    // Log the exact connection being used (hide password)
    const safeConnectionLog = typeof connection === 'string'
      ? connection.replace(/:[^:@]+@/, ':****@')
      : `{ host: ${connection.host}, port: ${connection.port} }`;
    logger.info(`✅ All validation passed. Creating Worker ${queueName} with: ${safeConnectionLog}`);

    // CRITICAL: One final check - BullMQ will default to localhost if connection is undefined
    // Even though we've validated above, double-check right before creating Worker
    if (!connection || connection === undefined || connection === null) {
      logger.error(`❌ FATAL: Connection is ${connection} when creating Worker for ${queueName}`);
      logger.error(`❌ BullMQ would default to localhost. Aborting worker creation.`);
      return null;
    }

    // BullMQ accepts IORedis instances or Redis URL strings – both are valid

    // Final check: ensure connection doesn't contain localhost
    const connectionString = typeof connection === 'string' ? connection : JSON.stringify(connection);
    if (connectionString.includes('127.0.0.1') || connectionString.includes('localhost')) {
      if (isProduction) {
        logger.error(`❌ FATAL: Connection contains localhost for ${queueName} in production`);
        logger.error(`❌ Connection: ${connectionString.substring(0, 100)}`);
        logger.error(`❌ BullMQ would connect to localhost. Aborting worker creation.`);
        return null;
      } else {
        logger.warn(`⚠️ Using localhost connection for ${queueName} in development.`);
      }
    }

    logger.info(`✅ Final validation passed. Creating Worker ${queueName}...`);

    // ABSOLUTE FINAL CHECK: Log exactly what we're passing to BullMQ
    
    
    logger.info(`[${queueName}] About to create Worker`, {
      connectionType: typeof connection,
      connectionPreview: typeof connection === 'string' ? connection.substring(0, 50) : JSON.stringify(connection).substring(0, 50),
      connectionLength: typeof connection === 'string' ? connection.length : 0
    });

    // CRITICAL: Throw error if connection is invalid - this will prevent Worker creation entirely
    if (connection === undefined || connection === null) {
      const error = new Error(`FATAL: Cannot create Worker ${queueName} - connection is ${connection}. BullMQ would default to localhost.`);
      
      logger.error(error.message, { queueName, connection });
      throw error; // Throw instead of return - this will prevent Worker creation
    }

    // In production, connection can be IORedis instance, options object, or string.
    if (isProduction) {
      const isIORedisByName = connection && typeof connection === 'object' && connection.constructor && connection.constructor.name === 'Redis';
      const isIORedisLike = connection && typeof connection === 'object' && connection.options && (typeof connection.connect === 'function' || typeof connection.status !== 'undefined');
      const isIORedis = isIORedisByName || isIORedisLike;
      const isOptionsObject = connection && typeof connection === 'object' && !isIORedis && typeof connection.host === 'string' && typeof connection.port === 'number';
      const isString = typeof connection === 'string';

      if (!isIORedis && !isString && !isOptionsObject) {
        const error = new Error(`FATAL: Cannot create Worker ${queueName} - connection is not IORedis instance, options object, or string in production. Type: ${typeof connection}`);

        logger.error(error.message, { queueName, connectionType: typeof connection, isIORedis, isOptionsObject });
        throw error;
      }

      // If it's an options object, validate the host
      if (isOptionsObject && (connection.host === 'localhost' || connection.host === '127.0.0.1')) {
        const error = new Error(`FATAL: Cannot create Worker ${queueName} - options object has localhost host`);
        logger.error(error.message, { queueName });
        throw error;
      }

      // If it's a string, check for localhost
      if (isString && (connection.includes('127.0.0.1') || connection.includes('localhost'))) {
        const error = new Error(`FATAL: Cannot create Worker ${queueName} - connection string contains localhost: ${connection.substring(0, 100)}`);
        
        logger.error(error.message, { queueName, connection: connection.substring(0, 100) });
        throw error;
      }

      // If it's an IORedis instance, check its options
      if (isIORedis) {
        const options = connection.options || {};
        const host = options.host || options.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
          const error = new Error(`FATAL: Cannot create Worker ${queueName} - IORedis instance has localhost host: ${host}`);
          
          logger.error(error.message, { queueName, host });
          throw error;
        }
      }
    }

    logger.info(`✅ All checks passed. Creating Worker ${queueName} with valid connection.`);

    // ABSOLUTE FINAL CHECK: Verify connection one more time right before Worker creation
    // This prevents any possibility of connection being undefined when passed to BullMQ
    if (!connection || connection === undefined || connection === null) {
      const error = new Error(`FATAL: Connection became ${connection} right before Worker creation for ${queueName}. This should never happen.`);
      
      logger.error(error.message, { queueName, connection });
      throw error;
    }

    // CRITICAL: Double-check that connection is not a localhost object
    if (typeof connection === 'object' && (connection.host === 'localhost' || connection.host === '127.0.0.1')) {
      const error = new Error(`FATAL: Connection object contains localhost for ${queueName} right before Worker creation. This should never happen in production.`);
      
      logger.error(error.message, { queueName, connection });
      throw error;
    }

    // Log the exact connection being passed to BullMQ
    const finalConnectionLog = typeof connection === 'string'
      ? connection.substring(0, 50)
      : JSON.stringify(connection).substring(0, 50);
    
    logger.info(`[${queueName}] FINAL: Creating Worker`, {
      connectionType: typeof connection,
      connectionPreview: finalConnectionLog,
      connectionLength: typeof connection === 'string' ? connection.length : 0
    });

    let worker;
    try {
      worker = new Worker(
        queueName,
        async (job) => {
          logger.info('Processing job', {
            queue: queueName,
            jobId: job.id,
            attempt: job.attemptsMade + 1,
          });

          try {
            const result = await processor(job.data, job);
            logger.info('Job processed successfully', {
              queue: queueName,
              jobId: job.id,
            });
            return result;
          } catch (error) {
            logger.error('Job processing error', {
              queue: queueName,
              jobId: job.id,
              error: error.message,
            });
            throw error;
          }
        },
        {
          // CRITICAL: Ensure connection is explicitly set - never pass undefined
          // BullMQ defaults to localhost if connection is undefined
          connection: (() => {
            if (!connection || connection === undefined || connection === null) {
              const error = new Error(`FATAL: Connection is ${connection} when passing to BullMQ Worker constructor for ${queueName}`);
              
              logger.error(error.message, { queueName, connection });
              throw error;
            }

            // Check if it's an IORedis instance or IORedis-like (options + connect/status)
            const isIORedisByName = connection && typeof connection === 'object' && connection.constructor && connection.constructor.name === 'Redis';
            const isIORedisLike = connection && typeof connection === 'object' && connection.options && (typeof connection.connect === 'function' || typeof connection.status !== 'undefined');
            const isIORedis = isIORedisByName || isIORedisLike;
            // Plain options object (host + port + maybe password). The new
            // production code path returns this so BullMQ creates its own
            // IORedis instances cleanly per Queue/Worker/QueueEvents.
            const isOptionsObject = connection && typeof connection === 'object' && !isIORedis && typeof connection.host === 'string' && typeof connection.port === 'number';
            const isString = typeof connection === 'string';

            // In production, connection can be IORedis instance, options object, or URL string.
            if (isProduction) {
              if (!isIORedis && !isString && !isOptionsObject) {
                const error = new Error(`FATAL: Connection is not IORedis instance, options object, or string in production when passing to BullMQ for ${queueName}. Type: ${typeof connection}`);

                logger.error(error.message, { queueName, connectionType: typeof connection, isIORedis, isOptionsObject });
                throw error;
              }

              // If it's a string, check for localhost
              if (isString && (connection.includes('127.0.0.1') || connection.includes('localhost'))) {
                const error = new Error(`FATAL: Connection string contains localhost when passing to BullMQ for ${queueName}: ${connection.substring(0, 100)}`);

                logger.error(error.message, { queueName, connection: connection.substring(0, 100) });
                throw error;
              }

              // If it's an IORedis instance OR an options object, check its host
              if (isIORedis || isOptionsObject) {
                const options = isIORedis ? (connection.options || {}) : connection;
                const host = options.host || options.hostname;
                if (host === 'localhost' || host === '127.0.0.1') {
                  const error = new Error(`FATAL: ${isIORedis ? 'IORedis instance' : 'options object'} has localhost host when passing to BullMQ for ${queueName}: ${host}`);

                  logger.error(error.message, { queueName, host });
                  throw error;
                }
              }
            }

            
            return connection;
          })(),
          concurrency: options.concurrency || 1,
          limiter: options.limiter,
          ...options,
        }
      );
    } catch (workerError) {
      
      logger.error(`Failed to create Worker ${queueName}`, {
        error: workerError.message,
        stack: workerError.stack,
        connectionType: typeof connection,
        connectionPreview: typeof connection === 'string' ? connection.substring(0, 50) : JSON.stringify(connection).substring(0, 50)
      });
      throw workerError; // Re-throw to prevent worker creation
    }

    // Log immediately after Worker creation to see what connection was passed - use both console.log and logger
    const workerLogMsg = `[createWorker] Worker created for ${queueName}`;
    
    logger.info(workerLogMsg, {
      queueName,
      connectionType: typeof connection,
      connectionPreview: typeof connection === 'string'
        ? connection.substring(0, 50)
        : (connection ? JSON.stringify(connection).substring(0, 100) : 'null/undefined'),
      connectionLength: typeof connection === 'string' ? connection.length : 0,
      containsLocalhost: typeof connection === 'string'
        ? (connection.includes('localhost') || connection.includes('127.0.0.1'))
        : false
    });

    if (!connection || connection === undefined || connection === null) {
      const fatalMsg = `[createWorker] FATAL: Connection is ${connection} - BullMQ will default to localhost!`;
      
      logger.error(fatalMsg, { queueName, connection });
    }

    worker.on('completed', async (job) => {
      const duration = job.finishedOn - job.processedOn;

      logger.info('Worker completed job', {
        queue: queueName,
        jobId: job.id,
        duration,
      });

      // Track metrics
      try {
        const { trackJobMetrics, calculateJobCost } = require('./jobMetricsService');
        const processMemoryUsage = process.memoryUsage();

        await trackJobMetrics(queueName, job.id, {
          duration,
          memoryUsage: processMemoryUsage.heapUsed,
          cpuUsage: 0, // Would need additional monitoring
          cost: calculateJobCost(queueName, duration, processMemoryUsage.heapUsed),
          success: true,
          retries: job.attemptsMade,
        });
      } catch (error) {
        logger.warn('Failed to track job metrics', { error: error.message });
      }

      // Process job dependencies
      try {
        const { processJobDependencies } = require('./jobDependencyService');
        await processJobDependencies(job.id, queueName);
      } catch (error) {
        logger.warn('Failed to process job dependencies', { error: error.message });
      }
    });

    worker.on('failed', async (job, err) => {
      logger.error('Worker failed job', {
        queue: queueName,
        jobId: job?.id,
        error: err.message,
        attempts: job?.attemptsMade,
      });

      const userId = job?.data?.userId?.toString?.() || job?.data?.user?._id?.toString?.() || job?.data?.user?.toString?.() || null;
      if (userId) {
        try {
          const notificationService = require('./notificationService');
          await notificationService.createNotificationForChange(userId, 'job_failed', {
            jobId: job.id,
            entityName: job.name || 'Job',
            reason: err?.message || 'Unknown error',
            link: '/dashboard/jobs'
          });
        } catch (notifErr) {
          logger.warn('Job failed notification not sent', { jobId: job?.id, error: notifErr.message });
        }
      }

      // Move to dead letter queue if max attempts reached
      if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
        try {
          const { moveToDeadLetter } = require('./jobDeadLetterService');
          await moveToDeadLetter(queueName, job.id, err.message);
        } catch (error) {
          logger.error('Failed to move job to dead letter queue', {
            jobId: job.id,
            error: error.message,
          });
        }
      }

      // Process job dependencies even on failure (optional)
      try {
        const { processJobDependencies } = require('./jobDependencyService');
        await processJobDependencies(job.id, queueName);
      } catch (error) {
        // Ignore dependency processing errors
      }
    });

    worker.on('error', (err) => {
      // Check if error is due to localhost connection in production
      if (err.message && err.message.includes('127.0.0.1') && (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')) {
        logger.error(`❌ CRITICAL: Worker ${queueName} is trying to connect to localhost in production!`);
        logger.error(`❌ This should never happen. REDIS_URL must be set in Render.com.`);
        logger.error(`❌ Error: ${err.message}`);
        logger.error(`❌ Closing worker to prevent further localhost connection attempts.`);
        worker.close().catch(() => { });
        delete workers[queueName];
        return;
      }

      logger.error('Worker error', { queue: queueName, error: err.message });
      captureException(err, { tags: { queue: queueName, type: 'worker_error' } });
    });

    workers[queueName] = worker;
    logger.info(`Worker created for queue: ${queueName}`);

    return worker;
  } catch (error) {
    logger.error(`Failed to create worker for ${queueName}`, { error: error.message });
    // Don't throw - workers are optional
    return null;
  }
}

/**
 * Get job status
 */
async function getJobStatus(queueName, jobId) {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress || 0;

    return {
      id: job.id,
      name: job.name,
      state,
      progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      createdAt: new Date(job.timestamp),
    };
  } catch (error) {
    logger.error('Failed to get job status', { queue: queueName, jobId, error: error.message });
    throw error;
  }
}

/**
 * Get queue statistics
 */
async function getQueueStats(queueName) {
  try {
    const queue = getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  } catch (error) {
    logger.error('Failed to get queue stats', { queue: queueName, error: error.message });
    throw error;
  }
}

/**
 * Cancel job
 */
async function cancelJob(queueName, jobId) {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    await job.remove();
    logger.info('Job cancelled', { queue: queueName, jobId });
    return true;
  } catch (error) {
    logger.error('Failed to cancel job', { queue: queueName, jobId, error: error.message });
    throw error;
  }
}

/**
 * Retry failed job
 */
async function retryJob(queueName, jobId) {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    await job.retry();
    logger.info('Job retried', { queue: queueName, jobId });
    return true;
  } catch (error) {
    logger.error('Failed to retry job', { queue: queueName, jobId, error: error.message });
    throw error;
  }
}

/**
 * Clean up old jobs
 */
async function cleanQueue(queueName, grace = 5000) {
  try {
    const queue = getQueue(queueName);
    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace, 100, 'failed');
    logger.info('Queue cleaned', { queue: queueName });
  } catch (error) {
    logger.error('Failed to clean queue', { queue: queueName, error: error.message });
  }
}

/**
 * Close all queues and workers
 */
async function closeAll() {
  try {
    // Close all workers
    for (const [name, worker] of Object.entries(workers)) {
      await worker.close();
      logger.info('Worker closed', { queue: name });
    }

    // Close all queues
    for (const [name, queue] of Object.entries(queues)) {
      await queue.close();
      logger.info('Queue closed', { queue: name });
    }

    // Close all queue events
    for (const [name, events] of Object.entries(queueEvents)) {
      await events.close();
    }

    // Close shared Redis connection (if any) and clear caches
    if (redisIORedisInstance) {
      try {
        await redisIORedisInstance.quit();
      } catch (_) {
        try { redisIORedisInstance.disconnect(false); } catch (__) { /* ignore */ }
      }
      redisIORedisInstance = null;
    }
    redisConnection = null;
    for (const key of Object.keys(workers)) delete workers[key];
    for (const key of Object.keys(queues)) delete queues[key];
    for (const key of Object.keys(queueEvents)) delete queueEvents[key];

    logger.info('All queues and workers closed');
  } catch (error) {
    logger.error('Error closing queues', { error: error.message });
  }
}

/**
 * Get job progress
 * @param {string} queueName - Queue name
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Job progress
 */
async function getJobProgress(queueName, jobId) {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    const progress = job.progress || 0;
    const returnvalue = job.returnvalue || null;
    const failedReason = job.failedReason || null;

    return {
      jobId,
      queue: queueName,
      state,
      progress,
      returnvalue,
      failedReason,
      data: job.data,
      opts: job.opts,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  } catch (error) {
    logger.error('Error getting job progress', { queueName, jobId, error: error.message });
    throw error;
  }
}

/**
 * Get all jobs for a queue with their progress
 * @param {string} queueName - Queue name
 * @param {string} state - Job state filter (optional)
 * @param {number} limit - Limit results
 * @returns {Promise<Array>} Jobs with progress
 */
async function getJobsWithProgress(queueName, state = null, limit = 100) {
  try {
    const queue = getQueue(queueName);
    let jobs;

    if (state) {
      jobs = await queue.getJobs([state], 0, limit);
    } else {
      // Get jobs from all states
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getJobs(['waiting'], 0, limit),
        queue.getJobs(['active'], 0, limit),
        queue.getJobs(['completed'], 0, limit),
        queue.getJobs(['failed'], 0, limit),
        queue.getJobs(['delayed'], 0, limit),
      ]);
      jobs = [...waiting, ...active, ...completed, ...failed, ...delayed].slice(0, limit);
    }

    // Get progress for each job
    const jobsWithProgress = await Promise.all(
      jobs.map(async (job) => {
        const jobState = await job.getState();
        return {
          id: job.id,
          name: job.name,
          data: job.data,
          state: jobState,
          progress: job.progress || 0,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
        };
      })
    );

    return jobsWithProgress;
  } catch (error) {
    logger.error('Error getting jobs with progress', { queueName, error: error.message });
    throw error;
  }
}

/**
 * Get active (in-progress) jobs for a user across user-facing queues.
 * Used by live-status feed. Returns list of { id, title, status, type: 'job', queue }.
 */
async function getActiveJobsForUser(userId) {
  const uid = userId != null && typeof userId === 'object' && userId.toString ? userId.toString() : String(userId);
  const queuesToCheck = [
    'video-processing',
    'content-generation',
    'transcript-generation',
    'file-processing',
    'social-posting'
  ];
  const out = [];
  try {
    for (const queueName of queuesToCheck) {
      try {
        const queue = getQueue(queueName);
        const jobs = await queue.getJobs(['active'], 0, 30);
        for (const job of jobs) {
          const jobUserId = job.data?.userId?.toString?.() || job.data?.user?._id?.toString?.() || job.data?.user?.toString?.() || null;
          if (jobUserId === uid) {
            out.push({
              id: job.id,
              title: job.name || queueName,
              status: 'active',
              type: 'job',
              queue: queueName,
              updatedAt: job.processedOn ? new Date(job.processedOn) : new Date(job.timestamp)
            });
          }
        }
      } catch (qErr) {
        logger.debug('getActiveJobsForUser queue skipped', { queueName, error: qErr.message });
      }
      if (out.length >= 20) break;
    }
    return out.slice(0, 20);
  } catch (error) {
    logger.warn('getActiveJobsForUser failed', { userId: uid, error: error.message });
    return [];
  }
}

module.exports = {
  getQueue,
  addJob,
  createWorker,
  getJobStatus,
  getQueueStats,
  cancelJob,
  retryJob,
  cleanQueue,
  closeAll,
  getRedisConnection, // Export for debugging
  getJobProgress,
  getJobsWithProgress,
  getActiveJobsForUser,
  verifyRedisConnection, // Export for pre-flight checks
};

/**
 * Perform a one-time ping to verify Redis connectivity
 * Returns true if successful, false otherwise
 */
async function verifyRedisConnection(redis) {
  if (!redis) return false;
  
  // If it's a string, we need to create a temporary instance to ping
  let instance = redis;
  let createdInstance = false;
  
  if (typeof redis === 'string') {
    if (!IORedis) return false;
    try {
      instance = new IORedis(redis, {
        maxRetriesPerRequest: 0, // Fail fast
        connectTimeout: 2000,
        lazyConnect: true
      });
      createdInstance = true;
    } catch (err) {
      logger.error('Failed to create test Redis instance', { error: err.message });
      return false;
    }
  }

  try {
    // Perform ping with timeout
    const pingPromise = typeof instance.ping === 'function' ? instance.ping() : Promise.resolve('PONG');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Redis ping timeout')), 2000)
    );

    const result = await Promise.race([pingPromise, timeoutPromise]);
    
    if (result === 'PONG') {
      return true;
    }
    return false;
  } catch (error) {
    logger.debug('Redis connectivity check failed', { error: error.message });
    return false;
  } finally {
    // If we created a temporary instance, close it
    if (createdInstance && instance && typeof instance.quit === 'function') {
      try { await instance.quit(); } catch (_) { 
        try { instance.disconnect(false); } catch (__) { /* ignore */ }
      }
    }
  }
}




