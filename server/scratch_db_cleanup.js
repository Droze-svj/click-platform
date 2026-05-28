const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collections.`);
  
  const junkCollections = collections.filter(c => c.name.startsWith('cache_') || c.name.startsWith('temp_') || c.name.match(/^[0-9a-f]{24}$/));
  
  console.log(`Found ${junkCollections.length} junk collections.`);
  
  for (const coll of junkCollections.slice(0, 50)) { // Delete up to 50 to free up space
    console.log(`Dropping ${coll.name}`);
    await db.collection(coll.name).drop();
  }
  
  console.log('Cleanup done. Dropped', Math.min(junkCollections.length, 50), 'collections.');
  process.exit(0);
}
cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
