# Team Collaboration (Task Chat & Calls)

Real-time teamwork features tied to tasks: embedded chat with @mentions and in-task video/audio calls, with room for role-based permissions and guest access.

## What’s included

### Task chat
- **Where:** Open any task → “Team chat” section in the task detail modal.
- **Features:** Send messages; real-time delivery via WebSocket (`task:message`).  
- **@mentions:** Use `@[userId]` in the message body; `mentionUserIds` are sent to the API and the mentioned user gets an in-app notification (link to task). Mentions are highlighted in the message list.
- **Typing indicator:** When someone types in the chat, others see “Teammate is typing…” (throttled; hides after 3s).
- **Timestamps:** Each message shows a relative time (e.g. “2m ago”, “Just now”).

### In-task calls
- **Where:** Same task detail modal → “Start call” in the Team chat header.
- **Flow:** “Start call” creates a call room (backend), joins the socket room `call:{roomId}` for signaling, and shows “Copy call link” and “End call”. Others open the link (e.g. ` /dashboard/tasks?task=:id&call=:roomId`) to open the task and join the call.
- **Join from link:** If the URL has `task` and `call` query params, the Tasks page opens that task in the modal and joins the call room automatically.
- **Signaling:** Socket events `join:call`, `leave:call`, `call:signal` (offer/answer/ICE). Frontend can implement full WebRTC (getUserMedia, RTCPeerConnection, exchange SDP/ICE over `call:signal`) for low-latency video/audio.

### Backend
- **Models:** `TaskMessage` (taskId, userId, body, mentionUserIds), `TaskCall` (taskId, roomId, startedBy, startedAt, endedAt).  
- **Task:** Optional `workspaceId` on `Task` for future workspace-scoped access.
- **APIs:**
  - `GET/POST /api/tasks/:taskId/messages` — list and send messages (with permission check).
  - `GET /api/tasks/:taskId/call` — active call for task (if any).
  - `POST /api/tasks/:taskId/call/start` — start call (returns `roomId`).
  - `POST /api/tasks/:taskId/call/end` — end call (body: `{ roomId }`).
- **Socket:** `join:task` / `leave:task` (chat); `join:call` / `leave:call` / `call:signal` (calls).  
- **Permissions:** Today, only the task owner can access chat/call; `taskMessageService.canAccessTask()` is the single place to extend (e.g. when `task.workspaceId` is set, allow workspace members).

## Role-based permissions and guest access (future)

- **Workspace model** already has `members[].role` (owner, admin, editor, viewer, etc.). Adding a `guest` role and wiring `canAccessTask` to workspace membership would give:
  - **Guests:** View task + chat + join call (no edit).
  - **Members:** + edit task.
  - **Admins:** + invite members.
- **Guest invite:** A `WorkspaceInvite` (email, token, role, expiresAt) plus invite-by-link would support client/agency workflows without full signup.

## Teams page

The dashboard **Teams** page includes a short “Task collaboration” blurb that links to **Tasks** and describes chat + in-task calls.

## Files touched

- **Server:** `server/models/TaskMessage.js`, `server/models/TaskCall.js`, `server/models/Task.js` (workspaceId), `server/services/taskMessageService.js`, `server/services/taskCallService.js`, `server/routes/tasks.js` (messages + call routes), `server/services/socketService.js` (task + call rooms and events).
- **Client:** `client/app/dashboard/tasks/page.tsx` (TaskCollaborationPanel, modal props), `client/app/dashboard/teams/page.tsx` (collaboration blurb + link to Tasks).
