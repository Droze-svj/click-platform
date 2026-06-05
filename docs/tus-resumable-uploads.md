# Resumable Uploads (tus) — Flow & Staging QA Checklist

Large video uploads use the [tus](https://tus.io) protocol so a dropped
connection (or a closed tab) resumes from the last acknowledged offset instead
of restarting at zero. The classic multipart `POST /api/video/upload` remains as
an automatic fallback.

## How it works

**Client** — `client/app/dashboard/video/page.tsx`
- `tusUpload()` uploads in **8 MB chunks** with retry backoff
  (`retryDelays: [0, 1s, 3s, 5s, 10s]`).
- Before starting it calls `findPreviousUploads()` and, if a prior interrupted
  upload of the **same file** exists, `resumeFromPreviousUpload()` — this is what
  makes resume survive a full page reload / tab close (tus-js-client persists the
  upload URL by file fingerprint in `localStorage`).
- On completion it reads the `X-Content-Id` response header to deep-link the new
  content. If tus fails outright it falls back to `xhrUpload()` (classic).

**Server** — `server/routes/upload-tus.js`, mounted in `server/index.js`
- `@tus/server` + `FileStore` at `uploads/temp/tus`, mounted at
  `/api/upload/tus` **before** `express.json()` (raw chunk stream) with auth
  first so `req.user` is set for the completion hook.
- `onUploadCreate` rejects non-video extensions; `maxSize` = `MAX_FILE_SIZE`
  (default 5 GB).
- `onUploadFinish` creates the `Content` doc + enqueues processing (defensive —
  chunk data is safe even if this hook throws), and exposes `X-Content-Id`
  (listed in `Access-Control-Expose-Headers`).

## Lifecycle / cleanup

- Partial + finished tus files live under `uploads/temp/tus` and are governed by
  **tus's own per-upload expiration** (`TUS_EXPIRY_MS`, default **24h**) — this
  is the practical *resume window*.
- The generic 6-hour temp sweep **excludes** the `tus` dir (a directory's mtime
  doesn't bump when chunks are appended, so an mtime sweep would wipe paused
  uploads). Expired tus uploads are reaped separately via
  `cleanupExpiredTusUploads()` on the 6-hour cron.

### Tunables
| Env var | Default | Meaning |
|---|---|---|
| `MAX_FILE_SIZE` | `5368709120` (5 GB) | Max upload size |
| `TUS_EXPIRY_MS` | `86400000` (24h) | Resume window before an abandoned upload is swept |

## Staging QA checklist (interactive — needs a deployed env)

These require a real browser + network and can't be validated headlessly.

1. **Happy path** — upload a small (<8 MB, single chunk) and a large (>50 MB,
   multi-chunk) video; both complete and appear in the list, deep-linking via
   `X-Content-Id`.
2. **Mid-flight network drop** — start a large upload, kill Wi-Fi for ~15s mid
   transfer, restore. Upload resumes from the last offset (watch the progress %
   not reset; server PATCH continues at the prior `Upload-Offset`).
3. **Tab close + resume** — start a large upload, reach ~40%, close the tab,
   reopen and re-select the *same file*. It resumes from ~40% (a HEAD to the
   stored URL returns the offset) rather than restarting.
4. **Fallback** — block `/api/upload/tus` (e.g. 405 at the proxy) and confirm the
   client transparently falls back to `POST /api/video/upload`.
5. **Expiry** — confirm an abandoned partial older than `TUS_EXPIRY_MS` is gone
   after the next sweep, and that a partial *within* the window survives the
   6-hour generic temp sweep.
6. **Auth** — an unauthenticated upload is rejected; a completed upload's
   `Content` is owned by the right user.

## Notes
- Resume across reloads depends on `localStorage` (won't persist in private mode
  — the client falls back to a clean start, which is handled).
- The server must retain the partial file for resume; behind a load balancer,
  tus uploads must be sticky to one instance **or** use a shared store. The
  current `FileStore` is per-instance/local disk.
