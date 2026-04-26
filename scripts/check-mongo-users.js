const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../server/models/User');

async function checkMongoUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const users = await User.find({}).limit(10);
    if (users.length === 0) {
      console.log('❌ No users found in MongoDB');
    } else {
      console.log(`✅ Found ${users.length} users:`);
      users.forEach((u, i) => {
        console.log(`${i + 1}. ${u.email} (Role: ${u.role})`);
      });
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMongoUsers();
