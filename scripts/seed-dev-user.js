/**
 * Seed Developer User
 * Ensures the mock developer ObjectId exists in the local database.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.production') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sovereign';
const DEV_USER_ID = '000000000000000000000001';

async function seed() {
  try {
    console.log('🌱 Seeding mock developer user...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    const User = require('../server/models/User');
    
    // Check if user exists
    let user = await User.findById(DEV_USER_ID);
    
    if (user) {
      console.log('✅ Developer user already exists.');
    } else {
      user = new User({
        _id: new mongoose.Types.ObjectId(DEV_USER_ID),
        name: 'Developer Admin',
        username: 'dev-admin',
        email: 'admin@click.yourdomain.com',
        password: 'password123', // Dummy password for mock dev
        role: 'admin',
        status: 'active',
        oauth: {
          twitter: { connected: false },
          tiktok: { connected: false },
          youtube: { connected: false },
          facebook: { connected: false },
          instagram: { connected: false },
          linkedin: { connected: false }
        }
      });
      
      await user.save();
      console.log('✅ Developer user seeded successfully.');
    }
    
    await mongoose.disconnect();
    console.log('🏁 Seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seed();
