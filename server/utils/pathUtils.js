const path = require('path');

/**
 * Converts a potentially relative URL/path (like '../uploads/video.mp4')
 * into an absolute path from the project root, CONTAINED within <root>/uploads.
 *
 * Media references (seg.sourceUrl / videoUrl) flow in from client editor state,
 * so this must never resolve outside the uploads directory. Every legitimate
 * caller resolves a file under <root>/uploads (server-stored originals, generated
 * thumbnails/exports/temp, or signed /uploads URLs); anything that escapes that
 * base — via a traversal like '/uploads/../../.env' or a bare absolute path like
 * '/etc/passwd' — is rejected with null so ffmpeg can't be pointed at an arbitrary
 * local file (LFI). Unresolvable inputs are skipped gracefully downstream.
 */
function toAbsolutePath(relativeOrAbsolute) {
  if (!relativeOrAbsolute) return null;

  // A filesystem path never carries a query/fragment. Strip a signed capability
  // suffix (?exp=…&sig=… — see utils/mediaUrlSigner) or #fragment so a SIGNED
  // /uploads URL resolves to the real file on disk instead of ffmpeg trying to open
  // "/uploads/x.mp3?exp=…&sig=…" (which silently dropped local music/overlay media).
  let p = String(relativeOrAbsolute);
  const cut = p.search(/[?#]/);
  if (cut !== -1) p = p.slice(0, cut);

  // A "/uploads/..." URL is PROJECT-RELATIVE (media lives under <root>/uploads),
  // NOT a filesystem-root path. Without this, path.isAbsolute() below treats the
  // leading slash as OS root — so local music / SFX / video referenced by their
  // "/uploads/..." URL silently failed to resolve on export. Strip the leading
  // slash(es) so it joins onto process.cwd().
  if (/^\/+uploads\//i.test(p)) p = p.replace(/^\/+/, '');

  // Resolve to a real absolute path (collapsing any embedded '../') — from the
  // project root for relative inputs, or as-is for genuine absolute inputs.
  const resolved = path.isAbsolute(p)
    ? path.resolve(p)
    : path.resolve(process.cwd(), p);

  // Containment: the result MUST stay within <root>/uploads. This blocks both
  // traversal ('/uploads/../../.env' → <root>/.env) and bare absolute paths
  // ('/etc/passwd'), while allowing every legitimate '<root>/uploads/...' file.
  // Every caller passes a /uploads-style reference and already handles null.
  const uploadsBase = path.resolve(process.cwd(), 'uploads');
  if (resolved !== uploadsBase && !resolved.startsWith(uploadsBase + path.sep)) {
    console.warn('[toAbsolutePath] rejected path outside uploads:', String(relativeOrAbsolute).slice(0, 120));
    return null;
  }

  return resolved;
}

module.exports = {
  toAbsolutePath
};
