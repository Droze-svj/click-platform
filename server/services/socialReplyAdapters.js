// Social reply adapters — per-platform "post an approved reply" senders for the
// AI Comment/DM Responder. Only wired platforms can send; everything else fails
// closed with 501. Actual posting still requires SOCIAL_REPLY_SEND=true (enforced
// upstream in socialResponderService.sendApprovedReply) AND valid OAuth tokens.

const logger = require('../utils/logger');

/**
 * Twitter/X reply adapter — replies to the target tweet as the connected user.
 * externalCommentId is the tweet id being replied to.
 */
async function twitterReply(userId, externalCommentId, text) {
  const twitter = require('./twitterOAuthService');
  const result = await twitter.replyToTweet(userId, text, externalCommentId);
  return { platform: 'twitter', id: result && result.id };
}

/**
 * Instagram reply adapter — replies to the target IG comment via the Graph API
 * (POST /{comment-id}/replies). externalCommentId is the IG comment id.
 */
async function instagramReply(userId, externalCommentId, text) {
  const instagram = require('./instagramOAuthService');
  const result = await instagram.replyToComment(userId, externalCommentId, text);
  return { platform: 'instagram', id: result && result.id };
}

/**
 * LinkedIn reply adapter — comments on the target object via socialActions.
 * externalCommentId is the urn:li:… of the post/comment being replied to.
 */
async function linkedinReply(userId, externalCommentId, text) {
  const linkedin = require('./linkedinOAuthService');
  const result = await linkedin.replyToComment(userId, externalCommentId, text);
  return { platform: 'linkedin', id: result && (result.id || result.$URN || result.object) };
}

/**
 * Facebook reply adapter — comments on the target object as the connected page
 * (Graph API POST /{object-id}/comments). externalCommentId is the FB object id.
 */
async function facebookReply(userId, externalCommentId, text) {
  const facebook = require('./facebookOAuthService');
  const result = await facebook.replyToComment(userId, externalCommentId, text);
  return { platform: 'facebook', id: result && result.id };
}

/**
 * YouTube reply adapter — replies to a top-level comment as the connected
 * channel (Data API comments.insert). externalCommentId is the parent comment id.
 */
async function youtubeReply(userId, externalCommentId, text) {
  const youtube = require('./youtubeOAuthService');
  const result = await youtube.replyToComment(userId, externalCommentId, text);
  return { platform: 'youtube', id: result && result.id };
}

// Registry of platforms we can actually send to. Add adapters here as each
// platform's reply/comment API is implemented.
const ADAPTERS = {
  twitter: twitterReply,
  x: twitterReply,
  instagram: instagramReply,
  linkedin: linkedinReply,
  facebook: facebookReply,
  youtube: youtubeReply,
};

/** Platforms with a wired reply adapter. */
function supportedPlatforms() {
  return Object.keys(ADAPTERS);
}

/**
 * Dispatch a reply to the right platform adapter. `adapters` is injectable for
 * tests. Throws 501 for an unsupported platform, 400 for a missing target id.
 */
async function sendReply(userId, platform, externalCommentId, text, adapters = ADAPTERS) {
  const fn = adapters[platform];
  if (!fn) {
    const e = new Error(`Replies to ${platform} are not supported yet`);
    e.statusCode = 501;
    throw e;
  }
  if (!externalCommentId) {
    const e = new Error('Missing target comment/tweet id (externalCommentId)');
    e.statusCode = 400;
    throw e;
  }
  logger.info('[replyAdapter] sending', { userId: String(userId), platform });
  return fn(userId, externalCommentId, text);
}

module.exports = {
  ADAPTERS,
  supportedPlatforms,
  sendReply,
  twitterReply,
  instagramReply,
  linkedinReply,
  facebookReply,
  youtubeReply,
};
