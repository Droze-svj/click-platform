// Video Chapters Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * Auto-generate video chapters
 */
async function autoGenerateChapters(videoId, options = {}) {
  try {
    const {
      transcript = null,
      scenes = [],
      duration = null,
    } = options;

    if (!transcript && !scenes.length) {
      throw new Error('Transcript or scenes required for chapter generation');
    }

    const prompt = `Generate video chapters from this content:

${transcript ? `Transcript: ${transcript}` : ''}
${scenes.length > 0 ? `Scenes: ${scenes.length} detected` : ''}
${duration ? `Duration: ${duration} seconds` : ''}

Provide:
1. Chapter titles (descriptive, engaging)
2. Start and end times
3. Chapter descriptions
4. Key topics in each chapter

Format as JSON array with objects containing: title (string), startTime (seconds), endTime (seconds), description (string), topics (array)`;

    if (!geminiConfigured) {
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a video chaptering expert. Create logical, engaging chapters that help viewers navigate content.\n\n${prompt}`;
    const chaptersText = await geminiGenerate(fullPrompt, { temperature: 0.6, maxTokens: 2000 });

    let chapters;
    try {
      chapters = JSON.parse(chaptersText);
    } catch (error) {
      const jsonMatch = chaptersText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        chapters = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse chapters');
      }
    }

    // Ensure chapters are sorted by start time
    chapters.sort((a, b) => a.startTime - b.startTime);

    logger.info('Video chapters generated', { videoId, count: chapters.length });
    return {
      videoId,
      chapters,
      totalChapters: chapters.length,
    };
  } catch (error) {
    logger.error('Auto-generate chapters error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Create custom chapters
 */
async function createCustomChapters(videoId, chaptersData) {
  try {
    if (!chaptersData || !Array.isArray(chaptersData)) {
      throw new Error('Chapters array is required');
    }

    const chapters = chaptersData.map((chapter, index) => ({
      id: `chapter-${index + 1}`,
      title: chapter.title,
      startTime: chapter.startTime,
      endTime: chapter.endTime,
      description: chapter.description || null,
      thumbnail: chapter.thumbnail || null,
      order: index + 1,
    }));

    // Validate chapters
    chapters.forEach((chapter, index) => {
      if (chapter.startTime >= chapter.endTime) {
        throw new Error(`Chapter ${index + 1}: Start time must be before end time`);
      }
      if (index > 0 && chapter.startTime < chapters[index - 1].endTime) {
        throw new Error(`Chapter ${index + 1}: Overlaps with previous chapter`);
      }
    });

    logger.info('Custom chapters created', { videoId, count: chapters.length });
    return {
      videoId,
      chapters,
      totalChapters: chapters.length,
    };
  } catch (error) {
    logger.error('Create custom chapters error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Get chapter navigation
 */
function getChapterNavigation(chapters) {
  try {
    const navigation = chapters.map((chapter, index) => ({
      id: chapter.id || `chapter-${index + 1}`,
      title: chapter.title,
      startTime: chapter.startTime,
      endTime: chapter.endTime,
      duration: chapter.endTime - chapter.startTime,
      thumbnail: chapter.thumbnail || null,
      order: chapter.order || index + 1,
    }));

    return {
      chapters: navigation,
      totalDuration: navigation.reduce((sum, ch) => sum + ch.duration, 0),
      chapterCount: navigation.length,
    };
  } catch (error) {
    logger.error('Get chapter navigation error', { error: error.message });
    throw error;
  }
}

/**
 * Generate chapter thumbnails
 */
async function generateChapterThumbnails(videoId, chapters) {
  try {
    const thumbnails = chapters.map((chapter, index) => ({
      chapterId: chapter.id || `chapter-${index + 1}`,
      timestamp: chapter.startTime + (chapter.endTime - chapter.startTime) / 2, // Middle of chapter
      url: `thumbnails/${videoId}_chapter_${index + 1}.jpg`,
      width: 640,
      height: 360,
    }));

    logger.info('Chapter thumbnails generated', { videoId, count: thumbnails.length });
    return thumbnails;
  } catch (error) {
    logger.error('Generate chapter thumbnails error', { error: error.message, videoId });
    throw error;
  }
}

module.exports = {
  autoGenerateChapters,
  createCustomChapters,
  getChapterNavigation,
  generateChapterThumbnails,
};






