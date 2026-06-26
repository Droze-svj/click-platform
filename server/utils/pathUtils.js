const path = require('path');

/**
 * Converts a potentially relative URL/path (like '../uploads/video.mp4') 
 * into an absolute path from the project root.
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

  // If it's already absolute (starts with / on Linux/Mac or C:\ on Windows), return it
  if (path.isAbsolute(p)) return p;
  relativeOrAbsolute = p;
  
  // Clean up any '../' or './' prefixes
  let cleaned = relativeOrAbsolute.replace(/^(\.\.\/)+/, '');
  cleaned = cleaned.replace(/^(\.\/)+/, '');
  
  // If it starts with 'uploads/', it's relative to the project root
  // Otherwise, assume it's relative to project root anyway
  return path.join(process.cwd(), cleaned);
}

module.exports = {
  toAbsolutePath
};
