// Locks in userId-flip Phase 1: every flip-set `Content` OWNERSHIP filter must
// resolve identity to the CANONICAL hex (via utils/userId.getUserIdFromReq), not
// the raw Supabase UUID (`req.user.id`). Keying a flip-set query off the UUID:
//   (a) silently misses hex-stored Content for Supabase-auth users (a 404 to the
//       real owner — the bug class utils/userId.js was written to kill), and
//   (b) becomes a hard CastError once Content.userId flips String → ObjectId
//       (see docs/userid-objectid-flip-runbook.md).
// This guard fails if any of the 4 converted routes regress to a UUID-first key.

const fs = require('fs');
const path = require('path');
const { getUserId, getUserIdFromReq, toCanonicalHex } = require('../../server/utils/userId');
const { ensureObjectId } = require('../../server/utils/devUser');

const ROOT = path.join(__dirname, '../../server/routes');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('utils/userId canonical resolver contract', () => {
  const UUID = 'd29c7011-1111-2222-3333-444455556666';

  it('passes a 24-hex ObjectId string through unchanged (lowercased)', () => {
    const hex = 'a1b2c3d4e5f6a1b2c3d4e5f6';
    expect(toCanonicalHex(hex)).toBe(hex);
  });

  it('hashes a Supabase UUID to the SAME 24-hex that ensureObjectId yields (writes==reads)', () => {
    expect(toCanonicalHex(UUID)).toBe(ensureObjectId(UUID).toString());
  });

  it('getUserId prefers _id, and always returns a 24-hex (ObjectId-castable) or null', () => {
    const fromObjId = getUserId({ _id: ensureObjectId(UUID), id: UUID });
    expect(fromObjId).toMatch(/^[a-f0-9]{24}$/);
    expect(getUserId({ id: UUID })).toBe(ensureObjectId(UUID).toString());
    expect(getUserId(null)).toBeNull();
    expect(getUserIdFromReq({ user: { id: UUID } })).toBe(ensureObjectId(UUID).toString());
  });

  it('its result is always castable to ObjectId (survives the schema flip)', () => {
    const id = getUserIdFromReq({ user: { id: UUID } });
    expect(() => new (require('mongoose').Types.ObjectId)(id)).not.toThrow();
  });
});

describe('flip-set Content ownership filters resolve canonically (Phase 1 guard)', () => {
  it('captions.js binds userId via getUserIdFromReq, never raw req.user.id', () => {
    const src = read('video/captions.js');
    expect(src).toContain("getUserIdFromReq(req)");
    // captions' userId feeds ONLY Content filters → the whole variable must be canonical.
    expect(src).not.toMatch(/const userId = req\.user\.id\b/);
  });

  // These three also pass `userId` to a service/job with its own identity keying,
  // so the variable stays as-is but the Content FILTER must be canonical inline.
  for (const file of ['video/advanced-editing.js', 'videoSharing.js', 'analytics/predictions.js']) {
    it(`${file}: every Content ownership findOne keys userId off getUserIdFromReq`, () => {
      const src = read(file);
      const ownershipFilters = src.match(/Content\.findOne\(\{\s*_id:[^}]*userId[^}]*\}/g) || [];
      expect(ownershipFilters.length).toBeGreaterThan(0);
      for (const f of ownershipFilters) {
        expect(f).toContain('getUserIdFromReq(req)');
      }
    });
  }

  // WRITE side: this route persists Workflow.userId (a flip-set field). A raw
  // req.user.id (UUID) here fragments the user's workflows now, and CastErrors
  // once Workflow.userId becomes ObjectId.
  it('workflows/advanced-automation.js writes Workflow userId canonically (getUserIdFromReq)', () => {
    const src = read('workflows/advanced-automation.js');
    expect(src).toContain('const userId = getUserIdFromReq(req)');
    expect(src).not.toMatch(/const userId = req\.user\.id\b/);
  });
});
