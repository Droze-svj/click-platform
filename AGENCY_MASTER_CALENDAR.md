# Agency Master Calendar & Bulk Operations

## Overview

Enhanced agency features with master calendar view, strict workspace isolation, and powerful bulk campaign operations.

---

## 1. Master Calendar

### Features
- **Single View**: See all scheduled content across all clients, platforms, and team members
- **Advanced Filtering**: Filter by client, platform, team member, status, date range, search
- **Multiple Views**: Day, week, month views
- **Conflict Detection**: Automatically detect scheduling conflicts
- **Export**: Export calendar data in JSON or CSV format
- **Grouping**: Group by date, client, platform, or team member

### Service: `masterCalendarService.js`
- `getMasterCalendar()` - Get aggregated calendar with filters
- `getCalendarView()` - Get day/week/month view
- `getCalendarConflicts()` - Detect scheduling conflicts

### API Endpoints
- `GET /api/agency/:agencyWorkspaceId/calendar` - Master calendar
- `GET /api/agency/:agencyWorkspaceId/calendar/view` - Calendar view (day/week/month)
- `GET /api/agency/:agencyWorkspaceId/calendar/conflicts` - Get conflicts
- `GET /api/agency/:agencyWorkspaceId/calendar/export` - Export calendar

### Filter Options
- `startDate` / `endDate` - Date range
- `clientIds` - Filter by specific clients
- `platforms` - Filter by platforms
- `teamMemberIds` - Filter by team members
- `status` - Filter by post status
- `search` - Full-text search
- `groupBy` - Group by date/client/platform/team

---

## 2. Workspace Isolation

### Strict Separation
Each client workspace has:
- **Separate Assets**: Content, images, videos isolated per workspace
- **Separate Guidelines**: Brand guidelines and content rules
- **Separate Workflows**: Approval workflows per workspace
- **Separate Templates**: Content templates per workspace
- **Separate Permissions**: Role-based access control per workspace

### Middleware: `workspaceIsolation.js`
- `verifyWorkspaceAccess()` - Verify user has access to workspace
- `verifyClientWorkspaceAccess()` - Verify client belongs to agency
- `requireWorkspaceAccess()` - Middleware to enforce access
- `requireAgencyClientAccess()` - Middleware for agency-client operations
- `enforceWorkspaceIsolation()` - Ensure all operations are scoped to workspace
- `getAccessibleWorkspaces()` - Get all workspaces user can access

### Models Updated
- **ScheduledPost**: Added `workspaceId`, `clientWorkspaceId`, `agencyWorkspaceId`
- **Content**: Added `workspaceId`, `clientWorkspaceId`, `agencyWorkspaceId`
- **Workspace**: Added `agencyId` for client workspaces

### Service: `workspaceAssetService.js`
- `getWorkspaceAssets()` - Get assets for workspace (isolated)
- `getWorkspaceGuidelines()` - Get brand guidelines
- `getWorkspaceWorkflows()` - Get approval workflows
- `getWorkspaceTemplates()` - Get content templates
- `verifyAssetOwnership()` - Verify asset belongs to workspace
- `getWorkspaceSummary()` - Get workspace summary

---

## 3. Client Guidelines

### Model: `ClientGuidelines`
Per-client workspace guidelines including:
- **Branding**: Logo, colors, fonts, brand voice, tone, personality
- **Content Rules**: Do not use words, must include phrases, hashtag strategy, caption length, emoji usage, link policy
- **Platform-Specific**: Rules for Instagram, Twitter, LinkedIn, Facebook, TikTok, YouTube
- **Approval Rules**: Required approvers, auto-approve conditions
- **Compliance**: Disclaimers, regulatory requirements
- **Assets**: Image library, video library, template library
- **Workflows**: Default approval workflows

### API Endpoints
- `POST /api/workspaces/:workspaceId/guidelines` - Create/update guidelines
- `GET /api/workspaces/:workspaceId/guidelines` - Get guidelines
- `PUT /api/workspaces/:workspaceId/guidelines` - Update guidelines
- `POST /api/workspaces/:workspaceId/guidelines/validate` - Validate content against guidelines

### Content Validation
- Checks for forbidden words
- Validates must-include phrases
- Validates caption length
- Checks hashtag compliance
- Returns compliance score

---

## 4. Bulk Campaign Operations

### Campaign Model
- **Template Content**: Base content for campaign
- **Brand Guidelines**: Default brand guidelines
- **Scheduling**: Start/end dates, frequency, times, timezone
- **Platforms**: Target platforms
- **Variations**: Headline, caption, hashtag variations
- **Client Instances**: Per-client customized content and scheduling

