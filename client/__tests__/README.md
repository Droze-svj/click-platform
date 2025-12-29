# Frontend Testing Guide

This directory contains tests for the Next.js frontend application.

## Setup

Tests are configured using Jest and React Testing Library. The configuration files are:

- `jest.config.js` - Jest configuration for Next.js
- `jest.setup.js` - Test setup and global mocks

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Test Structure

Tests are co-located with their source files using the `__tests__` directory pattern:

```
utils/
  ├── validation.ts
  └── __tests__/
      └── validation.test.ts
```

## Writing Tests

### Utility Function Test Example

```typescript
import { validateRequired, validateEmail } from '../validation'

describe('Validation Utilities', () => {
  describe('validateRequired', () => {
    it('should return null for non-empty string', () => {
      expect(validateRequired('test')).toBeNull()
    })

    it('should return error for empty string', () => {
      expect(validateRequired('')).toBe('This field is required.')
    })
  })
})
```

### Component Test Example

```typescript
import { render, screen } from '@testing-library/react'
import Button from '../Button'

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
})
```

## Test Utilities Included

- **validation.test.ts** - Tests for form validation utilities
- **apiResponse.test.ts** - Tests for API response handling utilities
- **envValidation.test.ts** - Tests for environment variable validation

## Mocking

Global mocks are set up in `jest.setup.js`:

- Next.js router (`useRouter`, `usePathname`, `useSearchParams`)
- localStorage
- window.matchMedia
- IntersectionObserver

## Coverage Goals

- **Utilities**: 80%+ coverage
- **Components**: 70%+ coverage
- **Hooks**: 80%+ coverage



