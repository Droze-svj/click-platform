// Exercises the shared per-user security state through its in-memory fallback
// path (redisCache is not connected in the test env), which must behave exactly
// like the old in-memory Maps. The Redis path uses the same readState/writeState
// helpers, so this also covers their array semantics.
const securityService = require('../../server/services/securityService');

describe('securityService shared state (in-memory fallback)', () => {
  const userId = 'sec-test-user-1';

  it('tracks and returns devices, and revokes them', async () => {
    const d1 = await securityService.trackDevice(userId, { name: 'iPhone' });
    const d2 = await securityService.trackDevice(userId, { name: 'MacBook' });
    expect(d1.id).toBeTruthy();

    let devices = await securityService.getUserDevices(userId);
    expect(devices.map((d) => d.name)).toEqual(expect.arrayContaining(['iPhone', 'MacBook']));

    const revoked = await securityService.revokeDevice(userId, d1.id);
    expect(revoked).toBe(true);

    devices = await securityService.getUserDevices(userId);
    expect(devices.find((d) => d.id === d1.id)).toBeUndefined();
    expect(devices.find((d) => d.id === d2.id)).toBeDefined();
  });

  it('caps devices at 10 (FIFO)', async () => {
    const u = 'sec-test-cap';
    for (let i = 0; i < 13; i++) await securityService.trackDevice(u, { name: `dev${i}` });
    const devices = await securityService.getUserDevices(u);
    expect(devices.length).toBe(10);
    expect(devices[0].name).toBe('dev3'); // first 3 evicted
  });

  it('whitelists and removes IPs (idempotent add)', async () => {
    const u = 'sec-test-wl';
    expect(await securityService.isIPWhitelisted(u, '1.2.3.4')).toBe(false); // empty = allow all
    await securityService.whitelistIP(u, '1.2.3.4');
    await securityService.whitelistIP(u, '1.2.3.4'); // dup, no-op
    await securityService.whitelistIP(u, '5.6.7.8');
    expect(await securityService.isIPWhitelisted(u, '1.2.3.4')).toBe(true);
    expect(await securityService.isIPWhitelisted(u, '9.9.9.9')).toBe(false);

    await securityService.removeWhitelistedIP(u, '1.2.3.4');
    expect(await securityService.isIPWhitelisted(u, '1.2.3.4')).toBe(false);
    expect(await securityService.isIPWhitelisted(u, '5.6.7.8')).toBe(true);
  });

  it('records and summarizes security events', async () => {
    const u = 'sec-test-events';
    await securityService.trackSecurityEvent(u, 'login_failed', { ip: '1.1.1.1' });
    await securityService.trackSecurityEvent(u, 'login_failed', { ip: '2.2.2.2' });
    await securityService.trackSecurityEvent(u, 'password_changed', {});

    const events = await securityService.getSecurityEvents(u, 50);
    expect(events.length).toBe(3);
    expect(events[0].type).toBe('password_changed'); // most-recent first

    const summary = await securityService.getSecuritySummary(u);
    expect(summary.totalEvents).toBe(3);
    expect(summary.failedLogins).toBe(2);
  });
});
