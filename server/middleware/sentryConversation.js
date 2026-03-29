const logger = require('../utils/logger');

let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (_) {
  // Sentry may be disabled in some local/dev environments.
}

function normalizeConversationId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Keep IDs bounded and URL/header-safe.
  return trimmed.slice(0, 128);
}

function extractUserId(req) {
  return (
    req?.user?._id?.toString?.() ||
    req?.user?.id?.toString?.() ||
    null
  );
}

function resolveConversationId(req) {
  const explicit =
    normalizeConversationId(req.headers['x-conversation-id']) ||
    normalizeConversationId(req.headers['x-sentry-conversation-id']) ||
    normalizeConversationId(req.body?.conversationId) ||
    normalizeConversationId(req.query?.conversationId);

  if (explicit) return { conversationId: explicit, source: 'explicit' };

  const userId = extractUserId(req);
  const sessionId =
    normalizeConversationId(req.sessionID) ||
    normalizeConversationId(req.headers['x-session-id']);

  if (userId && sessionId) return { conversationId: `u:${userId}:s:${sessionId}`, source: 'fallback' };
  if (userId) return { conversationId: `u:${userId}`, source: 'fallback' };
  if (sessionId) return { conversationId: `s:${sessionId}`, source: 'fallback' };

  // Fallback keeps tracing functional for anonymous traffic.
  return { conversationId: `anon:${req.method}:${req.path}`, source: 'fallback' };
}

module.exports = function sentryConversation(req, res, next) {
  if (!Sentry) return next();

  try {
    const { conversationId, source } = resolveConversationId(req);

    if (typeof Sentry.setConversationId === 'function') {
      Sentry.setConversationId(conversationId);
    } else if (typeof Sentry.setTag === 'function') {
      // Backward-compat fallback for older SDK behavior.
      Sentry.setTag('gen_ai.conversation.id', conversationId);
    }

    // Emit reusable conversation ID only when we generated fallback internally.
    if (source === 'fallback' && !res.headersSent) {
      res.setHeader('x-conversation-id', conversationId);
    }

    const clearConversation = () => {
      try {
        if (typeof Sentry.setConversationId === 'function') {
          Sentry.setConversationId(null);
        }
      } catch (_) {
        // ignore cleanup errors
      }
    };

    res.on('finish', clearConversation);
    res.on('close', clearConversation);
  } catch (error) {
    logger.debug('Sentry conversation middleware fallback', { error: error.message });
  }

  return next();
};

