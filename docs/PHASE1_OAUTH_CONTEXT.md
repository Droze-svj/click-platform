# Phase 1 — OAuth Token Refresh (context for Assignment #6)

Existing code to extend and harden. Use with `npm run assign 6` for the full assignment.

## Existing pieces

| File | What it does |
|------|----------------|
| **server/services/tokenRefreshService.js** | `refreshTokenIfNeeded(connection)`, `refreshAllTokens()`; uses SocialConnection; Twitter (oauthService), LinkedIn (linkedinOAuthService); Facebook/Instagram currently “long-lived, no refresh” |
| **server/services/oauthService.js** | `refreshTwitterToken(refreshToken)` — used by tokenRefreshService |
| **server/services/linkedinOAuthService.js** | `refreshAccessToken(userId)` (Supabase), `refreshWithRefreshToken(refreshToken)` — used by tokenRefreshService |
| **server/services/twitterOAuthService.js** | Twitter API calls; ensure refresh is wired and expiry/rate limits handled |
| **server/services/facebookOAuthService.js** | Facebook/Instagram OAuth; add refresh or re-auth when tokens expire |
| **server/routes/oauth.js** | OAuth callback routes; ensure refresh is triggered before posting |

## Gaps to address (Assignment #6 tasks)

- **Twitter/X:** Confirm refresh is used everywhere before posting; handle rate limits and token expiry errors.
- **LinkedIn:** Already has refresh; add consistent error handling and expiry checks.
- **Facebook/Instagram:** Implement refresh or clear “long-lived, no refresh” and add expiry handling / re-auth flow.
- **Error handling:** On token expiry or 401, call refresh (or re-auth) and retry or surface a clear “reconnect account” message.
- **Rate limits:** When APIs return rate-limit errors, back off and optionally surface in UI.

## Where posting uses tokens

- **server/services/socialPublishingService.js** — likely the main caller; ensure it uses `refreshTokenIfNeeded()` (or equivalent) before using an access token.
- **server/routes/posts.js** — any route that triggers “post to social” should go through a path that refreshes tokens first.

## Quick check

```bash
rg -n "refreshTokenIfNeeded|refreshToken|refreshAccessToken" server/
```

Then run `npm run assign 6` and create the GitHub issue from ASSIGNMENT_READY.md.
