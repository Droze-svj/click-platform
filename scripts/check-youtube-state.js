#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');

const USER_ID = '6952cd3722d6abc5509a9efd';

async function checkState() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click';
    await mongoose.connect(mongoUri);
    
    const User = require('../server/models/User');
    const user = await User.findById(USER_ID);
    
    console.log('Current user OAuth state:');
    console.log(JSON.stringify(user?.oauth?.youtube || {}, null, 2));
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkState();

