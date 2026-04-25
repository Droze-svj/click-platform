// Version Comparison Service
// Enhanced side-by-side version comparison for legal/compliance

const ContentVersion = require('../models/ContentVersion');
const PostVersion = require('../models/PostVersion');
const logger = require('../utils/logger');

// Simple diff implementation (or use diff library if available)
function simpleDiff(text1, text2) {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const diff = [];
  
  const maxLen = Math.max(lines1.length, lines2.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= lines1.length) {
      diff.push({ added: true, removed: false, value: lines2[i] + '\n' });
    } else if (i >= lines2.length) {
      diff.push({ added: false, removed: true, value: lines1[i] + '\n' });
    } else if (lines1[i] !== lines2[i]) {
      diff.push({ added: false, removed: true, value: lines1[i] + '\n' });
      diff.push({ added: true, removed: false, value: lines2[i] + '\n' });
    } else {
      diff.push({ added: false, removed: false, value: lines1[i] + '\n' });
    }
  }
  
  return diff;
}

/**
 * Compare two versions side-by-side
 */
async function compareVersionsSideBySide(entityId, version1Number, version2Number, entityType = 'content') {
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

    // Get content snapshots
    const content1 = version1.contentSnapshot || version1.content || {};
    const content2 = version2.contentSnapshot || version2.content || {};

    // Compare text content
    const text1 = content1.text || content1.transcript || content1.description || '';
    const text2 = content2.text || content2.transcript || content2.description || '';

    const textDiff = simpleDiff(text1, text2);

    // Compare hashtags
    const hashtags1 = content1.hashtags || [];
    const hashtags2 = content2.hashtags || [];
    const hashtagDiff = {
      added: hashtags2.filter(h => !hashtags1.includes(h)),
      removed: hashtags1.filter(h => !hashtags2.includes(h)),
      unchanged: hashtags1.filter(h => hashtags2.includes(h))
    };

    // Compare media
    const media1 = content1.media || content1.mediaUrl || null;
    const media2 = content2.media || content2.mediaUrl || null;
    const mediaChanged = media1 !== media2;

    // Compare metadata
    const metadataDiff = compareObjects(content1.metadata || {}, content2.metadata || {});

    // Generate summary
    const summary = {
      totalChanges: 0,
      textChanged: text1 !== text2,
      hashtagsChanged: hashtagDiff.added.length > 0 || hashtagDiff.removed.length > 0,
      mediaChanged,
      metadataChanged: Object.keys(metadataDiff).length > 0,
      changeTypes: []
    };

    if (summary.textChanged) {
      summary.totalChanges++;
      summary.changeTypes.push('text');
    }
    if (summary.hashtagsChanged) {
      summary.totalChanges++;
      summary.changeTypes.push('hashtags');
    }
    if (mediaChanged) {
      summary.totalChanges++;
      summary.changeTypes.push('media');
    }
    if (summary.metadataChanged) {
      summary.totalChanges++;
      summary.changeTypes.push('metadata');
    }

    return {
      version1: {
        number: version1.versionNumber,
        createdAt: version1.createdAt,
        createdBy: version1.createdBy,
        changeReason: version1.changeReason || 'No reason provided'
      },
      version2: {
        number: version2.versionNumber,
        createdAt: version2.createdAt,
        createdBy: version2.createdBy,
        changeReason: version2.changeReason || 'No reason provided'
      },
      differences: {
        text: {
          diff: textDiff,
          oldValue: text1,
          newValue: text2,
          changed: text1 !== text2
        },
        hashtags: hashtagDiff,
        media: {
          oldValue: media1,
          newValue: media2,
          changed: mediaChanged
        },
        metadata: metadataDiff
      },
      summary,
      // For legal/compliance export
      exportable: {
        comparisonDate: new Date(),
        version1Number,
        version2Number,
        changes: summary.changeTypes,
        fullDiff: {
          text: textDiff,
          hashtags: hashtagDiff,
          media: { old: media1, new: media2 },
          metadata: metadataDiff
        }
      }
    };
  } catch (error) {
    logger.error('Error comparing versions', { error: error.message, entityId });
    throw error;
  }
}

/**
 * Compare two objects
 */
function compareObjects(obj1, obj2) {
  const differences = {};
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  allKeys.forEach(key => {
    if (obj1[key] !== obj2[key]) {
      differences[key] = {
        oldValue: obj1[key],
        newValue: obj2[key]
      };
    }
  });

  return differences;
}

/**
 * Export version comparison for legal/compliance
 */
async function exportVersionComparison(entityId, version1Number, version2Number, entityType = 'content', format = 'json') {
  try {
    const comparison = await compareVersionsSideBySide(entityId, version1Number, version2Number, entityType);

    if (format === 'json') {
      return JSON.stringify(comparison, null, 2);
    } else if (format === 'html') {
      return generateHTMLComparison(comparison);
    } else if (format === 'pdf') {
      // Would use PDF generation library
      return generatePDFComparison(comparison);
    }

    return comparison;
  } catch (error) {
    logger.error('Error exporting version comparison', { error: error.message, entityId });
    throw error;
  }
}

/**
 * Generate HTML comparison
 */
function generateHTMLComparison(comparison) {
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Version Comparison</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .version-header { background: #f0f0f0; padding: 10px; margin: 10px 0; }
        .diff-added { background: #d4edda; }
        .diff-removed { background: #f8d7da; }
        .diff-unchanged { background: #fff; }
        .summary { background: #e7f3ff; padding: 15px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <h1>Version Comparison Report</h1>
      <div class="version-header">
        <strong>Version ${comparison.version1.number}</strong> vs <strong>Version ${comparison.version2.number}</strong>
      </div>
      <div class="summary">
        <h2>Summary</h2>
        <p>Total Changes: ${comparison.summary.totalChanges}</p>
        <p>Change Types: ${comparison.summary.changeTypes.join(', ')}</p>
      </div>
      <h2>Text Differences</h2>
      <pre>${formatTextDiff(comparison.differences.text.diff)}</pre>
    </body>
    </html>
  `;

  return html;
}

/**
 * Format text diff for HTML
 */
function formatTextDiff(diff) {
  return diff.map(part => {
    const className = part.added ? 'diff-added' : part.removed ? 'diff-removed' : 'diff-unchanged';
    return `<span class="${className}">${part.value}</span>`;
  }).join('');
}

/**
 * Generate PDF comparison (placeholder)
 */
function generatePDFComparison(comparison) {
  // Would use PDF library like pdfkit
  return null;
}

module.exports = {
  compareVersionsSideBySide,
  exportVersionComparison
};

