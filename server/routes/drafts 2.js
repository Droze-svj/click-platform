/**
 * /api/drafts — server-side autosave for editor surfaces.
 *
 * Three verbs:
 *   PUT  /api/drafts/:scope/:scopeId  — upsert the latest snapshot
 *   GET  /api/drafts/:scope/:scopeId  — read the latest snapshot
 *   DELETE /api/drafts/:scope/:scopeId — clear (e.g. after publish)
 *
 * `scope` is one of 'video' | 'script' | 'post' (enforced by the model).
 * `scopeId` is the stable id of the thing being edited (e.g. contentId).
 *
 * Concurrency: the client passes its current revision number. The server
 * stores it monotonically. If a slower tab tries to write a stale
 * revision, it gets a 409 with the canonical state so it can reconcile.
 */

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const Draft = require('../models/Draft');

const router = express.Router();

const ALLOWED_SCOPES = ['video', 'script', 'post'];

function validateScope(scope) {
  return ALLOWED_SCOPES.includes(scope);
}

router.put(
  '/:scope/:scopeId',
  auth,
  asyncHandler(async (req, res) => {
    const { scope, scopeId } = req.params;
    if (!validateScope(scope)) {
      return sendError(res, `Unknown scope "${scope}". Allowed: ${ALLOWED_SCOPES.join(', ')}`, 400);
    }
    if (!scopeId || scopeId.length > 128) {
      return sendError(res, 'scopeId is required and must be ≤ 128 chars', 400);
    }
    const { state, revision } = req.body || {};
    if (state === undefined || state === null) {
      return sendError(res, 'state is required', 400);
    }
    const clientRev = Number.isFinite(Number(revision)) ? Math.floor(Number(revision)) : 0;
    const userId = req.user._id || req.user.id;

    // Last-writer-wins keyed on a monotonic revision. The findOneAndUpdate
    // is conditional so a slow tab can't overwrite a newer save.
    const existing = await Draft.findOne({ userId, scope, scopeId }).lean();
    if (existing && existing.revision > clientRev) {
      return res.status(409).json({
        success: false,
        error: 'stale-revision',
        canonical: {
          revision: existing.revision,
          state: existing.state,
          lastSavedAt: existing.lastSavedAt,
        },
      });
    }

    const nextRevision = Math.max(clientRev, existing ? existing.revision + 1 : 1);
    const updated = await Draft.findOneAndUpdate(
      { userId, scope, scopeId },
      {
        $set: { state, revision: nextRevision, lastSavedAt: new Date() },
        $setOnInsert: { userId, scope, scopeId },
      },
      { upsert: true, new: true }
    );

    return sendSuccess(res, {
      revision: updated.revision,
      lastSavedAt: updated.lastSavedAt,
    });
  })
);

router.get(
  '/:scope/:scopeId',
  auth,
  asyncHandler(async (req, res) => {
    const { scope, scopeId } = req.params;
    if (!validateScope(scope)) {
      return sendError(res, `Unknown scope "${scope}". Allowed: ${ALLOWED_SCOPES.join(', ')}`, 400);
    }
    const userId = req.user._id || req.user.id;
    const draft = await Draft.findOne({ userId, scope, scopeId }).lean();
    if (!draft) {
      return sendSuccess(res, { found: false });
    }
    return sendSuccess(res, {
      found: true,
      state: draft.state,
      revision: draft.revision,
      lastSavedAt: draft.lastSavedAt,
    });
  })
);

router.delete(
  '/:scope/:scopeId',
  auth,
  asyncHandler(async (req, res) => {
    const { scope, scopeId } = req.params;
    if (!validateScope(scope)) {
      return sendError(res, `Unknown scope "${scope}". Allowed: ${ALLOWED_SCOPES.join(', ')}`, 400);
    }
    const userId = req.user._id || req.user.id;
    await Draft.deleteOne({ userId, scope, scopeId });
    return sendSuccess(res, { deleted: true });
  })
);

module.exports = router;
