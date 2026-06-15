// Verifies the render pipeline's SSRF guard: a remote source URL that resolves
// to a private/loopback/link-local/metadata address must be rejected before it
// ever reaches ffmpeg. Literal IPs need no DNS, so these are deterministic and
// network-free. A local /uploads path must pass through untouched.

const svc = require('../../server/services/videoRenderService');

describe('resolveInputPath — SSRF guard on the main source URL', () => {
  test('blocks the cloud-metadata link-local address', async () => {
    await expect(svc.resolveInputPath(null, 'http://169.254.169.254/latest/meta-data/'))
      .rejects.toThrow();
  });

  test('blocks loopback', async () => {
    await expect(svc.resolveInputPath(null, 'http://127.0.0.1/x.mp4')).rejects.toThrow();
  });

  test('blocks a private (RFC1918) range', async () => {
    await expect(svc.resolveInputPath(null, 'http://10.0.0.5/x.mp4')).rejects.toThrow();
    await expect(svc.resolveInputPath(null, 'http://192.168.1.10/x.mp4')).rejects.toThrow();
  });

  test('passes a local /uploads path through without a network call', async () => {
    const out = await svc.resolveInputPath(null, '/uploads/clips/a.mp4');
    expect(typeof out).toBe('string');
    expect(out).toContain('a.mp4');
  });
});
