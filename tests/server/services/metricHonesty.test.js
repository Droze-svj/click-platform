// These services used to return invented numbers as if they were measurements.
// This file pins the replacements: a real computation where data exists, and an
// explicit "unavailable" where it doesn't — never a fabricated constant.

const brandAwareness = require('../../../server/services/brandAwarenessService');
const competitive = require('../../../server/services/competitiveBenchmarkingService');
const sceneWorkflow = require('../../../server/services/sceneWorkflowService');

describe('share of voice', () => {
  it('reports unavailable instead of the old fixed total:15 / growth:5', async () => {
    // No posts in range: the point is the SHAPE, not the counts.
    const res = await brandAwareness.calculateShareOfVoice(
      '000000000000000000000001', 'twitter', new Date(Date.now() - 86400000), new Date()
    );

    expect(res.available).toBe(false);
    expect(res.total).toBeNull();
    expect(res.growth).toBeNull();
    // brandedMentions was `posts.length * 2` — a doubled post count presented as
    // a mention count.
    expect(res.brandedMentions).toBeNull();
    expect(res.unavailableReason).toMatch(/social-listening/i);
    // What IS measurable stays a real number.
    expect(typeof res.hashtagMentions).toBe('number');
    expect(typeof res.postsPublished).toBe('number');
  });
});

describe('competitor benchmarking', () => {
  it('exposes competitors as unavailable and a real self-comparison', async () => {
    const benchmark = await competitive.getCompetitiveBenchmarks(
      '000000000000000000000001', 'twitter', '30days'
    );

    // The old shape asserted competitors averaged 250 engagement / 5000 reach.
    expect(benchmark.competitors.available).toBe(false);
    expect(benchmark.competitors.avgEngagement).toBeNull();
    expect(benchmark.competitors.avgReach).toBeNull();

    // Industry figures are static reference values, and say so.
    expect(benchmark.industry.source).toBe('static_reference');

    // previousPeriod is measured from the account's own posts.
    expect(benchmark.previousPeriod).toBeDefined();
    expect(typeof benchmark.previousPeriod.postCount).toBe('number');
  });
});

describe('scene retention', () => {
  const scenes = [
    { sceneIndex: 0, start: 0, end: 10, duration: 10, metadata: {} },
    { sceneIndex: 1, start: 10, end: 20, duration: 10, metadata: {} },
  ];

  it('computes per-scene view rate and drop-off from a real retention curve', () => {
    // 100% at t=0 falling to 40% by t=20.
    const videoMetrics = {
      retention: {
        curve: [
          { second: 0, percentage: 100 }, { second: 5, percentage: 90 }, { second: 10, percentage: 80 },
          { second: 15, percentage: 60 }, { second: 20, percentage: 40 },
        ],
      },
    };

    const first = sceneWorkflow.sceneRetention(videoMetrics, scenes[0]);
    const second = sceneWorkflow.sceneRetention(videoMetrics, scenes[1]);

    expect(first.retentionStart).toBe(100);
    expect(first.retentionEnd).toBe(80);
    expect(first.dropOff).toBe(20);
    // mean of 100, 90, 80 = 90 → 0.9
    expect(first.viewRate).toBeCloseTo(0.9, 3);

    // The second scene loses more of the audience — the actionable signal.
    expect(second.dropOff).toBe(40);
    expect(second.dropOff).toBeGreaterThan(first.dropOff);
  });

  it('returns null (not a random number) when no curve has been ingested', () => {
    expect(sceneWorkflow.sceneRetention(null, scenes[0])).toBeNull();
    expect(sceneWorkflow.sceneRetention({ retention: { curve: [] } }, scenes[0])).toBeNull();
  });

  it('is deterministic — the old implementation used Math.random()', () => {
    const videoMetrics = { retention: { curve: [{ second: 0, percentage: 100 }, { second: 10, percentage: 50 }] } };
    const a = sceneWorkflow.sceneRetention(videoMetrics, scenes[0]);
    const b = sceneWorkflow.sceneRetention(videoMetrics, scenes[0]);
    expect(a).toEqual(b);
  });
});
