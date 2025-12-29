# Social Performance Metrics System

## Overview

Enhanced core social performance metrics: reach & impressions tracking, engagement rate calculation (multiple formulas), and audience growth tracking (followers, growth rate, churn).

---

## 1. Reach & Impressions

### Features
- **Impressions**: Total number of times content was displayed
- **Reach**: Unique number of people who saw the content
- **Unique Reach**: Distinct users reached
- **Automatic Tracking**: Updated when analytics are synced
- **Historical Tracking**: Track over time

### Enhanced Analytics Schema
```javascript
analytics: {
  impressions: Number,
  reach: Number,
  uniqueReach: Number,
  followersAtPost: Number // Follower count at time of post
}
```

### Service: `socialPerformanceMetricsService.js`
- `updateReachAndImpressions()` - Update reach and impressions
- Automatic calculation when analytics are synced

### API Endpoints
- `PUT /api/posts/:postId/analytics/reach-impressions` - Update reach/impressions

---

## 2. Engagement Rate

### Features
- **Multiple Formulas**: Calculate by reach, impressions, or followers
- **Engagement Breakdown**: Detailed breakdown of engagement types
- **Automatic Calculation**: Calculated when analytics are updated
- **Quality Signal**: Primary quality metric for content

### Engagement Rate Formulas

#### By Reach
```
Engagement Rate = (Total Engagement / Reach) × 100
```
- Most accurate for organic content
- Shows engagement of people who actually saw the post

#### By Impressions
```
Engagement Rate = (Total Engagement / Impressions) × 100
```
- Includes multiple views by same person
- Lower rate but includes all views

#### By Followers
```
Engagement Rate = (Total Engagement / Followers) × 100
```
- Traditional metric
- Shows engagement relative to audience size

### Engagement Breakdown
- **Likes**: Number of likes/reactions
- **Comments**: Number of comments
- **Shares**: Number of shares/retweets
- **Saves**: Number of saves/bookmarks
- **Clicks**: Number of link clicks
- **Reactions**: Platform-specific reactions (LinkedIn, Facebook)
- **Retweets**: Twitter-specific
- **Views**: Video views

### Service: `socialPerformanceMetricsService.js`
- `calculateEngagementRate()` - Calculate engagement rate
- `updateEngagementBreakdown()` - Update engagement breakdown

### API Endpoints
- `POST /api/posts/:postId/analytics/engagement-rate` - Calculate rate
- `PUT /api/posts/:postId/analytics/engagement-breakdown` - Update breakdown

---

## 3. Audience Growth

### Features
- **Follower Tracking**: Track follower count over time
- **Growth Rate**: Calculate growth percentage
- **Churn Rate**: Track follower loss
- **Net Growth**: New followers minus lost followers
- **Platform-Specific**: Track per platform
- **Daily Snapshots**: Daily follower snapshots
- **Trend Analysis**: Growth and churn trends over time

### Model: `AudienceGrowth`
- Daily/weekly/monthly snapshots
- Follower counts (current, previous, change)
- Growth metrics (new, lost, net, rates)
- Churn tracking

### Metrics Tracked
- **Current Followers**: Current follower count
- **Previous Followers**: Previous snapshot count
- **Change**: Absolute change in followers
- **Change Percentage**: Percentage change
- **New Followers**: Followers gained
- **Lost Followers**: Followers lost
- **Net Growth**: New - Lost
- **Growth Rate**: (Net Growth / Previous Followers) × 100
- **Churn Rate**: (Lost Followers / Previous Followers) × 100

### Service: `socialPerformanceMetricsService.js`
- `recordAudienceGrowth()` - Record growth snapshot
- `getAudienceGrowthTrends()` - Get growth trends

### Service: `audienceGrowthSyncService.js`
- `syncAudienceGrowth()` - Sync from platform API
- `syncAllPlatformsAudienceGrowth()` - Sync all platforms

### Supported Platforms
- Twitter/X
- LinkedIn
- Facebook
- Instagram
- YouTube
- TikTok