### Service: `bulkCampaignService.js`
- `createCampaign()` - Create campaign template
- `cloneCampaignToClients()` - Clone to multiple clients
- `updateCampaignForClients()` - Update specific client instances
- `applyClientGuidelines()` - Apply brand guidelines to content
- `scheduleCampaignPosts()` - Schedule posts for campaign

### API Endpoints
- `POST /api/agency/:agencyWorkspaceId/campaigns` - Create campaign
- `GET /api/agency/:agencyWorkspaceId/campaigns` - List campaigns
- `GET /api/agency/:agencyWorkspaceId/campaigns/:campaignId` - Get campaign
- `POST /api/agency/:agencyWorkspaceId/campaigns/:campaignId/clone` - Clone to clients
- `PUT /api/agency/:agencyWorkspaceId/campaigns/:campaignId/update-clients` - Update clients
- `PUT /api/agency/:agencyWorkspaceId/campaigns/:campaignId` - Update campaign
- `DELETE /api/agency/:agencyWorkspaceId/campaigns/:campaignId` - Archive campaign
- `POST /api/agency/:agencyWorkspaceId/campaigns/:campaignId/customize` - Customize for client

---

## 5. Enhanced Bulk Operations

### API Endpoints
- `POST /api/agency/:agencyWorkspaceId/bulk/clone-campaign` - Clone campaign with customization
- `POST /api/agency/:agencyWorkspaceId/bulk/clone-content` - Clone content across clients
- `POST /api/agency/:agencyWorkspaceId/bulk/schedule` - Bulk schedule
- `POST /api/agency/:agencyWorkspaceId/bulk/import` - Bulk import
- `POST /api/agency/:agencyWorkspaceId/bulk/customize-and-schedule` - One-flow operation

### One-Flow Operation
`POST /api/agency/:agencyWorkspaceId/bulk/customize-and-schedule`

**Flow:**
1. Clone content to multiple clients
2. Apply client-specific customizations
3. Apply brand guidelines per client
4. Schedule posts with optimal timing
5. Return results for all clients

**Request Body:**
```json
{
  "contentId": "content123",
  "clientWorkspaceIds": ["client1", "client2", "client3"],
  "customizations": {
    "client1": {
      "title": "Custom Title for Client 1",
      "text": "Customized text",
      "hashtags": ["#custom", "#hashtags"]
    }
  },
  "scheduleOptions": {
    "enabled": true,
    "timezone": "America/New_York",
    "customDates": {
      "client1": {
        "twitter": "2024-01-15T09:00:00Z"
      }
    }
  }
}
```

---

## 6. Workspace Structure

### Agency Workspace
- Type: `agency`
- Contains: Multiple client workspaces
- Features: Master calendar, bulk operations, cross-client analytics

### Client Workspace
- Type: `client`
- Linked to: Agency workspace via `agencyId` or `metadata.agencyWorkspaceId`
- Isolated: Assets, guidelines, workflows, permissions
- Features: Own content library, brand guidelines, approval workflows

### Workspace Fields
- `agencyId` - For client workspaces, links to agency
- `metadata.agencyWorkspaceId` - Alternative linking method
- `members` - Workspace members with permissions
- `settings` - Workspace settings and features

---

## 7. Permission System

### Workspace Permissions
- `canCreate` - Create content/assets
- `canEdit` - Edit content/assets
- `canDelete` - Delete content/assets
- `canPublish` - Publish content
- `canSchedule` - Schedule posts
- `canManageMembers` - Manage workspace members
- `canManageSettings` - Manage workspace settings
- `canViewAnalytics` - View analytics
- `canExportData` - Export data
- `canApprove` - Approve content
- `canReject` - Reject content
- `canRequestChanges` - Request changes
- `canManageWorkflows` - Manage workflows
- `canManageIntegrations` - Manage integrations
- `canAccessAPI` - API access
- `canManageBilling` - Manage billing

### Role-Based Access
- **Owner**: Full access
- **Admin**: Most permissions
- **Editor**: Create, edit, schedule
- **Viewer**: Read-only
- **Approver**: Approve/reject content
- **Contributor**: Create content only

---

## 8. Data Isolation

### Content Isolation
- All content scoped to `workspaceId`
- Content cannot be accessed across workspaces
- Queries automatically filtered by workspace

### Scheduled Post Isolation
- Posts scoped to `workspaceId` and `clientWorkspaceId`
- Agency can view all client posts via master calendar
- Clients can only see their own posts

### Asset Isolation
- Assets (images, videos) scoped to workspace
- No cross-workspace access
- Workspace-specific asset libraries

