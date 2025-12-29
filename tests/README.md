# Testing Guide

## Test Structure

```
tests/
├── server/           # Unit tests for server code
│   ├── routes/      # Route tests
│   └── services/    # Service tests
├── integration/     # Integration tests
├── e2e/            # End-to-end tests
├── performance/     # Performance/load tests
├── security/       # Security tests
└── setup.js        # Test setup file
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: All critical flows
- **E2E Tests**: Main user journeys
- **Security Tests**: All security-critical paths

## Writing Tests

### Unit Test Example
```javascript
describe('Service Name', () => {
  it('should do something', async () => {
    const result = await serviceFunction();
    expect(result).toBeDefined();
  });
});
```

### Integration Test Example
```javascript
describe('API Integration', () => {
  it('should complete full flow', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({ data: 'test' })
      .expect(200);
    
    expect(response.body).toHaveProperty('success', true);
  });
});
```

## Test Database

Tests use a separate test database: `click-test`

Make sure MongoDB is running before running tests.

## Mocking

External services are mocked in `tests/setup.js`:
- Email service
- External APIs
- File system operations (where needed)