### API Endpoints
- `POST /api/audience-growth/sync/:platform` - Sync platform
- `POST /api/audience-growth/sync-all` - Sync all platforms
- `GET /api/audience-growth/:platform/trends` - Get trends
- `POST /api/audience-growth/record` - Manual record

---

## 4. Aggregated Performance Metrics

### Features
- **Workspace-Level Aggregation**: Aggregate across all posts
- **Platform Breakdown**: Per-platform metrics
- **Engagement Breakdown**: Total engagement by type
- **Average Engagement Rates**: Average rates across posts

### Metrics Included
- Total posts
- Total impressions
- Total reach
- Total engagement
- Average engagement rates (by reach, impressions, followers)
- Engagement breakdown (likes, comments, shares, etc.)
- Platform breakdown

### API Endpoints
- `GET /api/workspaces/:workspaceId/performance-metrics` - Get aggregated metrics

---

## 5. Automatic Syncing

### Features
- **Daily Audience Growth Sync**: Automatic daily sync at 3 AM
- **Analytics Integration**: Updates reach/impressions when analytics synced
- **Engagement Rate Calculation**: Automatic calculation on analytics update
- **Follower Context**: Captures follower count at time of post

### Cron Jobs
- Daily audience growth sync (3 AM)
- Automatic engagement rate calculation
- Analytics sync integration

---

## 6. Integration Points

### Analytics Sync
- When analytics are synced → Update reach/impressions
- Calculate engagement rates automatically
- Capture follower count at post time

### Post Publishing
- Record follower count when post is published
- Initialize analytics structure
- Set up for future updates

### Daily Sync
- Sync all platforms for all users
- Record growth snapshots
- Calculate growth and churn rates

---

## 7. Models

### Enhanced ScheduledPost Analytics
- Reach & impressions
- Engagement breakdown
- Engagement rates (multiple formulas)
- Follower context

### AudienceGrowth
- Follower snapshots
- Growth metrics
- Churn tracking
- Trend data

---

## 8. Services

### socialPerformanceMetricsService.js
- Engagement rate calculation
- Reach/impressions updates
- Engagement breakdown
- Aggregated metrics
- Growth trends

### audienceGrowthSyncService.js
- Platform API syncing
- Follower count retrieval
- Growth snapshot creation

### audienceGrowthCronService.js
- Daily automatic syncing
- Batch processing

---

## 9. API Endpoints (8)

### Engagement Metrics (3)
- Calculate engagement rate
- Update reach/impressions
- Update engagement breakdown

### Aggregated Metrics (1)
- Get aggregated performance metrics

### Audience Growth (4)
- Sync platform
- Sync all platforms
- Get trends
- Manual record

---

## 10. Usage Examples

### Calculate Engagement Rate
```javascript
POST /api/posts/{postId}/analytics/engagement-rate
{
  "method": "byReach" // or "byImpressions", "byFollowers", "all"
}
```

### Update Reach & Impressions
```javascript
PUT /api/posts/{postId}/analytics/reach-impressions
{
  "impressions": 10000,
  "reach": 8500,
  "uniqueReach": 8000
}
```

### Sync Audience Growth
```javascript
POST /api/audience-growth/sync/twitter
```

### Get Growth Trends
```javascript
GET /api/audience-growth/twitter/trends?startDate=2024-01-01&endDate=2024-01-31&period=daily
```

### Get Aggregated Metrics
```javascript
GET /api/workspaces/{workspaceId}/performance-metrics?startDate=2024-01-01&endDate=2024-01-31&platform=twitter
```

---

## 11. Benefits

### For Agencies
1. **Quality Metrics**: Engagement rate as primary quality signal
2. **Growth Tracking**: Monitor client audience growth
3. **Performance Comparison**: Compare across clients/platforms
4. **Data-Driven Decisions**: Make decisions based on real metrics

### For Clients
1. **Transparency**: Clear visibility into performance
2. **Growth Insights**: Understand audience growth trends
3. **Engagement Quality**: See engagement relative to reach/followers
4. **Platform Comparison**: Compare performance across platforms

---

All features are implemented, tested, and ready for production use!


