# Multi-Step Workflow System - Enhanced

## Overview

Enhanced multi-step workflow system with templates, SLA tracking, bulk operations, delegation, analytics, version restore, and advanced comment features.

---

## New Features

### 1. Workflow Templates

#### Pre-configured Workflows
- **Standard Workflow**: Creator → Internal Review → Client Approval → Scheduled
- **Fast-Track Workflow**: Creator → Client Approval → Scheduled
- **Custom Templates**: Create your own workflow templates

#### Template Features
- Stage configuration (order, name, type)
- Approver assignment (users or emails)
- Approval types (all, any, majority)
- Conditional routing (by content type, platform, tags, priority)
- SLA configuration per stage
- Auto-approval settings
- Parallel approvals support

#### Service: `workflowTemplateService.js`
- `createWorkflowTemplate()` - Create new template
- `createApprovalFromTemplate()` - Create approval from template
- `getDefaultTemplate()` - Get default template
- `createDefaultTemplates()` - Create default templates

#### API Endpoints
- `POST /api/agency/:agencyWorkspaceId/workflow-templates` - Create template
- `GET /api/agency/:agencyWorkspaceId/workflow-templates` - List templates
- `POST /api/agency/:agencyWorkspaceId/workflow-templates/:templateId/use` - Use template
- `POST /api/agency/:agencyWorkspaceId/workflow-templates/default` - Create defaults

---

### 2. SLA Tracking & Escalation

#### SLA Features
- **Target Hours**: Set target completion time per stage
- **Status Tracking**: on_time, at_risk, overdue, completed
- **Auto-escalation**: Escalate to manager if overdue
- **Reminders**: Automatic reminders at risk thresholds
- **Analytics**: Track SLA compliance

#### Model: `ApprovalSLA`
- Target hours per stage
- Target completion date
- Status tracking
- Escalation configuration
- Reminder history

#### Service: `slaTrackingService.js`
- `checkSLAStatus()` - Check and update SLA status
- `escalateApproval()` - Auto-escalate overdue approvals
- `getSLAAnalytics()` - Get SLA metrics
- `checkAutoApprove()` - Check if auto-approve is enabled

#### SLA Status
- **on_time**: Within target time
- **at_risk**: Less than 20% time remaining
- **overdue**: Past target completion time
- **completed**: Stage completed

#### API Endpoints
- `GET /api/approvals/:approvalId/sla` - Get SLA status
- `GET /api/agency/:agencyWorkspaceId/approvals/sla-analytics` - Get SLA analytics

---

### 3. Bulk Approval Operations

#### Bulk Actions
- **Bulk Approve**: Approve multiple items at once
- **Bulk Reject**: Reject multiple items
- **Bulk Request Changes**: Request changes for multiple items
- **Error Handling**: Continue on errors, report failures

#### Service: `bulkApprovalService.js`
- `bulkApprove()` - Approve multiple approvals
- `bulkReject()` - Reject multiple approvals
- `bulkRequestChanges()` - Request changes for multiple

#### API Endpoints
- `POST /api/approvals/bulk/approve` - Bulk approve
- `POST /api/approvals/bulk/reject` - Bulk reject
- `POST /api/approvals/bulk/request-changes` - Bulk request changes

---

### 4. Approval Delegation

#### Delegation Features
- **Delegate to User**: Assign approval to another user
- **Expiration**: Set delegation expiration date
- **Revocation**: Revoke delegation
- **Notifications**: Notify delegated user
- **History**: Track all delegations

#### Model: `ApprovalDelegation`
- Delegated from/to users
- Expiration date
- Status (active, completed, revoked, expired)
- Reason for delegation

#### Service: `approvalDelegationService.js`
- `delegateApproval()` - Delegate approval
- `revokeDelegation()` - Revoke delegation
- `getUserDelegations()` - Get user's delegations

#### API Endpoints
- `POST /api/approvals/:approvalId/delegate` - Delegate approval
- `GET /api/approvals/delegations` - Get delegations
- `PUT /api/approvals/delegations/:delegationId/revoke` - Revoke delegation

---

### 5. Approval Analytics

#### Analytics Features
- **Status Breakdown**: By status (pending, approved, rejected)
- **Stage Metrics**: Per-stage statistics
- **Average Time**: Average approval time per stage
- **Bottleneck Detection**: Identify slow stages
- **Dashboard**: Real-time approval dashboard

#### Service: `approvalAnalyticsService.js`
- `getApprovalAnalytics()` - Get comprehensive analytics
- `getApprovalDashboard()` - Get dashboard data

#### Metrics Tracked
- Total approvals
- Status distribution
- Stage performance
- Average completion time
- Bottleneck identification
- Pending count
- Overdue count

#### API Endpoints
- `GET /api/agency/:agencyWorkspaceId/approvals/analytics` - Get analytics
- `GET /api/approvals/dashboard` - Get dashboard

---

### 6. Version Restore

#### Restore Features
- **Restore to Version**: Restore post to any previous version
- **Version History**: Complete restore history
- **Before Restore Snapshot**: Auto-create version before restore
- **Restore Tracking**: Track who restored and why

#### Service: `versionRestoreService.js`
- `restorePostVersion()` - Restore to version
- `getVersionRestoreHistory()` - Get restore history

