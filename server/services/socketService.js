// Socket.io service for real-time updates

const { Server } = require('socket.io');

let io = null;

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

  io.on('connection', (socket) => {
    const logger = require('../utils/logger');
    const collaborationService = require('./collaborationService');
    const realtimeCollaborationService = require('./realtimeCollaborationService');
    logger.info('Client connected', { socketId: socket.id });

    let currentUserId = null;
    let currentUserName = null;
    // Rooms this socket joined for editor collaboration, mapped to the
    // contentId so disconnect/leave can release locks for the right content.
    // editorRooms: Map<room, contentId>
    const editorRooms = new Map();

    // Authenticate/assign user context
    socket.on('authenticate', ({ userId }) => {
      if (userId) {
        currentUserId = userId;
        socket.join(`user-${userId}`);
        logger.info('User authenticated on socket', { userId, socketId: socket.id });

        // Broadcast new presence
        const activeUsers = collaborationService.getActiveUsers();
        const onlineIds = activeUsers.map(u => u.userId);
        io.emit('presence-update', onlineIds);
      }
    });

    // Handle get-presence request
    socket.on('get-presence', () => {
      const activeUsers = collaborationService.getActiveUsers();
      const onlineIds = activeUsers.map(u => u.userId);
      socket.emit('presence-update', onlineIds);
    });

    // Join content room for collaboration
    socket.on('join:room', async ({ room, contentId, user }) => {
      if (!room) return;
      socket.join(room);
      // Track editor rooms (those scoped to a contentId) for lock cleanup.
      if (contentId) editorRooms.set(room, contentId);
      // Allow the joiner to thread a display name through the payload.
      if (user && user.name) currentUserName = user.name;
      if (currentUserId) {
        collaborationService.trackPresence(currentUserId, socket.id, room, null, currentUserName);
        const users = collaborationService.getRoomUsers(room);
        io.to(room).emit('presence:update', { users });
        // Hydrate the freshly-joined client with the current lock state so it
        // doesn't briefly think every segment is unlocked.
        if (contentId) {
          const locks = realtimeCollaborationService.getContentLocks(contentId);
          for (const [segmentId, lockedBy] of Object.entries(locks)) {
            socket.emit('segment:lock-state', { segmentId, lockedBy });
          }
        }
      }
      logger.info('User joined content room', { room, socketId: socket.id });
    });

    // ── Editor timeline collaboration ──────────────────────────────────
    // Timeline operation (array-replace model). Broadcast to OTHER clients in
    // the room only — never echo to the sender (the sender already applied it
    // locally). version lets clients drop stale ops.
    socket.on('timeline:op', ({ room, op, version }) => {
      if (!room || !currentUserId) return;
      socket.to(room).emit('timeline:op', { userId: currentUserId, op, version });
    });

    // Playhead position broadcast (scrub sync). Other clients only.
    socket.on('playhead:update', ({ room, time }) => {
      if (!room || !currentUserId) return;
      socket.to(room).emit('playhead:update', { userId: currentUserId, time });
    });

    // Lock a segment for exclusive editing.
    socket.on('segment:lock', ({ room, contentId, segmentId }) => {
      if (!room || !contentId || !segmentId || !currentUserId) return;
      const result = realtimeCollaborationService.lockSegment(contentId, currentUserId, segmentId);
      if (result.success) {
        io.to(room).emit('segment:lock-state', { segmentId, lockedBy: String(currentUserId) });
      } else {
        socket.emit('segment:lock-denied', { segmentId, lockedBy: result.lockedBy });
      }
    });

    // Unlock a segment (only the owner can; service enforces it).
    socket.on('segment:unlock', ({ room, contentId, segmentId }) => {
      if (!room || !contentId || !segmentId || !currentUserId) return;
      const result = realtimeCollaborationService.unlockSegment(contentId, currentUserId, segmentId);
      if (result.success) {
        io.to(room).emit('segment:lock-state', { segmentId, lockedBy: null });
      }
    });

    // Add a live comment. Broadcast to the whole room (including sender so
    // their own comment is confirmed). Best-effort persistence is attempted
    // but never blocks the live broadcast.
    socket.on('comment:add', ({ room, contentId, comment }) => {
      if (!room || !comment || !currentUserId) return;
      const enriched = {
        ...comment,
        userId: String(currentUserId),
        userName: currentUserName || comment.userName || null,
        createdAt: comment.createdAt || new Date().toISOString(),
      };
      io.to(room).emit('comment:add', { userId: String(currentUserId), comment: enriched });
      // Best-effort persistence — failures are logged, not surfaced.
      if (contentId) {
        Promise.resolve()
          .then(() => realtimeCollaborationService.sendRealtimeComment(contentId, currentUserId, comment))
          .catch((error) => logger.error('Realtime comment persist failed', { error: error.message, contentId }));
      }
    });

    // Join agency calendar room
    socket.on('join:calendar', ({ agencyWorkspaceId }) => {
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

    // Join client portal room
    socket.on('join:portal', ({ portalId }) => {
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
      if (taskId) {
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
      if (teamId) {
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
      if (roomId) {
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
  emitToUser
};
