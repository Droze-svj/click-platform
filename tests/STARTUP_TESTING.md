# Server Startup Testing Guide

This document describes the comprehensive test suite for server startup scenarios, covering all recommended testing scenarios.

## Overview

The test suite validates:
1. ✅ Server startup with missing optional services
2. ✅ Uncaught exception handling in production mode
3. ✅ Health check server shutdown sequence
4. ✅ Service initialization error handling
5. ✅ Error messages and logging consistency
6. ✅ Production vs Development behavior

## Test Files

### 1. Integration Tests (Jest)
**File:** `tests/integration/server-startup.test.js`

Comprehensive Jest-based integration tests for server startup scenarios.

```bash
# Run with Jest
npm test -- server-startup.test.js

# Or directly
npx jest tests/integration/server-startup.test.js
```

### 2. Service Initialization Tests
**File:** `tests/scripts/test-service-init.js`

Tests that services fail gracefully without crashing the server.

```bash
node tests/scripts/test-service-init.js
```

### 3. Uncaught Exception Tests
**File:** `tests/scripts/test-uncaught-exception.js`

Tests uncaught exception handling in production vs development modes.

```bash
node tests/scripts/test-uncaught-exception.js
```

### 4. Server Startup Tests (Bash)
**File:** `tests/scripts/test-server-startup.sh`

Tests server startup with various missing optional services.

```bash
bash tests/scripts/test-server-startup.sh

# Or make it executable and run directly
chmod +x tests/scripts/test-server-startup.sh
./tests/scripts/test-server-startup.sh
```

### 5. Master Test Runner
**File:** `tests/scripts/run-all-startup-tests.js`

Runs all test scenarios and provides a comprehensive summary.

```bash
node tests/scripts/run-all-startup-tests.js
```

## Running All Tests

### Quick Start

Run all tests with the master test runner:

```bash
node tests/scripts/run-all-startup-tests.js
```

### Individual Test Execution

Run specific test scenarios:

```bash
# Service initialization error handling
node tests/scripts/test-service-init.js

# Uncaught exception handling
node tests/scripts/test-uncaught-exception.js

# Server startup with missing services
bash tests/scripts/test-server-startup.sh

# Jest integration tests
npx jest tests/integration/server-startup.test.js
```

## Test Scenarios

### 1. Server Startup with Missing Optional Services

Tests that the server starts successfully even when optional services are missing:

- ✅ Missing Redis
- ✅ Missing Sentry
- ✅ Missing Email Service (SendGrid)
- ✅ Missing Supabase
- ✅ Missing ALL optional services

**Expected Behavior:**
- Server should start successfully
- Appropriate warning messages should be logged
- No fatal errors should occur
- Server should continue with graceful degradation

### 2. Uncaught Exception Handling

Tests that uncaught exceptions are handled correctly:

- ✅ Development mode: Server continues after uncaught exception
- ✅ Production mode: Server exits gracefully after uncaught exception

**Expected Behavior:**
- Error handlers should be registered
- Appropriate error messages should be logged
- Production mode should exit to prevent undefined behavior
- Development mode should continue for debugging

### 3. Health Check Server Shutdown Sequence

Tests the health check server shutdown process:

- ✅ Health check server closes before main server starts
- ✅ Port conflicts are handled gracefully

**Expected Behavior:**
- Health check server should close cleanly
- Main server should start after health check server closes
- Port conflicts should not cause crashes

### 4. Service Initialization Error Handling

Tests that individual service failures don't crash the server:

- ✅ Email service initialization failure
- ✅ Cache service initialization failure
- ✅ Sentry initialization failure
- ✅ Supabase initialization failure
- ✅ Multiple service failures simultaneously

**Expected Behavior:**
- Each service should fail gracefully
- Warning messages should be logged
- Server should continue starting
- No fatal errors should occur

### 5. Error Messages and Logging

Tests that error messages are appropriate and consistent:

- ✅ Appropriate warnings for missing services
- ✅ Structured logging (logger) instead of console.log
- ✅ Clear, actionable error messages

**Expected Behavior:**
- All errors should use structured logging
- Error messages should be clear and actionable
- Initial startup logs may use console.log (acceptable)

### 6. Production vs Development Behavior

Tests environment-specific behavior:

- ✅ Production mode enforces Redis URL validation
- ✅ Development mode allows localhost Redis
- ✅ Different error handling in production vs development

**Expected Behavior:**
- Production mode should enforce stricter validation
- Development mode should be more permissive
- Appropriate warnings should be logged

## Test Configuration

### Environment Variables

Tests use the following test port to avoid conflicts:
- `TEST_PORT=6001` (default server uses 5001)

### Timeouts

- Individual test timeout: 15-30 seconds
- Total test suite timeout: ~2 minutes

## Expected Test Results

### ✅ Successful Test Run

```
🚀 Server Startup Test Suite
============================================================

🧪 Running: Service Initialization Error Handling
   Tests that services fail gracefully without crashing the server
✓ PASSED (12500ms)

🧪 Running: Uncaught Exception Handling
   Tests uncaught exception handling in production vs development
✓ PASSED (8500ms)

🧪 Running: Server Startup with Missing Services
   Tests server startup with various missing optional services
✓ PASSED (45000ms)

============================================================
Test Summary
============================================================
Total Tests: 3
✅ Passed: 3
❌ Failed: 0
⏱️  Total Duration: 66000ms

🎉 All tests passed!
✅ Server startup is robust and handles errors gracefully.
```

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:

```bash
# Kill process on test port
lsof -ti:6001 | xargs kill -9

# Or check what's using the port
lsof -i:6001
```

### Tests Timing Out

If tests timeout:

1. Check if server is actually starting (check logs)
2. Increase timeout in test files if needed
3. Verify required dependencies are installed

### Service Not Initializing

If a service doesn't initialize:

1. Check environment variables are set correctly
2. Verify service modules exist
3. Check for syntax errors in service files

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Startup Tests
  run: |
    node tests/scripts/run-all-startup-tests.js
```

## Manual Testing

For manual testing of specific scenarios:

```bash
# Test missing Redis
REDIS_URL= node server/index.js

# Test missing Sentry
SENTRY_DSN= node server/index.js

# Test production mode
NODE_ENV=production node server/index.js

# Test all optional services missing
REDIS_URL= SENTRY_DSN= SENDGRID_API_KEY= SUPABASE_URL= node server/index.js
```

## Notes

- Tests run in `test` mode to avoid conflicts with development/production
- Test port (6001) is used to avoid conflicts with main server (5001)
- Tests clean up spawned processes automatically
- Some tests may take 15-30 seconds to complete (server startup time)

## Contributing

When adding new services or error handling:

1. Add corresponding test scenarios
2. Update this documentation
3. Ensure tests pass before committing
4. Update the master test runner if adding new test files


