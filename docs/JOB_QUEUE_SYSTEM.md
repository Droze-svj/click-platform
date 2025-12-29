# 📋 Background Job Queue System

Complete guide to the BullMQ-based background job queue system.

---

## 🎯 Overview

The job queue system uses **BullMQ** with **Redis** to handle background processing tasks. This ensures:

- ✅ Non-blocking operations
- ✅ Automatic retries
- ✅ Job prioritization
- ✅ Progress tracking
- ✅ Scalable processing
- ✅ Job persistence

---

## 🏗️ Architecture

### Components

1. **Job Queue Service** (`server/services/jobQueueService.js`)
   - Core BullMQ integration
   - Queue and worker management
   - Job status tracking

2. **Queue Manager** (`server/queues/index.js`)
   - Queue definitions
   - Helper functions for adding jobs
   - Queue statistics

3. **Workers** (`server/workers/`)
   - Video processing
   - Content generation
   - Email sending
   - Transcript generation
   - Social media posting

4. **Job Scheduler** (`server/services/jobScheduler.js`)
   - Scheduled jobs
   - Recurring tasks
   - Cleanup operations

---

## 📦 Available Queues

### 1. Video Processing (`video-processing`)
- **Purpose**: Process uploaded videos
- **Concurrency**: 2 jobs
- **Rate Limit**: 5 jobs/minute
- **Priority**: High

**Usage:**
```javascript
const { addVideoProcessingJob, JOB_PRIORITY } = require('../queues');

const job = await addVideoProcessingJob({
  contentId: 'content-id',
  videoPath: '/path/to/video.mp4',
  user: { _id: 'user-id', email: 'user@example.com' },
}, {
  priority: JOB_PRIORITY.HIGH,
});
```

### 2. Content Generation (`content-generation`)
- **Purpose**: Generate social media content
- **Concurrency**: 5 jobs
- **Rate Limit**: 20 jobs/minute

**Usage:**
```javascript
const { addContentGenerationJob } = require('../queues');

const job = await addContentGenerationJob({
  contentId: 'content-id',
  text: 'Input text...',
  user: { _id: 'user-id' },
  platforms: ['twitter', 'linkedin'],
});
```

### 3. Email Sending (`email-sending`)
- **Purpose**: Send emails
- **Concurrency**: 10 jobs
- **Rate Limit**: 100 emails/minute

**Usage:**
```javascript
const { addEmailJob } = require('../queues');

const job = await addEmailJob({
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome',
  data: { name: 'John' },
});
```

### 4. Transcript Generation (`transcript-generation`)
- **Purpose**: Generate video transcripts
- **Concurrency**: 3 jobs
- **Rate Limit**: 10 jobs/minute

**Usage:**
```javascript
const { addTranscriptJob } = require('../queues');

const job = await addTranscriptJob({
  contentId: 'content-id',
  videoUrl: 'https://example.com/video.mp4',
  language: 'en',
  userId: 'user-id',
});
```

### 5. Social Media Posting (`social-posting`)
- **Purpose**: Post to social platforms
- **Concurrency**: 5 jobs
- **Rate Limit**: 20 posts/minute

**Usage:**
```javascript
const { addSocialPostJob } = require('../queues');

const job = await addSocialPostJob({
  userId: 'user-id',
  contentId: 'content-id',
  platforms: ['twitter', 'linkedin'],
  content: {
    text: 'Post content...',
    imageUrl: 'https://example.com/image.jpg',
  },
});
```

### 6. Scheduled Posts (`scheduled-posts`)
- **Purpose**: Schedule future posts
- **Concurrency**: 5 jobs

**Usage:**
```javascript
const { addScheduledPostJob } = require('../queues');

const job = await addScheduledPostJob({
  userId: 'user-id',
  contentId: 'content-id',
  platforms: ['twitter'],
  content: { text: 'Scheduled post...' },
}, new Date('2024-12-25T10:00:00Z'));
```

---

## 🔧 Job Priorities

```javascript
const { JOB_PRIORITY } = require('../queues');

JOB_PRIORITY.CRITICAL  // 10 - Highest priority
JOB_PRIORITY.HIGH      // 5
JOB_PRIORITY.NORMAL    // 0 - Default
JOB_PRIORITY.LOW       // -5
```

---

## 📊 Job Status

### States
- `waiting` - Job is queued
- `active` - Job is being processed
- `completed` - Job finished successfully
- `failed` - Job failed after retries
- `delayed` - Job scheduled for future

### Get Job Status
```javascript
const { getJobStatus } = require('../services/jobQueueService');

const status = await getJobStatus('video-processing', 'job-id');
console.log(status);
// {
//   id: 'job-id',
//   state: 'active',
//   progress: 50,
//   attemptsMade: 0,
//   ...
// }
```

---

## 🎛️ API Endpoints

### User Endpoints