#### Restore Process
1. Create snapshot of current version
2. Restore content from target version
3. Create new version with restore metadata
4. Track restore in history

#### API Endpoints
- `POST /api/posts/:postId/versions/:versionNumber/restore` - Restore version
- `GET /api/posts/:postId/versions/restore-history` - Get restore history

---

### 7. Advanced Comment Features

#### Comment Search
- **Full-Text Search**: Search across all comments
- **Filtering**: By user, date, type, resolved status
- **Mentions**: Find comments mentioning specific users
- **Post Filtering**: Filter by post IDs

#### Service: `commentSearchService.js`
- `searchComments()` - Search comments
- `getCommentsByUser()` - Get user's comments
- `getUnresolvedCommentsCount()` - Get unresolved count

#### Search Filters
- Post IDs
- User IDs
- Date range
- Comment type
- Resolved status
- Internal/external
- Mentions

#### API Endpoints
- `GET /api/agency/:agencyWorkspaceId/comments/search` - Search comments
- `GET /api/comments/user/:userId` - Get user comments

---

## Enhanced Models

### 1. WorkflowTemplate
- Pre-configured workflows
- Stage definitions
- Conditional routing
- SLA configuration
- Usage tracking

### 2. ApprovalSLA
- Target hours
- Status tracking
- Escalation rules
- Reminder history

### 3. ApprovalDelegation
- Delegation tracking
- Expiration management
- Revocation support

---

## Enhanced Services

### 1. workflowTemplateService.js
- Template creation and management
- Approval creation from templates
- Default template generation

### 2. slaTrackingService.js
- SLA status monitoring
- Auto-escalation
- Analytics

### 3. bulkApprovalService.js
- Bulk operations
- Error handling
- Result reporting

### 4. approvalDelegationService.js
- Delegation management
- Expiration handling
- Revocation

### 5. approvalAnalyticsService.js
- Analytics calculation
- Dashboard data
- Bottleneck detection

### 6. versionRestoreService.js
- Version restoration
- History tracking

### 7. commentSearchService.js
- Comment search
- User filtering
- Unresolved tracking

---

## API Summary (New Endpoints)

### Workflow Templates (4 endpoints)
- Create template
- List templates
- Use template
- Create defaults

### SLA Tracking (2 endpoints)
- Get SLA status
- Get SLA analytics

### Bulk Operations (3 endpoints)
- Bulk approve
- Bulk reject
- Bulk request changes

### Delegation (3 endpoints)
- Delegate approval
- Get delegations
- Revoke delegation

### Analytics (2 endpoints)
- Get analytics
- Get dashboard

### Version Restore (2 endpoints)
- Restore version
- Get restore history

### Comment Search (2 endpoints)
- Search comments
- Get user comments

**Total New Endpoints: 18**

---

## Workflow Template Structure

```javascript
{
  name: "Standard Workflow",
  workflow: {
    stages: [
      {
        stageOrder: 0,
        stageName: "Created",
        stageType: "creator"
      },
      {
        stageOrder: 1,
        stageName: "Internal Review",
        stageType: "internal_review",
        approvers: [{ userId: "...", role: "required" }],
        approvalType: "all",
        conditions: {
          contentType: ["post", "video"],
          platforms: ["facebook", "instagram"]
        },
        sla: {
          enabled: true,
          hours: 24,
          autoApprove: false,
          escalateTo: "..."
        }
      }
    ],
    settings: {
      allowParallelApprovals: false,
      allowDelegation: true,
      autoScheduleOnApproval: true
    }
  }
}
```

---

## SLA Configuration

```javascript
{
  targetHours: 24,
  targetCompletionAt: Date,
  status: "on_time" | "at_risk" | "overdue" | "completed",
  escalated: false,
  reminders: [
    { sentAt: Date, type: "warning" | "at_risk" | "overdue" }
  ]
}
```

---

## Benefits

1. **Templates**: Save time with pre-configured workflows
2. **SLA Tracking**: Ensure timely approvals
3. **Bulk Operations**: Process multiple approvals quickly
4. **Delegation**: Flexible approval assignment
5. **Analytics**: Identify bottlenecks and improve processes
6. **Version Restore**: Easy rollback to previous versions
7. **Comment Search**: Find and manage comments efficiently

---

## Usage Examples

### Create Approval from Template
```javascript
POST /api/agency/{workspaceId}/workflow-templates/{templateId}/use
{
  "contentId": "...",
  "scheduledPostId": "...",
  "internalReviewerId": "...",
  "clientApproverEmail": "..."
}
```

### Bulk Approve
```javascript
POST /api/approvals/bulk/approve
{
  "approvalIds": ["...", "..."],
  "comment": "Bulk approved"
}
```

### Delegate Approval
```javascript
POST /api/approvals/{approvalId}/delegate
{
  "stageOrder": 1,
  "toUserId": "...",
  "reason": "Out of office",
  "expiresAt": "2024-12-31"
}
```

### Restore Version
```javascript
POST /api/posts/{postId}/versions/{versionNumber}/restore
{
  "reason": "Client requested revert"
}
```

---

All enhancements are implemented, tested, and ready for production use!


