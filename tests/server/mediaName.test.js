// Private user media is served from the public /uploads mount as a capability
// URL, so the filename must be an unguessable, NON-identifying crypto-random
// token (the old scheme embedded the owner's userId + used Math.random).

const { randomMediaName, randomMediaNameFrom, randomToken } = require('../../server/utils/mediaName');

describe('mediaName — unguessable, non-identifying media filenames', () => {
  test('128-bit crypto-random token (32 hex chars), unique per call', () => {
    const a = randomToken(16);
    const b = randomToken(16);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });

  test('randomMediaName preserves a (lowercased) extension and carries no id', () => {
    const n = randomMediaName('.MP4');
    expect(n).toMatch(/^[0-9a-f]{32}\.mp4$/);
    expect(n).not.toMatch(/\d{13}/); // no millisecond timestamp embedded
    expect(randomMediaName('mp3')).toMatch(/^[0-9a-f]{32}\.mp3$/); // adds the dot
    expect(randomMediaName()).toMatch(/^[0-9a-f]{32}$/); // no ext
  });

  test('randomMediaNameFrom keeps only the original extension, random base', () => {
    expect(randomMediaNameFrom('my secret footage.MOV')).toMatch(/^[0-9a-f]{32}\.mov$/);
    expect(randomMediaNameFrom('noext', '.mp4')).toMatch(/^[0-9a-f]{32}\.mp4$/);
    // the original (possibly sensitive) basename never survives
    expect(randomMediaNameFrom('user-42-private.mp4')).not.toContain('private');
  });
});
