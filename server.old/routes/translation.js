// Translation Routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  detectLanguage,
  translateContent,
  translateToMultipleLanguages,
  getContentInLanguage,
  getContentTranslations,
  updateTranslation,
  deleteTranslation,
  getSupportedLanguages
} = require('../services/translationService');
const {
  optimizeForPlatform,
  getBestLanguageForPlatform,
  batchOptimizeForPlatforms
} = require('../services/languageOptimizationService');
const {
  getLanguagePerformance,
  getLanguageDistribution,
  getPlatformLanguagePerformance
} = require('../services/languageAnalyticsService');
const {
  addToMemory,
  searchMemory,
  updateMemory,
  deleteMemory,
  getMemoryStats,
  exportMemory,
  importMemory
} = require('../services/translationMemoryService');
const {
  createGlossary,
  getUserGlossaries,
  updateGlossary,
  addTerm,
  removeTerm,
  deleteGlossary,
  searchTerms
} = require('../services/translationGlossaryService');
const {
  bulkTranslateContent,
  autoTranslateOnCreate
} = require('../services/translationService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * POST /api/translation/detect
 * Detect language of text
 */
router.post('/detect', auth, asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return sendError(res, 'Text is required', 400);
  }

  const detection = await detectLanguage(text);
  sendSuccess(res, 'Language detected', 200, detection);
}));

/**
 * POST /api/translation/translate
 * Translate content to target language
 */