**GET `/api/jobs/user`**
- Get all user's jobs

**GET `/api/jobs/user/:jobId`**
- Get specific job status

**POST `/api/jobs/user/:jobId/cancel`**
- Cancel user's job

### Admin Endpoints

**GET `/api/jobs/dashboard`**
- Get comprehensive dashboard data

**GET `/api/jobs/dashboard/stats`**
- Get all queue statistics

**GET `/api/jobs/dashboard/jobs/:queueName`**
- Get jobs for specific queue

**GET `/api/jobs/status/:queueName/:jobId`**
- Get job status

**GET `/api/jobs/stats/:queueName`**
- Get queue statistics

**POST `/api/jobs/cancel/:queueName/:jobId`**
- Cancel job

**POST `/api/jobs/retry/:queueName/:jobId`**
- Retry failed job

---

## 🔄 Job Scheduling

### Schedule One-Time Job
```javascript
const { scheduleJob } = require('../services/jobScheduler');

await scheduleJob(
  'email-sending',
  { name: 'send-email', data: { to: 'user@example.com' } },
  new Date('2024-12-25T10:00:00Z')
);
```

### Scheduled Posts
The system automatically processes scheduled posts every minute.

---

## 🧹 Cleanup

Old jobs are automatically cleaned up:
- **Completed jobs**: Removed after 24 hours
- **Failed jobs**: Removed after 7 days
- **Daily cleanup**: Runs at 2 AM

---

## 📈 Monitoring

### Queue Statistics
```javascript
const { getAllQueueStats } = require('../queues');

const stats = await getAllQueueStats();
console.log(stats);
// {
//   'video-processing': { waiting: 5, active: 2, completed: 100, ... },
//   'content-generation': { waiting: 3, active: 1, ... },
//   ...
// }
```

### Worker Events
Workers emit events for monitoring:
- `completed` - Job completed
- `failed` - Job failed
- `error` - Worker error
- `progress` - Job progress update

---

## ⚙️ Configuration

### Redis Connection

**Option 1: Redis URL**
```env
REDIS_URL=redis://localhost:6379
```

**Option 2: Individual Config**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

### Environment Variables
```env
# Redis (required for job queue)
REDIS_URL=redis://localhost:6379

# Optional: Custom Redis config
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## 🚀 Initialization

Workers are automatically initialized on server startup:

```javascript
// In server/index.js
const { initializeWorkers } = require('./queues');
const { initializeScheduler } = require('./services/jobScheduler');

initializeWorkers();
initializeScheduler();
```

---

## 🔍 Troubleshooting

### Workers Not Starting
1. Check Redis connection
2. Verify `REDIS_URL` or `REDIS_HOST` is set
3. Check Redis is running: `redis-cli ping`

### Jobs Not Processing
1. Check worker logs: `pm2 logs click-api`
2. Verify workers are initialized
3. Check queue statistics

### High Memory Usage
1. Reduce concurrency in worker configs
2. Clean up old jobs: `cleanAllQueues()`
3. Monitor queue sizes

---

## 📝 Best Practices

1. **Use Appropriate Priorities**
   - Critical: Time-sensitive operations
   - High: User-facing operations
   - Normal: Standard operations
   - Low: Background tasks

2. **Handle Errors Gracefully**
   - Jobs automatically retry (3 attempts by default)
   - Log errors for debugging
   - Update status in database

3. **Update Progress**
   - Use `job.updateProgress(percentage)` for long-running jobs
   - Emit real-time updates to users

4. **Monitor Queue Sizes**
   - Set up alerts for large queues
   - Scale workers if needed

5. **Clean Up Resources**
   - Remove temporary files after processing
   - Update database status
   - Emit completion events

---

## 🎯 Example: Adding a New Queue

1. **Define Queue Name**
```javascript
// In server/queues/index.js
const QUEUE_NAMES = {
  // ... existing queues
  MY_NEW_QUEUE: 'my-new-queue',
};
```

2. **Create Worker**
```javascript
// server/workers/myProcessor.js
const { createWorker } = require('../services/jobQueueService');

async function processMyJob(jobData, job) {
  // Process job
  await job.updateProgress(50);
  // ... processing logic
  await job.updateProgress(100);
  return { success: true };
}

function initializeMyWorker() {
  return createWorker('my-new-queue', processMyJob, {
    concurrency: 3,
  });
}

module.exports = { initializeMyWorker };
```

3. **Add Helper Function**
```javascript
// In server/queues/index.js
async function addMyJob(data, options = {}) {
  return addJob(QUEUE_NAMES.MY_NEW_QUEUE, {
    name: 'my-job',
    data,
  }, options);
}
```

4. **Initialize Worker**
```javascript
// In server/workers/index.js
const { initializeMyWorker } = require('./myProcessor');
initializeMyWorker();
```

---

**Job queue system is ready for production use!** 🚀



