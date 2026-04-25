# Multi-Step Workflow System

## Overview

Complete multi-step approval workflow system with visible status tracking, audit trail, email approvals, mobile-friendly interface, post commenting, and version history with comparison.

---

## 1. Multi-Step Workflow

### Workflow Stages
1. **Created** - Content created by creator (auto-completed)
2. **Internal Review** - Reviewed by internal team member
3. **Client Approval** - Approved by client approver
4. **Scheduled** - Auto-scheduled after final approval

### Service: `multiStepWorkflowService.js`
- `createMultiStepApproval()` - Create workflow with all stages
- `advanceToNextStage()` - Move to next stage (approve/reject/request changes)
- `getApprovalStatus()` - Get current status with audit trail
- `createPostVersion()` - Create version snapshot
- `compareVersions()` - Compare two versions

### Workflow Flow
```
Creator → Internal Reviewer → Client Approver → Scheduled
   ↓            ↓                    ↓              ↓
 Created    In Review          Pending         Scheduled
```

### Status Tracking
- **Current Stage**: Visible at all times
- **Progress**: Percentage complete
- **Next Stage**: What's coming next
- **Can Approve**: Whether current user can approve
- **Can Request Changes**: Whether changes can be requested

---

## 2. Visible Status & Audit Trail

### Status Display
- Current stage name and order
- Progress percentage
- Next stage information
- Stage status (pending, in_progress, completed, rejected)
- Approver information

### Audit Trail
- Complete history of all actions
- User who performed each action
- Timestamp for each action
- Comments and reasons
- Stage transitions

### Actions Tracked
- `created` - Content created
- `stage_started` - Stage started
- `stage_completed` - Stage completed
- `approved` - Stage approved
- `rejected` - Stage rejected
- `changes_requested` - Changes requested
- `reassigned` - Reassigned to different approver
- `cancelled` - Workflow cancelled

### API Endpoints
- `GET /api/approvals/:approvalId/status` - Get status with audit trail
- `GET /api/approvals/:approvalId/audit-trail` - Get full audit trail

---

## 3. Email Approval Links

### Features
- **Secure Tokens**: Cryptographically secure tokens
- **Expiration**: Tokens expire after 7 days (configurable)
- **One-Time Use**: Tokens can only be used once
- **Action-Specific**: Separate tokens for approve/reject/request changes
- **IP Tracking**: Track IP address and user agent
- **Mobile-Friendly**: Optimized for mobile devices

### Model: `EmailApprovalToken`
- Secure token generation
- Expiration dates
- Usage tracking
- IP and user agent logging

### Service: `emailApprovalService.js`
- `processEmailApproval()` - Process approval via email link
- `getApprovalPreview()` - Get approval preview from token

### Email Links
- Approve: `/api/email-approval/{token}/approve`
- Reject: `/api/email-approval/{token}/reject`
- Request Changes: `/api/email-approval/{token}/request-changes`

### API Endpoints
- `GET /api/email-approval/:token` - Get approval preview
- `POST /api/email-approval/:token/approve` - Approve via email
- `POST /api/email-approval/:token/reject` - Reject via email
- `POST /api/email-approval/:token/request-changes` - Request changes
- `GET /api/email-approval/:token/mobile` - Mobile-friendly data

---

## 4. Mobile-Friendly Approval Portal

### Features
- **Responsive Design**: Works on all mobile devices
- **Simple Interface**: Approve/decline without learning the app
- **Content Preview**: See content before approving
- **Quick Actions**: One-tap approve/reject
- **Comment Support**: Add comments when rejecting/requesting changes

### Mobile Endpoint
- `GET /api/email-approval/:token/mobile` - Mobile-optimized data

### Mobile Data Format
```json
{
  "approval": {
    "content": {
      "title": "Post Title",
      "preview": "Content preview..."
    },
    "currentStage": {
      "name": "Client Approval",
      "order": 2
    }
  },
  "actions": {
    "approve": "/api/email-approval/{token}/approve",
    "reject": "/api/email-approval/{token}/reject",
    "requestChanges": "/api/email-approval/{token}/request-changes"
  }
}
```

---

## 5. Post Commenting System

### Features
- **Threaded Comments**: Reply to comments
- **Inline Comments**: Comment on specific lines/text
- **Mentions**: @mention users
- **Reactions**: Like, helpful, agree, disagree
- **Attachments**: Images, files, links
- **Internal Comments**: Comments visible only to agency
- **Resolve Comments**: Mark comments as resolved
- **Edit/Delete**: Edit or delete own comments

### Model: `PostComment`
- Comment text and type
- Parent comment (for threading)
- Inline comment support (line numbers, selected text)
- Mentions array
- Reactions array
- Attachments
- Internal flag
- Resolved status

### Service: `postCommentService.js`
- `addComment()` - Add comment to post
- `getPostComments()` - Get all comments (with threading)
- `resolveComment()` - Mark comment as resolved
- `addReaction()` - Add reaction to comment
- `editComment()` - Edit comment
- `deleteComment()` - Delete comment

### Comment Types
- `comment` - Regular comment
- `suggestion` - Suggestion
- `question` - Question
- `approval` - Approval comment
- `rejection` - Rejection comment

### API Endpoints
- `POST /api/posts/:postId/comments` - Add comment
- `GET /api/posts/:postId/comments` - Get comments
- `PUT /api/posts/:postId/comments/:commentId/resolve` - Resolve comment
- `POST /api/posts/:postId/comments/:commentId/reactions` - Add reaction
- `PUT /api/posts/:postId/comments/:commentId` - Edit comment
- `DELETE /api/posts/:postId/comments/:commentId` - Delete comment

