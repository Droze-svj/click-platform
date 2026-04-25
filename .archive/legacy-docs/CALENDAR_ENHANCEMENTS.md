# Calendar Enhancements

## Overview

Enhanced master calendar with real-time updates, drag-and-drop rescheduling, analytics, smart suggestions, saved views, team collaboration, and performance previews.

---

## 1. Real-Time Calendar Updates

### Features
- **WebSocket Integration**: Live updates when posts are created, updated, deleted, or rescheduled
- **Conflict Alerts**: Real-time conflict detection and notifications
- **Analytics Updates**: Live analytics updates as posts are scheduled
- **Team Collaboration**: See changes made by team members in real-time

### Service: `calendarRealtimeService.js`
- `emitCalendarUpdate()` - Emit calendar update event
- `emitCalendarConflict()` - Emit conflict alert
- `emitCalendarAnalytics()` - Emit analytics update
- `handlePostCreated()` - Handle new post creation
- `handlePostUpdated()` - Handle post updates
- `handlePostDeleted()` - Handle post deletion
- `handlePostRescheduled()` - Handle post rescheduling
- `handleBulkReschedule()` - Handle bulk reschedule operations

### Socket Events
- `join:calendar` - Join agency calendar room
- `leave:calendar` - Leave calendar room
- `calendar:update` - Calendar update event
- `calendar:conflict` - Conflict detected
- `calendar:analytics` - Analytics update

### Automatic Hooks
- ScheduledPost model hooks automatically trigger real-time updates
- No manual emission needed - fully automated

---

## 2. Drag-and-Drop Rescheduling

### Features
- **Single Post Reschedule**: Drag and drop to new time
- **Conflict Detection**: Automatic conflict checking
- **Auto-Resolution**: Optional automatic conflict resolution
- **Real-Time Updates**: Changes reflected immediately

### Service: `calendarRescheduleService.js`
- `reschedulePost()` - Reschedule single post
- `bulkReschedule()` - Bulk reschedule with multiple strategies
- `getRescheduleSuggestions()` - Get optimal reschedule times
- `checkPostConflicts()` - Check for scheduling conflicts
- `resolveConflicts()` - Auto-resolve conflicts

### Rescheduling Strategies
1. **Individual**: Each post gets specific new time
2. **Shift**: Shift all posts by time delta (hours/days)
3. **Optimal**: Reschedule to optimal posting times

### API Endpoints
- `POST /api/agency/:agencyWorkspaceId/calendar/reschedule` - Reschedule single post
- `POST /api/agency/:agencyWorkspaceId/calendar/bulk-reschedule` - Bulk reschedule
- `GET /api/agency/:agencyWorkspaceId/calendar/reschedule-suggestions/:postId` - Get suggestions

---

## 3. Calendar Analytics & Insights

### Analytics Provided
- **Posting Frequency**: Daily, weekly, monthly frequency analysis
- **Platform Distribution**: Posts per platform with percentages
- **Time Distribution**: Hourly and daily posting patterns
- **Content Gaps**: Identify gaps in posting schedule
- **Optimal Time Recommendations**: AI-powered suggestions
- **Team Workload**: Workload distribution across team
- **Client Activity**: Activity per client workspace

### Service: `calendarAnalyticsService.js`
- `getCalendarAnalytics()` - Comprehensive analytics
- `analyzePostingFrequency()` - Frequency analysis
- `analyzePlatformDistribution()` - Platform analysis
- `analyzeTimeDistribution()` - Time pattern analysis
- `identifyContentGaps()` - Gap detection
- `generateOptimalTimeRecommendations()` - AI recommendations
- `analyzeTeamWorkload()` - Workload analysis
- `analyzeClientActivity()` - Client activity analysis

### API Endpoint
- `GET /api/agency/:agencyWorkspaceId/calendar/analytics` - Get analytics

### Insights Provided
- Average posts per day/week/month
- Peak posting hours and days
- Platform distribution percentages
- Content gaps (gaps > 48 hours)
- Optimal time recommendations per client/platform
- Team workload distribution
- Client activity metrics

---

## 4. Smart Scheduling Suggestions

### Features
- **Optimal Time Suggestions**: AI-powered optimal posting times
- **Alternative Times**: Conflict-free alternative times
- **Scoring System**: Suggestions ranked by score
- **Multiple Options**: Up to 5 suggestions per post

### Suggestion Types
1. **Optimal Posting Times**: Based on historical performance
2. **Alternative Times**: 1-2 hours before/after current time
3. **Conflict-Free Times**: Times with no scheduling conflicts

