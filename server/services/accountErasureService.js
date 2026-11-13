/**
 * Account erasure (GDPR right to be forgotten) and full data export.
 *
 * Erasure used to delete five collections (account, content, scheduled posts,
 * security and error logs). Everything else a user leaves behind — connected
 * social-account tokens (SocialConnection), uploaded and rendered media files,
 * captions, scripts, notifications, style profile, and ~130 other collections
 * keyed by the user — stayed until someone removed it by hand.
 *
 * This finds every registered model with an owner field and deletes the user's
 * documents in all of them, deletes the media files those documents point at,
 * then deletes the account (which also ends every session: auth looks the user
 * up on each request). Payment records are kept — see RETAINED.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Fields that say "this document belongs to this user".
const OWNER_PATHS = ['userId', 'user', 'owner', 'ownerId'];

// Kept after erasure: payment and subscription records (invoice and tax
// accounting; the card payments themselves are held by Whop). They are keyed
// by the user's id only, which no longer resolves to a person once the account
// is gone.
const RETAINED = new Set(['BillingHistory', 'SubscriptionChange', 'CancellationRequest']);

// Shared spaces: only deleted when nobody else is in them; otherwise the user
// is taken out of the member list and the space stays with the team.
const SHARED = new Set(['Workspace', 'Team', 'Project']);

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

let modelsLoaded = false;
/** Register every model file, so a collection nobody has required yet isn't skipped. */
function loadAllModels() {
  if (modelsLoaded) return;
  const dir = path.join(__dirname, '../models');
  for (const f of fs.readdirSync(dir)) {
    // iCloud conflict copies ("User 2.js") would register duplicate models.
    if (!f.endsWith('.js') || / \d+\.js$/.test(f)) continue;
    try { require(path.join(dir, f)); } catch (_) { /* a model that can't load holds nothing to erase */ }
  }
  modelsLoaded = true;
}

/** [{ name, Model, paths }] for every model with an id-typed owner field. */
function ownedModels() {
  loadAllModels();
  const out = [];
  for (const [name, Model] of Object.entries(mongoose.models)) {
    if (name === 'User') continue;
    const paths = OWNER_PATHS.filter((p) => {
      const sp = Model.schema.path(p);
      return sp && ['ObjectId', 'String', 'Mixed'].includes(sp.instance);
    });
    if (paths.length) out.push({ name, Model, paths });
  }
  return out;
}

function ownerFilter(paths, userId) {
  // Ids are stored as ObjectIds in some collections and as strings in others
  // (Mixed fields such as Notification.userId keep whichever was written).
  const id = String(userId);
  const forms = mongoose.Types.ObjectId.isValid(id) ? [new mongoose.Types.ObjectId(id), id] : [id];
  const one = (p) => ({ [p]: { $in: forms } });
  return paths.length === 1 ? one(paths[0]) : { $or: paths.map(one) };
}

/** Every /uploads/… path and cloud storage key mentioned anywhere in these documents. */
function collectMedia(docs, into) {
  const walk = (v, key) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/\/uploads\/([^\s"'?#)]+)/g)) into.local.add(m[1]);
      if ((key === 'storageKey' || key === 'cloudKey') && v && !v.startsWith('/') && !/^https?:/i.test(v)) into.cloud.add(v);
      return;
    }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; }
    if (v && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) && v._bsontype === undefined) {
      for (const [k, x] of Object.entries(v)) walk(x, k);
    }
  };
  docs.forEach((d) => walk(d, ''));
}

async function deleteMedia(media) {
  let files = 0;
  for (const rel of media.local) {
    let decoded;
    try { decoded = decodeURIComponent(rel); } catch (_) { decoded = rel; }
    const abs = path.resolve(UPLOADS_DIR, decoded);
    if (!abs.startsWith(UPLOADS_DIR + path.sep)) continue; // never outside uploads/
    try { await fs.promises.unlink(abs); files += 1; } catch (_) { /* already gone */ }
  }
  if (media.cloud.size) {
    const { deleteFile } = require('./storageService');
    for (const key of media.cloud) {
      try { await deleteFile(key); files += 1; } catch (err) { logger.warn('[erasure] cloud file not deleted', { error: err.message }); }
    }
  }
  return files;
}

