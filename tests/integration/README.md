# Integration Tests

This directory contains integration tests for the Click platform, focusing on testing the interaction between different services and components.

## Test Files

### `ai.test.js`
Tests for AI features:
- Multi-Model AI service
- AI Recommendations engine
- Predictive Analytics
- Advanced Content Generation

### `infrastructure.test.js`
Tests for infrastructure services:
- Intelligent Caching
- Load Balancing
- Database Optimization
- Resource Management

### `workflows.test.js`
Tests for workflow automation:
- Workflow Templates
- Advanced Workflows
- Workflow Scheduling
- Workflow Analytics

### `e2e-flows.test.js`
End-to-end flow tests:
- Complete user journeys
- Multi-step workflows
- Service interactions

### `error-scenarios.test.js`
Error handling and edge cases:
- Authentication errors
- Validation errors
- Service unavailability
- Rate limiting
- Edge cases

## Running Tests

```bash
# Run all integration tests
npm test -- tests/integration

# Run specific test file
npm test -- tests/integration/ai.test.js

# Run with coverage
npm test -- --coverage tests/integration

# Run in watch mode
npm test -- --watch tests/integration
```

## Test Environment

Tests require:
- MongoDB connection
- Test user accounts
- Mock authentication tokens
- Optional: OpenAI API key (for AI tests)

## Notes

- Some tests may fail if external services (OpenAI, Redis) are not configured
- This is expected and tests handle these scenarios gracefully
- Admin-only tests require admin user tokens
- Tests clean up after themselves

## Coverage

- ✅ AI Features (Multi-model, Recommendations, Predictive Analytics)
- ✅ Infrastructure (Caching, Load Balancing, Database, Resources)
- ✅ Workflow Automation (Templates, Advanced Workflows, Scheduling)
- ✅ End-to-End Flows
- ✅ Error Scenarios






