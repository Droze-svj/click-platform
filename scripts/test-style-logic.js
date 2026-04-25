const styleLearningService = require('../server/services/styleLearningService');

function testLogic() {
    console.log('--- Unit Test: analyzeEditPatterns ---');
    const editState = {
        transitions: [{ type: 'circlecrop' }, { type: 'circlecrop' }, { type: 'fade' }],
        segments: [{ duration: 10 }, { duration: 10 }, { duration: 10 }], // Slow pacing: 10s > 5s base
        captionSettings: { style: 'neon' }
    };

    const patterns = styleLearningService.analyzeEditPatterns(editState);
    console.log('Extracted Patterns:', JSON.stringify(patterns, null, 2));

    // Verify transitions
    // circlecrop: 2/3 = 0.666...
    // fade: 1/3 = 0.333...
    if (Math.abs(patterns.transitions.circlecrop - 0.666) < 0.01 && 
        Math.abs(patterns.transitions.fade - 0.333) < 0.01) {
        console.log('✅ Transition weights pass!');
    } else {
        console.error('❌ Transition weights fail!');
    }

    // Verify pacing
    // avg duration 10 / 5 = 2.0
    if (patterns.pacing === 2.0) {
        console.log('✅ Pacing bias passes!');
    } else {
        console.error('❌ Pacing bias fails!', patterns.pacing);
    }

    // Verify captions
    if (patterns.captionStyle === 'neon') {
        console.log('✅ Caption style passes!');
    } else {
        console.error('❌ Caption style fails!');
    }
}

testLogic();
process.exit(0);
