/**
 * Dashboard content generation must not report success when nothing was generated.
 *
 * generateContentFromText saved `status: 'completed'` even when the model produced
 * no social posts (AI unavailable or over quota), counted it against the user's
 * usage, and told the client it completed. The worker then reported the job as a
 * success. Both now say it failed, with the reason — and the worker does not
 * throw, because a throw makes the queue retry against the same exhausted quota.
 * Runs against the in-memory MongoDB from tests/setup.js.
 */

jest.mock('../../server/services/aiService', () => ({
  generateSocialContent: jest.fn(),
  generateBlogSummary: jest.fn(),
  generateViralIdeas: jest.fn(),
  generateContentIdea: jest.fn(),
}));
jest.mock('../../server/services/socketService', () => ({ emitToUser: jest.fn() }));

const mongoose = require('mongoose');
const aiService = require('../../server/services/aiService');
const { emitToUser } = require('../../server/services/socketService');
const Content = require('../../server/models/Content');
const User = require('../../server/models/User');
const { generateContentFromText } = require('../../server/services/contentGenerationService');

describe('generateContentFromText', () => {
  let content;
  const userId = new mongoose.Types.ObjectId();

  beforeEach(async () => {
    jest.clearAllMocks();
    content = await Content.create({ userId, type: 'article', title: 'Morning routine', status: 'processing' });
  });

  afterEach(async () => {
    await Content.deleteOne({ _id: content._id });
    jest.restoreAllMocks();
  });

  it('marks the content failed — not completed — when no social post was produced', async () => {
    aiService.generateSocialContent.mockResolvedValue({});
    const usage = jest.spyOn(User, 'findByIdAndUpdate');

    const outcome = await generateContentFromText(content._id, 'source text', { _id: userId }, ['twitter']);

    expect(outcome).toEqual({ generated: false, reason: expect.stringMatching(/unavailable/) });
    const saved = await Content.findById(content._id).lean();
    expect(saved.status).toBe('failed');
    expect(saved.errorMessage).toMatch(/no social posts were produced/);
    expect(usage).not.toHaveBeenCalled();
    expect(emitToUser).toHaveBeenCalledWith(String(userId), 'content-generated', expect.objectContaining({ status: 'failed' }));
    // Nothing else is generated for a result that failed at the first step.
    expect(aiService.generateBlogSummary).not.toHaveBeenCalled();
    expect(aiService.generateViralIdeas).not.toHaveBeenCalled();
  });

  it('completes normally when the model produced posts', async () => {
    aiService.generateSocialContent.mockResolvedValue({ twitter: { platform: 'twitter', text: 'A real post', hashtags: [] } });
    aiService.generateBlogSummary.mockResolvedValue('A real summary');
    aiService.generateViralIdeas.mockResolvedValue([]);

    const outcome = await generateContentFromText(content._id, 'source text', { _id: userId }, ['twitter']);

    expect(outcome).not.toEqual(expect.objectContaining({ generated: false }));
    const saved = await Content.findById(content._id).lean();
    expect(saved.status).toBe('completed');
    expect(saved.generatedContent.socialPosts).toEqual([
      expect.objectContaining({ platform: 'twitter', content: 'A real post' }),
    ]);
  });
});

describe('content generation worker', () => {
  beforeEach(() => jest.resetModules());

  it('reports a job that generated nothing as failed, without throwing', async () => {
    const emitProcessingFailed = jest.fn();
    const emitProcessingComplete = jest.fn();
    jest.doMock('../../server/services/jobQueueService', () => ({ createWorker: jest.fn() }));
    jest.doMock('../../server/services/realtimeService', () => ({
      emitProcessingProgress: jest.fn(), emitProcessingComplete, emitProcessingFailed,
    }));
    jest.doMock('../../server/services/contentGenerationService', () => ({
      generateContentFromText: jest.fn().mockResolvedValue({ generated: false, reason: 'AI unavailable' }),
    }));
    const { processContentJob } = require('../../server/workers/contentGenerator');

    const job = { id: 'job-1', updateProgress: jest.fn().mockResolvedValue() };
    const result = await processContentJob({ contentId: 'c1', text: 't', user: { _id: 'u1' }, platforms: ['twitter'] }, job);

    expect(result).toEqual({ success: false, contentId: 'c1', reason: 'AI unavailable' });
    expect(emitProcessingFailed).toHaveBeenCalledWith('u1', 'job-1', expect.objectContaining({ message: 'AI unavailable' }));
    expect(emitProcessingComplete).not.toHaveBeenCalled();
  });

  it('still reports a job that generated content as a success', async () => {
    const emitProcessingComplete = jest.fn();
    jest.doMock('../../server/services/jobQueueService', () => ({ createWorker: jest.fn() }));
    jest.doMock('../../server/services/realtimeService', () => ({
      emitProcessingProgress: jest.fn(), emitProcessingComplete, emitProcessingFailed: jest.fn(),
    }));
    jest.doMock('../../server/services/contentGenerationService', () => ({
      generateContentFromText: jest.fn().mockResolvedValue(undefined),
    }));
    const { processContentJob } = require('../../server/workers/contentGenerator');

    const job = { id: 'job-2', updateProgress: jest.fn().mockResolvedValue() };
    const result = await processContentJob({ contentId: 'c2', text: 't', user: { _id: 'u1' }, platforms: ['twitter'] }, job);

    expect(result).toEqual({ success: true, contentId: 'c2' });
    expect(emitProcessingComplete).toHaveBeenCalled();
  });
});
