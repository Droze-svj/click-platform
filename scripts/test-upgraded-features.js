// scripts/test-upgraded-features.js - Verify upgraded scripts locally
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function runHelpTest(scriptName) {
  return new Promise((resolve, reject) => {
    const projectRoot = path.join(__dirname, '..');
    const venvPython = path.join(projectRoot, '.venv', 'bin', 'python');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';
    const scriptPath = path.join(projectRoot, 'scripts', scriptName);

    console.log(`🐍 Testing ${scriptName} imports and execution...`);
    const proc = spawn(pythonCmd, [scriptPath, '--help']);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => stdout += d.toString());
    proc.stderr.on('data', (d) => stderr += d.toString());

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptName} loaded successfully and executed --help without errors!`);
        console.log('Stdout output:\n', stdout.split('\n')[0]);
        resolve();
      } else {
        console.error(`❌ ${scriptName} execution failed with code ${code}. Stderr:\n`, stderr);
        reject(new Error(`${scriptName} test failed`));
      }
    });
  });
}

async function main() {
  try {
    await runHelpTest('video_avatar_sync.py');
    console.log('');
    await runHelpTest('eye_contact_fix.py');
    console.log('\n🎉 ALL UPGRADED SCRIPTS LOADED AND PASSED VERIFICATION!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ LOCAL VERIFICATION FAILED.');
    process.exit(1);
  }
}

main();
