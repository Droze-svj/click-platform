# Click — Readiness Findings Ledger (Phase 0 ground truth)

Verified baseline + de-duplicated confirmed issues. Three audit agents produced a
larger list; this ledger keeps only what was **verified in code**, and explicitly
drops the agents' false alarms. Drives Phases 1–4.

## Baseline (current state on `main`)

- **jest:** 562 passing, 0 failing (exit 0). Green.
- **client build:** `next build` succeeds (91 pages, exit 0 — verified this session).
- **server eslint (full tree):** 915 problems = **2 errors** + 913 warnings (warnings are
  overwhelmingly `no-unused-vars`; not blocking but noisy — Phase 3 broadens CI lint).
- **server boots healthy**, `/api/health` ok, signed-media enforcing in prod.

## Verified NOT broken — audit FALSE ALARMS (do not "fix")

- **Render pipeline** — `routes/video/render.js` is well-built; `RENDER_OUTPUT_DIR`
  (line 156) + `ensureRenderDir` (line 160) ARE defined; lazy Remotion + ffmpeg fallback,
  watermark, tier clamping all present. The "undefined/broken" claim is wrong.
- **c2pa signer / boot sequence** — boot logs clean in prod (`c2patool 0.9.12 ready`).
- The agents' "UUID users get mock data" criticality is overstated **today**: prod runs
  **Mongoose-mode** (Supabase disabled) so users are Mongo ObjectIds → the `!isMongoId`
  branches aren't hit. Still fixed in Phase 2 for the silent-failure case + future Supabase.

## Confirmed issues

### AI (Phase 1)
- **A1 🔴 Prod AI is mock.** `GOOGLE_AI_API_KEY` unset in Render → `aiService.js:65` returns
  `'Check this out! 🔥 #…'`; same canned fallback at `:112`, `:127`, and across
  `detectHighlights`/`generateViralIdeas`/`extractQuotes`. Headline blocker. (User sets key.)
- **A2 🟠 Raw user text → prompts.** `aiService.js:107` `Content context: ${text}`, `:208`
  `Transcript: ${transcript}`, `:266` `Original content: ${text}`, multiple `${niche}`.
  Prompt-injection + truncation surface; no escape/size-cap at the interpolation sites
  (`assertPromptSize` exists at `aiRouter.js:138` but isn't called on these fields).
- **A3 🟠 Fallback masking.** Canned/empty AI output is indistinguishable from real output;
  `aiCallJsonValidated`'s `integrityVerified` isn't honored by callers; missing-key/
  all-providers-failed is invisible to users + ops.

### Functional (Phase 2)
- **F1 🟠 39 unmounted top-level route files** (dead — 404 if called):
  `admin-new, ai-content, ai-enhanced, ai-music-{admin,analytics,batch,generation,
  recommendations,templates}, automation-analytics, creative, creatorDna, digitalTwin,
  dmca, dubbing, hookEnsemble, 2, music-ai-suggestions, music-catalog{,-playlists,-sync},
  music-dynamic-generation, music-editing, music-learning, music-licensing{,-admin,
  -analytics,-compliance,-favorites,-sync,-tools,-transparency}, music-smart-sync, remix,
  retention-heatmap, style-vault, toolbox, trust, videoSharing`.
  Notes: `ai-content` is a **dead duplicate** (live path = `routes/ai/content-generation`);
  `2.js` is junk; `music-*` confirmed dead in the security audit. Phase 2: mount the few that
  should ship (assess `remix`, `creative`/`creatorDna`/`digitalTwin`, `videoSharing`), delete
  the rest, add a mount-coverage test.
- **F2 🟡 Fabricated user-facing metrics via `Math.random()`:** `video.js:1746` & `:1765`
  (moment/clip `score`), `video/hook-analysis.js:224` (`viralPotential`),
  `voiceHookService.js:566` & `:593` (engagement), `sceneWorkflowService.js:556-557`
  (`estimated*`, self-labeled "Placeholder"). (Already cleaned with explanatory comments:
  `ai-recommendations.js:57`, `hardwareNodeService.js:66` — leave those.) Make honest:
  return `{available:false}` instead of inventing numbers.
- **F3 🟡 2 eslint errors = a real no-op:** `scripts/encryptSocialTokens.js:46-47`
  `doc.accessToken = doc.accessToken` (self-assign) → the token-encryption **backfill script
  does nothing**. (Live write-path GCM encryption is fine; this is the migration script.)
- **F4 🟡 Dev/ObjectId empty-return fallbacks** (Phase 2 audit): `routes/intelligence.js`,
  `userStyleProfile.js`, `posts.js`, `analytics/core.js` — ensure a REAL DB/connection error
  surfaces (500 + clear error), never a phantom `{success:true,data:[]}`.

### Robustness / validation (Phase 2)
- **R1 🟡** Unclamped pagination + unvalidated `:id` params (500 instead of 400) on several
  routes; empty-catch swallows on a few user-facing handlers; voice-hooks temp-file `unlink`
  race. Fix with a reusable `validateObjectId` middleware + pagination clamp.

### Verification gate (Phase 3)
- **V1 🟠** Route-integration tests exist but **disabled** (`jest.config.js:51`); CI lint gates
  only 5 files; 0 client component tests; integration/e2e are `continue-on-error`. "Green CI"
  currently under-verifies the product. Re-enable/repair + broaden.
