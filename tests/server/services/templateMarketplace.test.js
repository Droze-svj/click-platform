// Template marketplace: publish / unpublish / stats / trending (previously 501 stubs).

const mongoose = require('mongoose');
require('../../../server/models/User'); // register User so getTrendingTemplates' populate('userId') resolves
const Template = require('../../../server/models/Template');
const {
  publishToMarketplace,
  unpublishFromMarketplace,
  getTemplateStats,
  getTrendingTemplates,
} = require('../../../server/services/templateMarketplaceService');

const userA = new mongoose.Types.ObjectId();
const userB = new mongoose.Types.ObjectId();

function makeTemplate(overrides = {}) {
  return Template.create({
    userId: userA, name: 'T', category: 'color-grading', type: 'color-grading', settings: { preset: 'x' }, ...overrides,
  });
}

describe('templateMarketplace publish/unpublish/stats/trending', () => {
  afterEach(async () => { await Template.deleteMany({}); });

  it('publishes an owned template (isPublic → true)', async () => {
    const t = await makeTemplate();
    const out = await publishToMarketplace(t._id, userA);
    expect(out.isPublic).toBe(true);
    expect((await Template.findById(t._id).lean()).isPublic).toBe(true);
  });

  it('refuses to publish another user\'s template (403)', async () => {
    const t = await makeTemplate();
    await expect(publishToMarketplace(t._id, userB)).rejects.toMatchObject({ statusCode: 403 });
    expect((await Template.findById(t._id).lean()).isPublic).toBe(false); // untouched
  });

  it('404 when the template does not exist', async () => {
    await expect(publishToMarketplace(new mongoose.Types.ObjectId(), userA))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('unpublishes an owned template (isPublic → false)', async () => {
    const t = await makeTemplate({ isPublic: true });
    const out = await unpublishFromMarketplace(t._id, userA);
    expect(out.isPublic).toBe(false);
  });

  it('returns engagement stats', async () => {
    const t = await makeTemplate({
      isPublic: true, downloads: 5, views: 20, rating: 4.5, reviews: [{ userId: userB, rating: 5 }],
    });
    const stats = await getTemplateStats(t._id);
    expect(stats).toMatchObject({
      isPublic: true, downloads: 5, views: 20, rating: 4.5, reviewCount: 1,
    });
    expect(stats.templateId).toBe(String(t._id));
  });

  it('trending returns only PUBLIC templates, sorted by downloads desc', async () => {
    await makeTemplate({ isPublic: true, downloads: 3 });
    await makeTemplate({ isPublic: true, downloads: 10 });
    await makeTemplate({ isPublic: false, downloads: 99 }); // private → excluded
    const trending = await getTrendingTemplates(50);
    expect(trending).toHaveLength(2);
    expect(trending.map((x) => x.downloads)).toEqual([10, 3]);
  });

  it('trending clamps the limit to 1..50', async () => {
    for (let i = 0; i < 3; i += 1) await makeTemplate({ isPublic: true, downloads: i });
    expect(await getTrendingTemplates(1)).toHaveLength(1);
    expect((await getTrendingTemplates(9999)).length).toBeLessThanOrEqual(50);
  });
});
