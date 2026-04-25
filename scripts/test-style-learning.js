const mongoose = require('mongoose');
const styleLearningService = require('../server/services/styleLearningService');
const aiVideoAnalysisService = require('../server/services/aiVideoAnalysisService');
const UserPreferences = require('../server/models/UserPreferences');
const logger = require('../server/utils/logger');

// Mock data
const MOCK_USER_ID = new mongoose.Types.ObjectId().toString();

async function simulateLearningCycle() {
  console.log('--- Phase 1: Initial Suggestion (Static Default) ---');
  // Analysis results without a fingerprint
  const mockAnalysis = { technical: { duration: 60 }, content: { mood: 'professional' } };
  let suggestions = await aiVideoAnalysisService.generateEditingSuggestions('mock.mp4', mockAnalysis, { userId: MOCK_USER_ID });
  
  const initialTransition = suggestions.find(s => s.type === 'transition').transitionType;
  console.log(`Initial AI Suggestion (Professional): ${initialTransition}`); // Expected: 'fade'

  console.log('\n--- Phase 2: User Manual Edits (3 cycles of WipeLeft) ---');
  const manualEditState = {
    transitions: [
      { type: 'wipeleft' },
      { type: 'wipeleft' },
      { type: 'wipeleft' }
    ],
    segments: [
      { duration: 2 }, { duration: 2 }, { duration: 2 } // Fast pacing (2s < 5s base)
    ]
  };

  for (let i = 1; i <= 3; i++) {
    console.log(`Simulating Edit Session #${i}...`);
    await styleLearningService.learnFromEditSession(MOCK_USER_ID, manualEditState);
  }

  console.log('\n--- Phase 3: Adaptive Suggestion (Biased by Fingerprint) ---');
  // Re-run analysis with same mood
  suggestions = await aiVideoAnalysisService.generateEditingSuggestions('mock.mp4', mockAnalysis, { userId: MOCK_USER_ID });
  
  const adaptiveTransition = suggestions.find(s => s.type === 'transition').transitionType;
  const adaptiveTime = suggestions.find(s => s.type === 'transition').startTime;
  
  console.log(`New AI Suggestion (Adaptive): ${adaptiveTransition}`);
  console.log(`Transition Timing: ${adaptiveTime}s (Base was 48s for 60s video)`);

  if (adaptiveTransition === 'wipeleft') {
    console.log('✅ SUCCESS: AI successfully learned transition preference.');
  } else {
    console.error('❌ FAILURE: AI did not pick up transition preference.');
  }

  if (adaptiveTime < 48) {
    console.log('✅ SUCCESS: AI successfully adapted to faster pacing preference.');
  } else {
    console.error('❌ FAILURE: AI pacing bias remained stagnant.');
  }
}

async function run() {
  try {
    // We need a DB connection or we mock UserPreferences
    // For this test script, we will mock the Mongoose findOne/save if possible, 
    // but here we'll assume a local test DB if available or just unit test the service logic.
    
    // Unit Test: analyzeEditPatterns
    console.log('--- Unit Test: analyzeEditPatterns ---');
    const editState = {
        transitions: [{ type: 'circlecrop' }, { type: 'circlecrop' }],
        segments: [{ duration: 10 }, { duration: 10 }] // Slow pacing: 10s > 5s base
    };
    const patterns = styleLearningService.analyzeEditPatterns(editState);
    console.log('Extracted Patterns:', patterns);
    if (patterns.transitions.circlecrop === 1 && patterns.pacing === 2.0) {
        console.log('✅ analyzeEditPatterns passed.');
    } else {
        console.error('❌ analyzeEditPatterns failed.');
    }

    // Full simulation skip if no DB
    if (process.env.MONGODB_URI) {
        await mongoose.connect(process.env.MONGODB_URI);
        await simulateLearningCycle();
        await mongoose.disconnect();
    } else {
        console.log('\n(Simulator requires MONGODB_URI to test full persistence cycle)');
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    process.exit(0);
  }
}

run();