/**
 * Erase an account and everything it owns. Returns counts per collection.
 * The caller is responsible for authentication and for stopping billing first.
 */
async function eraseAccount(userId) {
  const User = mongoose.model('User');
  const user = await User.findById(userId).lean();
  if (!user) {
    const e = new Error('Account not found');
    e.statusCode = 404;
    throw e;
  }

  const media = { local: new Set(), cloud: new Set() };
  collectMedia([user], media);
  const removed = {};

  for (const { name, Model, paths } of ownedModels()) {
    if (RETAINED.has(name)) continue;
    const filter = ownerFilter(paths, userId);
    try {
      if (SHARED.has(name)) {
        const spaces = await Model.find(filter).lean();
        for (const s of spaces) {
          const others = (Array.isArray(s.members) ? s.members : [])
            .filter((m) => m && String(m.userId || m.user || m) !== String(userId) && m.status !== 'removed');
          if (others.length === 0) {
            collectMedia([s], media);
            await Model.deleteOne({ _id: s._id });
            removed[name] = (removed[name] || 0) + 1;
          }
        }
        continue;
      }
      const docs = await Model.find(filter).lean();
      if (!docs.length) continue;
      collectMedia(docs, media);
      const r = await Model.deleteMany(filter);
      if (r.deletedCount) removed[name] = r.deletedCount;
    } catch (err) {
      // One collection failing must not leave the account half-erased silently.
      logger.error('[erasure] collection not erased', { model: name, error: err.message });
      removed[`${name}:failed`] = true;
    }
  }

  // Take the user out of shared spaces they stay in.
  for (const name of SHARED) {
    const Model = mongoose.models[name];
    if (!Model || !Model.schema.path('members')) continue;
    try {
      const forms = [new mongoose.Types.ObjectId(String(userId)), String(userId)];
      await Model.updateMany({ 'members.userId': { $in: forms } }, { $pull: { members: { userId: { $in: forms } } } });
    } catch (_) { /* schema without members.userId */ }
  }

  const files = await deleteMedia(media);
  await User.deleteOne({ _id: userId });
  removed.User = 1;

  const failed = Object.keys(removed).filter((k) => k.endsWith(':failed'));
  logger.info('[erasure] account erased', { collections: Object.keys(removed).length, files, failed: failed.length });
  return { erased: true, collections: removed, files, failed };
}

// Secret fields never go into an export.
const SECRET_KEY = /(password|token|secret|apikey|api_key|hash|otp|totp|recovery|backupcodes|twofactor)/i;
function redact(v, key = '', depth = 0) {
  if (depth > 12) return undefined;
  if (key && SECRET_KEY.test(key)) return undefined;
  if (Array.isArray(v)) return v.map((x) => redact(x, '', depth + 1));
  if (v && typeof v === 'object' && !(v instanceof Date) && v._bsontype === undefined && !Buffer.isBuffer(v)) {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const r = redact(x, k, depth + 1);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  if (v && v._bsontype === 'ObjectId') return String(v);
  return v;
}

/** Everything stored about the user, collection by collection, without secrets. */
async function exportAccount(userId, { perCollection = 5000 } = {}) {
  const User = mongoose.model('User');
  const user = await User.findById(userId).lean();
  if (!user) {
    const e = new Error('Account not found');
    e.statusCode = 404;
    throw e;
  }
  const data = {};
  for (const { name, Model, paths } of ownedModels()) {
    try {
      const docs = await Model.find(ownerFilter(paths, userId)).limit(perCollection).lean();
      if (docs.length) data[name] = docs.map((d) => redact(d));
    } catch (_) { /* skip a collection that can't be read */ }
  }
  return {
    exportedAt: new Date().toISOString(),
    account: redact(user),
    data,
  };
}

module.exports = { eraseAccount, exportAccount, ownedModels, RETAINED };
