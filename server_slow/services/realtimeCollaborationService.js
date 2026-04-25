// Real-time Collaboration Service

const Content = require('../models/Content');
const User = require('../models/User');
const { emitToUser, emitToRoom, broadcast } = require('./realtimeService');
const logger = require('../utils/logger');

// Store active editing sessions
const activeSessions = new Map(); // contentId -> Set of userIds

/**
 * Join content editing session
 */
function joinEditingSession(contentId, userId, socketId) {
  try {
    if (!activeSessions.has(contentId)) {
      activeSessions.set(contentId, new Map());
    }

    const session = activeSessions.get(contentId);
    session.set(userId.toString(), {
      userId,
      socketId,
      joinedAt: new Date(),
      cursor: null,
      selection: null,
    });

    // Notify other users in the session
    const otherUsers = Array.from(session.keys()).filter(
      id => id !== userId.toString()
    );

    otherUsers.forEach(otherUserId => {
      emitToUser(otherUserId, 'collaboration:user-joined', {
        contentId,
        userId,
        activeUsers: Array.from(session.keys()),
      });
    });

    logger.info('User joined editing session', { contentId, userId });
    return {
      success: true,
      activeUsers: Array.from(session.keys()),
    };
  } catch (error) {
    logger.error('Join editing session error', {
      error: error.message,
      contentId,
      userId,
    });
    throw error;
  }
}

/**
 * Leave content editing session
 */
function leaveEditingSession(contentId, userId) {
  try {
    if (!activeSessions.has(contentId)) {
      return { success: true };
    }

    const session = activeSessions.get(contentId);
    session.delete(userId.toString());

    // Notify other users
    const otherUsers = Array.from(session.keys());
    otherUsers.forEach(otherUserId => {
      emitToUser(otherUserId, 'collaboration:user-left', {
        contentId,
        userId,
        activeUsers: otherUsers,
      });
    });

    // Clean up empty sessions
    if (session.size === 0) {
      activeSessions.delete(contentId);
    }

    logger.info('User left editing session', { contentId, userId });
    return { success: true };
  } catch (error) {
    logger.error('Leave editing session error', {
      error: error.message,
      contentId,
      userId,
    });
    throw error;
  }
}

/**
 * Update cursor position
 */
function updateCursor(contentId, userId, cursor) {
  try {
    if (!activeSessions.has(contentId)) {
      return;
    }

    const session = activeSessions.get(contentId);
    const userSession = session.get(userId.toString());

    if (userSession) {
      userSession.cursor = cursor;
      userSession.lastActivity = new Date();

      // Broadcast to other users
      const otherUsers = Array.from(session.keys()).filter(
        id => id !== userId.toString()
      );

      otherUsers.forEach(otherUserId => {
        emitToUser(otherUserId, 'collaboration:cursor-update', {
          contentId,
          userId,
          cursor,
        });
      });
    }
  } catch (error) {
    logger.error('Update cursor error', {
      error: error.message,
      contentId,
      userId,
    });
  }
}

/**
 * Handle content change (operational transform)
 */
async function handleContentChange(contentId, userId, change) {
  try {
    const { operation, version, content } = change;

    // Get current content
    const doc = await Content.findById(contentId);
    if (!doc) {
      throw new Error('Content not found');
    }

    // Simple operational transform (in production, use a library like ShareJS)
    // For now, we'll use a simple merge strategy
    if (operation === 'insert') {
      // Apply insert operation
      const currentText = doc.transcript || doc.text || '';
      const newText =
        currentText.slice(0, change.index) +
        change.text +
        currentText.slice(change.index);
      
      doc.transcript = newText;
      doc.text = newText;
    } else if (operation === 'delete') {
      // Apply delete operation
      const currentText = doc.transcript || doc.text || '';
      const newText =
        currentText.slice(0, change.index) +
        currentText.slice(change.index + change.length);
      
      doc.transcript = newText;
      doc.text = newText;
    } else if (operation === 'replace') {
      // Full content replace
      doc.transcript = content;
      doc.text = content;
    }

    await doc.save();

    // Broadcast change to other users
    if (activeSessions.has(contentId)) {
      const session = activeSessions.get(contentId);
      const otherUsers = Array.from(session.keys()).filter(
        id => id !== userId.toString()
      );

      otherUsers.forEach(otherUserId => {
        emitToUser(otherUserId, 'collaboration:content-change', {
          contentId,
          userId,
          change,
          version: doc.version || 0,
        });
      });
    }

    logger.info('Content change applied', { contentId, userId, operation });
    return {
      success: true,
      version: doc.version || 0,
    };
  } catch (error) {
    logger.error('Handle content change error', {
      error: error.message,
      contentId,
      userId,
    });
    throw error;
  }
}

/**
 * Get active users in session
 */
function getActiveUsers(contentId) {
  try {
    if (!activeSessions.has(contentId)) {
      return [];
    }

    const session = activeSessions.get(contentId);
    return Array.from(session.keys());
  } catch (error) {
    logger.error('Get active users error', {
      error: error.message,
      contentId,
    });
    return [];
  }
}

/**
 * Send comment in real-time
 */
async function sendRealtimeComment(contentId, userId, comment) {
  try {
    // Get user info
    const user = await User.findById(userId).select('name email').lean();

    // Broadcast to all users in session
    if (activeSessions.has(contentId)) {
      const session = activeSessions.get(contentId);
      const allUsers = Array.from(session.keys());

      allUsers.forEach(userIdInSession => {
        emitToUser(userIdInSession, 'collaboration:comment', {
          contentId,
          comment: {
            ...comment,
            user: {
              id: userId,
              name: user.name,
              email: user.email,
            },
            createdAt: new Date(),
          },
        });
      });
    }

    logger.info('Realtime comment sent', { contentId, userId });
    return { success: true };
  } catch (error) {
    logger.error('Send realtime comment error', {
      error: error.message,
      contentId,
      userId,
    });
    throw error;
  }
}

/**
 * Clean up inactive sessions
 */
function cleanupInactiveSessions() {
  try {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [contentId, session] of activeSessions.entries()) {
      for (const [userId, userSession] of session.entries()) {
        const lastActivity = userSession.lastActivity || userSession.joinedAt;
        const inactiveTime = now - lastActivity;

        if (inactiveTime > inactiveThreshold) {
          session.delete(userId);
          logger.info('Removed inactive user from session', {
            contentId,
            userId,
          });
        }
      }

      // Remove empty sessions
      if (session.size === 0) {
        activeSessions.delete(contentId);
      }
    }
  } catch (error) {
    logger.error('Cleanup inactive sessions error', { error: error.message });
  }
}

// Run cleanup every minute
setInterval(cleanupInactiveSessions, 60 * 1000);

module.exports = {
  joinEditingSession,
  leaveEditingSession,
  updateCursor,
  handleContentChange,
  getActiveUsers,
  sendRealtimeComment,
};






