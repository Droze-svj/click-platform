/**
 * unifiedContentPipelineService + adaptivePerformanceService — pipeline Maps.
 *
 * pipeline.assets, variations, performance, abTests and refreshed are Mongoose
 * Maps. The services read and wrote them with bracket access
 * (pipeline.assets[platform]), which on a Map reads undefined and saves nothing:
 * one-click publish published nothing, optimal scheduling scheduled nothing,
 * variations always answered "Pipeline not completed", A/B tests and adjusted
 * predictions were never stored, and refresh refreshed nothing.
 * Runs against the in-memory MongoDB from tests/setup.js.
 */

const mockGoogleAI = { generateContent: jest.fn(), isConfigured: true };
jest.mock('../../server/utils/googleAI', () => mockGoogleAI);
const mockPersonalizePrompt = jest.fn();
jest.mock('../../server/utils/applyPersona', () => ({
  personalizePrompt: (...args) => mockPersonalizePrompt(...args),
  applyPersona: jest.fn(),
}));
const mockPostToSocial = jest.fn();
jest.mock('../../server/services/socialMediaService', () => ({
  postToSocial: (...args) => mockPostToSocial(...args),
}));
jest.mock('../../server/services/aiService', () => ({
  generateSocialContent: jest.fn().mockResolvedValue({}),
  detectHighlights: jest.fn(),
  predictPerformance: jest.fn().mockResolvedValue({ score: 72, engagement: 140, reach: 1800 }),
}));
jest.mock('../../server/services/hashtagService', () => ({
  generateHashtags: jest.fn().mockResolvedValue([{ hashtag: 'fresh', category: 'general' }, '#trend']),
}));
jest.mock('../../server/services/contentRecyclingService', () => ({}));

const mongoose = require('mongoose');
const Content = require('../../server/models/Content');
const ScheduledPost = require('../../server/models/ScheduledPost');
const pipelineService = require('../../server/services/unifiedContentPipelineService');
const { updatePredictionsWithNewData } = require('../../server/services/adaptivePerformanceService');

describe('pipeline Maps are read and written through the Map API', () => {
  let userId;
  let content;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGoogleAI.isConfigured = true;
    mockPersonalizePrompt.mockImplementation(async (prompt) => `PERSONA\n${prompt}`);
    mockPostToSocial.mockResolvedValue({ success: true });
    userId = new mongoose.Types.ObjectId().toString();
    const created = await Content.create({ userId, type: 'article', title: 'Pipeline post' });
    // Stored the way processContentPipeline stores it (a $set update). Mongoose 8
    // cannot validate a NEW document constructed with pipeline Maps inside a
    // nested object (see routes/library.js duplicate), so no Content.create here.
    await Content.updateOne({ _id: created._id }, {
      $set: {
        'pipeline.status': 'completed',
        'pipeline.assets': {
          twitter: [{ type: 'post', content: 'Tweet one', hashtags: ['#old'] }],
          linkedin: [{ type: 'post', content: 'LinkedIn post' }],
        },
      },
    });
    content = await Content.findById(created._id);
  });

  afterEach(async () => {
    await Content.deleteOne({ _id: content._id });
    await ScheduledPost.deleteMany({ contentId: content._id });
  });

  it('publishes every stored asset', async () => {
    const results = await pipelineService.publishAllNetworks(userId, content._id, { platforms: ['twitter', 'linkedin'] });

    expect(results.published.map((p) => p.platform).sort()).toEqual(['linkedin', 'twitter']);
    expect(results.failed).toEqual([]);
    expect(mockPostToSocial).toHaveBeenCalledWith(
      userId, 'twitter', expect.objectContaining({ description: 'Tweet one' }), content._id
    );
  });

  it('schedules every stored asset', async () => {
    const result = await pipelineService.scheduleWithOptimalTimes(userId, content._id, ['twitter']);

    expect(result.total).toBe(1);
    const posts = await ScheduledPost.find({ contentId: content._id }).lean();
    expect(posts.map((p) => p.content.text)).toEqual(['Tweet one']);
  });

  it('generates personalized variations, skips an empty generation, and saves them', async () => {
    mockGoogleAI.generateContent
      .mockResolvedValueOnce(JSON.stringify({ content: 'A sharper take', hashtags: ['#new'], variationType: 'angle', hook: 'Stop' }))
      .mockResolvedValueOnce(null);

    const variations = await pipelineService.generateContentVariations(userId, content._id, 'twitter', 2);

    expect(variations).toHaveLength(1);
    expect(variations[0]).toMatchObject({ content: 'A sharper take', platform: 'twitter' });
    expect(mockPersonalizePrompt).toHaveBeenCalledWith(
      expect.stringContaining('Tweet one'), expect.objectContaining({ userId, platform: 'twitter' })
    );
    expect(mockGoogleAI.generateContent.mock.calls[0][0]).toMatch(/^PERSONA/);

    const saved = await Content.findById(content._id);
    expect(saved.pipeline.variations.get('twitter').map((v) => v.content)).toEqual(['A sharper take']);
  });

  it('refuses an unsupported platform before generating anything', async () => {
    await expect(pipelineService.generateContentVariations(userId, content._id, 'bad.key', 1))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(pipelineService.setupABTesting(userId, content._id, '$where', [{ content: 'A' }]))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockGoogleAI.generateContent).not.toHaveBeenCalled();
  });

  it('stores an A/B test', async () => {
    await pipelineService.setupABTesting(userId, content._id, 'twitter', [{ content: 'A' }, { content: 'B' }]);

    const saved = await Content.findById(content._id);
    const test = saved.pipeline.abTests.get('twitter');
    expect(test.status).toBe('active');
    expect(test.testGroups.map((g) => g.variant)).toEqual(['A', 'B']);
  });

  it('refreshes every stored asset, keeping its text and storing plain-string hashtags', async () => {
    const refreshed = await pipelineService.smartContentRefresh(userId, content._id, {
      updateHashtags: true, updateCaptions: false, optimizeForTrends: false, usePerformanceData: false,
    });

    expect(Object.keys(refreshed).sort()).toEqual(['linkedin', 'twitter']);
    expect(refreshed.twitter[0]).toMatchObject({ content: 'Tweet one', hashtags: ['#fresh', '#trend'] });

    const saved = await Content.findById(content._id);
    expect([...saved.pipeline.refreshed.get('twitter')[0].hashtags]).toEqual(['#fresh', '#trend']);
  });

  it('reads the stored prediction and saves the adjusted one', async () => {
    content.set('pipeline.performance.twitter', [{ predictedEngagement: 10, predictedReach: 100 }]);
    await content.save();
    await ScheduledPost.create({
      userId,
      contentId: content._id,
      platform: 'twitter',
      content: { text: 'Tweet one' },
      scheduledTime: new Date(),
      status: 'posted',
      postedAt: new Date(),
      analytics: { engagement: 50, reach: 400 },
    });

    const updated = await updatePredictionsWithNewData(userId, content._id);

    // Accuracy is only computed against a stored initial prediction.
    expect(updated.twitter.accuracy).not.toBeNull();
    const saved = await Content.findById(content._id);
    const [entry] = saved.pipeline.performance.get('twitter');
    expect(entry.predictedEngagement).toBe(updated.twitter.adjustedPrediction.engagement);
  });
});
