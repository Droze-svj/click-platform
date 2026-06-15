# Private media access — `/uploads` hardening plan

**Status:** proposed. The enumeration vector + S3 public-read ACL are already fixed
(commit `89f1dfeb`, crypto-random non-identifying filenames + private S3 ACL). This
doc scopes the remaining work: stop serving private media to **unauthenticated**
callers.

## The problem

`server/index.js:1824-1827` mounts the upload tree publicly:

```js
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), STATIC_OPTS));
// (+ two sibling mounts)
```

There is **no auth** in front of it. Private user media lives under it — source
videos (`uploads/videos/`), per-user clips (`uploads/users/<userId>/clips/...`),
private `isPublic:false` user music (`uploads/user-music/`), exports
(`uploads/exports/`), processed renders, ingested videos. Anyone who **observes a
URL** (shared link, `Referer`, logs, a collaborator's API response) can download it
with **no token**.

**The hard constraint:** auth here is **Bearer-JWT only — no cookies**. Browsers
load media via `<img src>` / `<video src>`, which **cannot send an `Authorization`
header**. So a naive `app.use('/uploads', auth)` would break *all* media rendering.
That's why this needs a deliberate design + a small frontend change, not a one-line
gate. (Render *downloads* were already moved to a private dir + authed streaming
route — `routes/video/render.js` — but that pattern is too heavy for inline media.)

## Recommended approach — Option A: signed capability URLs (HMAC, short TTL)

Serve `/uploads` only when the request carries a valid, unexpired HMAC signature
the backend minted. The frontend keeps using `<img>/<video src>` unchanged — it
just renders whatever (now-signed) URL string the API hands it.

### Backend
1. **`server/utils/mediaUrlSigner.js`**
   - `signMediaUrl(pathOrUrl, ttlSec = 86400)` → appends `?exp=<unixSec>&sig=<hex>`
     where `sig = HMAC_SHA256(MEDIA_URL_SECRET, "<normalizedPath>\n<exp>")`.
   - `verifyMediaUrl(path, exp, sig)` → timing-safe compare + `exp > now`.
   - Secret: `process.env.MEDIA_URL_SECRET` (fall back to the JWT secret so it
     works out of the box; document setting a dedicated one).
2. **`server/middleware/requireSignedMedia.js`** — mounted **before** the three
   `/uploads` static mounts, flag-gated by `REQUIRE_SIGNED_MEDIA=true` (default
   off → current behavior, zero risk until enabled):
   - If the path matches a **PUBLIC allowlist** prefix (e.g. `music/` catalog,
     `thumbnails/` if public, fonts) → `next()` (serve unsigned).
   - Else require a valid `?exp&sig` → `next()`; otherwise `403`.
   - Keep `dotfiles: 'deny'`; express.static already strips `../`.
3. **Sign at the response boundary.** Wherever the API returns a media URL —
   `Content.originalFile.url`, `Music.file.url`, export URLs, clip URLs — pass it
   through `signMediaUrl`. Centralize in one `serializeMediaUrl(url)` helper used
   by the serializers so it's one place to maintain. Public-allowlisted paths are
   returned unsigned.

### Frontend (the coordination)
Mostly components already render the URL the API returns verbatim
(`<video src={content.originalFile.url}>`) — those keep working because that URL
is now signed. But a grep of `client/` for `/uploads` found a few **concrete spots
that construct the path themselves** and would therefore 403 under the gate — fix
these:
- **`client/components/AssetLibrary.tsx:175`** — `url: m.url || m.fileUrl ||
  \`/uploads/music/${m.filename}\``. The fallback builds an unsigned path; drop it
  (or only ever use the API-provided `m.url`/`m.fileUrl`, which is signed).
- **`client/public/sw.js:44`** — the service worker caches `/uploads/`. Include the
  `sig`/`exp` query in the SW cache key, or exclude signed private media from SW
  caching (otherwise a stale/cross-user cached response or a cached 403).
- **`client/next.config.js:32`** — the `/uploads/:path*` rewrite. Confirm it
  forwards the query string to the backend (Next.js rewrites preserve query by
  default) so `exp`/`sig` reach the gate.
- **`client/components/ChunkedUpload.tsx:96`** / `VideoAdvancedTools.tsx:20` —
  verify these are upload *inputs*/hints, not media-render `src`s (they appear to
  be; no change needed if so).
- Render output already uses an authed-blob fetch — leave it.
- Handle **expiry**: if a signed URL can outlive the page session, the component
  re-fetches the record (→ fresh signed URL) on a media `error` event. With a
  24h TTL this is rare.

### Why Option A
- Works with `<img>/<video>` (the signature rides in the query string — survives
  HTTP range requests for video seeking).
- **Protects existing predictable-named files too** — they now require a signature,
  so no rename/migration of old files is needed to close the hole.
- Stateless (no per-request DB lookup); CDN-friendly (include the query string in
  the cache key, or bypass cache for signed paths).
- Minimal frontend churn (the URL is still just a string from the API).

### Trade-offs
- A signed URL is a **bearer capability for its TTL** — shareable until it expires.
  Acceptable and bounded; pick the TTL to taste (24h is a good default; drop to 1h
  for the most sensitive types and rely on re-fetch).
- You must classify **public vs private** paths (the allowlist). Start
  private-by-default; add public prefixes explicitly.

## Alternative — Option B: authed streaming routes + private dir (NOT recommended for inline media)
Move private dirs out of the static root and serve via authed, ownership-checked
routes (the render-download pattern). True per-request ownership (not a shareable
capability), but the frontend must fetch **every** image/video via `fetch()`→blob→
objectURL, which is a large rework, heavier, and worse for CDN caching. Reserve
this pattern for genuine *downloads* (already done for renders), not inline media.

## Rollout

### Status (implemented — all code shipped to main)

- ✅ Signer util (`utils/mediaUrlSigner`) + enforcement middleware
  (`middleware/requireSignedMedia`, mounted before the `/uploads` static handlers).
- ✅ **Global API response signer** (`server/index.js`, `app.use('/api', …)`): deep-signs
  every `/uploads` URL in EVERY API JSON response at one point — so no route (incl. the
  video sub-routes mounted directly under `/api/video/*`) can leak an unsigned path.
  Supersedes the earlier per-route signers (now redundant-but-harmless / idempotent).
- ✅ Frontend consumes the signed `file.url`; service worker strips `exp`/`sig` from the
  cache key (so rotating signatures don't fragment the cache).
- ✅ Crypto-random filenames + private S3 ACL.
- ✅ **E2E-verified with the flag ON** (local): unsigned `/uploads/...` → 403, valid signed
  → 200, tampered → 403, `fonts/` public prefix → 200. Tests: `tests/server/signedMedia.test.js`,
  `tests/server/globalMediaSigner.test.js`.
- ⬜ **Only remaining step: flip `REQUIRE_SIGNED_MEDIA=true` in staging → prod** (ops).

### Cutover checklist

1. **Set the secret first.** Set `MEDIA_URL_SECRET` (32+ random bytes) — identical across
   ALL app instances/workers — so signatures verify regardless of which node serves the
   request. (If left unset it falls back to `JWT_SECRET`, which also works but couples the
   two secrets.) Deploy this with the flag still **off** — no behavior change.
2. **Staging: set `REQUIRE_SIGNED_MEDIA=true`.** Smoke-test each media surface logged in:
   editor (source video + clips + waveform/filmstrip), library, player (incl. range/seek),
   music panel, generated/processed assets, thumbnails, exports/render downloads. Every
   media URL is now `…?exp&sig`; anything that still renders a bare `/uploads/...` is a
   missed surface → sign that response (or, if genuinely public, add its prefix to
   `PUBLIC_MEDIA_PREFIXES`). The global signer should make this empty, but verify.
3. **Negative checks (staging):** a hand-crafted unsigned/expired `/uploads/...` → 403;
   a `fonts/` (public-prefix) asset → 200.
4. **CDN:** include `exp`/`sig` in the cache key for `/uploads/*` (or bypass cache for the
   private prefixes) so signed URLs aren't served from a stale-key cache.
5. **Production: set `REQUIRE_SIGNED_MEDIA=true`.**
6. **Rollback** is instant and safe: set `REQUIRE_SIGNED_MEDIA=false` (or unset). URLs keep
   being signed; only enforcement turns off. No data migration either way.

## Effort
~1–2 days backend (signer + middleware + wiring the response serializers) + a
half-day frontend audit/touch-up + staging E2E. The crypto-random filenames and
private S3 ACL are already done, so this is the last piece.

## Acceptance criteria
- An unauthenticated GET to a private `/uploads/...` path without a valid signature
  returns 403 when `REQUIRE_SIGNED_MEDIA=true`.
- Logged-in users see all their media (editor, library, player, exports) load
  normally; public assets load without a signature.
- Existing (old-named) private files are protected by the gate without a migration.
