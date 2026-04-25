# Cross-Client Features

## Overview

Cross-client content templates, AI content health analysis, gap analysis with roll-up views, and smart evergreen queues for agencies managing multiple clients.

---

## 1. Cross-Client Content Templates

### Features
- **Reusable Templates**: Apply same template to any client's long-form content
- **Multi-Platform Output**: Generate multiple formats from single source
- **Example**: "Podcast → 10 short clips + 5 LinkedIn posts + 3 tweets"
- **Customizable**: Configure outputs, processing rules, AI settings
- **Usage Tracking**: Track template usage and success rates

### Template Structure
```javascript
{
  name: "Podcast to Multi-Platform",
  sourceType: "podcast",
  outputs: [
    {
      platform: "tiktok",
      format: "short_clip",
      count: 5,
      config: { duration: 60, aspectRatio: "9:16" }
    },
    {
      platform: "linkedin",
      format: "post",
      count: 5,
      config: { maxLength: 3000 }
    },
    {
      platform: "twitter",
      format: "tweet",
      count: 3,
      config: { maxLength: 280 }
    }
  ]
}
```

### Model: `CrossClientTemplate`
- Source type (podcast, video, article, etc.)
- Output configurations per platform
- Processing rules
- AI configuration
- Usage tracking

### Service: `crossClientTemplateService.js`
- `createCrossClientTemplate()` - Create new template
- `applyTemplateToContent()` - Apply template to content
- `getAgencyTemplates()` - Get all templates
- `createDefaultTemplates()` - Create default templates

### Default Templates
1. **Podcast to Multi-Platform**: 10 clips + 5 LinkedIn + 3 tweets
2. **Video to Social Media**: 8 clips + 4 posts

### API Endpoints
- `POST /api/agency/:agencyWorkspaceId/cross-client-templates` - Create template
- `GET /api/agency/:agencyWorkspaceId/cross-client-templates` - List templates
- `POST /api/agency/:agencyWorkspaceId/cross-client-templates/:templateId/apply` - Apply template
- `POST /api/agency/:agencyWorkspaceId/cross-client-templates/default` - Create defaults

---

## 2. AI Content Health Analysis

### Features
- **Per-Client Analysis**: Analyze content health for each client
- **Multi-Dimensional Scoring**: Freshness, diversity, engagement, consistency, relevance, volume
- **Platform Breakdown**: Per-platform health scores and issues
- **Gap Identification**: Identify content gaps automatically
- **Strengths & Opportunities**: Highlight what's working and what could improve
- **AI Insights**: AI-powered recommendations

### Health Scores
- **Freshness** (15%): How recent is the content
- **Diversity** (20%): Variety in types, topics, formats, platforms
- **Engagement** (25%): Average engagement rates
- **Consistency** (15%): Posting frequency and regularity
- **Relevance** (15%): Content relevance to audience
- **Volume** (10%): Posting frequency

### Model: `ContentHealth`
- Overall score (0-100)
- Individual scores per dimension
- Platform breakdown with issues
- Gaps, strengths, opportunities
- AI insights
- Metadata (niche, industry, audience)

### Service: `contentHealthService.js`
- `analyzeContentHealth()` - Analyze client content health
- `getRollUpView()` - Get aggregated view by niche/platform

### API Endpoints
- `POST /api/clients/:clientWorkspaceId/content-health/analyze` - Analyze health
- `GET /api/clients/:clientWorkspaceId/content-health` - Get health history
- `GET /api/agency/:agencyWorkspaceId/content-health/rollup` - Get roll-up view

---

## 3. Gap Analysis with Roll-Up View

### Features
- **Per-Client Gaps**: Identify gaps for each client
- **Roll-Up by Niche**: Aggregate gaps across clients in same niche
- **Roll-Up by Platform**: Aggregate gaps across platforms
- **Common Gaps**: Identify most common gaps across clients
- **Opportunity Identification**: Highlight growth opportunities

### Gap Categories
- **Topic**: Missing topic coverage
- **Format**: Missing content formats
- **Platform**: Not posting on certain platforms
- **Timing**: Inconsistent posting times
- **Audience**: Missing audience segments
- **CTA**: Missing call-to-actions
- **Hashtag**: Missing or poor hashtag usage

### Roll-Up View Structure
```javascript
{
  niche: "SaaS",
  clients: [...],
  averageScore: 75,
  platformBreakdown: {
    linkedin: {
      averageScore: 80,
      totalPosts: 150,
      averageEngagement: 250
    }
  },
  commonGaps: [
    { description: "Missing video content", count: 5, priority: 9 }
  ],
  opportunities: [...]
}
```

### API Endpoints
- `GET /api/agency/:agencyWorkspaceId/content-health/rollup` - Get roll-up view

---

## 4. Smart Evergreen Queues

