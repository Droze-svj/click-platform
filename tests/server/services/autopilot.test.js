const {
  buildAutopilotPlan, createAutopilotPlan, approveAutopilotPlan,
} = require('../../../server/services/autopilotPlanService');
const SocialConnection = require('../../../server/models/SocialConnection');
const ScheduledPost = require('../../../server/models/ScheduledPost');

const BASE = new Date('2026-06-20T00:00:00Z').getTime();

describe('buildAutopilotPlan (pure)', () => {
  it('schedules each item on each platform, staggered, pending_approval by default', () => {
    const items = [{ contentId: 'c1', hook: 'h1' }, { contentId: 'c2', hook: 'h2' }];
    const plan = buildAutopilotPlan(items, { platforms: ['tiktok', 'youtube'], baseTime: BASE });
    expect(plan).toHaveLength(4); // 2 items × 2 platforms
    for (const p of plan) {
      expect(p.status).toBe('pending_approval');
      expect(new Date(p.scheduledTime).getTime()).toBeGreaterThan(BASE);
      expect(['tiktok', 'youtube']).toContain(p.platform);
    }
    const tt = plan.filter((p) => p.platform === 'tiktok').sort((a, b) => a.slot - b.slot);
    expect(new Date(tt[1].scheduledTime).getTime()).toBeGreaterThan(new Date(tt[0].scheduledTime).getTime());
  });

  it('full_auto status passes through; hookByPlatform customizes', () => {
    const plan = buildAutopilotPlan([{ contentId: 'c1' }], {
      platforms: ['tiktok', 'linkedin'], baseTime: BASE, status: 'scheduled',
      hookByPlatform: (_i, platform) => `${platform}-hook`,
    });
    expect(plan.every((p) => p.status === 'scheduled')).toBe(true);
    expect(plan.find((p) => p.platform === 'linkedin').hook).toBe('linkedin-hook');
  });

  it('handles empty items/platforms safely', () => {
    expect(buildAutopilotPlan([], { platforms: ['tiktok'], baseTime: BASE })).toEqual([]);
    expect(buildAutopilotPlan([{ contentId: 'c1' }], { platforms: [], baseTime: BASE })).toEqual([]);
  });
});

describe('autopilot human-approve gate (E2E)', () => {
  const userId = '6a3500000000000000000aaa';
  const conn = () => new SocialConnection({
    userId, platform: 'tiktok', platformUserId: 'tt-123', accessToken: 'x', isActive: true,
  }).save();

  afterEach(async () => {
    await ScheduledPost.deleteMany({});
    await SocialConnection.deleteMany({});
  });

  it('drafts pending_approval (NOT scheduled) until approved', async () => {
    await conn();
    const plan = await createAutopilotPlan(userId, { items: [{ contentId: 'c1', hook: 'h' }], autonomyMode: 'human_approve' });
    expect(plan.planId).toBeTruthy();

    const drafted = await ScheduledPost.find({ autopilotPlanId: plan.planId });
    expect(drafted.length).toBeGreaterThan(0);
    expect(drafted.every((p) => p.status === 'pending_approval')).toBe(true);
    // The scheduler cron only fires `scheduled` — so NOTHING would publish yet.
    expect(await ScheduledPost.countDocuments({ autopilotPlanId: plan.planId, status: 'scheduled' })).toBe(0);

    await approveAutopilotPlan(userId, plan.planId);
    expect(await ScheduledPost.countDocuments({ autopilotPlanId: plan.planId, status: 'scheduled' })).toBe(drafted.length);
  });

  it('full_auto opt-in schedules immediately', async () => {
    await conn();
    const plan = await createAutopilotPlan(userId, { items: [{ contentId: 'c1' }], autonomyMode: 'full_auto' });
    expect(await ScheduledPost.countDocuments({ autopilotPlanId: plan.planId, status: 'scheduled' })).toBeGreaterThan(0);
  });

  it('no connected platforms → empty plan (never invents a connection)', async () => {
    const plan = await createAutopilotPlan(userId, { items: [{ contentId: 'c1' }] });
    expect(plan.posts).toEqual([]);
    expect(plan.planId).toBeNull();
  });
});
