// Sentry server configuration for Next.js

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || `click-client@${process.env.npm_package_version || '1.0.0'}`,
  
  // Filter out sensitive data
  beforeSend(event, hint) {
    // Remove sensitive information
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      
      // Remove sensitive body data
      if (event.request.data) {
        if (typeof event.request.data === 'object') {
          delete (event.request.data as any).password;
          delete (event.request.data as any).token;
          delete (event.request.data as any).accessToken;
          delete (event.request.data as any).refreshToken;
        }
      }
    }
    
    return event;
  },
});






