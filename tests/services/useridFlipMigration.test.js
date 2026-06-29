// Round-trip proof for the userId String↔ObjectId Phase-3 migrations
// (scripts/migrate-userid-to-objectid.js + migrate-userid-to-string.js) on
// seeded in-memory data — the rehearsal the runbook demands before prod.
//
// Asserts: forward flips String→BSON ObjectId preserving the hex value; inverse
// flips back to the identical hex string; both are idempotent; mixed already-
// converted docs are untouched; and a non-hex (un-normalized) value ABORTS the
// forward run with zero writes.

const mongoose = require('mongoose');
const connectTestDb = require('../helpers/connectTestDb');
const { convertToObjectId } = require('../../scripts/migrate-userid-to-objectid');
const { convertToString } = require('../../scripts/migrate-userid-to-string');

const COLLECTIONS = ['contents', 'scheduledposts', 'vectormemories', 'workflows', 'agenticjobs'];
const HEX_A = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const HEX_B = 'ffffffffffffffffffffffff';

let db;

beforeAll(async () => {
  await connectTestDb();
  db = mongoose.connection.db;
});

afterEach(async () => {
  for (const c of COLLECTIONS) { try { await db.collection(c).deleteMany({}); } catch (_) { /* noop */ } }
});

async function seedStringIds() {
  for (const c of COLLECTIONS) {
    await db.collection(c).insertMany([
      { userId: HEX_A, marker: `${c}-1` },
      { userId: HEX_B, marker: `${c}-2` },
    ]);
  }
}

async function typeOf(coll, marker) {
  const doc = await db.collection(coll).findOne({ marker });
  return doc.userId instanceof mongoose.Types.ObjectId ? 'objectId'
    : typeof doc.userId === 'string' ? 'string' : 'other';
}

describe('userId Phase-3 forward migration (String → ObjectId)', () => {
  it('dry-run reports convertible but writes NOTHING', async () => {
    await seedStringIds();
    const { totals } = await convertToObjectId(db, { apply: false });
    expect(totals.convertible).toBe(COLLECTIONS.length * 2);
    expect(await typeOf('contents', 'contents-1')).toBe('string'); // unchanged
  });

  it('apply flips every flip-set userId to a BSON ObjectId, preserving the hex', async () => {
    await seedStringIds();
    const { aborted } = await convertToObjectId(db, { apply: true });
    expect(aborted).toBe(false);
    for (const c of COLLECTIONS) {
      expect(await typeOf(c, `${c}-1`)).toBe('objectId');
      const doc = await db.collection(c).findOne({ marker: `${c}-1` });
      expect(doc.userId.toString()).toBe(HEX_A); // value preserved exactly
    }
  });

  it('is idempotent — a second apply converts 0 (already ObjectId)', async () => {
    await seedStringIds();
    await convertToObjectId(db, { apply: true });
    const { totals } = await convertToObjectId(db, { apply: true });
    expect(totals.stringTyped).toBe(0);
    expect(totals.convertible).toBe(0);
  });

  it('ABORTS with zero writes if any String userId is non-hex (Phase 2 not run)', async () => {
    await db.collection('contents').insertMany([
      { userId: HEX_A, marker: 'ok' },
      { userId: 'd29c7011-1111-2222-3333-444455556666', marker: 'uuid' }, // un-normalized
    ]);
    const { aborted, totals } = await convertToObjectId(db, { apply: true });
    expect(aborted).toBe(true);
    expect(totals.nonHex).toBe(1);
    // nothing converted — the hex one is left as a string, no partial flip
    expect(await typeOf('contents', 'ok')).toBe('string');
  });
});

describe('userId Phase-3 inverse migration (ObjectId → String) — rollback', () => {
  it('flips ObjectId back to the identical hex string', async () => {
    await seedStringIds();
    await convertToObjectId(db, { apply: true });   // forward
    const { totals } = await convertToString(db, { apply: true }); // rollback
    expect(totals.converted).toBe(COLLECTIONS.length * 2);
    for (const c of COLLECTIONS) {
      expect(await typeOf(c, `${c}-1`)).toBe('string');
      const doc = await db.collection(c).findOne({ marker: `${c}-1` });
      expect(doc.userId).toBe(HEX_A);
    }
  });

  it('full round-trip (String → ObjectId → String) is identity', async () => {
    await seedStringIds();
    const before = await db.collection('contents').findOne({ marker: 'contents-2' });
    await convertToObjectId(db, { apply: true });
    await convertToString(db, { apply: true });
    const after = await db.collection('contents').findOne({ marker: 'contents-2' });
    expect(after.userId).toBe(before.userId);
    expect(after.userId).toBe(HEX_B);
  });

  it('inverse is idempotent — converts 0 when already String', async () => {
    await seedStringIds();
    const { totals } = await convertToString(db, { apply: true });
    expect(totals.objectIdTyped).toBe(0);
  });
});
