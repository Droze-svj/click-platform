// Visual Diff Service
// Enhanced visual diff with highlighting and annotations

const PostVersion = require('../models/PostVersion');
const ContentVersion = require('../models/ContentVersion');
const logger = require('../utils/logger');

/**
 * Generate visual diff with highlighting
 */
async function generateVisualDiff(entityId, version1Number, version2Number, entityType = 'content') {
  try {
    let VersionModel;
    if (entityType === 'post') {
      VersionModel = PostVersion;
    } else {
      VersionModel = ContentVersion;
    }

    const [version1, version2] = await Promise.all([
      VersionModel.findOne({
        [entityType === 'post' ? 'postId' : 'contentId']: entityId,
        versionNumber: version1Number
      }).lean(),
      VersionModel.findOne({
        [entityType === 'post' ? 'postId' : 'contentId']: entityId,
        versionNumber: version2Number
      }).lean()
    ]);

    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }

    const content1 = version1.contentSnapshot || version1.content || {};
    const content2 = version2.contentSnapshot || version2.content || {};

    const text1 = content1.text || content1.transcript || content1.description || '';
    const text2 = content2.text || content2.transcript || content2.description || '';

    // Generate word-level diff
    const wordDiff = generateWordDiff(text1, text2);

    // Generate line-level diff
    const lineDiff = generateLineDiff(text1, text2);

    // Generate character-level diff for precise highlighting
    const charDiff = generateCharDiff(text1, text2);

    // Annotations (comments on specific changes)
    const annotations = (version2.comments || []).filter(c => c.lineNumber || c.position);

    return {
      version1: {
        number: version1.versionNumber,
        createdAt: version1.createdAt,
        createdBy: version1.createdBy
      },
      version2: {
        number: version2.versionNumber,
        createdAt: version2.createdAt,
        createdBy: version2.createdBy
      },
      diffs: {
        word: wordDiff,
        line: lineDiff,
        char: charDiff
      },
      annotations,
      summary: {
        wordsAdded: wordDiff.filter(d => d.added).length,
        wordsRemoved: wordDiff.filter(d => d.removed).length,
        linesAdded: lineDiff.filter(d => d.added).length,
        linesRemoved: lineDiff.filter(d => d.removed).length,
        totalChanges: wordDiff.filter(d => d.added || d.removed).length
      }
    };
  } catch (error) {
    logger.error('Error generating visual diff', { error: error.message, entityId });
    throw error;
  }
}

/**
 * Generate word-level diff
 */
function generateWordDiff(text1, text2) {
  const words1 = text1.split(/(\s+)/);
  const words2 = text2.split(/(\s+)/);
  const diff = [];
  let i1 = 0, i2 = 0;

  while (i1 < words1.length || i2 < words2.length) {
    if (i1 >= words1.length) {
      diff.push({ added: true, removed: false, value: words2[i2] });
      i2++;
    } else if (i2 >= words2.length) {
      diff.push({ added: false, removed: true, value: words1[i1] });
      i1++;
    } else if (words1[i1] === words2[i2]) {
      diff.push({ added: false, removed: false, value: words1[i1] });
      i1++;
      i2++;
    } else {
      // Check if word appears later
      const nextMatch1 = words2.indexOf(words1[i1], i2);
      const nextMatch2 = words1.indexOf(words2[i2], i1);

      if (nextMatch1 !== -1 && (nextMatch2 === -1 || nextMatch1 < nextMatch2)) {
        // Add words from text2 until match
        while (i2 < nextMatch1) {
          diff.push({ added: true, removed: false, value: words2[i2] });
          i2++;
        }
      } else if (nextMatch2 !== -1) {
        // Remove words from text1 until match
        while (i1 < nextMatch2) {
          diff.push({ added: false, removed: true, value: words1[i1] });
          i1++;
        }
      } else {
        // No match found, add/remove one word
        diff.push({ added: false, removed: true, value: words1[i1] });
        diff.push({ added: true, removed: false, value: words2[i2] });
        i1++;
        i2++;
      }
    }
  }

  return diff;
}

/**
 * Generate line-level diff
 */
function generateLineDiff(text1, text2) {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const diff = [];
  let i1 = 0, i2 = 0;

  while (i1 < lines1.length || i2 < lines2.length) {
    if (i1 >= lines1.length) {
      diff.push({ added: true, removed: false, value: lines2[i2], lineNumber: i2 + 1 });
      i2++;
    } else if (i2 >= lines2.length) {
      diff.push({ added: false, removed: true, value: lines1[i1], lineNumber: i1 + 1 });
      i1++;
    } else if (lines1[i1] === lines2[i2]) {
      diff.push({ added: false, removed: false, value: lines1[i1], lineNumber: i1 + 1 });
      i1++;
      i2++;
    } else {
      diff.push({ added: false, removed: true, value: lines1[i1], lineNumber: i1 + 1 });
      diff.push({ added: true, removed: false, value: lines2[i2], lineNumber: i2 + 1 });
      i1++;
      i2++;
    }
  }

  return diff;
}

/**
 * Generate character-level diff
 */
function generateCharDiff(text1, text2) {
  const chars1 = text1.split('');
  const chars2 = text2.split('');
  const diff = [];
  let i1 = 0, i2 = 0;

  while (i1 < chars1.length || i2 < chars2.length) {
    if (i1 >= chars1.length) {
      diff.push({ added: true, removed: false, value: chars2[i2] });
      i2++;
    } else if (i2 >= chars2.length) {
      diff.push({ added: false, removed: true, value: chars1[i1] });
      i1++;
    } else if (chars1[i1] === chars2[i2]) {
      diff.push({ added: false, removed: false, value: chars1[i1] });
      i1++;
      i2++;
    } else {
      diff.push({ added: false, removed: true, value: chars1[i1] });
      diff.push({ added: true, removed: false, value: chars2[i2] });
      i1++;
      i2++;
    }
  }

  return diff;
}

/**
 * Add annotation to diff
 */
async function addDiffAnnotation(entityId, versionNumber, annotationData, entityType = 'content') {
  try {
    let VersionModel;
    if (entityType === 'post') {
      VersionModel = PostVersion;
    } else {
      VersionModel = ContentVersion;
    }

    const version = await VersionModel.findOne({
      [entityType === 'post' ? 'postId' : 'contentId']: entityId,
      versionNumber
    });

    if (!version) {
      throw new Error('Version not found');
    }

    if (!version.comments) {
      version.comments = [];
    }

    version.comments.push({
      ...annotationData,
      createdAt: new Date()
    });

    await version.save();

    logger.info('Diff annotation added', { entityId, versionNumber });
    return version;
  } catch (error) {
    logger.error('Error adding diff annotation', { error: error.message, entityId });
    throw error;
  }
}

module.exports = {
  generateVisualDiff,
  addDiffAnnotation
};


