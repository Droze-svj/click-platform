// Inline approval collaboration — comment threads on the content + revision
// history (the Planable/Loomly collaboration layer). Pure builders + thin
// persist ops over ContentApproval.comments / .revisions.

const crypto = require('crypto');
const ContentApproval = require('../models/ContentApproval');

/** PURE: build a validated comment object. */
function buildComment({ authorId, authorName, authorRole, text, targetField, parentId } = {}) {
  const t = String(text == null ? '' : text).trim();
  if (!t) { const e = new Error('Comment text is required'); e.statusCode = 400; throw e; }
  return {
    id: `cm_${crypto.randomBytes(6).toString('hex')}`,
    authorId: authorId || null,
    authorName: String(authorName || '').slice(0, 200),
    authorRole: authorRole || 'reviewer',
    text: t.slice(0, 5000),
    targetField: targetField ? String(targetField).slice(0, 120) : null,
    parentId: parentId || null,
    resolved: false,
    createdAt: new Date(),
  };
}

/** PURE: build the next revision entry given the existing revisions count. */
function buildRevision(existingCount, { changedBy, note, changes } = {}) {
  return {
    version: (Number(existingCount) || 0) + 1,
    changedBy: changedBy || null,
    note: String(note || '').slice(0, 2000),
    changes: changes && typeof changes === 'object' ? changes : {},
    createdAt: new Date(),
  };
}

async function _load(approvalId) {
  const approval = await ContentApproval.findById(approvalId);
  if (!approval) { const e = new Error('Approval not found'); e.statusCode = 404; throw e; }
  return approval;
}

async function addComment(approvalId, comment) {
  const c = buildComment(comment);
  const approval = await _load(approvalId);
  approval.comments.push(c);
  await approval.save();
  return c;
}

async function resolveComment(approvalId, commentId, resolved = true) {
  const approval = await _load(approvalId);
  const c = (approval.comments || []).find((x) => x.id === commentId);
  if (!c) { const e = new Error('Comment not found'); e.statusCode = 404; throw e; }
  c.resolved = !!resolved;
  await approval.save();
  return c;
}

/** Creator re-submits after changes-requested → push a revision (version++). */
async function addRevision(approvalId, payload) {
  const approval = await _load(approvalId);
  const rev = buildRevision((approval.revisions || []).length, payload);
  approval.revisions.push(rev);
  await approval.save();
  return rev;
}

module.exports = { buildComment, buildRevision, addComment, resolveComment, addRevision };