---

## 9. Master Calendar Features

### Statistics
- Total posts
- By status (scheduled, posted, failed)
- By platform
- By client
- By team member
- Upcoming vs posted
- Date range

### Grouping Options
- **By Date**: Group posts by calendar date
- **By Client**: Group by client workspace
- **By Platform**: Group by social platform
- **By Team**: Group by team member

### Conflict Detection
- Detects overlapping posts
- Same platform + same client + same time window (5 minutes)
- Returns conflict details with resolution suggestions

---

## 10. Bulk Campaign Flow

### Step 1: Create Campaign Template
```javascript
POST /api/agency/:agencyWorkspaceId/campaigns
{
  "name": "Q1 Product Launch",
  "templateContent": { ... },
  "brandGuidelines": { ... },
  "scheduling": { ... },
  "platforms": ["twitter", "linkedin", "instagram"]
}
```

### Step 2: Clone to Clients
```javascript
POST /api/agency/:agencyWorkspaceId/campaigns/:campaignId/clone
{
  "clientWorkspaceIds": ["client1", "client2", "client3"],
  "customizeContent": true,
  "applyBrandGuidelines": true,
  "schedulePosts": true
}
```

### Step 3: Customize Per Client (Optional)
```javascript
POST /api/agency/:agencyWorkspaceId/campaigns/:campaignId/customize
{
  "clientWorkspaceId": "client1",
  "customizedContent": {
    "title": "Client 1 Specific Title",
    "text": "Customized text for client 1"
  }
}
```

### Step 4: Update Multiple Clients
```javascript
PUT /api/agency/:agencyWorkspaceId/campaigns/:campaignId/update-clients
{
  "clientWorkspaceIds": ["client1", "client2"],
  "updates": {
    "customizedContent": {
      "hashtags": ["#updated", "#hashtags"]
    }
  }
}
```

---

## 11. One-Flow Operation

### Customize and Schedule in One Request
```javascript
POST /api/agency/:agencyWorkspaceId/bulk/customize-and-schedule
{
  "contentId": "source123",
  "clientWorkspaceIds": ["client1", "client2", "client3"],
  "customizations": {
    "client1": {
      "title": "Client 1 Title",
      "text": "Client 1 Text",
      "hashtags": ["#client1"]
    },
    "client2": {
      "title": "Client 2 Title",
      "text": "Client 2 Text"
    }
  },
  "scheduleOptions": {
    "enabled": true,
    "timezone": "America/New_York",
    "customDates": {
      "client1": {
        "twitter": "2024-01-15T09:00:00Z",
        "linkedin": "2024-01-15T10:00:00Z"
      }
    }
  }
}
```

**What it does:**
1. Clones source content to each client
2. Applies client-specific customizations
3. Applies brand guidelines per client
4. Creates scheduled posts with optimal timing
5. Returns results for all clients

---

## 12. Implementation Details

### Database Indexes
- `ScheduledPost.agencyWorkspaceId` - For master calendar queries
- `ScheduledPost.clientWorkspaceId` - For client calendar
- `ScheduledPost.workspaceId` - For workspace calendar
- `ScheduledPost.campaignId` - For campaign posts
- `Content.workspaceId` - For workspace content
- `Content.clientWorkspaceId` - For client content
- `Content.agencyWorkspaceId` - For agency content

### Query Optimization
- Aggregated queries for master calendar
- Efficient filtering with indexes
- Pagination for large datasets
- Caching for frequently accessed data

### Security
- Workspace access verification on every request
- Permission checks before operations
- Audit logging for all operations
- Data isolation enforced at database level

---

## API Summary

### Master Calendar (4 endpoints)
- Get master calendar
- Get calendar view
- Get conflicts
- Export calendar

### Campaigns (7 endpoints)
- Create campaign
- List campaigns
- Get campaign
- Clone to clients
- Update clients
- Update campaign
- Customize for client
- Archive campaign

### Bulk Operations (5 endpoints)
- Clone campaign
- Clone content
- Bulk schedule
- Bulk import
- Customize and schedule

### Guidelines (4 endpoints)
- Create/update guidelines
- Get guidelines
- Update guidelines
- Validate content

---

## Benefits

1. **Single View**: See everything in one place
2. **Isolation**: No accidental cross-contamination
3. **Efficiency**: Bulk operations save time
4. **Customization**: Per-client brand guidelines
5. **Automation**: One-flow operations
6. **Security**: Strict permission enforcement
7. **Scalability**: Handles many clients efficiently

All features are implemented, tested, and ready for production use!


