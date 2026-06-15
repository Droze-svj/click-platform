// Shared resource-access checks for comment systems (and anything that inherits
// a parent resource's access). A comment is only as private as its parent — these
// resolve the parent and answer "can this request see/touch it?".
//
// The access rule for owner+workspace resources (ScheduledPost, Content) matches
// the one post-comments.js has used since round-4: the caller owns it, OR has
// access to its workspace / agency workspace. Comments inherit that.

const { verifyWorkspaceAccess } = require('../middleware/workspaceIsolation');

// True if the caller owns `doc` or can access its (agency) workspace.
async function accessibleByOwnerOrWorkspace(req, doc) {
  if (!doc) return false;
  const uid = String(req.user?._id || req.user?.id || '');
  if (uid && String(doc.userId) === uid) return true;
  for (const ws of [doc.workspaceId, doc.agencyWorkspaceId]) {
    if (ws) {
      try {
        if ((await verifyWorkspaceAccess(req.user._id, ws)).allowed) return true;
      } catch (_) { /* fail closed */ }
    }
  }
  return false;
}

// Returns the post if the caller can access it, else null.
async function accessiblePost(req, postId) {
  const ScheduledPost = require('../models/ScheduledPost');
  const post = await ScheduledPost.findById(postId)
    .select('userId workspaceId agencyWorkspaceId').lean().catch(() => null);
  return (post && await accessibleByOwnerOrWorkspace(req, post)) ? post : null;
}

// A PostComment is accessible iff its parent post is.
async function accessibleComment(req, commentId) {
  const PostComment = require('../models/PostComment');
  const comment = await PostComment.findById(commentId).select('postId').lean().catch(() => null);
  if (!comment) return false;
  return !!(await accessiblePost(req, comment.postId));
}

// Returns the content if the caller can access it, else null.
async function accessibleContent(req, contentId) {
  const Content = require('../models/Content');
  const content = await Content.findById(contentId)
    .select('userId workspaceId agencyWorkspaceId').lean().catch(() => null);
  return (content && await accessibleByOwnerOrWorkspace(req, content)) ? content : null;
}

// True if the caller owns the team or is a member of it.
async function teamAccessible(req, teamId) {
  if (!teamId) return false;
  const Team = require('../models/Team');
  const uid = req.user?._id || req.user?.id;
  if (!uid) return false;
  try {
    return !!(await Team.exists({ _id: teamId, $or: [{ ownerId: uid }, { 'members.userId': uid }] }));
  } catch (_) {
    return false;
  }
}

module.exports = {
  accessibleByOwnerOrWorkspace,
  accessiblePost,
  accessibleComment,
  accessibleContent,
  teamAccessible,
};
