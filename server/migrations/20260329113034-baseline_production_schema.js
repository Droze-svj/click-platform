module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    // Baseline index pass for production schema v1.
    // Ensures the indexes defined in the Mongoose models are actually present
    // on the Atlas cluster after the initial deploy.
    await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: false });
    await db.collection('users').createIndex({ whopUserId: 1 }, { unique: true, sparse: true });
    await db.collection('scheduledposts').createIndex({ userId: 1, status: 1, scheduledTime: 1 });
    await db.collection('contents').createIndex({ userId: 1, type: 1, createdAt: -1 });
    await db.collection('exportjobs').createIndex({ userId: 1, createdAt: -1 });
  },

  async down(db) {
    await db.collection('users').dropIndex({ email: 1 });
    await db.collection('scheduledposts').dropIndex({ userId: 1, status: 1, scheduledTime: 1 });
    await db.collection('contents').dropIndex({ userId: 1, type: 1, createdAt: -1 });
    await db.collection('exportjobs').dropIndex({ userId: 1, createdAt: -1 });
  }
};
