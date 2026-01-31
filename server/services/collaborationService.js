// Real-time collaboration service

const User = require('../models/User');
const Content = require('../models/Content');
const logger = require('../utils/logger');

// In-memory store for active users and their presence
const activeUsers = new Map(); // userId -> { socketId, room, cursor, lastSeen }
const roomPresence = new Map(); // roomId -> Set of userIds

/**
 * Track user presence
 */
function trackPresence(userId, socketId, room, cursor = null) {
  try {
    const userPresence = {
      userId,
      socketId,
      room,
      cursor,
      lastSeen: new Date()
    };

    activeUsers.set(userId, userPresence);

    // Track room presence
    if (!roomPresence.has(room)) {
      roomPresence.set(room, new Set());
    }
    roomPresence.get(room).add(userId);

    logger.info('User presence tracked', { userId, room, socketId });
    return userPresence;
  } catch (error) {
    logger.error('Error tracking presence', { error: error.message, userId });
    throw error;
  }
}

/**
 * Remove user presence
 */
function removePresence(userId, socketId) {
  try {
    const userPresence = activeUsers.get(userId);
    if (userPresence) {
      const room = userPresence.room;
      if (roomPresence.has(room)) {
        roomPresence.get(room).delete(userId);
        if (roomPresence.get(room).size === 0) {
          roomPresence.delete(room);
        }
      }
      activeUsers.delete(userId);
      logger.info('User presence removed', { userId, socketId });
    }
  } catch (error) {
    logger.error('Error removing presence', { error: error.message, userId });
  }
}

/**
 * Update user cursor position with enhanced tracking
 */
function updateCursor(userId, cursor) {
  try {
    const userPresence = activeUsers.get(userId);
    if (userPresence) {
      // Enhanced cursor tracking with history
      const cursorData = {
        x: cursor.x || cursor.position?.x || 0,
        y: cursor.y || cursor.position?.y || 0,
        visible: cursor.visible !== false,
        timestamp: new Date(),
        selection: cursor.selection || null,
        tool: cursor.tool || 'default',
        // Store cursor history for smooth animations
        history: userPresence.cursor?.history || [],
      };

      // Keep last 5 cursor positions for smooth interpolation
      cursorData.history.push({
        x: cursorData.x,
        y: cursorData.y,
        timestamp: cursorData.timestamp,
      });
      if (cursorData.history.length > 5) {
        cursorData.history.shift();
      }

      userPresence.cursor = cursorData;
      userPresence.lastSeen = new Date();
      return userPresence;
    }
    return null;
  } catch (error) {
    logger.error('Error updating cursor', { error: error.message, userId });
    return null;
  }
}

/**
 * Get cursor positions for all users in a room
 */
function getRoomCursors(room) {
  try {
    const users = getRoomUsers(room);
    return users.map((user) => ({
      userId: user.userId,
      cursor: user.cursor,
      lastSeen: user.lastSeen,
    }));
  } catch (error) {
    logger.error('Error getting room cursors', { error: error.message, room });
    return [];
  }
}

/**
 * Get users in a room
 */
function getRoomUsers(room) {
  try {
    const userIds = roomPresence.get(room) || new Set();
    const users = [];
    
    userIds.forEach(userId => {
      const presence = activeUsers.get(userId);
      if (presence) {
        users.push({
          userId: presence.userId,
          cursor: presence.cursor,
          lastSeen: presence.lastSeen
        });
      }
    });

    return users;
  } catch (error) {
    logger.error('Error getting room users', { error: error.message, room });
    return [];
  }
}

/**
 * Get all active users
 */
function getActiveUsers() {
  try {
    const users = [];
    activeUsers.forEach((presence, userId) => {
      users.push({
        userId: presence.userId,
        room: presence.room,
        cursor: presence.cursor,
        lastSeen: presence.lastSeen
      });
    });
    return users;
  } catch (error) {
    logger.error('Error getting active users', { error: error.message });
    return [];
  }
}

/**
 * Check if user is editing content
 */
async function isUserEditing(userId, contentId) {
  try {
    const userPresence = activeUsers.get(userId);
    if (userPresence && userPresence.room === `content:${contentId}`) {
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error checking edit status', { error: error.message, userId, contentId });
    return false;
  }
}

/**
 * Get editing users for content
 */
function getEditingUsers(contentId) {
  try {
    const room = `content:${contentId}`;
    return getRoomUsers(room);
  } catch (error) {
    logger.error('Error getting editing users', { error: error.message, contentId });
    return [];
  }
}

/**
 * Broadcast content change
 */
function broadcastContentChange(io, contentId, change, userId) {
  try {
    const room = `content:${contentId}`;
    io.to(room).emit('content:change', {
      contentId,
      change,
      userId,
      timestamp: new Date()
    });
    logger.info('Content change broadcasted', { contentId, userId });
  } catch (error) {
    logger.error('Error broadcasting content change', { error: error.message, contentId });
  }
}

/**
 * Broadcast typing indicator
 */
function broadcastTyping(io, contentId, userId, isTyping) {
  try {
    const room = `content:${contentId}`;
    io.to(room).except(userId).emit('user:typing', {
      contentId,
      userId,
      isTyping,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error broadcasting typing', { error: error.message, contentId, userId });
  }
}

/**
 * Clean up stale presence (users inactive for more than 5 minutes)
 */
function cleanupStalePresence() {
  try {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    activeUsers.forEach((presence, userId) => {
      const timeSinceLastSeen = now - presence.lastSeen;
      if (timeSinceLastSeen > staleThreshold) {
        removePresence(userId, presence.socketId);
        logger.info('Removed stale presence', { userId });
      }
    });
  } catch (error) {
    logger.error('Error cleaning up stale presence', { error: error.message });
  }
}

// Clean up stale presence every minute
setInterval(cleanupStalePresence, 60 * 1000);

/**
 * Get cursor positions for all users in a room
 */
function getRoomCursors(room) {
  try {
    const users = getRoomUsers(room);
    return users.map((user) => ({
      userId: user.userId,
      cursor: user.cursor,
      lastSeen: user.lastSeen,
    }));
  } catch (error) {
    logger.error('Error getting room cursors', { error: error.message, room });
    return [];
  }
}

module.exports = {
  trackPresence,
  removePresence,
  updateCursor,
  getRoomUsers,
  getActiveUsers,
  isUserEditing,
  getEditingUsers,
  broadcastContentChange,
  broadcastTyping,
  getRoomCursors,
};