### API Endpoint
- `GET /api/agency/:agencyWorkspaceId/calendar/reschedule-suggestions/:postId`

### Response Format
```json
{
  "suggestions": [
    {
      "time": "2024-01-15T09:00:00Z",
      "reason": "optimal_posting_time",
      "score": 100
    },
    {
      "time": "2024-01-15T10:00:00Z",
      "reason": "1_hour_later",
      "score": 80
    }
  ]
}
```

---

## 5. Calendar Views & Templates

### Features
- **Saved Views**: Save filter combinations and display options
- **Default Views**: Set default view for quick access
- **Shared Views**: Share views with team members
- **Custom Grouping**: Group by date, client, platform, team
- **Display Options**: Customize calendar appearance

### Model: `CalendarView`
- View name and description
- Filter settings (clients, platforms, team, status, date range)
- Grouping preferences
- Display options (colors, compact mode, etc.)
- Sharing settings

### API Endpoints
- `POST /api/agency/:agencyWorkspaceId/calendar/views` - Save view
- `GET /api/agency/:agencyWorkspaceId/calendar/views` - List views
- `GET /api/agency/:agencyWorkspaceId/calendar/views/:viewId` - Get view
- `PUT /api/agency/:agencyWorkspaceId/calendar/views/:viewId` - Update view
- `DELETE /api/agency/:agencyWorkspaceId/calendar/views/:viewId` - Delete view

### Display Options
- `showConflicts` - Show/hide conflicts
- `showPerformance` - Show/hide performance previews
- `showApprovalStatus` - Show/hide approval status
- `showTeamMembers` - Show/hide team member info
- `colorBy` - Color coding (client, platform, status, team, performance)
- `compactMode` - Compact display mode

---

## 6. Team Collaboration Features

### Features
- **Comments**: Add comments to calendar events
- **Mentions**: Mention team members in comments
- **Notes**: Private notes on posts
- **Tags**: Tag posts for organization
- **Priority**: Set priority levels (low, normal, high, urgent)
- **Custom Fields**: Add custom metadata

### Model: `CalendarEvent`
- Comments with mentions
- Notes
- Tags
- Priority
- Performance preview
- Approval status
- Custom fields

### API Endpoints
- `POST /api/agency/:agencyWorkspaceId/calendar/events/:postId/comments` - Add comment
- `GET /api/agency/:agencyWorkspaceId/calendar/events/:postId` - Get event
- `PUT /api/agency/:agencyWorkspaceId/calendar/events/:postId` - Update event

### Comment Features
- User mentions (@username)
- Timestamps
- Edit history
- Threaded replies (future)

---

## 7. Performance Preview

### Features
- **Predicted Engagement**: AI-powered engagement prediction
- **Predicted Reach**: Estimated reach
- **Predicted Clicks**: Estimated clicks
- **Confidence Levels**: Low, medium, high confidence
- **Performance Factors**: Reasons for prediction
- **Historical Comparison**: Based on similar past posts

### Service: `performancePreviewService.js`
- `getPerformancePreview()` - Get preview for single post
- `batchGetPerformancePreviews()` - Batch get previews

### Prediction Factors
- Optimal posting time
- Hashtag count
- Content length
- Historical performance
- Platform-specific factors

### API Endpoints
- `GET /api/agency/:agencyWorkspaceId/calendar/performance-preview/:postId` - Get preview
- `POST /api/agency/:agencyWorkspaceId/calendar/performance-preview/batch` - Batch previews

### Response Format
```json
{
  "predictedEngagement": 1250,
  "predictedReach": 5000,
  "predictedClicks": 125,
  "confidence": "high",
  "factors": ["optimal_morning_time", "good_hashtag_count", "optimal_content_length"],
  "basedOn": {
    "similarPosts": 10,
    "hasPrediction": true
  }
}
```

---

## 8. Bulk Rescheduling

### Features
- **Multiple Strategies**: Individual, shift, optimal
- **Conflict Detection**: Automatic conflict checking
- **Auto-Resolution**: Optional automatic conflict resolution
- **Batch Processing**: Process multiple posts efficiently

### Rescheduling Strategies

#### Individual
```json
{
  "strategy": "individual",
  "newTimes": [
    { "postId": "post1", "newTime": "2024-01-15T09:00:00Z" },
    { "postId": "post2", "newTime": "2024-01-15T10:00:00Z" }
  ]
}
```

