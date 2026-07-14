// Guards the fix for the editor timeline 404s (waveform/filmstrip/beats): a
// leading-slash /uploads path is a WEB path served from <root>/uploads, NOT a
// filesystem-absolute path. toAbsolutePath used to return it as-is, so ffmpeg
// looked for "/uploads/x.mp4" at the filesystem root and every local /uploads
// media source silently 404'd.

const path = require('path');
const { toAbsolutePath } = require('../../server/utils/pathUtils');

describe('toAbsolutePath — /uploads web-path resolution', () => {
  const root = process.cwd();

  it('maps a leading-slash /uploads web path under the project root', () => {
    expect(toAbsolutePath('/uploads/videos/x.mp4')).toBe(path.join(root, 'uploads/videos/x.mp4'));
  });

  it('strips a signed ?exp=&sig= suffix before resolving', () => {
    expect(toAbsolutePath('/uploads/videos/x.mp4?exp=1784104569&sig=deadbeef'))
      .toBe(path.join(root, 'uploads/videos/x.mp4'));
  });

  it('preserves a genuine filesystem-absolute path (does not remap it)', () => {
    expect(toAbsolutePath('/private/tmp/render-abc.mp4')).toBe('/private/tmp/render-abc.mp4');
  });

  it('resolves a relative uploads path under the project root', () => {
    expect(toAbsolutePath('uploads/videos/x.mp4')).toBe(path.join(root, 'uploads/videos/x.mp4'));
  });

  it('returns null for empty input', () => {
    expect(toAbsolutePath('')).toBeNull();
    expect(toAbsolutePath(null)).toBeNull();
  });
});
