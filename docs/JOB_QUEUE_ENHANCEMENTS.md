# 🚀 Job Queue System Enhancements

Advanced features added to the background job queue system.

---

## ✨ New Features

### 1. Job Metrics & Analytics 📊

Track job performance, costs, and analytics.

**Features:**
- Duration tracking
- Memory usage monitoring
- Cost calculation per job
- Success/failure rates
- Retry statistics

**Usage:**
```javascript
const { getQueueMetrics, getUserJobMetrics } = require('./services/jobMetricsService');

// Get queue metrics
const metrics = await getQueueMetrics('video-processing', '24h');
// Returns: { total, successful, failed, averageDuration, averageMemory, totalCost, totalRetries }

// Get user metrics
const userMetrics = await getUserJobMetrics(userId, '7d');
```

**API:**
- `GET /api/jobs/metrics/queue/:queueName` - Queue metrics (admin)
- `GET /api/jobs/metrics/user` - User job metrics

---

### 2. Job Dependencies 🔗

Chain jobs together - jobs that depend on other jobs completing.

**Features:**
- Job chaining
- Automatic dependency processing
- Dependency tracking

**Usage:**
```javascript
const { addDependentJob, chainJobs } = require('./services/jobDependencyService');

// Add dependent job
await addDependentJob(
  {
    queueName: 'content-generation',
    name: 'generate-content',
    data: { contentId: '123' },
  },
  'parent-job-id',
  'video-processing'
);

// Chain multiple jobs
await chainJobs([
  { queueName: 'video-processing', name: 'process-video', data: {...} },
  { queueName: 'transcript-generation', name: 'generate-transcript', data: {...} },
  { queueName: 'content-generation', name: 'generate-content', data: {...} },
]);
```

---

### 3. Job Batching 📦

Process multiple jobs together efficiently.

**Features:**
- Batch job creation
- Batch processing
- Efficient resource usage

**Usage:**
```javascript
const { addBatchJobs, createBatchJob } = require('./services/jobBatchingService');

// Add multiple jobs at once
const jobs = await addBatchJobs('email-sending', [
  { name: 'send-email', data: { to: 'user1@example.com' } },
  { name: 'send-email', data: { to: 'user2@example.com' } },
  { name: 'send-email', data: { to: 'user3@example.com' } },
]);

// Create batch processing job
const batchJob = await createBatchJob(
  'content-generation',
  items, // Array of items to process
  batchProcessor, // Function to process batch
  { batchSize: 10 }
);
```

---

### 4. Dead Letter Queue 💀

Handle permanently failed jobs.

**Features:**
- Automatic dead letter queue
- Failed job storage
- Retry capability
- Cleanup automation

**Usage:**
```javascript
const {
  getDeadLetterJobs,
  retryDeadLetterJob,
  cleanupDeadLetterJobs,
} = require('./services/jobDeadLetterService');

// Get dead letter jobs
const failedJobs = await getDeadLetterJobs('video-processing');

// Retry a dead letter job
await retryDeadLetterJob('dead-letter-job-id', 'video-processing');

// Cleanup old dead letter jobs
await cleanupDeadLetterJobs(30); // Delete jobs older than 30 days
```

**API:**
- `GET /api/jobs/dead-letter` - Get dead letter jobs (admin)
- `POST /api/jobs/dead-letter/:id/retry` - Retry dead letter job (admin)
- `POST /api/jobs/dead-letter/cleanup` - Cleanup old jobs (admin)

---

### 5. Per-User Rate Limiting 🚦

Prevent job queue abuse with per-user rate limits.

**Features:**
- Per-user rate limits
- Per-queue limits
- Automatic reset
- Rate limit status

