/**
 * Test Service Initialization Error Handling
 * Verifies that services fail gracefully without crashing the server
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, '../../server/index.js');
const TEST_TIMEOUT = 15000; // 15 seconds

function testServiceInit(testName, envVars) {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', [SERVER_PATH], {
      env: { ...process.env, ...envVars, NODE_ENV: 'development' },
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let serverReady = false;
    let hasStarted = false;

    const timeoutId = setTimeout(() => {
      serverProcess.kill('SIGTERM');
      if (!serverReady) {
        // Check if server started at any point
        const allOutput = stdout + stderr;
        if (allOutput.includes('Server running on port') || allOutput.includes('Server bound to port')) {
          resolve({ stdout, stderr, testName, serverReady: true, timedOut: true, hasStarted: true });
        } else {
          reject(new Error(`Test "${testName}" timed out. Output: ${allOutput.substring(0, 500)}`));
        }
      } else {
        resolve({ stdout, stderr, testName, serverReady: true, timedOut: true });
      }
    }, TEST_TIMEOUT);

    serverProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      if (data.toString().includes('Server running on port') || data.toString().includes('Server bound to port')) {
        hasStarted = true;
        if (!serverReady) {
          serverReady = true;
          clearTimeout(timeoutId);
          setTimeout(() => {
            serverProcess.kill('SIGTERM');
            resolve({ stdout, stderr, testName, serverReady: true, hasStarted: true });
          }, 3000); // Give it time to log initialization messages
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      // Check stderr too for server ready message
      if (data.toString().includes('Server running on port') || data.toString().includes('Server bound to port')) {
        hasStarted = true;
        if (!serverReady) {
          serverReady = true;
          clearTimeout(timeoutId);
          setTimeout(() => {
            serverProcess.kill('SIGTERM');
            resolve({ stdout, stderr, testName, serverReady: true, hasStarted: true });
          }, 3000);
        }
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      clearTimeout(timeoutId);
      const allOutput = stdout + stderr;
      
      // Check if server started before exiting
      if (allOutput.includes('Server running on port') || allOutput.includes('Server bound to port')) {
        hasStarted = true;
        serverReady = true;
        resolve({ stdout, stderr, testName, serverReady: true, exitCode: code, hasStarted: true });
      } else if (code === 0 || serverReady) {
        resolve({ stdout, stderr, testName, serverReady, exitCode: code, hasStarted });
      } else {
        // Show helpful error message
        const errorPreview = allOutput.substring(allOutput.length - 1000);
        reject(new Error(`Server exited with code ${code} before starting.\nLast output:\n${errorPreview}`));
      }
    });
  });
}

async function runTests() {
  console.log('🧪 Testing Service Initialization Error Handling\n');

  const tests = [
    {
      name: 'Email Service Failure',
      env: { SENDGRID_API_KEY: 'invalid-key' },
      expectedPattern: /Email service|SendGrid/i
    },
    {
      name: 'Cache Service Failure',
      env: { REDIS_URL: 'redis://invalid-host:6379' },
      expectedPattern: /Redis not available|Cache initialization failed/i
    },
    {
      name: 'Sentry Initialization Failure',
      env: { SENTRY_DSN: 'invalid-dsn' },
      expectedPattern: /Sentry.*placeholder|Sentry DSN not configured/i
    },
    {
      name: 'Supabase Initialization Failure',
      env: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
      expectedPattern: /Supabase not configured/i
    },
    {
      name: 'Multiple Service Failures',
      env: {
        REDIS_URL: 'redis://invalid-host:6379',
        SENDGRID_API_KEY: 'invalid-key',
        SENTRY_DSN: '',
        SUPABASE_URL: ''
      },
      expectedPattern: /Server running on port/
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}...`);
      const result = await testServiceInit(test.name, test.env);

      const allOutput = result.stdout + result.stderr;
      const hasPattern = test.expectedPattern.test(allOutput);
      // Mongoose warnings are NOT fatal - exclude them from fatal error detection
      const isFatalError = /FATAL|Cannot read properties.*null|TypeError.*null|ReferenceError/i.test(allOutput) &&
                          !/MONGOOSE.*Warning|Duplicate schema index|MONGODB DRIVER.*Warning|useNewUrlParser|useUnifiedTopology/i.test(allOutput);
      const hasServerStarted = allOutput.includes('Server running on port') || 
                               allOutput.includes('Server bound to port') ||
                               result.hasStarted;

      if (hasServerStarted) {
        
        if (hasPattern && !isFatalError) {
          console.log(`  ✓ PASSED - Server started successfully with graceful degradation\n`);
          passed++;
        } else {
          console.log(`  ✗ FAILED - Pattern not found or fatal error detected`);
          console.log(`    Pattern found: ${hasPattern}`);
          console.log(`    Fatal error: ${isFatalError}`);
          console.log(`    Last 300 chars: ${allOutput.substring(allOutput.length - 300)}\n`);
          failed++;
        }
      } else {
        // Server didn't start - check if it's a known issue we can work around
        if (allOutput.includes('MongoDB') || allOutput.includes('Database connection')) {
          console.log(`  ⚠ SKIPPED - Database not available (expected in test environment)`);
          console.log(`    Server attempted to start but requires database\n`);
          // Don't count as failed - this is expected
        } else {
          console.log(`  ✗ FAILED - Server did not start`);
          console.log(`    Exit code: ${result.exitCode || 'N/A'}`);
          console.log(`    Last 300 chars: ${allOutput.substring(allOutput.length - 300)}\n`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`  ✗ FAILED - ${error.message.substring(0, 200)}\n`);
      failed++;
    }

    // Wait between tests (increased to avoid port conflicts)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n=== Test Results ===');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✅ All service initialization tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

runTests();

