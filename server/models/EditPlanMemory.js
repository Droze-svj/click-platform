/**
 * EditPlanMemory — Click AI Director's "edit-plan memory" (Slice 2).
 *
 * A per-user record of recently generated AI Director directions. Two jobs:
 *   1. VARIETY — before each generation we hand Claude a list of the user's
 *      recent direction "fingerprints" and tell it to produce something
 *      meaningfully different, so the director never regenerates the same plan.
 *   2. LEARNING — as the user chooses / applies / dismisses directions we flip
 *      a row's `status`, and later (optional wiring) attach the published-post
 *      `performanceDelta` so we learn which directions actually land.
 *
 * The fingerprint is a deterministic sha256 over a direction's creative
 * signature (hook gist, color grade, transition set, pacing, narrative
 * structure, vfx set, title). Arrays are sorted before hashing so two
 * directions that differ only in step ORDER collapse to the same fingerprint.
 *
 * Owner's #1 rule: no fabricated data. `fingerprintOf` is a PURE function over
 * a real direction object — it never invents fields and never touches the DB.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

// userId matches UserStyleProfile.userId — a User ObjectId.
const editPlanMemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  contentId: { type: String, default: null },

  // Stable hash of the direction's creative signature (see fingerprintOf).
  fingerprint: { type: String, required: true, index: true },

  // The raw fields the fingerprint was built from — kept for the avoid-list
  // summary we feed back into the prompt, and for diagnostics.
  signature: {
    type: new mongoose.Schema({
      hookTextHash: { type: String, default: '' },
      colorGrade: { type: String, default: '' },
      transitionSet: { type: [String], default: [] },
      pacing: { type: String, default: '' },
      narrativeStructure: { type: String, default: '' },
      vfxSet: { type: [String], default: [] },
      title: { type: String, default: '' },
    }, { _id: false }),
    default: () => ({}),
  },

  directionId: { type: String, default: '' },
  title: { type: String, default: '' },
  vibe: { type: String, default: '' },

  status: {
    type: String,
    enum: ['generated', 'chosen', 'applied', 'dismissed'],
    default: 'generated',
  },

  // Filled later when the published-post performance is known. Hook only;
  // full wiring is optional for this slice.
  performanceDelta: { type: Number, default: null },
}, { timestamps: true });

editPlanMemorySchema.index({ userId: 1, createdAt: -1 });
editPlanMemorySchema.index({ userId: 1, fingerprint: 1 });
// M5: TTL — rows self-expire 90 days after creation so memory can't grow without bound.
editPlanMemorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

// ── Helpers ────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

/** Lowercase + collapse whitespace so trivial formatting differences don't
 * read as "different" creative choices. */
