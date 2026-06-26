// Universal AI feedback closes the learning loop (and learns from MISTAKES):
// positive upweights + records the pick; reject/regenerate/heavy-edit downweights
// the trait; a tagged mistake adds an explicit "AVOID …" line to the very next
// personalized prompt. Runs on the in-memory DB (the unit project's guard).

const mongoose = require('mongoose');
const aiFeedback = require('../../server/services/aiFeedbackService');
const personalization = require('../../server/services/personalizationService');
const UserStyleProfile = require('../../server/models/UserStyleProfile');
const SuggestionFeedback = require('../../server/models/SuggestionFeedback');

const scoreOf = (prof, facet, key) => (prof[facet].find((e) => e.key === key) || {}).performanceScore;

describe('aiFeedbackService — closes the loop + learns from mistakes', () => {
  let userId;
  beforeEach(() => { userId = new mongoose.Types.ObjectId(); personalization.invalidatePersona(String(userId)); });
  afterEach(async () => {
    await UserStyleProfile.deleteMany({});
    await SuggestionFeedback.deleteMany({});
  });

  it('positive feedback records the pick AND upweights the trait', async () => {
    const r = await aiFeedback.recordFeedback({ userId, itemType: 'hook', action: 'accept', value: 'curiosity-gap' });
    expect(r.ok).toBe(true);
    const prof = await UserStyleProfile.findOne({ userId }).lean();
    expect(prof.hookStyles.some((h) => h.key === 'curiosity-gap')).toBe(true);
    expect(scoreOf(prof, 'weightedHooks', 'curiosity-gap')).toBeGreaterThan(0);
  });

  it('reject downweights (de-ranks) the trait', async () => {
    await aiFeedback.recordFeedback({ userId, itemType: 'hook', action: 'accept', value: 'fear-bait' });
    const before = scoreOf(await UserStyleProfile.findOne({ userId }).lean(), 'weightedHooks', 'fear-bait');
    await aiFeedback.recordFeedback({ userId, itemType: 'hook', action: 'reject', value: 'fear-bait' });
    const after = scoreOf(await UserStyleProfile.findOne({ userId }).lean(), 'weightedHooks', 'fear-bait');
    expect(after).toBeLessThan(before);
  });

  it('a tagged mistake adds an AVOID line to the NEXT personalized prompt', async () => {
    await aiFeedback.recordFeedback({ userId, itemType: 'caption', action: 'reject', value: 'hormozi-bold', reason: 'too aggressive' });
    const prompt = await personalization.buildPersonalizedSystemPrompt({ userId, niche: 'finance', platform: 'tiktok' });
    expect(prompt).toMatch(/AVOID/i);
    expect(prompt).toMatch(/too aggressive/i);
  });

  it('rejects an invalid action; a SMALL edit is not a mistake, a BIG edit is', async () => {
    expect((await aiFeedback.recordFeedback({ userId, action: 'nonsense' })).ok).toBe(false);
    await aiFeedback.recordFeedback({ userId, itemType: 'caption', action: 'edit', value: 'minimal-white', magnitude: 0.05 });
    expect(await SuggestionFeedback.countDocuments({ userId, signal: 'negative' })).toBe(0);
    await aiFeedback.recordFeedback({ userId, itemType: 'caption', action: 'edit', value: 'minimal-white', magnitude: 0.8 });
    expect(await SuggestionFeedback.countDocuments({ userId, signal: 'negative' })).toBe(1);
  });

  it('is per-user isolated — A\'s feedback never touches B\'s profile', async () => {
    const userB = new mongoose.Types.ObjectId();
    await aiFeedback.recordFeedback({ userId, itemType: 'hook', action: 'accept', value: 'curiosity-gap' });
    expect(await UserStyleProfile.findOne({ userId: userB })).toBeNull();
  });
});