### Features
- **Per-Client Queues**: Separate evergreen queue per client
- **Auto-Detection**: Automatically detect evergreen content
- **Auto-Population**: Auto-populate queue with high-scoring content
- **Auto-Scheduling**: Automatically schedule from queue
- **Performance Tracking**: Track content performance over time
- **Auto-Refresh**: Refresh scores and archive low performers

### Evergreen Detection
- **Timeless Topics**: Content about fundamentals, how-tos, guides
- **Age Factor**: Older content that still performs
- **Performance History**: Based on engagement history
- **No Time-Sensitive References**: Avoids dated content

### Queue Settings
- **Min Evergreen Score**: Minimum score to include (default: 70)
- **Max Uses Per Item**: How many times to reuse (default: 10)
- **Rotation Frequency**: How often to rotate (daily, weekly, biweekly, monthly)
- **Posting Frequency**: How often to post from queue
- **Refresh Threshold**: When to refresh/archive items

### Model: `EvergreenQueue`
- Client workspace ID
- Platform (or 'all')
- Content items with scores
- Settings and stats
- Auto-schedule configuration

### Service: `evergreenQueueService.js`
- `createEvergreenQueue()` - Create new queue
- `populateEvergreenQueue()` - Auto-populate with evergreen content
- `autoScheduleFromQueue()` - Auto-schedule next items
- `refreshEvergreenQueue()` - Refresh scores and performance
- `getClientEvergreenQueues()` - Get client queues

### Queue Item Structure
```javascript
{
  contentId: "...",
  evergreenScore: 85,
  useCount: 3,
  status: "active",
  performance: {
    averageEngagement: 250,
    trend: "increasing"
  },
  nextScheduledDate: Date
}
```

### API Endpoints
- `POST /api/clients/:clientWorkspaceId/evergreen-queues` - Create queue
- `GET /api/clients/:clientWorkspaceId/evergreen-queues` - Get queues
- `POST /api/evergreen-queues/:queueId/populate` - Populate queue
- `POST /api/evergreen-queues/:queueId/auto-schedule` - Auto-schedule
- `POST /api/evergreen-queues/:queueId/refresh` - Refresh queue

---

## 5. Benefits

### For Agencies
1. **Efficiency**: Reuse templates across clients
2. **Consistency**: Standardize content creation process
3. **Insights**: Understand client content health at a glance
4. **Opportunities**: Identify growth opportunities by niche/platform
5. **Automation**: Reduce manual work with evergreen queues

### For Clients
1. **Quality**: Better content through proven templates
2. **Consistency**: Regular posting through evergreen queues
3. **Performance**: Better engagement through optimized content
4. **Efficiency**: Less time creating from scratch

---

## 6. Usage Examples

### Create and Apply Template
```javascript
// Create template
POST /api/agency/{workspaceId}/cross-client-templates
{
  "name": "Podcast to Multi-Platform",
  "sourceType": "podcast",
  "outputs": [...]
}

// Apply to client content
POST /api/agency/{workspaceId}/cross-client-templates/{templateId}/apply
{
  "contentId": "...",
  "clientWorkspaceId": "...",
  "autoSchedule": true
}
```

### Analyze Content Health
```javascript
// Analyze client
POST /api/clients/{clientWorkspaceId}/content-health/analyze

// Get roll-up view
GET /api/agency/{agencyWorkspaceId}/content-health/rollup?niche=SaaS
```

### Create Evergreen Queue
```javascript
// Create queue
POST /api/clients/{clientWorkspaceId}/evergreen-queues
{
  "name": "LinkedIn Evergreen",
  "platform": "linkedin",
  "settings": {
    "autoSchedule": true,
    "rotationFrequency": "weekly"
  }
}

// Populate
POST /api/evergreen-queues/{queueId}/populate

// Auto-schedule
POST /api/evergreen-queues/{queueId}/auto-schedule
```

---

## 7. Models Summary

### CrossClientTemplate
- Reusable templates for agencies
- Multi-platform output configuration
- Usage tracking

### ContentHealth
- Per-client health analysis
- Multi-dimensional scoring
- Gap identification
- Roll-up support

### EvergreenQueue
- Per-client evergreen content queues
- Auto-scheduling
- Performance tracking
- Auto-refresh

---

## 8. Services Summary

### crossClientTemplateService.js
- Template creation and management
- Template application to content
- Default template generation

### contentHealthService.js
- Content health analysis
- Gap identification
- Roll-up view generation

### evergreenQueueService.js
- Queue creation and management
- Auto-population
- Auto-scheduling
- Performance tracking

### evergreenDetectionService.js
- Evergreen content detection
- Score calculation

---

## 9. API Summary

### Cross-Client Templates (4 endpoints)
- Create template
- List templates
- Apply template
- Create defaults

### Content Health (3 endpoints)
- Analyze health
- Get health history
- Get roll-up view

### Evergreen Queues (5 endpoints)
- Create queue
- Get queues
- Populate queue
- Auto-schedule
- Refresh queue

**Total: 12 endpoints**

---

All features are implemented, tested, and ready for production use!


