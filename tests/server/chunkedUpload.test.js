// Chunked upload hardening: the assembled destination is ALWAYS derived
// server-side (never a client outputPath → no arbitrary CWD overwrite), sessions
// are owner-bound, and size/index are capped.

const fs = require('fs');
const path = require('path');
const svc = require('../../server/services/chunkedUploadService');

const ASSEMBLED = path.join(__dirname, '../../uploads/assembled');

afterEach(() => {
  // best-effort cleanup of any files/sessions created
  for (const id of ['t-assemble', 't-owner', 't-cap', 't-idx']) {
    try { svc.cancelChunkedUpload(id, 'OWNER1'); } catch (_) { /* ignore */ }
  }
});

test('assembled file is written only under uploads/assembled, named by uploadId (ignores client paths)', async () => {
  const uploadId = 't-assemble';
  // filename carries a traversal attempt; only a sanitized extension survives.
  svc.initChunkedUpload(uploadId, 5, 1, '../../../.env', 'OWNER1');
  await svc.uploadChunk(uploadId, 0, Buffer.from('hello'), 5, 'OWNER1');
  const finalPath = await svc.assembleChunks(uploadId, 'OWNER1');

  expect(path.resolve(finalPath).startsWith(path.resolve(ASSEMBLED) + path.sep)).toBe(true);
  expect(path.basename(finalPath).startsWith(uploadId)).toBe(true);
  expect(path.basename(finalPath)).not.toContain('..');
  expect(fs.readFileSync(finalPath, 'utf8')).toBe('hello');
  fs.rmSync(finalPath, { force: true });
});

test('a non-owner cannot touch another user\'s upload session', async () => {
  const uploadId = 't-owner';
  svc.initChunkedUpload(uploadId, 5, 1, 'f.mp4', 'OWNER1');
  await expect(svc.uploadChunk(uploadId, 0, Buffer.from('x'), 1, 'ATTACKER')).rejects.toThrow(/not found/i);
  await expect(svc.assembleChunks(uploadId, 'ATTACKER')).rejects.toThrow(/not found/i);
  expect(svc.getChunkedUploadProgress(uploadId, 'ATTACKER')).toBeNull();
  expect(svc.getMissingChunks(uploadId, 'ATTACKER')).toBeNull();
  expect(svc.cancelChunkedUpload(uploadId, 'ATTACKER')).toBe(false);
  // the real owner is unaffected
  expect(svc.getChunkedUploadProgress(uploadId, 'OWNER1')).not.toBeNull();
});

test('enforces the declared size cap', async () => {
  const uploadId = 't-cap';
  svc.initChunkedUpload(uploadId, 4, 1, 'f.bin', 'OWNER1'); // declared total 4 bytes
  await expect(svc.uploadChunk(uploadId, 0, Buffer.from('toolong'), 7, 'OWNER1')).rejects.toThrow(/exceeds/i);
});

test('rejects an out-of-range chunk index', async () => {
  const uploadId = 't-idx';
  svc.initChunkedUpload(uploadId, 100, 2, 'f.bin', 'OWNER1'); // only chunks 0..1 valid
  await expect(svc.uploadChunk(uploadId, 5, Buffer.from('x'), 1, 'OWNER1')).rejects.toThrow(/invalid chunk/i);
});
