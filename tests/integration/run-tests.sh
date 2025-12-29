#!/bin/bash

# Integration Tests Runner Script

echo "🧪 Starting Integration Tests..."
echo ""

# Check if MongoDB is running
if ! nc -z localhost 27017 2>/dev/null; then
  echo "⚠️  Warning: MongoDB may not be running on localhost:27017"
  echo "   Some tests may fail"
  echo ""
fi

# Check if Redis is running (optional)
if ! nc -z localhost 6379 2>/dev/null; then
  echo "⚠️  Warning: Redis may not be running on localhost:6379"
  echo "   Cache-related tests may fail"
  echo ""
fi

# Set test environment
export NODE_ENV=test
export MONGODB_URI=${MONGODB_URI:-mongodb://localhost:27017/click-test}

# Run tests
echo "📋 Running AI Features Tests..."
npm test -- tests/integration/ai.test.js --verbose

echo ""
echo "📋 Running Infrastructure Tests..."
npm test -- tests/integration/infrastructure.test.js --verbose

echo ""
echo "📋 Running Workflow Tests..."
npm test -- tests/integration/workflows.test.js --verbose

echo ""
echo "📋 Running E2E Flow Tests..."
npm test -- tests/integration/e2e-flows.test.js --verbose

echo ""
echo "📋 Running Error Scenario Tests..."
npm test -- tests/integration/error-scenarios.test.js --verbose

echo ""
echo "✅ Integration Tests Complete!"
echo ""
echo "Note: Some tests may fail if:"
echo "  - OpenAI API key is not configured"
echo "  - Redis is not running"
echo "  - External services are unavailable"
echo ""
echo "This is expected and tests handle these scenarios gracefully."






