// Transcript Management Service

const Content = require('../models/Content');
const ContentVersion = require('../models/ContentVersion');
const logger = require('../utils/logger');
const { trackEvent } = require('./analyticsService');

/**
 * Update transcript for content
 */
async function updateTranscript(contentId, userId, transcript, changeSummary = '') {
  try {
    const content = await Content.findOne({ _id: contentId, userId });
    
    if (!content) {
      throw new Error('Content not found');
    }

    // Create version before updating
    const { createVersion } = require('./versionService');
    await createVersion(contentId, userId, changeSummary || 'Transcript updated');

    // Update transcript
    content.transcript = transcript;
    content.updatedAt = new Date();
    await content.save();

    // Track event
    await trackEvent(userId, 'transcript_updated', {
      contentId,
      transcriptLength: transcript.length,
    });

    logger.info('Transcript updated', { contentId, userId, length: transcript.length });
    return content;
  } catch (error) {
    logger.error('Update transcript error', { error: error.message, contentId, userId });
    throw error;
  }
}

/**
 * Export transcript in various formats
 */
async function exportTranscript(contentId, userId, format = 'txt') {
  try {
    const content = await Content.findOne({ _id: contentId, userId }).select('transcript title');
    
    if (!content || !content.transcript) {
      throw new Error('Transcript not found');
    }

    let exported;

    switch (format.toLowerCase()) {
      case 'txt':
        exported = content.transcript;
        break;
      
      case 'json':
        exported = JSON.stringify({
          title: content.title,
          transcript: content.transcript,
          exportedAt: new Date().toISOString(),
        }, null, 2);
        break;
      
      case 'srt':
        // Convert to SRT subtitle format
        exported = convertToSRT(content.transcript);
        break;
      
      case 'vtt':
        // Convert to WebVTT format
        exported = convertToVTT(content.transcript);
        break;
      
      case 'docx':
        // For DOCX, return metadata for file generation
        exported = {
          format: 'docx',
          content: content.transcript,
          title: content.title,
        };
        break;
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Track export
    await trackEvent(userId, 'transcript_exported', {
      contentId,
      format,
    });

    return exported;
  } catch (error) {
    logger.error('Export transcript error', { error: error.message, contentId, userId, format });
    throw error;
  }
}

/**
 * Search transcripts
 */
async function searchTranscripts(userId, query, options = {}) {
  try {
    const { limit = 20, offset = 0 } = options;
    
    // Use MongoDB text search if index exists, otherwise regex
    const searchQuery = {
      userId,
      transcript: { $exists: true, $ne: '' },
      $or: [
        { transcript: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } },
      ],
    };

    const results = await Content.find(searchQuery)
      .select('title transcript createdAt type')
      .limit(limit)
      .skip(offset)
      .sort({ createdAt: -1 });

    const total = await Content.countDocuments(searchQuery);

    // Highlight matches in results
    const highlighted = results.map(content => ({
      ...content.toObject(),
      transcriptSnippet: highlightMatch(content.transcript, query),
    }));

    return {
      results: highlighted,
      total,
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Search transcripts error', { error: error.message, userId, query });
    throw error;
  }
}

/**
 * Get transcript with timestamps (if available)
 */
async function getTranscriptWithTimestamps(contentId, userId) {
  try {
    const content = await Content.findOne({ _id: contentId, userId }).select('transcript generatedContent');
    
    if (!content || !content.transcript) {
      throw new Error('Transcript not found');
    }

    // Check if we have timestamped transcript in generatedContent
    const timestamped = content.generatedContent?.timestampedTranscript;
    
    return {
      transcript: content.transcript,
      timestamped: timestamped || null,
      hasTimestamps: !!timestamped,
    };
  } catch (error) {
    logger.error('Get transcript with timestamps error', { error: error.message, contentId, userId });
    throw error;
  }
}

/**
 * Convert transcript to SRT format
 */
function convertToSRT(transcript) {
  // Simple conversion - split by sentences and add timestamps
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let srt = '';
  let startTime = 0;
  const sentenceDuration = 3; // 3 seconds per sentence (simplified)

  sentences.forEach((sentence, index) => {
    const endTime = startTime + sentenceDuration;
    srt += `${index + 1}\n`;
    srt += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
    srt += `${sentence.trim()}\n\n`;
    startTime = endTime;
  });

  return srt;
}

/**
 * Convert transcript to WebVTT format
 */
function convertToVTT(transcript) {
  let vtt = 'WEBVTT\n\n';
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let startTime = 0;
  const sentenceDuration = 3;

  sentences.forEach((sentence, index) => {
    const endTime = startTime + sentenceDuration;
    vtt += `${formatVTTTime(startTime)} --> ${formatVTTTime(endTime)}\n`;
    vtt += `${sentence.trim()}\n\n`;
    startTime = endTime;
  });

  return vtt;
}

/**
 * Format time for SRT
 */
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Format time for VTT
 */
function formatVTTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Highlight search matches
 */
function highlightMatch(text, query, maxLength = 200) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + query.length + 50);
  let snippet = text.substring(start, end);
  
  // Highlight the match
  snippet = snippet.replace(
    new RegExp(query, 'gi'),
    match => `<mark>${match}</mark>`
  );

  return (start > 0 ? '...' : '') + snippet + (end < text.length ? '...' : '');
}

module.exports = {
  updateTranscript,
  exportTranscript,
  searchTranscripts,
  getTranscriptWithTimestamps,
};