**Usage:**
```javascript
const { addJobWithRateLimit, getUserRateLimitStatus } = require('./services/jobRateLimiterService');

// Add job with rate limiting
const { job, rateLimit } = await addJobWithRateLimit(
  'video-processing',
  { name: 'process-video', data: {...} },
  userId,
  {
    rateLimits: {
      'video-processing': { max: 10, window: 3600000 }, // 10 per hour
    },
  }
);

// Check rate limit status
const status = getUserRateLimitStatus(userId, 'video-processing');
// Returns: { count, limit, remaining, resetAt }
```

**Default Limits:**
- Video Processing: 10/hour
- Content Generation: 50/hour
- Transcript Generation: 20/hour
- Social Posting: 100/hour
- Email Sending: 200/hour

---

## 🔧 Enhanced Features

### Automatic Metrics Tracking

All jobs now automatically track:
- Execution duration
- Memory usage
- Estimated cost
- Success/failure status
- Retry count

### Automatic Dead Letter Queue

Jobs that fail after all retries are automatically moved to the dead letter queue.

### Job Dependency Processing

When a job completes, all dependent jobs are automatically started.

### Cost Calculation

Jobs calculate their estimated cost based on:
- Queue type (different base costs)
- Execution duration
- Memory usage

---

## 📊 Monitoring & Analytics

### Queue Metrics Dashboard

Access comprehensive metrics via:
- `GET /api/jobs/metrics/queue/:queueName?timeRange=24h`
- Time ranges: `1h`, `24h`, `7d`, `30d`

### User Metrics

Track individual user job usage:
- `GET /api/jobs/metrics/user?timeRange=7d`

### Dead Letter Monitoring

Monitor permanently failed jobs:
- `GET /api/jobs/dead-letter?queueName=video-processing&limit=100`

---

## 🎯 Best Practices

### 1. Use Job Dependencies for Workflows

```javascript
// Process video, then generate transcript, then create content
await chainJobs([
  { queueName: 'video-processing', ... },
  { queueName: 'transcript-generation', ... },
  { queueName: 'content-generation', ... },
]);
```

### 2. Batch Similar Jobs

```javascript
// Send multiple emails efficiently
await addBatchJobs('email-sending', emailJobs);
```

### 3. Monitor Dead Letter Queue

Regularly check and retry dead letter jobs:
```javascript
const failedJobs = await getDeadLetterJobs();
for (const job of failedJobs) {
  // Investigate and retry if appropriate
  await retryDeadLetterJob(job._id);
}
```

### 4. Track Costs

Monitor job costs to optimize:
```javascript
const metrics = await getQueueMetrics('video-processing', '7d');
console.log(`Total cost: $${metrics.totalCost.toFixed(4)}`);
```

### 5. Set Appropriate Rate Limits

Configure rate limits based on your needs:
```javascript
await addJobWithRateLimit(queueName, jobData, userId, {
  rateLimits: {
    'video-processing': { max: 5, window: 3600000 }, // 5 per hour
  },
});
```

---

## 🔄 Automatic Cleanup

The system automatically cleans up:
- **Completed jobs**: After 24 hours
- **Failed jobs**: After 7 days
- **Dead letter jobs**: After 90 days (configurable)
- **Job metrics**: After 90 days
- **Job dependencies**: After 7 days

---

## 📈 Performance Improvements

1. **Batch Processing**: Reduces overhead for multiple similar jobs
2. **Dependency Chaining**: Efficient workflow execution
3. **Metrics Tracking**: Minimal overhead, async tracking
4. **Rate Limiting**: In-memory (fast), can be moved to Redis for distributed systems

---

## 🚨 Error Handling

All enhancements include:
- Comprehensive error logging
- Graceful degradation
- Automatic retries where appropriate
- Dead letter queue for permanent failures

---

## 📝 Models

### JobMetrics
Tracks job execution metrics with TTL (90 days).

### JobDependency
Tracks job dependencies with TTL (7 days).

### DeadLetterJob
Stores permanently failed jobs with TTL (90 days).

---

**Enhanced job queue system is production-ready!** 🚀



