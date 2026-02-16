# Phase 1 — Cloud Storage (context for Assignment #7)

Existing code to extend and unify. Use with `npm run assign 7` for the full assignment.

## Existing pieces

| File | What it does |
|------|----------------|
| **server/services/cloudStorageService.js** | S3 (AWS SDK v3) + Cloudinary; `uploadToProduction(file, folder)`, `getSecureAccessUrl(key)`; env: `AWS_*`, `CLOUDINARY_*` |
| **server/services/storageService.js** | Local/abstracted storage; align with cloudStorageService so one abstraction backs both |
| **server/routes/upload.js** | Main upload routes; migrate to use cloud storage when env is production or when S3/Cloudinary is configured |
| **server/routes/upload/chunked.js** | Chunked uploads; should write to S3/Cloudinary in production |
| **server/routes/upload/progress.js** | Upload progress; keep working with cloud uploads |
| **server/services/uploadProgressService.js** | Progress tracking; integrate with cloud upload flow |

## .env.example / production

- **AWS:** `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
- **Cloudinary:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## Tasks (from Assignment #7)

1. **Storage abstraction** — Single interface (e.g. `upload(file, options)`, `getUrl(key)`) that uses local disk when no cloud env, and S3 or Cloudinary when configured.
2. **Migrate file upload** — Point upload routes and chunked upload to the abstraction so production uses S3/Cloudinary.
3. **Video processing** — Ensure video pipeline reads/writes via the same abstraction (e.g. server/services/aiVideoEditingService.js, manual-editing, export services).
4. **CDN** — If using Cloudinary or S3 + CloudFront, add CDN base URL config and use it in `getUrl()` / `getSecureAccessUrl()`.

## Quick check

```bash
rg -n "uploadToProduction|getSecureAccessUrl|storageService|multer|upload" server/routes server/services/uploadProgressService.js server/services/cloudStorageService.js server/services/storageService.js
```

Then run `npm run assign 7` and create the GitHub issue from ASSIGNMENT_READY.md.
