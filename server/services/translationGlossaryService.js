// Translation Glossary Service
// Manages translation glossaries and terminology

const TranslationGlossary = require('../models/TranslationGlossary');
const logger = require('../utils/logger');

/**
 * Create glossary
 */
async function createGlossary(userId, glossaryData) {
  try {
    const glossary = new TranslationGlossary({
      userId,
      name: glossaryData.name,
      description: glossaryData.description || '',
      sourceLanguage: glossaryData.sourceLanguage.toUpperCase(),
      targetLanguage: glossaryData.targetLanguage.toUpperCase(),
      domain: glossaryData.domain || 'general',
      terms: glossaryData.terms || [],
      isActive: true,
      isDefault: glossaryData.isDefault || false
    });

    // If this is set as default, unset other defaults
    if (glossary.isDefault) {
      await TranslationGlossary.updateMany(
        {
          userId,
          sourceLanguage: glossary.sourceLanguage,
          targetLanguage: glossary.targetLanguage,
          _id: { $ne: glossary._id }
        },
        { isDefault: false }
      );
    }

    await glossary.save();
    logger.info('Glossary created', { userId, glossaryId: glossary._id });
    return glossary;
  } catch (error) {
    logger.error('Error creating glossary', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user's glossaries
 */
async function getUserGlossaries(userId, options = {}) {
  try {
    const {
      sourceLanguage = null,
      targetLanguage = null,
      domain = null,
      isActive = true
    } = options;

    const query = { userId };
    if (sourceLanguage) query.sourceLanguage = sourceLanguage.toUpperCase();
    if (targetLanguage) query.targetLanguage = targetLanguage.toUpperCase();
    if (domain) query.domain = domain;
    if (isActive !== null) query.isActive = isActive;

    const glossaries = await TranslationGlossary.find(query)
      .sort({ isDefault: -1, usageCount: -1, createdAt: -1 })
      .lean();

    return glossaries;
  } catch (error) {
    logger.error('Error getting user glossaries', { error: error.message, userId });
    throw error;
  }
}

/**
 * Update glossary
 */
async function updateGlossary(glossaryId, userId, updates) {
  try {
    const glossary = await TranslationGlossary.findOne({ _id: glossaryId, userId });
    if (!glossary) {
      throw new Error('Glossary not found');
    }

    if (updates.name !== undefined) glossary.name = updates.name;
    if (updates.description !== undefined) glossary.description = updates.description;
    if (updates.domain !== undefined) glossary.domain = updates.domain;
    if (updates.isActive !== undefined) glossary.isActive = updates.isActive;
    if (updates.terms !== undefined) glossary.terms = updates.terms;

    if (updates.isDefault === true) {
      // Unset other defaults
      await TranslationGlossary.updateMany(
        {
          userId,
          sourceLanguage: glossary.sourceLanguage,
          targetLanguage: glossary.targetLanguage,
          _id: { $ne: glossaryId }
        },
        { isDefault: false }
      );
      glossary.isDefault = true;
    }

    await glossary.save();
    return glossary;
  } catch (error) {
    logger.error('Error updating glossary', { error: error.message, glossaryId });
    throw error;
  }
}

/**
 * Add term to glossary
 */
async function addTerm(glossaryId, userId, term) {
  try {
    const glossary = await TranslationGlossary.findOne({ _id: glossaryId, userId });
    if (!glossary) {
      throw new Error('Glossary not found');
    }

    // Check if term already exists
    const existingIndex = glossary.terms.findIndex(
      t => t.term.toLowerCase() === term.term.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update existing term
      glossary.terms[existingIndex] = {
        ...glossary.terms[existingIndex],
        ...term,
        preferred: term.preferred !== undefined ? term.preferred : glossary.terms[existingIndex].preferred
      };
    } else {
      // Add new term
      glossary.terms.push({
        term: term.term,
        translation: term.translation,
        context: term.context || '',
        caseSensitive: term.caseSensitive || false,
        preferred: term.preferred !== undefined ? term.preferred : true
      });
    }

    await glossary.save();
    return glossary;
  } catch (error) {
    logger.error('Error adding term to glossary', { error: error.message, glossaryId });
    throw error;
  }
}

/**
 * Remove term from glossary
 */
async function removeTerm(glossaryId, userId, termText) {
  try {
    const glossary = await TranslationGlossary.findOne({ _id: glossaryId, userId });
    if (!glossary) {
      throw new Error('Glossary not found');
    }

    glossary.terms = glossary.terms.filter(
      t => t.term.toLowerCase() !== termText.toLowerCase()
    );

    await glossary.save();
    return glossary;
  } catch (error) {
    logger.error('Error removing term from glossary', { error: error.message, glossaryId });
    throw error;
  }
}

/**
 * Delete glossary
 */
async function deleteGlossary(glossaryId, userId) {
  try {
    const glossary = await TranslationGlossary.findOneAndDelete({
      _id: glossaryId,
      userId
    });

    if (!glossary) {
      throw new Error('Glossary not found');
    }

    return glossary;
  } catch (error) {
    logger.error('Error deleting glossary', { error: error.message, glossaryId });
    throw error;
  }
}

/**
 * Search terms in glossaries
 */
async function searchTerms(userId, sourceLanguage, targetLanguage, query) {
  try {
    const glossaries = await TranslationGlossary.find({
      userId,
      sourceLanguage: sourceLanguage.toUpperCase(),
      targetLanguage: targetLanguage.toUpperCase(),
      isActive: true
    }).lean();

    const results = [];
    const queryLower = query.toLowerCase();

    glossaries.forEach(glossary => {
      glossary.terms.forEach(term => {
        if (term.term.toLowerCase().includes(queryLower) ||
            term.translation.toLowerCase().includes(queryLower)) {
          results.push({
            term: term.term,
            translation: term.translation,
            context: term.context,
            glossary: glossary.name,
            glossaryId: glossary._id
          });
        }
      });
    });

    return results;
  } catch (error) {
    logger.error('Error searching terms', { error: error.message, userId });
    throw error;
  }
}

/**
 * Increment glossary usage
 */
async function incrementUsage(glossaryId) {
  try {
    await TranslationGlossary.findByIdAndUpdate(glossaryId, {
      $inc: { usageCount: 1 }
    });
  } catch (error) {
    logger.error('Error incrementing glossary usage', { error: error.message, glossaryId });
  }
}

module.exports = {
  createGlossary,
  getUserGlossaries,
  updateGlossary,
  addTerm,
  removeTerm,
  deleteGlossary,
  searchTerms,
  incrementUsage
};


