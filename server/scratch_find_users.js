const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function findUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const users = await db.collection('users').find({}).limit(5).toArray();
  console.log('Users found:', users.map(u => u.email));
  process.exit(0);
}
findUsers().catch(console.error);
