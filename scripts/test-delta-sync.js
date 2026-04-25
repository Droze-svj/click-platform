const mongoose = require('mongoose');
const Content = require('../server/models/Content');
const ContentTranslation = require('../server/models/ContentTranslation');
const SyncEngine = require('../server/services/SyncEngine');
require('dotenv').config();

async function runTest() {
  console.log('Starting test...');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click';
  console.log('Connecting to:', uri);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
    // 1. Create Source Content
    const content = await Content.create({
      userId: 'test-user',
      type: 'article',
      title: 'Original Title',
      description: 'Original Description',
      transcript: 'This is the original transcript.',
      syncVersion: 1
    });
    console.log('✅ Created content:', content._id);

    // 2. Create Initial Translation
    const translation = await ContentTranslation.create({
      contentId: content._id,
      userId: 'test-user',
      language: 'ES',
      title: 'Título Original',
      metadata: {
        sourceVersion: 1,
        sourceHash: SyncEngine.generateHash(content)
      },
      segments: [
        { startTime: 0, endTime: 5, originalText: 'Original transcript', translatedText: 'Transcripción original', status: 'synced' }
      ],
      syncStatus: 'current'
    });
    console.log('✅ Created translation:', translation._id);

    // 3. Modify Content
    content.title = 'Modified Title';
    content.syncVersion = 2;
    await content.save();
    console.log('🔄 Modified content to version 2');

    // 4. Run Sync Check
    console.log('🔍 Running Sync Check...');
    await SyncEngine.syncContent(content._id);

    // 5. Verify status
    const updatedTranslation = await ContentTranslation.findById(translation._id);
    console.log('📊 Sync Status after modification:', updatedTranslation.syncStatus);
    if (updatedTranslation.syncStatus === 'outdated') {
      console.log('✅ Success: Translation marked as outdated');
    } else {
      console.log('❌ Failure: Translation status not updated');
    }

    // 6. Trigger Delta Update
    console.log('🚀 Triggering Delta Translation Simulation...');
    await SyncEngine.triggerDeltaTranslation(translation._id);
    
    const finalTranslation = await ContentTranslation.findById(translation._id);
    console.log('📊 Sync Status after delta update:', finalTranslation.syncStatus);
    console.log('📊 Source Version in translation:', finalTranslation.metadata.sourceVersion);

    if (finalTranslation.syncStatus === 'current') {
      console.log('✅ Success: Delta synchronization complete');
    }

  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    // Cleanup
    await Content.deleteMany({ userId: 'test-user' });
    await ContentTranslation.deleteMany({ userId: 'test-user' });
    await mongoose.disconnect();
  }
}

runTest();
