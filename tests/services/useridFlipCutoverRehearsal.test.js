// Cut-over rehearsal — proves the lockstep CONTRACT the migration test doesn't:
// after the forward migration (String→BSON ObjectId), the ObjectId schema matches
// BOTH canonical query forms (req.user._id as ObjectId, and getUserIdFromReq's hex
// string which Mongoose auto-casts), while a raw Supabase UUID CastErrors — which is
// exactly why flip-set reads/writes had to be canonicalized first (#128/#130).
// See docs/userid-objectid-flip-runbook.md.

const mongoose = require('mongoose');
const connectTestDb = require('../helpers/connectTestDb');
const { convertToObjectId } = require('../../scripts/migrate-userid-to-objectid');
const { convertToString } = require('../../scripts/migrate-userid-to-string');

const HEX = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const UUID = 'd29c7011-1111-2222-3333-444455556666';
const COLL = 'contents';

// Two models on the SAME collection — String (today) and ObjectId (#131 cut-over).
const StringContent = mongoose.models.RehearsalStr
  || mongoose.model('RehearsalStr', new mongoose.Schema({ userId: String, title: String }), COLL);
const ObjContent = mongoose.models.RehearsalObj
  || mongoose.model('RehearsalObj', new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, title: String }), COLL);

let db, contentId;

beforeAll(async () => {
  await connectTestDb();
  db = mongoose.connection.db;
});

beforeEach(async () => {
  await db.collection(COLL).deleteMany({});
  const r = await db.collection(COLL).insertOne({ userId: HEX, title: 'owned' });
  contentId = r.insertedId;
});
afterEach(async () => { await db.collection(COLL).deleteMany({}); });

describe('userId flip cut-over rehearsal (migration + ObjectId schema + query contract)', () => {
  it('PRE-FLIP: String schema ownership query matches String data', async () => {
    expect(await StringContent.findOne({ _id: contentId, userId: HEX })).toBeTruthy();
  });

  it('POST-FLIP: ObjectId schema matches req.user._id (ObjectId) AND getUserIdFromReq (hex string)', async () => {
    await convertToObjectId(db, { apply: true });
    const stored = await db.collection(COLL).findOne({ _id: contentId });
    expect(stored.userId).toBeInstanceOf(mongoose.Types.ObjectId);

    // req.user._id form (ObjectId):
    expect(await ObjContent.findOne({ _id: contentId, userId: new mongoose.Types.ObjectId(HEX) })).toBeTruthy();
    // getUserIdFromReq form (24-hex string, Mongoose auto-casts under ObjectId schema):
    expect(await ObjContent.findOne({ _id: contentId, userId: HEX })).toBeTruthy();
  });

  it('POST-FLIP: a raw Supabase UUID CastErrors (why canonicalization was required first)', async () => {
    await convertToObjectId(db, { apply: true });
    await expect(ObjContent.findOne({ _id: contentId, userId: UUID })).rejects.toThrow(/Cast to ObjectId failed/);
  });

  it('ROLLBACK: inverse migration restores identical hex string + String-schema reads recover', async () => {
    await convertToObjectId(db, { apply: true });
    await convertToString(db, { apply: true });
    const stored = await db.collection(COLL).findOne({ _id: contentId });
    expect(typeof stored.userId).toBe('string');
    expect(stored.userId).toBe(HEX);
    expect(await StringContent.findOne({ _id: contentId, userId: HEX })).toBeTruthy();
  });
});
