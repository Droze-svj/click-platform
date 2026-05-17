module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    // V3 data model additions: niche default, oauth sub-documents, usage counters.
    await db.collection('users').updateMany(
      { niche: { $exists: false } },
      { $set: { niche: 'other' } }
    );
    await db.collection('users').updateMany(
      { 'usage.postsScheduled': { $exists: false } },
      { $set: { 'usage.postsScheduled': 0, 'usage.videosProcessed': 0, 'usage.contentGenerated': 0 } }
    );
    await db.collection('scheduledposts').createIndex(
      { userId: 1, platform: 1, 'holdUntil': 1 },
      { sparse: true }
    );
  },

  async down(db) {
    await db.collection('users').updateMany(
      {},
      { $unset: { niche: '', 'usage.postsScheduled': '', 'usage.videosProcessed': '', 'usage.contentGenerated': '' } }
    );
    await db.collection('scheduledposts').dropIndex({ userId: 1, platform: 1, holdUntil: 1 });
  }
};
