/**
 * contentRepurposingService — the text the AI works from.
 *
 * All three generators built their prompt from content.body. Content has no body
 * path, so every prompt read "Body: undefined" and the model invented the post.
 * A missing or unparsable reply crashed on null.match() or a thrown SyntaxError
 * and surfaced as a 500 with the raw error text.
 * Runs against the in-memory MongoDB from tests/setup.js.
 */

const mockGoogleAI = { generateContent: jest.fn(), isConfigured: true };
jest.mock('../../server/utils/googleAI', () => mockGoogleAI);
const mockAiCallJson = jest.fn();
jest.mock('../../server/utils/aiRouter', () => ({
  aiCallJson: (...args) => mockAiCallJson(...args),
}));
const mockPersonalizePrompt = jest.fn();
jest.mock('../../server/utils/applyPersona', () => ({
  personalizePrompt: (...args) => mockPersonalizePrompt(...args),
  applyPersona: jest.fn(),
}));

const mongoose = require('mongoose');
const Content = require('../../server/models/Content');
const {
  repurposeContent,
  createContentVariations,
  extractKeyPoints,
} = require('../../server/services/contentRepurposingService');

describe('contentRepurposingService', () => {
  let userId;
  const created = [];
  const make = async (fields) => {
    const doc = await Content.create({ userId, type: 'article', title: 'Morning routine', ...fields });
    created.push(doc._id);
    return doc;
  };

  beforeEach(() => {
    mockGoogleAI.generateContent.mockReset();
    mockGoogleAI.isConfigured = true;
    mockAiCallJson.mockReset();
    mockPersonalizePrompt.mockReset();
    mockPersonalizePrompt.mockImplementation(async (prompt) => `PERSONA\n${prompt}`);
    userId = new mongoose.Types.ObjectId().toString();
  });

  afterAll(async () => {
    await Content.deleteMany({ _id: { $in: created } });
  });

  it("repurposes the post's real text, not \"undefined\"", async () => {
    const content = await make({ content: { text: 'Wake at 5, walk, then write.' } });
    mockAiCallJson.mockResolvedValue({ variants: [{ angle: 'safe', title: 'T', body: 'B', hashtags: [] }] });

    const result = await repurposeContent(content._id, userId, 'linkedin');

    const prompt = mockAiCallJson.mock.calls[0][0];
    expect(prompt).toContain('Body: Wake at 5, walk, then write.');
    expect(prompt).not.toContain('undefined');
    expect(result.variants).toHaveLength(1);
  });

  it('varies the transcript when there is no post text — personalized, with a bounded count', async () => {
    const content = await make({ transcript: 'Today I show my morning routine.' });
    mockGoogleAI.generateContent.mockResolvedValue(JSON.stringify({ variations: [{ title: 'V1', body: 'Body 1' }] }));

    const variations = await createContentVariations(content._id, userId, 50);

    expect(variations).toEqual([{ title: 'V1', body: 'Body 1' }]);
    const [prompt, opts] = mockPersonalizePrompt.mock.calls[0];
    expect(prompt).toContain('Create 5 different variations');
    expect(prompt).toContain('Body: Today I show my morning routine.');
    expect(opts).toMatchObject({ userId });
    expect(mockGoogleAI.generateContent.mock.calls[0][0]).toMatch(/^PERSONA/);
  });

  it('says variations are unavailable when the model returns nothing', async () => {
    const content = await make({ description: 'A short description.' });
    mockGoogleAI.generateContent.mockResolvedValue(null);

    await expect(createContentVariations(content._id, userId, 3))
      .rejects.toMatchObject({ statusCode: 503, message: 'Content variations are unavailable right now' });
  });

  it('extracts key points from the real text and reports unusable replies, missing text and missing content', async () => {
    const withText = await make({ content: { text: 'Three habits that changed my mornings.' } });

    mockGoogleAI.generateContent.mockResolvedValueOnce('{"mainMessage":"Habits matter","keyPoints":["a"]}');
    await expect(extractKeyPoints(withText._id, userId)).resolves.toMatchObject({ mainMessage: 'Habits matter' });
    expect(mockGoogleAI.generateContent.mock.calls[0][0]).toContain('Three habits that changed my mornings.');
    expect(mockPersonalizePrompt).not.toHaveBeenCalled();

    mockGoogleAI.generateContent.mockResolvedValueOnce('not json {broken');
    await expect(extractKeyPoints(withText._id, userId)).rejects.toMatchObject({ statusCode: 503 });

    const empty = await make({});
    mockGoogleAI.generateContent.mockClear();
    await expect(extractKeyPoints(empty._id, userId)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockGoogleAI.generateContent).not.toHaveBeenCalled();

    await expect(extractKeyPoints(new mongoose.Types.ObjectId(), userId)).rejects.toMatchObject({ statusCode: 404 });
  });
});
