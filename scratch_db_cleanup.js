const mongoose = require('mongoose');

async function cleanup() {
  await mongoose.connect('mongodb+srv://clickadmin:gclClVAgVpxxkDNR@click-cluster.wgq1ffr.mongodb.net/click_v3?appName=Click-Cluster');
  console.log('Connected to MongoDB');
  
  const adminDb = mongoose.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  
  for (const dbInfo of dbs.databases) {
    if (dbInfo.name !== 'click_v3' && dbInfo.name !== 'admin' && dbInfo.name !== 'local') {
      console.log(`Dropping DB: ${dbInfo.name}`);
      try {
        const tempDb = mongoose.connection.client.db(dbInfo.name);
        await tempDb.dropDatabase();
      } catch (e) {
        console.error(`Failed to drop DB ${dbInfo.name}:`, e.message);
      }
    }
  }
  
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const junkCols = collections.filter(c => c.name.includes('test') || c.name.includes('bak'));
  console.log(`Found ${junkCols.length} junk collections in click_v3. Dropping...`);
  
  for (const coll of junkCols) {
    console.log(`Dropping collection: ${coll.name}`);
    await db.collection(coll.name).drop();
  }
  
  console.log('Cleanup done.');
  process.exit(0);
}
cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