function norm(v) {
  return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Pull steps array off a direction defensively. */
function stepsOf(direction) {
  return (direction && Array.isArray(direction.steps)) ? direction.steps : [];
}

/** Collect normalized, deduped, SORTED values from steps of given type via a
 * param-extracting fn. Sorting makes the fingerprint order-independent. */
function collectSorted(steps, type, pick) {
  const set = new Set();
  for (const s of steps) {
    if (!s || s.type !== type) continue;
    const raw = pick(s.params || {}, s);
    if (raw == null || raw === '') continue;
    set.add(norm(raw));
  }
  return Array.from(set).sort();
}

// ── Statics ──────────────────────────────────────────────────────────────

/**
 * fingerprintOf — PURE. Builds the signature object + a deterministic sha256
 * from a direction's steps. Same direction → same hash; a different hook,
 * color, transition mix, pacing, vfx, or title → different hash. Arrays are
 * sorted so step ORDER never changes the fingerprint.
 *
 * @param {Object} direction
 * @returns {{ signature: Object, fingerprint: string }}
 */
editPlanMemorySchema.statics.fingerprintOf = function fingerprintOf(direction) {
  const steps = stepsOf(direction);

  // Hook gist — concat all hook texts (sorted) then hash, so we store a hash
  // not raw user copy in the signature.
  const hookTexts = collectSorted(steps, 'hook', (p) => p.text);
  const hookTextHash = hookTexts.length ? sha256(hookTexts.join('|')) : '';

  // Color grade — first color step's grade (normalized).
  const colorGrades = collectSorted(steps, 'color', (p) => p.grade);
  const colorGrade = colorGrades[0] || '';

  // Transition set — all transition styles, sorted + deduped.
  const transitionSet = collectSorted(steps, 'transition', (p) => p.style);

  // Pacing — first pacing step's strategy.
  const pacings = collectSorted(steps, 'pacing', (p) => p.strategy);
  const pacing = pacings[0] || '';

  // VFX set — effect names, sorted + deduped.
  const vfxSet = collectSorted(steps, 'effect', (p) => p.name);

  // Narrative structure — derived from the ORDERED sequence of step types
  // present in the direction (the creative skeleton). Distinct skeletons read
  // as distinct narratives; identical skeletons collapse together.
  const narrativeStructure = steps
    .map((s) => (s && typeof s.type === 'string' ? s.type : ''))
    .filter(Boolean)
    .join('>');

  const title = norm(direction && direction.title);

  const signature = {
    hookTextHash,
    colorGrade,
    transitionSet,
    pacing,
    narrativeStructure,
    vfxSet,
    title,
  };

  // Canonicalize for hashing: arrays already sorted; serialize with stable key
  // order (object literal keys are insertion-ordered and fixed above).
  const canonical = JSON.stringify({
    hookTextHash,
    colorGrade,
    transitionSet,
    pacing,
    narrativeStructure,
    vfxSet,
    title,
  });

  return { signature, fingerprint: sha256(canonical) };
};

/**
 * recentFingerprints — the user's most recent GENERATED directions (newest
 * first), as lightweight rows for the avoid-list.
 *
 * @returns {Promise<Array<{ fingerprint, signature, title }>>}
 */
editPlanMemorySchema.statics.recentFingerprints = async function recentFingerprints(userId, limit = 12) {
  if (!userId) return [];
  const rows = await this.find({ userId, status: 'generated' })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, limit))
    .select('fingerprint signature title')
    .lean();
  return (rows || []).map((r) => ({
    fingerprint: r.fingerprint,
    signature: r.signature || {},
    title: r.title || (r.signature && r.signature.title) || '',
  }));
};

/**
 * recordGenerated — compute a direction's fingerprint and persist a
 * 'generated' row. Upserts on (userId, fingerprint) so re-generating the same
 * creative signature refreshes the existing row's timestamp rather than piling
 * up duplicates.
 */
editPlanMemorySchema.statics.recordGenerated = async function recordGenerated(userId, contentId, direction) {
  if (!userId || !direction) return null;
  const { signature, fingerprint } = this.fingerprintOf(direction);
  const now = new Date();
  return this.findOneAndUpdate(
    { userId, fingerprint },
    {
      $set: {
        contentId: contentId == null ? null : String(contentId),
        signature,
        directionId: typeof direction.id === 'string' ? direction.id : '',
        title: typeof direction.title === 'string' ? direction.title : '',
        vibe: typeof direction.vibe === 'string' ? direction.vibe : '',
        updatedAt: now,
      },
      // M4: only set status on INSERT. Re-generating the same creative signature
      // must NOT reset an existing chosen/dismissed/applied row back to 'generated'.
      $setOnInsert: { userId, fingerprint, status: 'generated', createdAt: now },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

/**
 * markStatus — flip the status of the matching recent row(s). Matches by
 * fingerprint first, then falls back to directionId (what the /feedback
 * endpoint has on hand). Updates the most-recent matching row for this user.
 */
editPlanMemorySchema.statics.markStatus = async function markStatus(userId, fingerprintOrDirectionId, status) {
  if (!userId || !fingerprintOrDirectionId || !status) return null;
  const allowed = ['generated', 'chosen', 'applied', 'dismissed'];
  if (!allowed.includes(status)) throw new Error(`Invalid status: ${status}`);

  const key = String(fingerprintOrDirectionId);
  // Prefer fingerprint match; fall back to directionId.
  const row = await this.findOne({
    userId,
    $or: [{ fingerprint: key }, { directionId: key }],
  }).sort({ createdAt: -1 });

  if (!row) return null;
  row.status = status;
  await row.save();
  return row;
};

module.exports = mongoose.models.EditPlanMemory
  || mongoose.model('EditPlanMemory', editPlanMemorySchema);
