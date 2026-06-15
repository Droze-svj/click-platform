// Locks the SSRF-relevant host matching in classifyUrl. The platform path hands
// the URL to yt-dlp (which does its own DNS/redirects), so ONLY genuine platform
// domains — whose DNS an attacker can't control — may be classified 'platform'.
// A previous unanchored substring regex let attacker-controlled look-alike hosts
// through.

const { classifyUrl } = require('../../server/utils/downloadUtils');

describe('classifyUrl — anchored platform-host matching (SSRF guard)', () => {
  test('genuine platform domains + subdomains → platform', () => {
    expect(classifyUrl('https://youtube.com/watch?v=x')).toMatchObject({ kind: 'platform', platform: 'youtube' });
    expect(classifyUrl('https://www.youtube.com/watch?v=x')).toMatchObject({ kind: 'platform', platform: 'youtube' });
    expect(classifyUrl('https://m.youtube.com/watch?v=x')).toMatchObject({ kind: 'platform', platform: 'youtube' });
    expect(classifyUrl('https://youtu.be/x')).toMatchObject({ kind: 'platform', platform: 'youtube' });
    expect(classifyUrl('https://www.tiktok.com/@a/video/1')).toMatchObject({ kind: 'platform', platform: 'tiktok' });
    expect(classifyUrl('https://x.com/a/status/1')).toMatchObject({ kind: 'platform', platform: 'twitter' });
  });

  test('attacker look-alike hosts are NOT platform (cannot reach yt-dlp)', () => {
    expect(classifyUrl('https://youtube.com.evil.com/x').kind).toBe('unknown');
    expect(classifyUrl('https://notyoutube.com/x').kind).toBe('unknown');
    expect(classifyUrl('https://youtube.com.evil.com/x').platform).toBeUndefined();
    expect(classifyUrl('https://eviltiktok.com/x').kind).toBe('unknown');
    expect(classifyUrl('https://x.com.evil.net/x').kind).toBe('unknown');
  });

  test('internal / non-platform hosts are never platform', () => {
    expect(classifyUrl('http://169.254.169.254/latest/meta-data/').kind).toBe('unknown');
    expect(classifyUrl('http://127.0.0.1/x').kind).toBe('unknown');
    expect(classifyUrl('http://localhost/youtube.com').kind).toBe('unknown'); // path contains the name, host doesn't
  });

  test('direct video links + invalid protocols', () => {
    expect(classifyUrl('https://cdn.example.com/a.mp4')).toMatchObject({ kind: 'direct' });
    expect(classifyUrl('ftp://example.com/a.mp4').kind).toBe('invalid');
    expect(classifyUrl('not a url').kind).toBe('invalid');
  });
});
