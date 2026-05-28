const mongoose = require('mongoose');
require('dotenv').config();
async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MONGODB_URI:', process.env.MONGODB_URI.split('@')[1]);
  const User = require('./server/models/User');
  const count = await User.countDocuments();
  const sarah = await User.findOne({ email: 'sarah@click.test' });
  console.log(`Users count: ${count}`);
  console.log('Sarah:', sarah ? sarah.email : 'Not found');
  process.exit(0);
}
check();