---

## 6. Version History & Comparison

### Features
- **Version Tracking**: Every change creates a new version
- **Change Reasons**: Track why version was created
- **Version Comments**: Comments on specific versions
- **Compare Versions**: Side-by-side comparison
- **Diff Visualization**: See what changed
- **Version Metadata**: Track who made changes and when

### Model: `PostVersion`
- Version number (auto-incrementing)
- Content snapshot
- Change reason
- Comments on version
- Approval status at version time
- Metadata (platform, scheduled time, changes)

### Version Comparison
- Text diff (line-by-line)
- Hashtag changes (added/removed)
- Media URL changes
- Summary of changes
- Change types (added, removed, modified)

### Service Functions
- `createPostVersion()` - Create new version
- `compareVersions()` - Compare two versions
- `calculateTextDiff()` - Calculate text differences

### API Endpoints
- `POST /api/posts/:postId/versions` - Create version
- `GET /api/posts/:postId/versions` - Get version history
- `GET /api/posts/:postId/versions/:versionNumber` - Get specific version
- `GET /api/posts/:postId/versions/compare` - Compare versions
- `POST /api/posts/:postId/versions/:versionNumber/comments` - Comment on version

### Comparison Response
```json
{
  "version1": { "number": 1, "createdAt": "...", "createdBy": "..." },
  "version2": { "number": 2, "createdAt": "...", "createdBy": "..." },
  "differences": [
    {
      "field": "text",
      "type": "text",
      "oldValue": "...",
      "newValue": "...",
      "diff": [...]
    }
  ],
  "summary": {
    "totalChanges": 3,
    "textChanged": true,
    "hashtagsChanged": true,
    "mediaChanged": false
  }
}
```

---

## 7. Workflow Actions

### Approve
- Advances to next stage
- If last stage, marks as approved and schedules
- Creates audit trail entry
- Notifies next approver (if applicable)

### Reject
- Marks current stage as rejected
- Marks entire approval as rejected
- Creates audit trail entry
- Notifies creator

### Request Changes
- Marks current stage as changes requested
- Moves back to creator (stage 0)
- Creates audit trail entry
- Notifies creator with requested changes

---

## 8. Implementation Details

### New Models
1. `PostVersion` - Version history
2. `PostComment` - Post comments
3. `EmailApprovalToken` - Email approval tokens

### Enhanced Models
1. `ContentApproval` - Already had stages, enhanced with workflow logic

### New Services
1. `multiStepWorkflowService.js` - Multi-step workflow logic
2. `postCommentService.js` - Commenting system
3. `emailApprovalService.js` - Email approval processing

### New Routes
1. `approval-workflow.js` - Workflow management (6 endpoints)
2. `email-approval.js` - Email approvals (5 endpoints)
3. `post-comments.js` - Comments (6 endpoints)
4. `post-versions.js` - Versions (5 endpoints)

---

## 9. API Summary

### Approval Workflow (6 endpoints)
- Create multi-step approval
- Get approval status
- Approve stage
- Reject approval
- Request changes
- Get audit trail
- List approvals

### Email Approval (5 endpoints)
- Get approval preview
- Approve via email
- Reject via email
- Request changes via email
- Mobile-friendly data

### Post Comments (6 endpoints)
- Add comment
- Get comments
- Resolve comment
- Add reaction
- Edit comment
- Delete comment

### Post Versions (5 endpoints)
- Create version
- Get version history
- Get specific version
- Compare versions
- Comment on version

---

## 10. Client Experience

### Simple Approval
- Click email link
- See content preview
- Approve/decline/request changes
- Add comment (optional)
- Done - no app learning required

### Mobile-Friendly
- Responsive design
- Touch-optimized buttons
- Fast loading
- Works offline (with caching)
- No account required

### Email Approval Flow
1. Client receives email
2. Clicks approval link
3. Sees content preview
4. Clicks approve/reject/request changes
5. Optionally adds comment
6. Confirmation shown
7. Done

---

## 11. Version Comparison Features

### For Legal/Compliance
- **Complete History**: Every change tracked
- **Who Changed What**: Track who made each change
- **When Changed**: Timestamp for every version
- **Why Changed**: Change reason for each version
- **Side-by-Side**: Compare any two versions
- **Diff View**: See exact changes
- **Comments on Versions**: Discuss specific versions
- **Export Versions**: Export for legal records

### Comparison Types
- Text diff (line-by-line)
- Hashtag changes
- Media changes
- Metadata changes
- Summary of all changes

---

## 12. Benefits

1. **Clear Workflow**: Everyone knows where content is
2. **Accountability**: Complete audit trail
3. **Client Convenience**: Approve from email or mobile
4. **Collaboration**: Comments enable discussion
5. **Compliance**: Version history for legal requirements
6. **Transparency**: Visible status at all times
7. **Efficiency**: Streamlined approval process
8. **Mobile-First**: Clients can approve anywhere

---

## 13. Workflow Status Visibility

### Status Indicators
- **Created** ✅ - Content created
- **Internal Review** 🔍 - Being reviewed internally
- **Client Approval** ⏳ - Waiting for client
- **Scheduled** 📅 - Approved and scheduled
- **Rejected** ❌ - Rejected
- **Changes Requested** 🔄 - Changes needed

### Progress Bar
- Visual progress indicator
- Percentage complete
- Current stage highlighted
- Next stage preview

### Audit Trail Display
- Timeline view
- User actions
- Comments and reasons
- Stage transitions
- Timestamps

---

All features are implemented, tested, and ready for production use!


