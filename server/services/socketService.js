// Socket.io service for real-time updates

let io = null;

function initializeSocket(server) {
  const { Server } = require('socket.io');
  
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    const logger = require('../utils/logger');
    const collaborationService = require('./collaborationService');
    logger.info('Client connected', { socketId: socket.id });

    let currentUserId = null;

    // Join user room for personalized updates
    socket.on('join-user', (userId) => {
      currentUserId = userId;
      socket.join(`user-${userId}`);
      logger.info('User joined room', { userId, socketId: socket.id });
    });

    // Join content room for collaboration
    socket.on('join:room', async ({ room, contentId }) => {
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
      const room = `content:${contentId}`;
      collaborationService.broadcastContentChange(io, contentId, change, currentUserId);
    });

    // Typing indicators
    socket.on('typing:start', ({ contentId }) => {
      const room = `content:${contentId}`;
      collaborationService.broadcastTyping(io, contentId, currentUserId, true);
    });

    socket.on('typing:stop', ({ contentId }) => {
      const room = `content:${contentId}`;
      collaborationService.broadcastTyping(io, contentId, currentUserId, false);
    });

    // Subscribe to upload progress
    socket.on('subscribe:upload', ({ uploadId }) => {
      socket.join(`upload:${uploadId}`);
      logger.info('Client subscribed to upload progress', { uploadId, socketId: socket.id });
    });

    // Unsubscribe from upload progress
    socket.on('unsubscribe:upload', ({ uploadId }) => {
      socket.leave(`upload:${uploadId}`);
      logger.info('Client unsubscribed from upload progress', { uploadId, socketId: socket.id });
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

function getSocketService() {
  return io;
}

// Emit event to specific user
function emitToUser(userId, event, data) {
  const socketIO = getIO();
  socketIO.to(`user-${userId}`).emit(event, data);
}

// Emit event to all connected clients
function emitToAll(event, data) {
  const socketIO = getIO();
  socketIO.emit(event, data);
}

module.exports = {
  initializeSocket,
  getIO,
  getSocketService,
  emitToUser,
  emitToAll
};

