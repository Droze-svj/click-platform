# Analytics Guide

This document describes the analytics tracking setup and usage in the application.

## Overview

The application includes analytics tracking capabilities that support:
- **Google Analytics 4 (GA4)** - If `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured
- **Custom Analytics Endpoint** - If `NEXT_PUBLIC_ANALYTICS_ENDPOINT` is configured
- **Page View Tracking** - Automatic page view tracking on route changes
- **Event Tracking** - Custom event tracking for user interactions

## Configuration

### Environment Variables

```env
# Enable/disable analytics (default: enabled in production)
NEXT_PUBLIC_ANALYTICS_ENABLED=true

# Google Analytics 4 Measurement ID (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Custom analytics endpoint (optional)
NEXT_PUBLIC_ANALYTICS_ENDPOINT=https://your-analytics-endpoint.com/events
```

### Setup

1. **Google Analytics 4**:
   - Create a GA4 property in Google Analytics
   - Get your Measurement ID (format: G-XXXXXXXXXX)
   - Add it to `NEXT_PUBLIC_GA_MEASUREMENT_ID`

2. **Custom Analytics Endpoint**:
   - Set up your analytics endpoint that accepts POST requests
   - Endpoint should accept JSON payload with event data
   - Add it to `NEXT_PUBLIC_ANALYTICS_ENDPOINT`

## Usage

### Automatic Page View Tracking

Page views are automatically tracked via the `Analytics` component in the root layout. No additional code is needed for basic page view tracking.

### Manual Event Tracking

#### Basic Event Tracking

```typescript
import { trackEvent } from '../utils/analytics'

trackEvent('click', {
  category: 'button',
  action: 'generate_content',
  label: 'content_page',
})
```

#### Click Tracking

```typescript
import { trackClick } from '../utils/analytics'

trackClick('generate_button', {
  category: 'content',
  location: 'content_page',
})
```

#### Form Submission Tracking

```typescript
import { trackFormSubmit } from '../utils/analytics'

trackFormSubmit('content_generator', {
  category: 'content',
  value: contentLength,
})
```

#### Download Tracking

```typescript
import { trackDownload } from '../utils/analytics'

trackDownload('content_export.pdf', 'pdf')
```

#### Share Tracking

```typescript
import { trackShare } from '../utils/analytics'

trackShare('twitter', 'content_post')
```

#### User Identification

```typescript
import { setUserProperties } from '../utils/analytics'

setUserProperties('user123', {
  subscription: 'pro',
  plan: 'monthly',
})
```

### React Component Example

```tsx
'use client'

import { trackClick, trackFormSubmit } from '../utils/analytics'

export default function ContentGenerator() {
  const handleGenerate = async () => {
    trackClick('generate_button', {
      category: 'content',
    })
    
    // ... generate content logic ...
    
    trackFormSubmit('content_generator', {
      category: 'content',
      value: content.length,
    })
  }

  return (
    <button onClick={handleGenerate}>
      Generate Content
    </button>
  )
}
```

## Event Types

The analytics system supports the following event types:

- `page_view` - Page views (tracked automatically)
- `click` - User clicks
- `submit` - Form submissions
- `download` - File downloads
- `share` - Social sharing
- `custom` - Custom events

## Event Data Structure

All events include:
- `event` - Event type
- `category` - Event category (optional)
- `action` - Action performed (optional)
- `label` - Event label (optional)
- `value` - Numeric value (optional)
- `url` - Current page URL (automatically added)
- `timestamp` - Event timestamp (automatically added)
- `userAgent` - User agent string (automatically added)
- Additional custom properties as needed

## Privacy Considerations

### GDPR Compliance

- Analytics tracking respects user privacy preferences
- Can be disabled via `NEXT_PUBLIC_ANALYTICS_ENABLED=false`
- No personally identifiable information (PII) should be sent in events
- User IDs are hashed/anonymized if needed

### Data Retention

- Check your analytics provider's data retention policies
- Custom analytics endpoints should implement data retention policies
- Consider implementing data anonymization for long-term storage

## Best Practices

### 1. Track Meaningful Events

Track events that provide business value:
- Content generation
- File downloads
- Form submissions
- Feature usage
- User conversions

### 2. Use Consistent Naming

Use consistent naming conventions:
- `snake_case` for event names
- Descriptive category names
- Clear action labels

### 3. Avoid Tracking Sensitive Data

Never track:
- Passwords or authentication tokens
- Credit card numbers
- Personal identification numbers
- Health information
- Other sensitive user data

### 4. Test in Development

Test analytics tracking in development:
- Events are logged to console in development
- Verify events are being sent correctly
- Test with analytics disabled/enabled

### 5. Monitor Analytics Performance

- Monitor analytics endpoint performance
- Ensure analytics doesn't impact page load times
- Use `keepalive` flag for reliability

## Troubleshooting

### Events Not Appearing

1. Check `NEXT_PUBLIC_ANALYTICS_ENABLED` is set correctly
2. Verify environment variables are set
3. Check browser console for errors
4. Verify analytics endpoint is accessible
5. Check network tab for failed requests

### Google Analytics Not Working

1. Verify `NEXT_PUBLIC_GA_MEASUREMENT_ID` is correct
2. Check Google Analytics Real-Time reports
3. Verify gtag script is loading (check Network tab)
4. Check for ad blockers that might block GA

### Too Many Events

1. Review event tracking implementation
2. Avoid tracking on every render (use event handlers)
3. Consider event sampling if needed
4. Review analytics endpoint rate limiting

## Integration with Performance Monitoring

Analytics events can be correlated with performance metrics:

```typescript
import { trackEvent } from '../utils/analytics'
import { measureAsyncPerformance } from '../utils/performance'

async function generateContent() {
  const result = await measureAsyncPerformance('generate_content', async () => {
    // ... content generation ...
  })
  
  trackEvent('submit', {
    category: 'content',
    action: 'generate',
    value: result.length,
    performance: true,
  })
}
```

## Resources

- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [Next.js Analytics](https://nextjs.org/docs/app/building-your-application/optimizing/analytics)



