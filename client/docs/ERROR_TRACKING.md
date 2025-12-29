# Error Tracking Guide

This document describes the error tracking setup and best practices for the application.

## Overview

The application uses **Sentry** for error tracking and monitoring. Sentry automatically captures:
- Unhandled exceptions
- Unhandled promise rejections
- Browser errors
- Performance issues
- User feedback

## Configuration

### Sentry Setup

Sentry is configured in three files:

1. **`sentry.client.config.ts`** - Client-side configuration
2. **`sentry.server.config.ts`** - Server-side configuration
3. **`sentry.edge.config.ts`** - Edge runtime configuration

### Environment Variables

Required environment variables for Sentry:

```env
# Sentry DSN (required for error tracking)
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id

# Sentry organization (optional, for source maps)
SENTRY_ORG=your-org

# Sentry project name (optional, for source maps)
SENTRY_PROJECT=your-project

# Sentry traces sample rate (optional, default: 0.1)
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1

# Sentry release (optional, defaults to package version)
NEXT_PUBLIC_SENTRY_RELEASE=click-client@1.0.0
```

### Next.js Configuration

Sentry is integrated via `next.config.js` using `withSentryConfig`:

- Source maps are hidden in production
- Automatic instrumentation for Server Components, Route Handlers, and API Routes
- Middleware auto-instrumentation
- Logger statements are tree-shaken to reduce bundle size

## Error Boundaries

### React Error Boundaries

Error boundaries are implemented using the `ErrorBoundary` component:

```tsx
import { ErrorBoundary } from '../components/ErrorBoundary'

export default function MyPage() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  )
}
```

The `ErrorBoundary` component:
- Catches React component errors
- Displays a user-friendly error UI
- Logs errors to Sentry (when configured)
- Provides error recovery options

### Error Boundary Features

- **Automatic Error Capture**: Errors are automatically sent to Sentry
- **User-Friendly UI**: Displays a friendly error message instead of a blank screen
- **Error Context**: Includes component stack trace and error details
- **Recovery Options**: Provides options to reload the page or go back

## Manual Error Reporting

### Capturing Exceptions

To manually capture exceptions:

```typescript
import * as Sentry from '@sentry/nextjs'

try {
  // Your code
} catch (error) {
  Sentry.captureException(error)
  // Handle error
}
```

### Adding Context

Add additional context to errors:

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.setContext('user', {
  id: user.id,
  email: user.email,
  subscription: user.subscription,
})

Sentry.setTag('feature', 'content-generation')
Sentry.setLevel('error')
```

### Breadcrumbs

Add breadcrumbs to track user actions:

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.addBreadcrumb({
  category: 'user',
  message: 'User clicked generate button',
  level: 'info',
})
```

## Error Filtering

### Ignored Errors

The following errors are automatically ignored (configured in `sentry.client.config.ts`):

- Browser extension errors
- Network errors (when appropriate)
- Non-critical ResizeObserver errors
- Known non-critical promise rejections

### Filtering Sensitive Data

Sentry automatically filters sensitive data in `beforeSend`:

- Authorization headers
- Cookies
- Passwords
- Tokens (access, refresh, API tokens)

## Best Practices

### 1. Use Error Boundaries

Wrap major sections of your app with Error Boundaries:

```tsx
<ErrorBoundary>
  <DashboardSection />
</ErrorBoundary>
```

### 2. Report Important Errors

Report errors that need investigation:

```typescript
try {
  await criticalOperation()
} catch (error) {
  Sentry.captureException(error, {
    tags: { section: 'critical-operation' },
    level: 'error',
  })
  // Show user-friendly message
}
```

### 3. Don't Report User Errors

Don't report expected errors (validation errors, user cancellations, etc.):

```typescript
try {
  await submitForm()
} catch (error) {
  if (error.status === 400) {
    // Validation error - don't report
    showValidationError(error)
  } else {
    // Unexpected error - report it
    Sentry.captureException(error)
  }
}
```

### 4. Add Context

Add relevant context to errors:

```typescript
Sentry.withScope((scope) => {
  scope.setTag('page', 'dashboard')
  scope.setContext('formData', { field1: value1 })
  scope.setLevel('warning')
  Sentry.captureException(error)
})
```

### 5. Use Error Boundaries for Recovery

Use Error Boundaries to provide fallback UI and recovery options.

## Monitoring in Sentry

### Dashboard

View errors in the Sentry dashboard:
- Error frequency and trends
- Affected users
- Error details and stack traces
- Performance impact

### Alerts

Set up alerts for:
- New errors
- Error rate spikes
- Performance degradation

### Releases

Track errors by release:
- See which releases introduced errors
- Compare error rates between releases
- Track error fixes

## Development vs Production

### Development

In development:
- Errors are logged to console
- Source maps are available
- Detailed error information is shown

### Production

In production:
- Errors are sent to Sentry
- Source maps are hidden (for security)
- User-friendly error messages are shown
- Sensitive data is filtered

## Troubleshooting

### Errors Not Appearing in Sentry

1. Check `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. Verify Sentry project is active
3. Check browser console for Sentry errors
4. Verify network requests to Sentry are not blocked

### Too Many Errors

1. Review and update ignored errors list
2. Add more specific error filtering
3. Use error sampling (adjust `tracesSampleRate`)

### Missing Context

1. Add more context in error handlers
2. Use breadcrumbs to track user actions
3. Set user context in authentication

## Integration with Utilities

### Error Handling Utilities

Use error handling utilities with Sentry:

```typescript
import { extractApiError } from '../utils/apiResponse'
import * as Sentry from '@sentry/nextjs'

try {
  await apiCall()
} catch (error) {
  const message = extractApiError(error)
  Sentry.captureException(error, {
    extra: { apiError: message },
  })
}
```

## Resources

- [Sentry Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Next.js Sentry Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)



