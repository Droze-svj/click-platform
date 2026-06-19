const mongoose = require('mongoose');
const { loadAgencyTierContext } = require('../../../server/services/agencyPlanContext');
const { evaluateTierLimit } = require('../../../server/middleware/tierEnforcement');
const Workspace = require('../../../server/models/Workspace');
const AgencyScalePlan = require('../../../server/models/AgencyScalePlan');
const ClientOnboarding = require('../../../server/models/ClientOnboarding');

function makePlan(clientsIncluded, overageRate = 0) {
  return AgencyScalePlan.create({
    name: 'Test Scale', slug: `test-scale-${clientsIncluded}-${overageRate}`,
    pricing: { monthly: { amount: 100 }, yearly: { amount: 1000 } },
    bundle: {
      clients: { included: clientsIncluded, overageRate },
      profiles: { included: 50 },
      aiMinutes: { included: 1000 },
    },
  });
}

afterEach(async () => {
  await Promise.all([Workspace.deleteMany({}), AgencyScalePlan.deleteMany({}), ClientOnboarding.deleteMany({})]);
});

describe('loadAgencyTierContext → evaluateTierLimit (real wiring)', () => {
  it('treats the action as UNLIMITED when the workspace has no plan assigned (safe default)', async () => {
    const ws = await Workspace.create({ name: 'Agency', type: 'agency', userId: new mongoose.Types.ObjectId(), ownerId: new mongoose.Types.ObjectId() });
    const ctx = await loadAgencyTierContext('add_client')({ params: { agencyWorkspaceId: ws._id } });
    expect(ctx.plan).toBeNull();
    expect(evaluateTierLimit('add_client', ctx.plan, ctx.used)).toMatchObject({ allowed: true, unlimited: true });
  });

  it('counts real client usage and ALLOWS under the limit', async () => {
    const plan = await makePlan(5);
    const ws = await Workspace.create({ name: 'Agency', type: 'agency', userId: new mongoose.Types.ObjectId(), ownerId: new mongoose.Types.ObjectId(), settings: { scalePlanId: plan._id } });
    await ClientOnboarding.create([
      { agencyWorkspaceId: ws._id, clientWorkspaceId: new mongoose.Types.ObjectId() },
      { agencyWorkspaceId: ws._id, clientWorkspaceId: new mongoose.Types.ObjectId() },
    ]);
    const ctx = await loadAgencyTierContext('add_client')({ params: { agencyWorkspaceId: ws._id } });
    expect(ctx.used).toBe(2);
    const verdict = evaluateTierLimit('add_client', ctx.plan, ctx.used);
    expect(verdict.allowed).toBe(true);
    expect(verdict.remaining).toBe(3);
  });

  it('BLOCKS (402-bound) when at the limit with no overage', async () => {
    const plan = await makePlan(2, 0);
    const ws = await Workspace.create({ name: 'Agency', type: 'agency', userId: new mongoose.Types.ObjectId(), ownerId: new mongoose.Types.ObjectId(), settings: { scalePlanId: plan._id } });
    await ClientOnboarding.create([
      { agencyWorkspaceId: ws._id, clientWorkspaceId: new mongoose.Types.ObjectId() },
      { agencyWorkspaceId: ws._id, clientWorkspaceId: new mongoose.Types.ObjectId() },
    ]);
    const ctx = await loadAgencyTierContext('add_client')({ params: { agencyWorkspaceId: ws._id } });
    expect(ctx.used).toBe(2);
    const verdict = evaluateTierLimit('add_client', ctx.plan, ctx.used);
    expect(verdict.allowed).toBe(false);
    expect(verdict.upgrade).toBeDefined();
  });

  it('allows with overage flag when at the limit but overageRate>0', async () => {
    const plan = await makePlan(2, 15);
    const ws = await Workspace.create({ name: 'Agency', type: 'agency', userId: new mongoose.Types.ObjectId(), ownerId: new mongoose.Types.ObjectId(), settings: { scalePlanId: plan._id } });
    await ClientOnboarding.create([
      { agencyWorkspaceId: ws._id, clientWorkspaceId: new mongoose.Types.ObjectId() },
      { agencyWorkspaceId: ws._id, clientWorkspaceId: new mongoose.Types.ObjectId() },
    ]);
    const ctx = await loadAgencyTierContext('add_client')({ params: { agencyWorkspaceId: ws._id } });
    const verdict = evaluateTierLimit('add_client', ctx.plan, ctx.used);
    expect(verdict).toMatchObject({ allowed: true, overage: true });
  });

  it('resolves the agency id from the body when not in params', async () => {
    const ctx = await loadAgencyTierContext('add_client')({ body: { agencyWorkspaceId: new mongoose.Types.ObjectId() } });
    expect(ctx.plan).toBeNull(); // no workspace → unlimited, no throw
  });
});
