# Error tracking

Errors are reported to Sentry from the **server only** (`server/index.js`,
`server/utils/sentry.js`), and only when `SENTRY_DSN` is set and
`NODE_ENV=production`.

Before anything is sent, `server/utils/sentryScrub.js` removes request bodies,
cookies, query strings, IP addresses, emails and the text of AI prompts and
replies. A report carries the error, the route, the device type and the account
id. Change that file, and its tests, if a report needs more context; the
privacy policy (`app/privacy/page.tsx`, section 5) describes what Sentry
receives and must stay true.

The browser app has no error tracking. The previous `@sentry/nextjs` config
files were never loaded (no `instrumentation-client.ts`, no
`withSentryConfig`) and were removed. Adding browser reporting means a new
provider data flow: scrub it the same way, keep Session Replay off, allow the
ingest host in the CSP `connect-src`, and update the privacy policy.
