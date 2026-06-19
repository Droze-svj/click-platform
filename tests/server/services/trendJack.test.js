const { buildTrendRepurposePlan } = require('../../../server/services/trendJackService');

const TRENDS = {
  platform: 'tiktok',
  hashtags: [
    { label: '#morningroutine', kind: 'hashtag', score: 90, velocity: 40, whyNow: 'spiking this week' },
    { label: '#lowscore', kind: 'hashtag', score: 10, velocity: 0 },
  ],
  topics: [{ label: 'productivity hacks', kind: 'topic', score: 70, velocity: 80 }],
  sounds: [{ label: 'Aesthetic Lo-Fi', kind: 'sound', score: 60, velocity: 10 }],
};

const CONTENT = [
  { _id: 'c1', title: 'My 5am routine', hashtags: ['#vlog', '#daily'] },
  { _id: 'c2', title: 'Deep work tips' },
];

describe('buildTrendRepurposePlan (pure)', () => {
  it('ranks trends by score+velocity and pairs each with recent content', () => {
    const plan = buildTrendRepurposePlan(CONTENT, TRENDS, { maxSuggestions: 3 });
    expect(plan.platform).toBe('tiktok');
    expect(plan.suggestions).toHaveLength(3);
    // productivity hacks: 0.6*70 + 0.4*80 = 74 ; morningroutine: 0.6*90+0.4*40=70
    expect(plan.suggestions[0].trend).toBe('productivity hacks');
    expect(plan.suggestions[0].relevanceScore).toBeCloseTo(74, 1);
    expect(plan.suggestions[1].trend).toBe('#morningroutine');
  });

  it('merges the trend hashtag with the source content hashtags (deduped)', () => {
    const plan = buildTrendRepurposePlan(CONTENT, TRENDS, { maxSuggestions: 2 });
    const morning = plan.suggestions.find((s) => s.trend === '#morningroutine');
    expect(morning.suggestedHashtags).toContain('#morningroutine');
    // paired source rotates: suggestion index 1 → CONTENT[1] (no hashtags)
    expect(morning.suggestedHashtags[0]).toBe('#morningroutine');
    expect(morning.suggestedCaption).toMatch(/morningroutine/i);
  });

  it('derives a hashtag from a non-hashtag trend label', () => {
    const plan = buildTrendRepurposePlan(CONTENT, TRENDS, { maxSuggestions: 1 });
    // top is "productivity hacks" (topic) → #productivityhacks
    expect(plan.suggestions[0].suggestedHashtags).toContain('#productivityhacks');
  });

  it('returns no_trends / no_content reasons instead of throwing', () => {
    expect(buildTrendRepurposePlan(CONTENT, { platform: 'tiktok' })).toMatchObject({ total: 0, reason: 'no_trends' });
    expect(buildTrendRepurposePlan([], TRENDS)).toMatchObject({ total: 0, reason: 'no_content' });
  });

  it('is safe on undefined input', () => {
    expect(buildTrendRepurposePlan()).toMatchObject({ suggestions: [], total: 0 });
  });
});
