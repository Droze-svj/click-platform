// Dynamic Music Generation Service
// Generates music that exactly matches video length and allows section regeneration

const logger = require('../utils/logger');
const { generateMusicTrack } = require('./aiMusicGenerationService');

/**
 * Generate music track with exact video length
 */
async function generateMusicForExactLength(videoDuration, params, userId, options = {}) {
  const {
    provider = 'mubert',
    theme = null, // Keep theme consistent if regenerating
    key = null, // Keep key consistent if regenerating
    structure = 'auto' // 'auto', 'intro-verse-chorus-outro', etc.
  } = options;

  try {
    // Round to nearest second
    const duration = Math.round(videoDuration);

    // Build generation parameters
    const generationParams = {
      ...params,
      duration,
      // Include theme/key if provided for consistency
      ...(theme && { theme }),
      ...(key && { key })
    };

    // Generate track
    const generation = await generateMusicTrack(
      provider,
      generationParams,
      userId
    );

    return {
      ...generation,
      exactDuration: duration,
      theme: theme || generationParams.theme,
      key: key || generationParams.key,
      structure
    };
  } catch (error) {
    logger.error('Error generating music for exact length', {
      error: error.message,
      videoDuration,
      userId
    });
    throw error;
  }
}

/**
 * Regenerate section of track while maintaining theme and key
 */
async function regenerateTrackSection(
  originalTrackId,
  section,
  userId,
  options = {}
) {
  const {
    provider = 'mubert',
    preserveTheme = true,
    preserveKey = true
  } = options;

  try {
    const MusicGeneration = require('../models/MusicGeneration');
    const originalGeneration = await MusicGeneration.findById(originalTrackId).lean();

    if (!originalGeneration || originalGeneration.userId.toString() !== userId.toString()) {
      throw new Error('Original track not found or unauthorized');
    }

    // Get theme and key from original
    const originalParams = originalGeneration.params || {};
    const theme = preserveTheme ? (originalParams.theme || originalParams.mood) : null;
    const key = preserveKey ? originalParams.key : null;

    // Calculate section duration
    const sectionDuration = section.end - section.start;

    // Generate new section
    const sectionParams = {
      mood: originalParams.mood || 'energetic',
      genre: originalParams.genre || 'electronic',
      duration: sectionDuration,
      ...(theme && { theme }),
      ...(key && { key }),
      // Indicate this is a section, not full track
      isSection: true,
      sectionType: section.type || 'middle'
    };

    const newSection = await generateMusicTrack(
      provider,
      sectionParams,
      userId
    );

    return {
      sectionGeneration: newSection,
      originalTrackId,
      section: {
        start: section.start,
        end: section.end,
        duration: sectionDuration
      },
      preserved: {
        theme: preserveTheme && theme,
        key: preserveKey && key
      },
      instructions: 'Merge this section into the original track at the specified time range'
    };
  } catch (error) {
    logger.error('Error regenerating track section', {
      error: error.message,
      originalTrackId,
      userId
    });
    throw error;
  }
}

/**
 * Generate structured track (with intro, verse, chorus, outro sections)
 */
async function generateStructuredTrack(videoDuration, params, userId, structure, options = {}) {
  const { provider = 'mubert' } = options;

  try {
    const duration = Math.round(videoDuration);

    // Define structure proportions
    const structures = {
      'intro-verse-chorus-outro': {
        intro: 0.15,
        verse: 0.25,
        chorus: 0.35,
        outro: 0.25
      },
      'intro-chorus-bridge-outro': {
        intro: 0.15,
        chorus: 0.50,
        bridge: 0.20,
        outro: 0.15
      },
      'simple': {
        intro: 0.20,
        main: 0.60,
        outro: 0.20
      }
    };

    const structureMap = structures[structure] || structures['simple'];
    const sections = [];

    let currentTime = 0;
    for (const [sectionName, proportion] of Object.entries(structureMap)) {
      const sectionDuration = Math.round(duration * proportion);
      sections.push({
        name: sectionName,
        start: currentTime,
        end: currentTime + sectionDuration,
        duration: sectionDuration
      });
      currentTime += sectionDuration;
    }

    // Adjust last section to match exact duration
    if (sections.length > 0) {
      const total = sections.reduce((sum, s) => sum + s.duration, 0);
      const diff = duration - total;
      sections[sections.length - 1].duration += diff;
      sections[sections.length - 1].end += diff;
    }

    // Generate full track with structure markers
    const generationParams = {
      ...params,
      duration,
      structure: structureMap,
      hasStructure: true
    };

    const generation = await generateMusicTrack(
      provider,
      generationParams,
      userId
    );

    return {
      ...generation,
      exactDuration: duration,
      structure: {
        type: structure,
        sections,
        map: structureMap
      }
    };
  } catch (error) {
    logger.error('Error generating structured track', {
      error: error.message,
      videoDuration,
      userId
    });
    throw error;
  }
}

/**
 * Merge regenerated section into original track
 */
async function mergeSectionIntoTrack(originalTrackId, sectionGenerationId, section, userId) {
  try {
    // This would use audio editing to merge sections
    // For now, return instructions for manual merging
    return {
      originalTrackId,
      sectionGenerationId,
      section,
      mergeInstructions: {
        type: 'audio_merge',
        operation: 'replace_section',
        startTime: section.start,
        endTime: section.end,
        crossfade: true,
        crossfadeDuration: 0.5
      },
      note: 'Use audio editing service to merge the regenerated section into the original track'
    };
  } catch (error) {
    logger.error('Error merging section into track', {
      error: error.message,
      originalTrackId,
      userId
    });
    throw error;
  }
}

module.exports = {
  generateMusicForExactLength,
  regenerateTrackSection,
  generateStructuredTrack,
  mergeSectionIntoTrack
};







