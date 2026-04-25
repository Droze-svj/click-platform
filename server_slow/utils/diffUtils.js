const diff = require('diff');

/**
 * Compares two strings and returns a list of changed "chunks"
 * @param {string} oldText 
 * @param {string} newText 
 */
function getDeltaChunks(oldText, newText) {
  const changes = diff.diffWords(oldText, newText);
  return changes;
}

/**
 * Maps changes to specific segments based on character offsets or simple matching
 * For simplicity in Phase 2.2 POC, we'll use a sentence-based segmenter
 */
function identifyModifiedSegments(segments, oldTranscript, newTranscript) {
  // Simple heuristic: if the segment's originalText is no longer in the newTranscript, 
  // or if its context has changed significantly, mark it as modified.
  
  return segments.map(segment => {
    const isPresent = newTranscript.includes(segment.originalText);
    return {
      ...segment,
      status: isPresent ? 'synced' : 'outdated'
    };
  });
}

module.exports = {
  getDeltaChunks,
  identifyModifiedSegments
};
