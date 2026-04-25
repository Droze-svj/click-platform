// Advanced Editing Service
// Side-by-side comparison, edit history, collaborative editing

const logger = require('../utils/logger');

/**
 * Compare content side-by-side
 */
async function compareContentSideBySide(original, edited) {
  try {
    // Simple diff calculation
    const diff = calculateDiff(original, edited);

    return {
      original,
      edited,
      diff,
      changes: {
        added: diff.filter(d => d.type === 'added').length,
        removed: diff.filter(d => d.type === 'removed').length,
        modified: diff.filter(d => d.type === 'modified').length
      },
      similarity: calculateSimilarity(original, edited)
    };
  } catch (error) {
    logger.error('Error comparing content', { error: error.message });
    throw error;
  }
}

/**
 * Calculate diff
 */
function calculateDiff(original, edited) {
  const originalWords = original.split(/\s+/);
  const editedWords = edited.split(/\s+/);
  const diff = [];

  let i = 0, j = 0;

  while (i < originalWords.length || j < editedWords.length) {
    if (i >= originalWords.length) {
      diff.push({ type: 'added', value: editedWords[j], index: j });
      j++;
    } else if (j >= editedWords.length) {
      diff.push({ type: 'removed', value: originalWords[i], index: i });
      i++;
    } else if (originalWords[i] === editedWords[j]) {
      diff.push({ type: 'unchanged', value: originalWords[i], index: i });
      i++;
      j++;
    } else {
      // Check if word appears later
      const nextMatch = editedWords.indexOf(originalWords[i], j);
      if (nextMatch !== -1 && nextMatch < j + 3) {
        while (j < nextMatch) {
          diff.push({ type: 'added', value: editedWords[j], index: j });
          j++;
        }
      } else {
        diff.push({ type: 'removed', value: originalWords[i], index: i });
        diff.push({ type: 'added', value: editedWords[j], index: j });
        i++;
        j++;
      }
    }
  }

  return diff;
}

/**
 * Calculate similarity
 */
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return Math.round((intersection.size / union.size) * 100);
}

/**
 * Get edit suggestions based on history
 */
async function getEditSuggestions(contentId, editHistory) {
  try {
    // Analyze edit patterns
    const patterns = analyzeEditPatterns(editHistory);

    // Generate suggestions
    const suggestions = [];

    // Common improvements
    if (patterns.frequentlyShortened) {
      suggestions.push({
        type: 'shorten',
        message: 'You frequently shorten content. Consider using "Shorten" option.',
        action: 'use_shorten'
      });
    }

    if (patterns.frequentlyImprovedHooks) {
      suggestions.push({
        type: 'hook',
        message: 'You often improve hooks. Consider using "Improve Hook" option.',
        action: 'use_improve_hook'
      });
    }

    if (patterns.frequentlyChangedTone) {
      suggestions.push({
        type: 'tone',
        message: 'You frequently change tone. Consider using "Rewrite for Tone" option.',
        action: 'use_rewrite_tone'
      });
    }

    return suggestions;
  } catch (error) {
    logger.error('Error getting edit suggestions', { error: error.message });
    return [];
  }
}

/**
 * Analyze edit patterns
 */
function analyzeEditPatterns(editHistory) {
  const patterns = {
    frequentlyShortened: 0,
    frequentlyImprovedHooks: 0,
    frequentlyChangedTone: 0
  };

  editHistory.forEach(edit => {
    if (edit.type === 'shorten') patterns.frequentlyShortened++;
    if (edit.type === 'improve_hook') patterns.frequentlyImprovedHooks++;
    if (edit.type === 'rewrite_tone') patterns.frequentlyChangedTone++;
  });

  return {
    frequentlyShortened: patterns.frequentlyShortened > editHistory.length * 0.3,
    frequentlyImprovedHooks: patterns.frequentlyImprovedHooks > editHistory.length * 0.3,
    frequentlyChangedTone: patterns.frequentlyChangedTone > editHistory.length * 0.3
  };
}

/**
 * Bulk improve sections
 */
async function bulkImproveSections(content, sections, options = {}) {
  try {
    const { improveSection } = require('./assistedEditingService');
    const results = [];

    for (const section of sections) {
      try {
        const result = await improveSection(content, section.text, {
          sectionType: section.type,
          improvementType: options.improvementType || 'enhance'
        });
        results.push({
          section: section.type,
          original: section.text,
          improved: result.improved,
          success: true
        });
      } catch (error) {
        results.push({
          section: section.type,
          error: error.message,
          success: false
        });
      }
    }

    return {
      total: sections.length,
      successful: results.filter(r => r.success).length,
      results
    };
  } catch (error) {
    logger.error('Error bulk improving sections', { error: error.message });
    throw error;
  }
}

module.exports = {
  compareContentSideBySide,
  getEditSuggestions,
  bulkImproveSections
};


