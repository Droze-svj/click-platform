const path = require('path');

/**
 * Converts a potentially relative URL/path (like '../uploads/video.mp4') 
 * into an absolute path from the project root.
 */
function toAbsolutePath(relativeOrAbsolute) {
  if (!relativeOrAbsolute) return null;
  
  // If it's already absolute (starts with / on Linux/Mac or C:\ on Windows), return it
  if (path.isAbsolute(relativeOrAbsolute)) return relativeOrAbsolute;
  
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
