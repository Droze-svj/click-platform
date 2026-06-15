// Defense-in-depth: the admin bulk-user-update path must never set privilege/
// identity fields (role/permissions/subscription/…). When a request contains
// ONLY blocked fields, the helper returns early WITHOUT issuing a DB write — so
// even a compromised admin token can't mass-escalate via the bulk path.

const { bulkUpdateUsers } = require('../../server/services/bulkOperationsService');

describe('bulkUpdateUsers — privilege fields blocked from the bulk path', () => {
  test('a role/isAdmin-only bulk update writes nothing (early return, no updateMany)', async () => {
    const r = await bulkUpdateUsers(['64b000000000000000000001'], { role: 'admin', isAdmin: true, permissions: { all: true } });
    expect(r).toMatchObject({ success: true, modified: 0, matched: 0 });
  });

  test('a Mongo-operator key is stripped too', async () => {
    const r = await bulkUpdateUsers(['64b000000000000000000001'], { $where: '1', role: 'admin' });
    expect(r.modified).toBe(0);
  });
});
