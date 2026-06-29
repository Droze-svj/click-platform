const mongoose = require('mongoose');
const { mongoUserId, supabaseUserId } = require('../../server/utils/userKey');
const { ensureObjectId } = require('../../server/utils/devUser');
const { canonicalHexIfDifferent } = require('../../scripts/migrate-userid-normalize');

const UUID = '11111111-2222-3333-4444-555555555555';

describe('userKey.mongoUserId', () => {
  it('returns the canonical ObjectId from req.user._id', () => {
    const oid = new mongoose.Types.ObjectId();
    const got = mongoUserId({ user: { _id: oid, id: UUID } });
    expect(got.equals(oid)).toBe(true);
  });
  it('derives the deterministic ObjectId when only the UUID is present', () => {
    const got = mongoUserId({ user: { id: UUID } });
    expect(got.equals(ensureObjectId(UUID))).toBe(true);
  });
  it('is null when there is no user', () => {
    expect(mongoUserId({})).toBeNull();
    expect(mongoUserId({ user: null })).toBeNull();
  });
});

describe('userKey.supabaseUserId', () => {
  it('prefers the supabaseId / UUID for Supabase queries', () => {
    expect(supabaseUserId({ user: { supabaseId: UUID, _id: new mongoose.Types.ObjectId() } })).toBe(UUID);
    expect(supabaseUserId({ user: { id: UUID } })).toBe(UUID);
  });
});

describe('migrate-userid-normalize.canonicalHexIfDifferent', () => {
  it('converts a UUID-form userId to the canonical hex', () => {
    const hex = canonicalHexIfDifferent(UUID);
    expect(hex).toBe(ensureObjectId(UUID).toString());
    expect(hex).toMatch(/^[a-f0-9]{24}$/);
  });
  it('leaves an already-hex userId unchanged (idempotent → null)', () => {
    const hex = ensureObjectId(UUID).toString();
    expect(canonicalHexIfDifferent(hex)).toBeNull();
  });
  it('ignores null / non-string values (BSON ObjectId is already canonical)', () => {
    expect(canonicalHexIfDifferent(null)).toBeNull();
    expect(canonicalHexIfDifferent(new mongoose.Types.ObjectId())).toBeNull();
  });
});