#### Shift
```json
{
  "strategy": "shift",
  "deltaHours": 2,
  "deltaDays": 0
}
```

#### Optimal
```json
{
  "strategy": "optimal"
}
```

### API Endpoint
- `POST /api/agency/:agencyWorkspaceId/calendar/bulk-reschedule`

### Response
```json
{
  "total": 10,
  "successful": 9,
  "failed": 1,
  "results": [
    { "postId": "post1", "success": true, "newTime": "2024-01-15T09:00:00Z" },
    { "postId": "post2", "success": false, "error": "Conflict detected" }
  ]
}
```

---

## 9. Conflict Detection & Resolution

### Conflict Detection
- **Time Overlap**: Posts scheduled within 5 minutes
- **Same Platform**: Same platform + same client
- **Automatic Detection**: Real-time conflict detection

### Auto-Resolution
- **Shift Strategy**: Shift conflicting posts by 10 minutes
- **Optimal Time**: Reschedule to optimal time
- **Manual Override**: Option to manually resolve

### Conflict Response
```json
{
  "success": false,
  "conflicts": [
    {
      "postId": "post2",
      "scheduledTime": "2024-01-15T09:02:00Z",
      "conflictType": "time_overlap"
    }
  ],
  "message": "Scheduling conflicts detected"
}
```

---

## 10. API Summary

### New Endpoints (15 total)

#### Analytics (1)
- `GET /api/agency/:agencyWorkspaceId/calendar/analytics`

#### Rescheduling (3)
- `POST /api/agency/:agencyWorkspaceId/calendar/reschedule`
- `POST /api/agency/:agencyWorkspaceId/calendar/bulk-reschedule`
- `GET /api/agency/:agencyWorkspaceId/calendar/reschedule-suggestions/:postId`

#### Performance (2)
- `GET /api/agency/:agencyWorkspaceId/calendar/performance-preview/:postId`
- `POST /api/agency/:agencyWorkspaceId/calendar/performance-preview/batch`

#### Views (5)
- `POST /api/agency/:agencyWorkspaceId/calendar/views`
- `GET /api/agency/:agencyWorkspaceId/calendar/views`
- `GET /api/agency/:agencyWorkspaceId/calendar/views/:viewId`
- `PUT /api/agency/:agencyWorkspaceId/calendar/views/:viewId`
- `DELETE /api/agency/:agencyWorkspaceId/calendar/views/:viewId`

#### Events (3)
- `POST /api/agency/:agencyWorkspaceId/calendar/events/:postId/comments`
- `GET /api/agency/:agencyWorkspaceId/calendar/events/:postId`
- `PUT /api/agency/:agencyWorkspaceId/calendar/events/:postId`

---

## 11. Real-Time Integration

### Socket.IO Events

#### Client → Server
- `join:calendar` - Join calendar room
- `leave:calendar` - Leave calendar room

#### Server → Client
- `calendar:update` - Calendar update
- `calendar:conflict` - Conflict detected
- `calendar:analytics` - Analytics update

### Update Types
- `post_created` - New post created
- `post_updated` - Post updated
- `post_deleted` - Post deleted
- `post_rescheduled` - Post rescheduled
- `bulk_reschedule` - Bulk reschedule completed

---

## 12. Benefits

1. **Real-Time Collaboration**: See changes as they happen
2. **Efficient Rescheduling**: Drag-and-drop or bulk operations
3. **Data-Driven Decisions**: Analytics and insights
4. **Smart Suggestions**: AI-powered optimal times
5. **Customizable Views**: Save and share views
6. **Team Communication**: Comments and mentions
7. **Performance Insights**: Predictions before posting
8. **Conflict Prevention**: Automatic detection and resolution

---

## 13. Implementation Details

### Models
- `CalendarView` - Saved calendar views
- `CalendarEvent` - Extended event data (comments, notes, performance)

### Services
- `calendarRealtimeService.js` - Real-time updates
- `calendarRescheduleService.js` - Rescheduling operations
- `calendarAnalyticsService.js` - Analytics and insights
- `performancePreviewService.js` - Performance predictions

### Automatic Hooks
- ScheduledPost model hooks trigger real-time updates
- No manual emission needed

### Database Indexes
- `CalendarView.agencyWorkspaceId` - Fast view lookup
- `CalendarEvent.scheduledPostId` - Fast event lookup
- `CalendarEvent.agencyWorkspaceId` - Agency event queries

---

All features are implemented, tested, and ready for production use!


