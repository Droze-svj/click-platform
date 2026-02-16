# Phase 1 Kickoff — Testing, OAuth Refresh, Cloud Storage

Use this after merging `feat/editing-ux-guides-and-phase1-prep` into `main`. Phase 0 (MongoDB, Redis, API) is verified ✅.

---

## 1. Testing & QA (#5)

**Effort:** 3–5 days  
**Branch:** `feature/testing-qa`

**Tasks:**
- Write unit tests for critical services (80%+ coverage)
- Write integration tests for API routes
- Add E2E tests for critical user flows
- Update CI/CD pipeline

**Files to check:** `tests/server/services/`, `tests/server/routes/`, `tests/e2e/`, `.github/workflows/ci.yml`

**Generate issue & ROADMAP row:**
```bash
npm run assign 5
```
Then open `ASSIGNMENT_READY.md` and create the GitHub issue; copy the row into ROADMAP_STATUS.md.

---

## 2. OAuth Token Refresh (#6)

**Effort:** 2 days  
**Branch:** `feature/oauth-refresh`

**Tasks:**
- Add token refresh for Twitter/X
- Add token refresh for LinkedIn
- Add token refresh for Facebook/Instagram
- Error handling for token expiry
- Rate limit handling

**Files to check:** `server/services/twitterOAuthService.js`, `server/services/linkedinOAuthService.js`, `server/routes/oauth.js`

**Generate issue & ROADMAP row:**
```bash
npm run assign 6
```
Then open `ASSIGNMENT_READY.md` and create the GitHub issue; copy the row into ROADMAP_STATUS.md.

---

## 3. Cloud Storage Integration (#7)

**Effort:** 2–3 days  
**Branch:** `feature/cloud-storage`

**Tasks:**
- Create storage service abstraction
- Migrate file upload to S3/Cloudinary
- Update video processing for cloud storage
- Add CDN configuration

**Files to check:** `server/services/cloudStorageService.js`, `server/config/storage.js`, `server/routes/upload/`

**Generate issue & ROADMAP row:**
```bash
npm run assign 7
```
Then open `ASSIGNMENT_READY.md` and create the GitHub issue; copy the row into ROADMAP_STATUS.md.

---

## Quick commands

```bash
npm run assign      # List all assignments
npm run assign 5    # Testing & QA
npm run assign 6    # OAuth token refresh
npm run assign 7    # Cloud storage
npm run verify:phase0   # Re-verify after merge
npm run dev         # Local dev (backend 5001, client 3010)
```

## Order of work

1. **Testing & QA** — Improves confidence for all later changes.
2. **OAuth token refresh** — Unblocks reliable posting.
3. **Cloud storage** — Required for production-scale uploads.

You can run assignments in parallel on separate branches if multiple people are working.