router.post('/translate', auth, asyncHandler(async (req, res) => {
  const { contentId, targetLanguage, ...options } = req.body;

  if (!contentId || !targetLanguage) {
    return sendError(res, 'Content ID and target language are required', 400);
  }

  const Content = require('../models/Content');
  const content = await Content.findOne({
    _id: contentId,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  const translation = await translateContent(contentId, targetLanguage, options);
  sendSuccess(res, 'Content translated', 200, translation);
}));

/**
 * POST /api/translation/translate-multiple
 * Translate content to multiple languages
 */
router.post('/translate-multiple', auth, asyncHandler(async (req, res) => {
  const { contentId, languages, ...options } = req.body;

  if (!contentId || !languages || !Array.isArray(languages)) {
    return sendError(res, 'Content ID and languages array are required', 400);
  }

  const Content = require('../models/Content');
  const content = await Content.findOne({
    _id: contentId,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  const results = await translateToMultipleLanguages(contentId, languages, options);
  sendSuccess(res, 'Content translated to multiple languages', 200, results);
}));

/**
 * GET /api/translation/content/:contentId/:language
 * Get content in specific language
 */
router.get('/content/:contentId/:language', auth, asyncHandler(async (req, res) => {
  const { contentId, language } = req.params;
  const { fallbackToOriginal = true } = req.query;

  const Content = require('../models/Content');
  const content = await Content.findOne({
    _id: contentId,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  const translatedContent = await getContentInLanguage(
    contentId,
    language,
    fallbackToOriginal === 'true'
  );
  
  sendSuccess(res, 'Content retrieved', 200, translatedContent);
}));

/**
 * GET /api/translation/content/:contentId/translations
 * Get all translations for content
 */
router.get('/content/:contentId/translations', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const Content = require('../models/Content');
  const content = await Content.findOne({
    _id: contentId,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  const translations = await getContentTranslations(contentId);
  sendSuccess(res, 'Translations retrieved', 200, { translations });
}));

/**
 * PUT /api/translation/:translationId
 * Update translation
 */
router.put('/:translationId', auth, asyncHandler(async (req, res) => {
  const { translationId } = req.params;
  const updates = req.body;

  const translation = await updateTranslation(translationId, req.user._id, updates);
  sendSuccess(res, 'Translation updated', 200, translation);
}));

/**
 * DELETE /api/translation/:translationId
 * Delete translation
 */
router.delete('/:translationId', auth, asyncHandler(async (req, res) => {
  const { translationId } = req.params;

  await deleteTranslation(translationId, req.user._id);
  sendSuccess(res, 'Translation deleted', 200);
}));

/**
 * GET /api/translation/languages
 * Get supported languages
 */
router.get('/languages', auth, asyncHandler(async (req, res) => {
  const languages = getSupportedLanguages();
  sendSuccess(res, 'Supported languages retrieved', 200, { languages });
}));

/**
 * POST /api/translation/optimize-platform
 * Optimize content for platform and language
 */
router.post('/optimize-platform', auth, asyncHandler(async (req, res) => {
  const { contentId, platform, targetLanguage, ...options } = req.body;

  if (!contentId || !platform || !targetLanguage) {
    return sendError(res, 'Content ID, platform, and target language are required', 400);
  }

  const Content = require('../models/Content');
  const content = await Content.findOne({
    _id: contentId,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  const optimization = await optimizeForPlatform(contentId, platform, targetLanguage, options);
  sendSuccess(res, 'Content optimized for platform', 200, optimization);
}));

/**
 * GET /api/translation/best-language/:platform
 * Get best language for platform
 */
router.get('/best-language/:platform', auth, asyncHandler(async (req, res) => {
  const { platform } = req.params;

  const recommendation = await getBestLanguageForPlatform(req.user._id, platform);
  sendSuccess(res, 'Best language recommended', 200, recommendation);
}));

/**
 * POST /api/translation/batch-optimize
 * Batch optimize for multiple platforms and languages
 */
router.post('/batch-optimize', auth, asyncHandler(async (req, res) => {
  const { contentId, platforms, languages, ...options } = req.body;

  if (!contentId || !platforms || !languages) {
    return sendError(res, 'Content ID, platforms, and languages are required', 400);
  }

  const Content = require('../models/Content');
  const content = await Content.findOne({
    _id: contentId,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  const results = await batchOptimizeForPlatforms(contentId, platforms, languages, options);
  sendSuccess(res, 'Batch optimization completed', 200, results);
}));

/**
 * GET /api/translation/analytics/performance
 * Get language performance analytics
 */
router.get('/analytics/performance', auth, asyncHandler(async (req, res) => {
  const { period = 30, platforms, languages } = req.query;

  const analytics = await getLanguagePerformance(req.user._id, {
    period: parseInt(period),
    platforms: platforms ? platforms.split(',') : null,
    languages: languages ? languages.split(',') : null
  });

  sendSuccess(res, 'Language performance retrieved', 200, analytics);
}));

/**
 * GET /api/translation/analytics/distribution
 * Get language distribution
 */
router.get('/analytics/distribution', auth, asyncHandler(async (req, res) => {
  const distribution = await getLanguageDistribution(req.user._id);
  sendSuccess(res, 'Language distribution retrieved', 200, distribution);
}));

/**
 * GET /api/translation/analytics/platform/:platform
 * Get platform-language performance
 */
router.get('/analytics/platform/:platform', auth, asyncHandler(async (req, res) => {
  const { platform } = req.params;

  const performance = await getPlatformLanguagePerformance(req.user._id, platform);
  sendSuccess(res, 'Platform language performance retrieved', 200, { performance });
}));

/**
 * POST /api/translation/memory
 * Add entry to translation memory
 */
router.post('/memory', auth, asyncHandler(async (req, res) => {
  const memory = await addToMemory(req.user._id, req.body);
  sendSuccess(res, 'Added to translation memory', 201, memory);
}));

/**
 * GET /api/translation/memory/search
 * Search translation memory
 */
router.get('/memory/search', auth, asyncHandler(async (req, res) => {
  const { sourceLanguage, targetLanguage, query, ...options } = req.query;

  if (!sourceLanguage || !targetLanguage) {
    return sendError(res, 'Source and target languages are required', 400);
  }

  const results = await searchMemory(req.user._id, sourceLanguage, targetLanguage, query, options);
  sendSuccess(res, 'Memory search completed', 200, { results });
}));

/**
 * PUT /api/translation/memory/:memoryId
 * Update translation memory entry
 */
router.put('/memory/:memoryId', auth, asyncHandler(async (req, res) => {
  const { memoryId } = req.params;
  const memory = await updateMemory(memoryId, req.user._id, req.body);
  sendSuccess(res, 'Memory entry updated', 200, memory);
}));

/**
 * DELETE /api/translation/memory/:memoryId
 * Delete translation memory entry
 */
router.delete('/memory/:memoryId', auth, asyncHandler(async (req, res) => {
  const { memoryId } = req.params;
  await deleteMemory(memoryId, req.user._id);
  sendSuccess(res, 'Memory entry deleted', 200);
}));

/**
 * GET /api/translation/memory/stats
 * Get translation memory statistics
 */
router.get('/memory/stats', auth, asyncHandler(async (req, res) => {
  const stats = await getMemoryStats(req.user._id);
  sendSuccess(res, 'Memory stats retrieved', 200, stats);
}));

/**
 * GET /api/translation/memory/export
 * Export translation memory
 */
router.get('/memory/export', auth, asyncHandler(async (req, res) => {
  const { sourceLanguage, targetLanguage } = req.query;

  if (!sourceLanguage || !targetLanguage) {
    return sendError(res, 'Source and target languages are required', 400);
  }

  const entries = await exportMemory(req.user._id, sourceLanguage, targetLanguage);
  sendSuccess(res, 'Memory exported', 200, { entries });
}));

/**
 * POST /api/translation/memory/import
 * Import translation memory
 */
router.post('/memory/import', auth, asyncHandler(async (req, res) => {
  const { entries } = req.body;

  if (!entries || !Array.isArray(entries)) {
    return sendError(res, 'Entries array is required', 400);
  }

  const results = await importMemory(req.user._id, entries);
  sendSuccess(res, 'Memory imported', 200, results);
}));

/**
 * POST /api/translation/glossary
 * Create translation glossary
 */
router.post('/glossary', auth, asyncHandler(async (req, res) => {
  const glossary = await createGlossary(req.user._id, req.body);
  sendSuccess(res, 'Glossary created', 201, glossary);
}));

/**
 * GET /api/translation/glossary
 * Get user's glossaries
 */
router.get('/glossary', auth, asyncHandler(async (req, res) => {
  const glossaries = await getUserGlossaries(req.user._id, req.query);
  sendSuccess(res, 'Glossaries retrieved', 200, { glossaries });
}));

/**
 * PUT /api/translation/glossary/:glossaryId
 * Update glossary
 */
router.put('/glossary/:glossaryId', auth, asyncHandler(async (req, res) => {
  const { glossaryId } = req.params;
  const glossary = await updateGlossary(glossaryId, req.user._id, req.body);
  sendSuccess(res, 'Glossary updated', 200, glossary);
}));

/**
 * POST /api/translation/glossary/:glossaryId/terms
 * Add term to glossary
 */
router.post('/glossary/:glossaryId/terms', auth, asyncHandler(async (req, res) => {
  const { glossaryId } = req.params;
  const glossary = await addTerm(glossaryId, req.user._id, req.body);
  sendSuccess(res, 'Term added', 200, glossary);
}));

/**
 * DELETE /api/translation/glossary/:glossaryId/terms
 * Remove term from glossary
 */
router.delete('/glossary/:glossaryId/terms', auth, asyncHandler(async (req, res) => {
  const { glossaryId } = req.params;
  const { term } = req.body;

  if (!term) {
    return sendError(res, 'Term is required', 400);
  }

  const glossary = await removeTerm(glossaryId, req.user._id, term);
  sendSuccess(res, 'Term removed', 200, glossary);
}));

/**
 * DELETE /api/translation/glossary/:glossaryId
 * Delete glossary
 */
router.delete('/glossary/:glossaryId', auth, asyncHandler(async (req, res) => {
  const { glossaryId } = req.params;
  await deleteGlossary(glossaryId, req.user._id);
  sendSuccess(res, 'Glossary deleted', 200);
}));

/**
 * GET /api/translation/glossary/search
 * Search terms in glossaries
 */
router.get('/glossary/search', auth, asyncHandler(async (req, res) => {
  const { sourceLanguage, targetLanguage, query } = req.query;

  if (!sourceLanguage || !targetLanguage || !query) {
    return sendError(res, 'Source language, target language, and query are required', 400);
  }

  const results = await searchTerms(req.user._id, sourceLanguage, targetLanguage, query);
  sendSuccess(res, 'Terms found', 200, { results });
}));

/**
 * POST /api/translation/bulk
 * Bulk translate content
 */
router.post('/bulk', auth, asyncHandler(async (req, res) => {
  const { contentIds, targetLanguages, ...options } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  if (!targetLanguages || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
    return sendError(res, 'Target languages array is required', 400);
  }

  const results = await bulkTranslateContent([req.user._id], contentIds, targetLanguages, options);
  sendSuccess(res, 'Bulk translation completed', 200, results);
}));

/**
 * POST /api/translation/auto-translate
 * Auto-translate on content creation
 */
router.post('/auto-translate', auth, asyncHandler(async (req, res) => {
  const { contentId, ...options } = req.body;

  if (!contentId) {
    return sendError(res, 'Content ID is required', 400);
  }

  const Content = require('../models/Content');
  const content = await Content.findOne({
    _id: contentId,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  const result = await autoTranslateOnCreate(contentId, req.user._id, options);
  sendSuccess(res, 'Auto-translation completed', 200, result);
}));

module.exports = router;

