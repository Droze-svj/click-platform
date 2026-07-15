import { getMediaUrl } from '../url';

// getMediaUrl must return SAME-ORIGIN relative URLs for our own /uploads media
// (routed through the Next /uploads proxy) so <video>/<audio> aren't blocked by
// the page's CSP media-src on the cross-origin backend. External (cloud) URLs
// must stay absolute. The signed ?exp=&sig= query must always be preserved.
describe('getMediaUrl — same-origin media resolution', () => {
  it('returns empty for empty input', () => {
    expect(getMediaUrl('')).toBe('');
  });

  it('keeps a relative /uploads path relative, preserving the signed query', () => {
    expect(getMediaUrl('/uploads/videos/x.mp4?exp=1&sig=abc')).toBe('/uploads/videos/x.mp4?exp=1&sig=abc');
  });

  it('adds a leading slash to a bare relative path', () => {
    expect(getMediaUrl('uploads/x.mp4')).toBe('/uploads/x.mp4');
  });

  it('strips an absolute /uploads URL to a same-origin relative path (query kept)', () => {
    expect(getMediaUrl('http://any-backend:5001/uploads/videos/x.mp4?exp=1&sig=2'))
      .toBe('/uploads/videos/x.mp4?exp=1&sig=2');
  });

  it('leaves a genuine external (cloud) URL absolute', () => {
    const ext = 'https://res.cloudinary.com/demo/video/upload/x.mp4';
    expect(getMediaUrl(ext)).toBe(ext);
  });
});
