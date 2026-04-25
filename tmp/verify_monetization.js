/**
 * Scratch script to verify Monetization Plan persistence and editing
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const monetizationService = require('../server/services/monetizationService');
const User = require('../server/models/User');
const Content = require('../server/models/Content');
const MonetizationPlan = require('../server/models/MonetizationPlan');

async function verifyMonetizationPersistence() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/click-platform');
    
    // 1. Find or create a test user
    let user = await User.findOne({ email: 'monetization_test@example.com' });
    if (!user) {
      user = new User({ email: 'monetization_test@example.com', password: 'password', name: 'Monetization Tester' });
      await user.save();
    }

    // 2. Find or create a test content
    let content = await Content.findOne({ title: 'Monetization Test Video' });
    if (!content) {
      content = new Content({
        userId: user._id,
        title: 'Monetization Test Video',
        type: 'video',
        status: 'completed'
      });
      await content.save();
    }

    // 3. Generate and persist plan
    console.log('Generating plan...');
    const transcript = 'This video is about AI and results. You should join our course today to get results fast.';
    const plan = await monetizationService.generateAndPersistPlan(user._id, content._id, transcript, { provider: 'whop' });
    
    console.log('Plan created with ID:', plan._id);
    console.log('Number of triggers:', plan.triggers.length);

    // 4. Edit a trigger
    console.log('Updating trigger...');
    const updatedTriggers = [...plan.triggers];
    if (updatedTriggers.length > 0) {
      updatedTriggers[0].reason = 'Manually edited reason';
      updatedTriggers[0].duration = 15;
    }
    
    const updatedPlan = await monetizationService.updateMonetizationPlan(user._id, plan._id, { triggers: updatedTriggers });
    console.log('Plan updated successfully');
    console.log('New reason:', updatedPlan.triggers[0].reason);

    // 5. Verify persistence
    const fetchedPlan = await MonetizationPlan.findById(plan._id);
    const isPersistent = fetchedPlan.triggers[0].reason === 'Manually edited reason';
    
    console.log('\nPersistence Check:', isPersistent ? '✅ SUCCESS' : '❌ FAILED');

    // Cleanup (optional)
    // await MonetizationPlan.deleteOne({ _id: plan._id });
    // await Content.deleteOne({ _id: content._id });
    
    process.exit(isPersistent ? 0 : 1);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verifyMonetizationPersistence();
