// Regression for the critical realtime cross-tenant takeover (C1): join:room
// used to ownership-check the client's `contentId` but then join the client's
// separate `room` string, so an attacker owning their OWN content could join
// `editor:<victim>` by sending { room:'editor:<victim>', contentId:'<mine>' }.
// The fix derives the authoritative contentId from the ROOM NAME, so the room
// and the authorized id can't be decoupled.

const { deriveRoomContentId } = require('../../server/services/socketService');

describe('socket join:room — room/contentId cannot be decoupled (C1)', () => {
  test('editor room id comes from the room name, NOT the client contentId', () => {
    // The attack: own MINE, try to join the victim's room.
    expect(deriveRoomContentId('editor:VICTIM', 'MINE')).toBe('VICTIM');
    // → the ownership check then runs against VICTIM (which the attacker does
    //   not own) and the join is denied.
  });

  test('normal cases resolve as expected', () => {
    expect(deriveRoomContentId('editor:abc123', null)).toBe('abc123');
    expect(deriveRoomContentId('editor:abc123', 'abc123')).toBe('abc123');
    expect(deriveRoomContentId('custom-room', 'mine')).toBe('mine'); // non-editor room falls back to contentId
  });

  test('un-authorizable rooms resolve to null (join denied)', () => {
    expect(deriveRoomContentId('editor:', 'x')).toBeNull(); // empty id
    expect(deriveRoomContentId('custom-room', null)).toBeNull(); // no id at all
    expect(deriveRoomContentId(null, null)).toBeNull();
    expect(deriveRoomContentId(undefined, undefined)).toBeNull();
  });
});
