// Regression guard for the approval-kanban cross-tenant IDOR fixes (audit batch 3).
// These per-client kanban routes took a client/agency workspace id from the
// URL/body with only `auth` — the service's only check compared the card's
// clientId to the ATTACKER-supplied clientWorkspaceId, so any authenticated user
// could read/flip another tenant's approval board. Now gated by
// requireAgencyClientAccess (verifies agency membership + client↔agency linkage).

const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../../../server/routes', p), 'utf8');

describe('approval kanban cross-tenant IDOR guards', () => {
  it('approval-kanban.js: board read + card move require requireAgencyClientAccess', () => {
    const src = read('approval-kanban.js');
    expect(src).toMatch(/'\/:clientWorkspaceId\/kanban',\s*auth,\s*requireAgencyClientAccess,/);
    expect(src).toMatch(/'\/:clientWorkspaceId\/kanban\/move',\s*auth,\s*requireAgencyClientAccess,/);
  });

  it('approval-enhanced.js: all client-workspace kanban/sla routes require requireAgencyClientAccess', () => {
    const src = read('approval-enhanced.js');
    for (const rp of [
      '/:clientWorkspaceId/kanban/filtered',
      '/:clientWorkspaceId/kanban/swimlanes',
      '/:clientWorkspaceId/kanban/bulk-move',
      '/:clientWorkspaceId/kanban/bulk-update',
      '/:clientWorkspaceId/sla/analytics',
      '/:clientWorkspaceId/sla/predictions',
    ]) {
      const re = new RegExp(`'${rp.replace(/\//g, '\\/')}',\\s*auth,\\s*requireAgencyClientAccess,`);
      expect(src).toMatch(re);
    }
  });
});
