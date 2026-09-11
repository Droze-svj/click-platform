/**
 * contentRecyclingService.applyAdvancedRefreshStrategy — refreshed title,
 * description and caption for a repost.
 *
 * The three refresh helpers called aiService.generateSocialContent(prompt,
 * { maxLength }). That function takes a niche STRING second and returns an object
 * of platform posts, so the prompt read "Transform this [object Object] content…"
 * and each "refreshed" field came back as that object — "[object Object]" once
 * saved. They now ask for plain text, respect their length limits, and keep the
 * real original when the model has nothing to offer.
 * Runs against the in-memory MongoDB from tests/setup.js.
 */

const mockGoogleAI = { generateContent: jest.fn(), isConfigured: true };
jest.mock('../../server/utils/googleAI', () => mockGoogleAI);
jest.mock('../../server/services/hashtagService', () => ({
  generateHashtags: jest.fn().mockResolvedValue(['#reposted']),
}));

const mongoose = require('mongoose');
const Content = require('../../server/models/Content');
const ContentRecycle = require('../../server/models/ContentRecycle');
const { applyAdvancedRefreshStrategy } = require('../../server/services/contentRecyclingService');

// Answer by what the prompt asks for, so the test doesn't depend on call order.
const answer = ({ title, description, caption }) => (prompt) => Promise.resolve(
  /new title/.test(prompt) ? title : /new description/.test(prompt) ? description : /new caption/.test(prompt) ? caption : null
);

describe('applyAdvancedRefreshStrategy (aggressive)', () => {
  let content;
  let recycle;

  beforeEach(async () => {
    mockGoogleAI.generateContent.mockReset();
    mockGoogleAI.isConfigured = true;
    const userId = new mongoose.Types.ObjectId();
    content = await Content.create({
      userId, type: 'article', title: 'Old title', description: 'Old description of the post',
    });
    recycle = await ContentRecycle.create({
      originalContentId: content._id, originalPostId: new mongoose.Types.ObjectId(), userId, platform: 'twitter',
    });
  });

  afterEach(async () => {
    await Content.deleteOne({ _id: content._id });
    await ContentRecycle.deleteOne({ _id: recycle._id });
  });

  it('uses the plain text the model wrote, trimmed and unquoted', async () => {
    mockGoogleAI.generateContent.mockImplementation(answer({
      title: '"A sharper title"',
      description: '  A fresher description.  ',
      caption: 'A new caption for the repost',
    }));

    const refresh = await applyAdvancedRefreshStrategy(recycle._id, 'aggressive');

    expect(refresh).toMatchObject({
      title: 'A sharper title',
      description: 'A fresher description.',
      caption: 'A new caption for the repost',
      hashtags: ['#reposted'],
    });
  });

  it('keeps the real original when the model has nothing to offer — never "[object Object]"', async () => {
    mockGoogleAI.generateContent.mockResolvedValue(null);

    const refresh = await applyAdvancedRefreshStrategy(recycle._id, 'aggressive');

    expect(refresh.title).toBe('Old title');
    expect(refresh.description).toBe('Old description of the post');
    expect(refresh.caption).toBe('Old description of the post');
    expect(JSON.stringify(refresh)).not.toMatch(/\[object Object\]/);
  });

  it('cuts an over-long title at a word boundary within the 60-character limit', async () => {
    mockGoogleAI.generateContent.mockImplementation(answer({
      title: 'This refreshed title keeps going well past the sixty character limit it was given',
      description: 'd', caption: 'c',
    }));

    const { title } = await applyAdvancedRefreshStrategy(recycle._id, 'aggressive');

    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toBe('This refreshed title keeps going well past the sixty');
  });

  it('does not call the model when AI is not configured', async () => {
    mockGoogleAI.isConfigured = false;

    const refresh = await applyAdvancedRefreshStrategy(recycle._id, 'aggressive');

    expect(mockGoogleAI.generateContent).not.toHaveBeenCalled();
    expect(refresh.title).toBe('Old title');
  });
});
