const { applySafeUpdates, SENSITIVE_FIELDS } = require('../../server/utils/safeUpdate');

describe('safeUpdate.applySafeUpdates (mass-assignment guard)', () => {
  it('copies normal fields but NEVER identity/ownership fields', () => {
    const doc = { _id: 'real', userId: 'owner', workspaceId: 'ws1', name: 'old', description: 'd' };
    applySafeUpdates(doc, {
      name: 'new',
      description: 'updated',
      userId: 'attacker',          // must be ignored
      workspaceId: 'ws-other',     // must be ignored
      agencyWorkspaceId: 'agency2',// must be ignored
      createdBy: 'someone',        // must be ignored
      _id: 'forged',               // must be ignored
    });
    expect(doc.name).toBe('new');
    expect(doc.description).toBe('updated');
    expect(doc.userId).toBe('owner');
    expect(doc.workspaceId).toBe('ws1');
    expect(doc._id).toBe('real');
    expect(doc.agencyWorkspaceId).toBeUndefined();
    expect(doc.createdBy).toBeUndefined();
  });

  it('ignores Mongo operator keys ($set etc.)', () => {
    const doc = { name: 'a' };
    applySafeUpdates(doc, { $set: { name: 'b' }, name: 'c' });
    expect(doc.name).toBe('c');
    expect(doc.$set).toBeUndefined();
  });

  it('honors an extra block list', () => {
    const doc = { name: 'a', analytics: { views: 5 } };
    applySafeUpdates(doc, { name: 'b', analytics: { views: 999 } }, { block: ['analytics'] });
    expect(doc.name).toBe('b');
    expect(doc.analytics.views).toBe(5);
  });

  it('allow-list mode copies only allowed (and non-sensitive) fields', () => {
    const doc = { name: 'a', secret: 's', userId: 'o' };
    applySafeUpdates(doc, { name: 'b', secret: 'hacked', userId: 'x' }, { allow: ['name', 'userId'] });
    expect(doc.name).toBe('b');
    expect(doc.secret).toBe('s');   // not in allow-list
    expect(doc.userId).toBe('o');   // in allow-list but also sensitive → still blocked
  });

  it('SENSITIVE_FIELDS covers the cross-tenant ownership keys', () => {
    ['userId', 'workspaceId', 'agencyWorkspaceId', 'clientWorkspaceId', 'createdBy', '_id'].forEach((f) =>
      expect(SENSITIVE_FIELDS).toContain(f)
    );
  });
});
