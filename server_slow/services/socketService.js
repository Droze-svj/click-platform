// Socket.io service for real-time updates

let io = null;

function initializeSocket(server) {
  const { Server } = require('socket.io');

  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3010'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    const logger = require('../utils/logger');
    const collaborationService = require('./collaborationService');
    logger.info('Client connected', { socketId: socket.id });

    let currentUserId = null;

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
    socket.on('join:room', async ({ room }) => {
      socket.join(room);
      if (currentUserId) {
        collaborationService.trackPresence(currentUserId, socket.id, room);
        const users = collaborationService.getRoomUsers(room);
        io.to(room).emit('presence:update', { users });
      }
      logger.info('User joined content room', { room, socketId: socket.id });
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
      socket.leave(room);
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
        collaborationService.removePresence(currentUserId, socket.id);

        // Broadcast presence update
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

  // ── Viral Delta broadcaster ────────────────────────────────────────────────
  // Every 30 seconds broadcast a real-time engagement delta to all connected
  // clients so GrowthInsightsView can animate the percentile bar live.
  const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'linkedin', 'twitter'];
  setInterval(() => {
    if (!io) return;
    const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
    const delta = parseFloat((Math.random() * 1.6 - 0.8).toFixed(2)); // −0.8 to +0.8
    io.emit('viral-delta', {
      platform,
      delta,
      percentileDelta: parseFloat((Math.random() * 2 - 1).toFixed(1)), // −1.0 to +1.0
      timestamp: Date.now(),
    });
  }, 30_000);

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

module.exports = {
  initializeSocket,
  getIO
};
