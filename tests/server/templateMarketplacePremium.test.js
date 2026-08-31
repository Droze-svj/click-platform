// A premium template must not be handed out for free.
//
// Any user can publish a template with { isPremium: true, price: N }, and
// downloadTemplate() carried this instead of a check:
//
//     if (template.isPremium && template.price > 0) {
//       // In production, check payment/subscription
//       // For now, allow download
//     }
//
// so every paid template was free to every other user while still being
// presented as paid. There is no purchase flow anywhere in the codebase — no
// checkout, no entitlement record — so the honest resolution is to refuse
// rather than to give away content the platform advertised as costing money.
// Nobody loses access they were entitled to, and the author keeps their own.
//
// Behavioural, not a source grep: what matters is that the download does not
// happen, not how the guard is spelled.

const mongoose = require('mongoose');
const Template = require('../../server/models/Template');
const { downloadTemplate } = require('../../server/services/templateMarketplaceService');

const authorId = new mongoose.Types.ObjectId();
const otherUserId = new mongoose.Types.ObjectId();

const makeTemplate = (overrides = {}) =>
  Template.create({
    userId: authorId,
    name: 'Test template',
    description: 'For the premium gate test',
    category: 'color-grading',
    type: 'color-grading',
    settings: { contrast: 1 },
    isPublic: true,
    downloads: 0,
    ...overrides,
  });

describe('premium templates are not given away', () => {
  afterEach(async () => {
    await Template.deleteMany({ userId: { $in: [authorId, otherUserId] } });
  });

  it('refuses a priced template to someone who is not the author', async () => {
    const template = await makeTemplate({ isPremium: true, price: 25 });

    await expect(downloadTemplate(template._id.toString(), otherUserId.toString()))
      .rejects.toMatchObject({ statusCode: 402 });

    // And the refusal must be real: no download credited.
    const after = await Template.findById(template._id).lean();
    expect(after.downloads).toBe(0);
  });

  it('still lets the author download their own premium template', async () => {
    const template = await makeTemplate({ isPremium: true, price: 25 });

    await expect(downloadTemplate(template._id.toString(), authorId.toString()))
      .resolves.toBeDefined();

    const after = await Template.findById(template._id).lean();
    expect(after.downloads).toBe(1);
  });

  it('leaves free templates alone', async () => {
    // isPremium with price 0 is not a sale, and must not be gated.
    const free = await makeTemplate({ isPremium: true, price: 0 });

    await expect(downloadTemplate(free._id.toString(), otherUserId.toString()))
      .resolves.toBeDefined();

    const plain = await makeTemplate({ isPremium: false, price: 0 });
    await expect(downloadTemplate(plain._id.toString(), otherUserId.toString()))
      .resolves.toBeDefined();
  });
});
