// The editor's 7-day calendar showed only day names: each weeklyPlan day had
// no slot time, and the ideas were generated for twitter/linkedin/instagram
// whatever platform was being planned. Each day now carries its time, the
// idea text, and ideas pinned to the requested platform.

const mongoose = require('mongoose');
const contentHealth = require('../../../server/services/contentHealthService');
const { getNextWeekRecommendations } = require('../../../server/services/competitiveBenchmarkingService');

describe('getNextWeekRecommendations weeklyPlan', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gives every day its idea and posting time, for the requested platform', async () => {
    jest.spyOn(contentHealth, 'performContentHealthCheck').mockResolvedValue({ gaps: [] });
    const suggest = jest.spyOn(contentHealth, 'getFutureContentSuggestions').mockResolvedValue([
      { title: 'Day one hook', idea: 'Open on the result', platform: 'tiktok' },
      { title: 'Myth bust', idea: 'Three myths in 30s', platform: 'tiktok' },
    ]);

    const out = await getNextWeekRecommendations(String(new mongoose.Types.ObjectId()), 'tiktok');

    expect(suggest).toHaveBeenCalledWith(expect.anything(), [], 7, { platforms: ['tiktok'] });
    expect(out.weeklyPlan).toHaveLength(2);
    expect(out.weeklyPlan[0]).toMatchObject({
      day: 'Monday', time: '18:00',
      content: { title: 'Day one hook', idea: 'Open on the result', platforms: ['tiktok'] },
    });
    expect(out.weeklyPlan[1]).toMatchObject({ day: 'Tuesday', time: '21:00' });
  });
});
