# Integration test debt

State of each `tests/integration/*.test.js` file as of 2026-04-28. The whole project is currently `continue-on-error: true` in CI (`.github/workflows/ci.yml`). Fixing files in this list flips them to gating coverage.

Common failure modes in this suite:

- **Cross-file mongoose connection race** — file 1's `afterAll` closes mongoose; file 2's `beforeAll` reconnects but the timing under jest workers can leave the first User.save() buffer-timing-out at the default 10s. PR #5 raised the buffer to 60s + waits for the `'connected'` event, which helped but didn't fully eliminate the race.
- **Test wants a feature the source doesn't ship** — assertion expects `result.foo`, source returns `result.bar`. Each is a one-line fix once you read both halves.
- **`require('../../server/index')` boots the full server** — fine post-PR #5 (boot block skipped under `JEST_WORKER_ID`), but means the tests live close to a real server instance with all middleware. Don't be surprised by global rate-limiters, etc.

## File-by-file

| File | Size | Status | Likely fix |
|---|---|---|---|
| `health.test.js` | 33 | **Passing** | — |
| `api.test.js` | 111 | Buffer-timeout on `User.save()` in `beforeAll` | Race condition (see common modes). Verify in CI; if still red there, switch to `tests/setup.js`'s shared connection instead of the local `mongoose.connect()` in `beforeAll`. |
| `oauth.test.js` | 155 | Buffer-timeout | Same race. Also: it calls `mongoose.connect()` itself; remove that and rely on the global setup. |
| `scheduler.test.js` | 109 | Buffer-timeout | Same race. |
| `viralPipeline.test.js` | 95 | Buffer-timeout | Same race. |
| `viralPipelineV2.test.js` | 108 | Buffer-timeout | Same race. |
| `socialMediaIntegration.test.js` | 90 | Buffer-timeout + assertion drift on Instagram mock-publish guard (matches the unit-suite skips noted in `tests/server/services/socialMediaService.test.js`) | Skip the Instagram assertions, fix the rest. |
| `subscriptionIntegration.test.js` | 122 | Buffer-timeout. Plan-name mismatch — test expects `subscription.plan === 'pro'` but new tier system uses `creator/pro/agency` (was `'monthly'/'annual'/etc`). | After PR #8's plan-name unification, retest. May already pass once Mongo is reachable. |
| `infrastructure.test.js` | 234 | Buffer-timeout + likely assertion drift (admin metrics shape) | Audit per assertion. |
| `workflows.test.js` | 259 | Buffer-timeout | Same race. |
| `ai.test.js` | 290 | Buffer-timeout + tests assume `googleAI.generateContent` mock that PR #4 changed (returns null on quota) | Update mocks to match the new return contract. |
| `e2e-flows.test.js` | 287 | Buffer-timeout. Long; tests cross-feature flows. | Highest-value to fix; needs the most time. |
| `error-scenarios.test.js` | 254 | Buffer-timeout + tests for 500s that PR #4 turned into graceful 200/empty (Supabase degrade) | Update assertions: `.expect(500)` → `.expect(200)` with empty payload check. |
| `server-startup.test.js` | 359 | Imports `server/index.js` — boots the server. PR #5 made this safe via `JEST_WORKER_ID` guard, so should be fine in CI. Buffer-timeout otherwise. | Verify in CI. |

## Strategic order to fix

1. **`api.test.js`, `oauth.test.js`, `scheduler.test.js`** — smallest files, similar shape; one fix-pattern across all three.
2. **`subscriptionIntegration.test.js`** — important for the Whop webhook story; verify it tests the new plan IDs from `client/lib/plans.ts`.
3. **`error-scenarios.test.js`** — assertions are wrong, not the source. ~5 line edits.
4. **`viralPipeline*.test.js`** — race-only.
5. **`ai.test.js`** — mock fixes.
6. **`e2e-flows.test.js`, `workflows.test.js`** — biggest scope, save for last.

## How to verify locally

The suite needs a real MongoDB on `localhost:27017`:

```bash
docker run -d --rm --name click-test-mongo -p 27017:27017 mongo:7
TZ=UTC NODE_ENV=test JWT_SECRET=test-secret-key MONGODB_URI=mongodb://localhost:27017/click-test \
  npx jest --selectProjects integration --testPathPattern=<file>
```

Without a local Mongo, every test buffer-times out — there's no point grading them.
