/**
 * backupService.restoreFromBackup — content that went through the pipeline.
 *
 * Backups export Content with .lean(), so `pipeline` comes back with its Maps as
 * plain objects. Restoring it with Content.create({ ...item }) made Mongoose 8
 * throw an uncaught TypeError ("val.keys is not a function") during validation —
 * outside the per-item try/catch, so the restore request never finished. The item
 * is now created without `pipeline`, which is then stored as an update.
 * Runs against the in-memory MongoDB from tests/setup.js.
 */

const mongoose = require('mongoose');
const Content = require('../../server/models/Content');
const { restoreFromBackup } = require('../../server/services/backupService');

describe('restoreFromBackup with pipeline content', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const contentId = new mongoose.Types.ObjectId();

  afterAll(async () => {
    await Content.deleteMany({ _id: contentId });
  });

  it('restores the item and its pipeline assets', async () => {
    const backupData = {
      data: {
        content: [{
          _id: contentId,
          userId,
          type: 'article',
          title: 'Backed-up post',
          status: 'completed',
          pipeline: {
            status: 'completed',
            assets: { twitter: [{ type: 'post', content: 'Tweet from backup', hashtags: ['#saved'] }] },
            performance: { twitter: [{ predictedEngagement: 12, predictedReach: 300 }] },
          },
        }],
      },
    };

    const results = await restoreFromBackup(userId, backupData, {
      restorePosts: false, restoreScripts: false, restoreSettings: false,
    });

    expect(results.errors).toEqual([]);
    expect(results.restored.content).toBe(1);
    const restored = await Content.findById(contentId);
    expect(restored.title).toBe('Backed-up post');
    expect(restored.pipeline.assets.get('twitter')[0].content).toBe('Tweet from backup');
    expect(restored.pipeline.performance.get('twitter')[0].predictedReach).toBe(300);
  });
});
