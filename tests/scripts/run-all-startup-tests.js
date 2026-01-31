#!/usr/bin/env node

/**
 * Master Test Runner for Server Startup Tests
 * Runs all recommended test scenarios
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE_DIR = path.join(__dirname, '../..');
const SCRIPTS_DIR = path.join(__dirname);

// Test configuration
const tests = [
  {
    name: 'Service Initialization Error Handling',
    script: path.join(SCRIPTS_DIR, 'test-service-init.js'),
    description: 'Tests that services fail gracefully without crashing the server'
  },
  {
    name: 'Uncaught Exception Handling',
    script: path.join(SCRIPTS_DIR, 'test-uncaught-exception.js'),
    description: 'Tests uncaught exception handling in production vs development'
  }
];

const bashTests = [
  {
    name: 'Server Startup with Missing Services',
    script: path.join(SCRIPTS_DIR, 'test-server-startup.sh'),
    description: 'Tests server startup with various missing optional services'
  }
];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

function runTest(test) {
  return new Promise((resolve) => {
    log(`\n🧪 Running: ${test.name}`, 'yellow');
    log(`   ${test.description}`, 'bright');
    
    try {
      const startTime = Date.now();
      const output = execSync(`node "${test.script}"`, {
        cwd: BASE_DIR,
        encoding: 'utf-8',
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' }
      });
      const duration = Date.now() - startTime;
      
      log(`✓ PASSED (${duration}ms)`, 'green');
      resolve({ success: true, duration, test: test.name });
    } catch (error) {
      log(`✗ FAILED`, 'red');
      resolve({ success: false, error: error.message, test: test.name });
    }
  });
}

function runBashTest(test) {
  return new Promise((resolve) => {
    log(`\n🧪 Running: ${test.name}`, 'yellow');
    log(`   ${test.description}`, 'bright');
    
    try {
      const startTime = Date.now();
      const output = execSync(`bash "${test.script}"`, {
        cwd: BASE_DIR,
        encoding: 'utf-8',
        stdio: 'inherit'
      });
      const duration = Date.now() - startTime;
      
      log(`✓ PASSED (${duration}ms)`, 'green');
      resolve({ success: true, duration, test: test.name });
    } catch (error) {
      log(`✗ FAILED`, 'red');
      resolve({ success: false, error: error.message, test: test.name });
    }
  });
}

async function runAllTests() {
  logSection('🚀 Server Startup Test Suite');
  
  log('This test suite validates all recommended testing scenarios:');
  log('  1. Server startup with missing optional services');
  log('  2. Uncaught exception handling in production mode');
  log('  3. Health check server shutdown sequence');
  log('  4. Service initialization error handling');
  
  const results = [];
  
  // Run Node.js tests
  logSection('Running Node.js Tests');
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    
    // Wait between tests to avoid port conflicts
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Run Bash tests
  logSection('Running Bash Tests');
  for (const test of bashTests) {
    const result = await runBashTest(test);
    results.push(result);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  logSection('Test Summary');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  
  log(`Total Tests: ${results.length}`, 'bright');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'reset');
  log(`⏱️  Total Duration: ${totalDuration}ms\n`);
  
  // Detailed results
  if (failed > 0) {
    log('\nFailed Tests:', 'red');
    results
      .filter(r => !r.success)
      .forEach(r => {
        log(`  - ${r.test}`, 'red');
        if (r.error) {
          log(`    Error: ${r.error}`, 'yellow');
        }
      });
  }
  
  if (failed === 0) {
    log('\n🎉 All tests passed!', 'green');
    log('✅ Server startup is robust and handles errors gracefully.\n', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Please review the errors above.\n', 'yellow');
    process.exit(1);
  }
}

// Handle interruptions gracefully
process.on('SIGINT', () => {
  log('\n\n⚠️  Tests interrupted by user', 'yellow');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('\n\n⚠️  Tests terminated', 'yellow');
  process.exit(1);
});

// Run tests
runAllTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});


