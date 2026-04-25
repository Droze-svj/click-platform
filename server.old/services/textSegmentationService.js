// Advanced Text Segmentation Service
// NLP-based semantic segmentation for better scene boundaries

const logger = require('../utils/logger');

/**
 * Segment transcript into semantic units using NLP techniques
 */
function segmentTranscriptAdvanced(transcript, duration) {
  if (!transcript || transcript.trim().length === 0) {
    return [];
  }

  try {
    // Split into sentences
    const sentences = splitIntoSentences(transcript);
    
    // Extract topics and semantic boundaries
    const segments = extractSemanticSegments(sentences, duration);

    return segments;
  } catch (error) {
    logger.warn('Advanced text segmentation failed', { error: error.message });
    return segmentTranscriptSimple(transcript, duration);
  }
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text) {
  // Split by sentence endings, keeping punctuation
  const sentenceEndings = /[.!?]+/g;
  const sentences = text
    .split(sentenceEndings)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Extract semantic segments using topic modeling and keyword detection
 */
function extractSemanticSegments(sentences, duration) {
  const segments = [];
  const timePerSentence = duration / sentences.length;

  // Topic change indicators
  const topicChangeKeywords = [
    // Transitions
    'now', 'next', 'moving on', 'let\'s', 'another', 'finally', 'in conclusion',
    // Questions
    'what', 'why', 'how', 'when', 'where', 'who',
    // Topic markers
    'first', 'second', 'third', 'lastly', 'additionally', 'furthermore',
    // New concepts
    'introducing', 'let me explain', 'here\'s', 'this is'
  ];

  let currentTopic = null;
  let segmentStart = 0;
  let sentenceIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].toLowerCase();
    const timestamp = i * timePerSentence;

    // Detect topic change
    const hasTopicKeyword = topicChangeKeywords.some(keyword => 
      sentence.includes(keyword)
    );

    // Detect question (often indicates topic shift)
    const isQuestion = sentence.includes('?');

    // Detect long pause (paragraph break)
    const isLongSentence = sentence.length > 150;

    // Extract current topic (first few significant words)
    const topic = extractTopicFromSentence(sentence);

    // Check if topic changed significantly
    const topicChanged = currentTopic && topic && 
      !topicsSimilar(currentTopic, topic);

    if ((hasTopicKeyword || isQuestion || topicChanged) && i > 0) {
      // Create segment boundary
      segments.push({
        start: segmentStart,
        end: timestamp,
        type: 'semantic',
        confidence: 0.85,
        reason: hasTopicKeyword ? 'keyword' : (isQuestion ? 'question' : 'topic_change')
      });
      segmentStart = timestamp;
      currentTopic = topic;
    } else if (!currentTopic) {
      currentTopic = topic;
    }
  }

  // Add final segment
  if (segmentStart < duration) {
    segments.push({
      start: segmentStart,
      end: duration,
      type: 'semantic',
      confidence: 0.8,
      reason: 'default'
    });
  }

  return segments;
}

/**
 * Extract topic from sentence (simplified)
 */
function extractTopicFromSentence(sentence) {
  // Remove common words
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'];
  
  const words = sentence
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.includes(word.toLowerCase()))
    .slice(0, 3); // First 3 significant words

  return words.join(' ');
}

/**
 * Check if topics are similar
 */
function topicsSimilar(topic1, topic2) {
  if (!topic1 || !topic2) return false;

  const words1 = new Set(topic1.toLowerCase().split(/\s+/));
  const words2 = new Set(topic2.toLowerCase().split(/\s+/));

  // Calculate overlap
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  const similarity = intersection.size / union.size;
  return similarity > 0.3; // 30% overlap = similar
}

/**
 * Simple segmentation fallback
 */
function segmentTranscriptSimple(transcript, duration) {
  const paragraphs = transcript.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  if (paragraphs.length === 0) {
    return [];
  }

  const timePerParagraph = duration / paragraphs.length;
  const segments = [];

  for (let i = 0; i < paragraphs.length - 1; i++) {
    segments.push({
      start: i * timePerParagraph,
      end: (i + 1) * timePerParagraph,
      type: 'semantic',
      confidence: 0.6,
      reason: 'paragraph'
    });
  }

  return segments;
}

/**
 * Detect paragraph boundaries with timestamps
 */
function detectParagraphBoundaries(text, estimatedDuration) {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const boundaries = [];

  if (paragraphs.length <= 1) {
    return boundaries;
  }

  // Estimate time per character (rough approximation)
  const totalChars = text.length;
  const timePerChar = estimatedDuration / totalChars;

  let currentPos = 0;
  for (let i = 0; i < paragraphs.length - 1; i++) {
    currentPos += paragraphs[i].length + 2; // +2 for \n\n
    const timestamp = currentPos * timePerChar;
    boundaries.push({
      timestamp,
      confidence: 0.7,
      type: 'paragraph'
    });
  }

  return boundaries;
}

module.exports = {
  segmentTranscriptAdvanced,
  detectParagraphBoundaries,
  extractSemanticSegments
};







