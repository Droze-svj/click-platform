// Unit tests for urlGuard — the SSRF chokepoint used by ingest + the Repurpose
// Studio. isBlockedIp is pure; assertPublicUrl is tested with IP-literal hosts
// (which resolve to themselves, so no real DNS is needed).

const { isBlockedIp, assertPublicUrl, BlockedUrlError } = require('../../../server/utils/urlGuard');

describe('urlGuard.isBlockedIp', () => {
  const BLOCKED = [
    '127.0.0.1',          // loopback
    '169.254.169.254',    // cloud metadata
    '10.0.0.5',           // private
    '172.16.5.4',         // private
    '192.168.1.1',        // private
    '100.64.0.1',         // CGNAT
    '0.0.0.0',            // this host
    '::1',                // ipv6 loopback
    '::ffff:127.0.0.1',   // ipv4-mapped loopback
    'fd00::1',            // ipv6 unique-local
    'fe80::1',            // ipv6 link-local
  ];
  const ALLOWED = [
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34',
    '2606:2800:220:1:248:1893:25c8:1946',
  ];

  it.each(BLOCKED)('blocks private/reserved address %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(ALLOWED)('allows public address %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });

  it('fails closed on garbage / non-IP input', () => {
    expect(isBlockedIp('not-an-ip')).toBe(true);
    expect(isBlockedIp('')).toBe(true);
    expect(isBlockedIp(null)).toBe(true);
  });
});

describe('urlGuard.assertPublicUrl', () => {
  it('rejects the cloud metadata endpoint', async () => {
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('rejects loopback by literal IP', async () => {
    await expect(assertPublicUrl('http://127.0.0.1:5001/admin')).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('rejects non-http(s) protocols', async () => {
    await expect(assertPublicUrl('ftp://example.com/x')).rejects.toThrow(/protocol/i);
  });

  it('rejects an unparseable URL', async () => {
    await expect(assertPublicUrl('http://')).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('allows a public IP-literal http URL', async () => {
    const u = await assertPublicUrl('https://1.1.1.1/video.mp4');
    expect(u.hostname).toBe('1.1.1.1');
  });
});
