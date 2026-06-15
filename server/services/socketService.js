// Socket.io service for real-time updates

const { Server } = require('socket.io');

let io = null;

// Resolve the authoritative contentId for a collaboration room. For editor
// rooms the id is taken from the ROOM NAME (`editor:<id>`), NOT a separate
// client field — so a client can't join `editor:<victim>` while passing
// contentId:<their-own-id> to satisfy the ownership check (the C1 takeover).
// Exported for tests.
function deriveRoomContentId(room, contentId) {
  if (typeof room === 'string' && room.startsWith('editor:')) {
    return room.slice('editor:'.length) || null;
  }
  return contentId ? String(contentId) : null;
}

function initializeSocket(server) {
  // In dev, accept any localhost/127.0.0.1 origin so we don't have to keep the
  // explicit list in lock-step with whatever port `next dev` picks.
  // In prod, honor FRONTEND_URL or fall back to the known dev ports.
  const isDev = process.env.NODE_ENV !== 'production';
  const corsOrigin = isDev
    ? (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl / native ws clients
      try {
        const u = new URL(origin);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return cb(null, true);
      } catch { /* fall through */ }
      cb(null, false);
    }
    : (process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3010']);

  io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Handshake authentication. The client sends its JWT in
  // socket.handshake.auth.token (see client/hooks/useSocket.ts). We verify it
  // and stamp the SERVER-VERIFIED userId on socket.data — identity is never
  // taken from a client-supplied `authenticate({userId})` payload anymore
  // (that allowed impersonating any user / joining any room). A socket with NO
  // token is allowed to connect but stays anonymous (socket.data.userId
  // undefined) so it can only use public progress subscriptions, never user/
  // project rooms. A token that is PRESENT but INVALID is rejected.
  io.use((socket, next) => {
    try {
      const h = socket.handshake || {};
      const token = h.auth?.token
        || (h.headers?.authorization || '').replace(/^Bearer\s+/i, '')
        || h.query?.token;
      if (!token) return next(); // anonymous progress-only socket
      const jwt = require('jsonwebtoken');
      const { getJwtSecret } = require('../utils/jwtSecret');
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
      if (decoded && decoded.userId) socket.data.userId = String(decoded.userId);
      return next();
    } catch (err) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const logger = require('../utils/logger');
    const collaborationService = require('./collaborationService');
    const realtimeCollaborationService = require('./realtimeCollaborationService');
    logger.info('Client connected', { socketId: socket.id });

    // Identity comes from the verified handshake (io.use), NOT from the client.
    let currentUserId = socket.data.userId || null;
    let currentUserName = null;
    // Rooms this socket joined for editor collaboration, mapped to the
    // contentId so disconnect/leave can release locks for the right content.
    // editorRooms: Map<room, contentId>
    const editorRooms = new Map();

    // Join the user's private room immediately on a verified connection so
    // emitToUser reaches them without waiting for a client 'authenticate'.
    if (currentUserId) {
      socket.join(`user-${currentUserId}`);
      const activeUsers = collaborationService.getActiveUsers();
      io.emit('presence-update', activeUsers.map(u => u.userId));
    }

    // Back-compat 'authenticate' event: the client may still emit it, but we
    // IGNORE any userId it sends and use the server-verified identity only.
    socket.on('authenticate', () => {
      if (!currentUserId) return; // unauthenticated socket cannot assume an identity
      socket.join(`user-${currentUserId}`);
      logger.info('User authenticated on socket', { userId: currentUserId, socketId: socket.id });
      const activeUsers = collaborationService.getActiveUsers();
      io.emit('presence-update', activeUsers.map(u => u.userId));
    });

    // Handle get-presence request
    socket.on('get-presence', () => {
      const activeUsers = collaborationService.getActiveUsers();
      const onlineIds = activeUsers.map(u => u.userId);
      socket.emit('presence-update', onlineIds);
    });

    // Join content room for collaboration
    socket.on('join:room', async ({ room, contentId, user }) => {
      if (!room || typeof room !== 'string') return;
      // Must be authenticated to join a collaboration room.
      if (!currentUserId) {
        socket.emit('join:denied', { room, error: 'Authentication required' });
        return;
      }
      // The room IS the authorization scope. For editor rooms the contentId is
      // derived from the ROOM NAME (`editor:<id>`), NOT a separate client field —
      // otherwise a client could join `editor:<victim>` while passing
      // contentId:<their-own-id> to satisfy the ownership check, taking over the
      // victim's live collaboration stream. Every join must resolve to a content
      // id we can authorize the user against.
      const cid = deriveRoomContentId(room, contentId);
      if (!cid) {
        socket.emit('join:denied', { room, error: 'A content room is required' });
        return;
      }
      try {
        const { assertOwnership } = require('../utils/ownership');
        await assertOwnership({ user: { _id: currentUserId, id: currentUserId } }, cid);
      } catch (e) {
        socket.emit('join:denied', { room, contentId: cid, error: 'You do not have access to this content' });
        return;
      }
      socket.join(room);
      // Map room → VERIFIED contentId. Membership in this Map is what every
      // mutating handler below checks (so a socket can't write to a room it
      // never ownership-joined).
      editorRooms.set(room, cid);
      // Allow the joiner to thread a display name through the payload.
      if (user && user.name) currentUserName = user.name;
      collaborationService.trackPresence(currentUserId, socket.id, room, null, currentUserName);
      const users = collaborationService.getRoomUsers(room);
      io.to(room).emit('presence:update', { users });
      // Hydrate the freshly-joined client with the current lock state so it
      // doesn't briefly think every segment is unlocked.
      const locks = realtimeCollaborationService.getContentLocks(cid);
      for (const [segmentId, lockedBy] of Object.entries(locks)) {
        socket.emit('segment:lock-state', { segmentId, lockedBy });
      }
      logger.info('User joined content room', { room, socketId: socket.id });
    });

    // ── Editor timeline collaboration ──────────────────────────────────
    // Timeline operation (array-replace model). Broadcast to OTHER clients in
    // the room only — never echo to the sender (the sender already applied it
    // locally). version lets clients drop stale ops.
    socket.on('timeline:op', ({ room, op, version }) => {
      // Membership gate: only a socket that did an ownership-checked join:room
      // (→ editorRooms) may broadcast into the room. `socket.to(room)` targets a
      // room regardless of membership, so without this any authed socket could
      // overwrite another tenant's timeline by naming their room.
      if (!currentUserId || !editorRooms.has(room)) return;
      socket.to(room).emit('timeline:op', { userId: currentUserId, op, version });
    });

    // Playhead position broadcast (scrub sync). Other clients only.
    socket.on('playhead:update', ({ room, time }) => {
      if (!currentUserId || !editorRooms.has(room)) return;
      socket.to(room).emit('playhead:update', { userId: currentUserId, time });
    });

    // Lock a segment for exclusive editing. Uses the VERIFIED contentId mapped
    // at join (never the client payload), so a member can only lock segments of
    // the content the room is authorized for.
    socket.on('segment:lock', ({ room, segmentId }) => {
      if (!currentUserId || !segmentId || !editorRooms.has(room)) return;
      const cid = editorRooms.get(room);
      const result = realtimeCollaborationService.lockSegment(cid, currentUserId, segmentId);
      if (result.success) {
        io.to(room).emit('segment:lock-state', { segmentId, lockedBy: String(currentUserId) });
      } else {
        socket.emit('segment:lock-denied', { segmentId, lockedBy: result.lockedBy });
      }
    });

    // Unlock a segment (only the owner can; service enforces it).
    socket.on('segment:unlock', ({ room, segmentId }) => {
      if (!currentUserId || !segmentId || !editorRooms.has(room)) return;
      const cid = editorRooms.get(room);
      const result = realtimeCollaborationService.unlockSegment(cid, currentUserId, segmentId);
      if (result.success) {
        io.to(room).emit('segment:lock-state', { segmentId, lockedBy: null });
      }
    });

    // Add a live comment. Broadcast to the whole room (including sender so
    // their own comment is confirmed). Best-effort persistence is attempted
    // but never blocks the live broadcast.
    socket.on('comment:add', ({ room, comment }) => {
      if (!currentUserId || !comment || !editorRooms.has(room)) return;
      const cid = editorRooms.get(room);
      const enriched = {
        ...comment,
        userId: String(currentUserId),
        userName: currentUserName || comment.userName || null,
        createdAt: comment.createdAt || new Date().toISOString(),
      };
      io.to(room).emit('comment:add', { userId: String(currentUserId), comment: enriched });
      // Best-effort persistence — failures are logged, not surfaced.
      Promise.resolve()
        .then(() => realtimeCollaborationService.sendRealtimeComment(cid, currentUserId, comment))
        .catch((error) => logger.error('Realtime comment persist failed', { error: error.message, contentId: cid }));
    });

    // Join agency calendar room
    socket.on('join:calendar', async ({ agencyWorkspaceId }) => {
      if (!currentUserId || !agencyWorkspaceId) return;
      // Membership gate: only the owner/active members of the workspace may join
      // its calendar room — otherwise (now that server-push broadcasts are live)
      // anyone could subscribe to another agency's calendar by guessing the id.
      try {
        const { verifyWorkspaceAccess } = require('../middleware/workspaceIsolation');
        const access = await verifyWorkspaceAccess(currentUserId, agencyWorkspaceId);
        if (!access.allowed) {
          socket.emit('join:denied', { room: `agency-calendar-${agencyWorkspaceId}`, error: 'No access to this workspace' });
          return;
        }
      } catch (e) {
        return; // fail closed on lookup error
      }
      const room = `agency-calendar-${agencyWorkspaceId}`;
      socket.join(room);
      logger.info('User joined calendar room', { agencyWorkspaceId, socketId: socket.id });
    });

    // Leave calendar room
    socket.on('leave:calendar', ({ agencyWorkspaceId }) => {
      const room = `agency-calendar-${agencyWorkspaceId}`;
      socket.leave(room);
      logger.info('User left calendar room', { agencyWorkspaceId, socketId: socket.id });
    });

    // Join a team's comment stream for an entity. Comments are TEAM-scoped (see
    // routes/comments.js + utils/resourceAccess), and the room is keyed by
    // `comments:<teamId>:<entityId>`, so the joiner must be a member of the team —
    // otherwise anyone could subscribe to another team's live comments by id.
    socket.on('join:comments', async ({ teamId, entityId }) => {
      if (!currentUserId || !teamId || !entityId) return;
      try {
        const { teamAccessible } = require('../utils/resourceAccess');
        const ok = await teamAccessible({ user: { _id: currentUserId, id: currentUserId } }, teamId);
        if (!ok) {
          socket.emit('join:denied', { room: `comments:${teamId}:${entityId}`, error: 'No access to this team' });
          return;
        }
      } catch (e) {
        return; // fail closed
      }
      socket.join(`comments:${teamId}:${entityId}`);
      logger.info('User joined comments room', { teamId, entityId, socketId: socket.id });
    });

    // Leave a team's comment stream
    socket.on('leave:comments', ({ teamId, entityId }) => {
      if (!teamId || !entityId) return;
      socket.leave(`comments:${teamId}:${entityId}`);
    });

    // Join client portal room
    socket.on('join:portal', async ({ portalId }) => {
      if (!currentUserId || !portalId) return;
      // Membership gate: the joiner must belong to the workspace that owns (or is
      // the client of) this portal. portalId may be the _id or the subdomain.
      try {
        const mongoose = require('mongoose');
        const WhiteLabelPortal = require('../models/WhiteLabelPortal');
        const { verifyWorkspaceAccess } = require('../middleware/workspaceIsolation');
        let portal = null;
        if (mongoose.Types.ObjectId.isValid(String(portalId))) {
          portal = await WhiteLabelPortal.findById(portalId).select('workspaceId clientId').lean().catch(() => null);
        }
        if (!portal) {
          portal = await WhiteLabelPortal.findOne({ subdomain: String(portalId).toLowerCase() }).select('workspaceId clientId').lean().catch(() => null);
        }
        if (!portal) {
          socket.emit('join:denied', { room: `portal-${portalId}`, error: 'Portal not found' });
          return;
        }
        const owner = await verifyWorkspaceAccess(currentUserId, portal.workspaceId);
        const client = owner.allowed ? owner : await verifyWorkspaceAccess(currentUserId, portal.clientId);
        if (!owner.allowed && !client.allowed) {
          socket.emit('join:denied', { room: `portal-${portalId}`, error: 'No access to this portal' });
          return;
        }
      } catch (e) {
        return; // fail closed
      }
      const room = `portal-${portalId}`;
      socket.join(room);
      logger.info('User joined portal room', { portalId, socketId: socket.id });
    });

    // Leave portal room
    socket.on('leave:portal', ({ portalId }) => {
      const room = `portal-${portalId}`;
      socket.leave(room);
      logger.info('User left portal room', { portalId, socketId: socket.id });
    });

    // Leave content room
    socket.on('leave:room', ({ room }) => {
      if (!room) return;
      socket.leave(room);
      // Release any segment locks this user held in the room's content and
      // broadcast the freed lock-state to remaining peers.
      const contentId = editorRooms.get(room);
      editorRooms.delete(room);
      if (currentUserId && contentId) {
        const freed = realtimeCollaborationService.releaseUserLocks(contentId, currentUserId);
        freed.forEach((segmentId) => {
          io.to(room).emit('segment:lock-state', { segmentId, lockedBy: null });
        });
      }
      if (currentUserId) {
        collaborationService.removePresence(currentUserId, socket.id);
        const users = collaborationService.getRoomUsers(room);
        io.to(room).emit('presence:update', { users });
      }
    });

    // Update cursor position
    socket.on('cursor:update', ({ room, cursor }) => {
      if (currentUserId) {
        collaborationService.updateCursor(currentUserId, cursor);
        socket.to(room).emit('cursor:update', { userId: currentUserId, cursor });
      }
    });

    // Content change
    socket.on('content:change', ({ contentId, change }) => {
      collaborationService.broadcastContentChange(io, contentId, change, currentUserId);
    });

    // Typing indicators
    socket.on('typing:start', ({ contentId }) => {
      collaborationService.broadcastTyping(io, contentId, currentUserId, true);
    });

    socket.on('typing:stop', ({ contentId }) => {
      collaborationService.broadcastTyping(io, contentId, currentUserId, false);
    });

    // Unsubscribe from upload progress
    socket.on('unsubscribe:upload', ({ uploadId }) => {
      socket.leave(`upload:${uploadId}`);
      logger.info('Client unsubscribed from upload progress', { uploadId, socketId: socket.id });
    });

    // Task management: join user room for live task updates
    socket.on('join:tasks', () => {
      if (currentUserId) {
        socket.join(`user-${currentUserId}`);
        logger.info('User joined tasks room', { userId: currentUserId, socketId: socket.id });
      }
    });

    // Task chat: join room for a specific task
    socket.on('join:task', ({ taskId }) => {
      if (currentUserId && taskId) {
        socket.join(`task:${taskId}`);
        logger.info('User joined task room', { taskId, socketId: socket.id });
      }
    });

    socket.on('leave:task', ({ taskId }) => {
      if (taskId) socket.leave(`task:${taskId}`);
    });

    socket.on('task:typing', ({ taskId }) => {
      if (currentUserId && taskId) {
        socket.to(`task:${taskId}`).emit('task:typing', { userId: currentUserId });
      }
    });

    // Team signals: broadcast pulses to the whole team
    socket.on('join:team', ({ teamId }) => {
      if (currentUserId && teamId) {
        socket.join(`team:${teamId}`);
        logger.info('User joined team room', { teamId, socketId: socket.id });
      }
    });

    socket.on('activity:pulse', ({ teamId, pulse }) => {
      if (teamId && pulse) {
        const enrichedPulse = collaborationService.trackActivityPulse(teamId, pulse);
        io.to(`team:${teamId}`).emit('activity-pulse', enrichedPulse);
      }
    });

    socket.on('directive:claim', ({ teamId, directiveId, userName }) => {
      if (teamId && directiveId && currentUserId) {
        const claim = collaborationService.claimDirective(teamId, directiveId, currentUserId, userName);
        io.to(`team:${teamId}`).emit('directive:claimed', { directiveId, claim });
      }
    });

    // Task call: WebRTC signaling
    socket.on('join:call', ({ roomId }) => {
      if (currentUserId && roomId) {
        socket.join(`call:${roomId}`);
        socket.to(`call:${roomId}`).emit('call:joined', { userId: currentUserId });
        logger.info('User joined call room', { roomId, socketId: socket.id });
      }
    });

    socket.on('leave:call', ({ roomId }) => {
      if (roomId) {
        socket.leave(`call:${roomId}`);
        socket.to(`call:${roomId}`).emit('call:left', { userId: currentUserId });
      }
    });

    socket.on('call:signal', ({ roomId, signal }) => {
      if (roomId && signal) socket.to(`call:${roomId}`).emit('call:signal', { fromUserId: currentUserId, signal });
    });

    // Subscribe to job progress
    socket.on('subscribe:job', ({ jobId, queueName }) => {
      const room = `job:${queueName}:${jobId}`;
      socket.join(room);
      logger.info('Client subscribed to job progress', { jobId, queueName, socketId: socket.id });
    });

    // Unsubscribe from job progress
    socket.on('unsubscribe:job', ({ jobId, queueName }) => {
      const room = `job:${queueName}:${jobId}`;
      socket.leave(room);
      logger.info('Client unsubscribed from job progress', { jobId, queueName, socketId: socket.id });
    });

    socket.on('disconnect', () => {
      if (currentUserId) {
        // Release segment locks held in every editor room this socket joined,
        // and notify the remaining peers in each room (so a closed tab never
        // strands a lock).
        for (const [room, contentId] of editorRooms.entries()) {
          const freed = realtimeCollaborationService.releaseUserLocks(contentId, currentUserId);
          freed.forEach((segmentId) => {
            io.to(room).emit('segment:lock-state', { segmentId, lockedBy: null });
          });
          // Emit room-scoped presence update reflecting this user leaving.
          const roomUsers = collaborationService.getRoomUsers(room);
          io.to(room).emit('presence:update', {
            users: roomUsers.filter(u => u.userId !== currentUserId),
          });
        }
        editorRooms.clear();

        collaborationService.removePresence(currentUserId, socket.id);

        // Broadcast global presence update
        const activeUsers = collaborationService.getActiveUsers();
        const onlineIds = activeUsers.map(u => u.userId);
        io.emit('presence-update', onlineIds);
      }
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });

  // Initialize notification service
  const notificationService = require('./notificationService');
  notificationService.initialize(io);

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

/**
 * Emit a real-time event to a single user across all their connected
 * tabs/devices. Best-effort: if the socket layer isn't initialized yet
 * (worker boot, tests) we silently no-op so callers don't have to guard.
 */
function emitToUser(userId, event, payload) {
  if (!io || !userId) return false;
  try {
    io.to(`user-${userId}`).emit(event, payload);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  initializeSocket,
  getIO,
  // Alias used by realtimeService / calendarRealtimeService / portalRealtimeService.
  // It was never exported, so every server-push broadcast (calendar/portal/
  // processing/notification) was a silent no-op. Now that it's live, the
  // calendar/portal join handlers above enforce workspace membership.
  getSocketService: getIO,
  emitToUser,
  deriveRoomContentId
};
