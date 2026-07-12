// scripts/test-free-features.js - Verify Edge-TTS and video_object_removal.py locally
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

async function testEdgeTTS() {
  console.log('🔊 Testing Edge-TTS fallback integration...');
  try {
    const localizationService = require('../server/services/aiLocalizationService');
    const text = "Hola, esta es una prueba de la síntesis de voz de Click usando Edge-TTS.";
    const targetLanguage = "Spanish";
    
    console.log(`Generating audio for: "${text}" in ${targetLanguage}...`);
    const audioUrl = await localizationService.generateLocalizedAudio(text, null, targetLanguage);
    
    console.log('✅ Edge-TTS audio generated successfully!');
    console.log('Audio URL:', audioUrl);
    
    const absolutePath = path.join(__dirname, '..', audioUrl);
    if (fs.existsSync(absolutePath)) {
      console.log(`File exists on disk: ${absolutePath} (${fs.statSync(absolutePath).size} bytes)`);
    } else {
      throw new Error(`File does not exist: ${absolutePath}`);
    }
  } catch (err) {
    console.error('❌ Edge-TTS Test Failed:', err);
    throw err;
  }
}

async function testObjectRemovalPython() {
  console.log('\n🐍 Testing video_object_removal.py script imports and execution...');
  return new Promise((resolve, reject) => {
    const projectRoot = path.join(__dirname, '..');
    const venvPython = path.join(projectRoot, '.venv', 'bin', 'python');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';
    const scriptPath = path.join(projectRoot, 'scripts', 'video_object_removal.py');
    
    // Run script with --help to check syntax, imports (cv2, numpy), and parser
    const proc = spawn(pythonCmd, [scriptPath, '--help']);
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (d) => stdout += d.toString());
    proc.stderr.on('data', (d) => stderr += d.toString());
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('✅ python video_object_removal.py loaded successfully and executed without errors!');
        console.log('Stdout output (abbreviated):\n', stdout.split('\n')[0]);
        resolve();
      } else {
        console.error(`❌ Python execution failed with code ${code}. Stderr:\n`, stderr);
        reject(new Error('Python test failed'));
      }
    });
  });
}

async function main() {
  try {
    await testEdgeTTS();
    await testObjectRemovalPython();
    console.log('\n🎉 ALL FREE AI FEATURES PASSED LOCAL VERIFICATION!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ LOCAL VERIFICATION FAILED.');
    process.exit(1);
  }
}

main();
