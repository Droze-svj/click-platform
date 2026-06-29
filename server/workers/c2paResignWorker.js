// C2PA re-sign worker — re-signs a render that shipped UNSIGNED because the
// signer (c2pa-node / c2patool) was transiently unavailable at render time, so
// provenance is eventually applied instead of permanently missing (CLAUDE.md
// mandates strict signing). Enqueued by videoRenderService via addC2paResignJob.
//
// File-access note: the job re-signs the file at `inputPath` IN PLACE. That only
// works while the file is still on local disk (the common case for a fresh
// render). If it's already been moved to remote storage + the local copy cleaned,
// the job can't re-sign — it logs and stops (the original render emitted a loud
// alert, so the gap is already visible).
const fs = require('fs');
const logger = require('../utils/logger');
const c2paService = require('../services/c2paService');

async function processC2paResignJob(data) {
  const { inputPath, tree, jobId, userId, contentId } = data || {};

  if (!inputPath || !fs.existsSync(inputPath)) {
    // File gone — retrying won't help; finish (don't throw → no infinite retry).
    logger.warn('[c2pa-resign] source file no longer available; cannot re-sign', { jobId, inputPath });
    return { resigned: false, reason: 'file-unavailable' };
  }

  const result = await c2paService.signRender({ inputPath, tree, jobId, userId });
  if (!result || !result.signed) {
    // Signer STILL unavailable — throw so BullMQ retries with backoff (the
    // exponential delay gives c2patool/c2pa-node time to come back).
    throw new Error(`[c2pa-resign] signer still unavailable for job ${jobId}: ${result?.reason || 'unknown'}`);
  }

  await c2paService.persistAuthenticity({
    contentId,
    userId,
    jobId,
    signed: true,
    manifest: result.manifest,
    signer: result.signer,
    sha256: result.sha256,
  });
  logger.info('[c2pa-resign] render re-signed successfully', { jobId, signer: result.signer });
  return { resigned: true, signer: result.signer };
}

function initializeC2paResignWorker() {
  const { createWorker } = require('../services/jobQueueService');
  const { QUEUE_NAMES } = require('../queues');
  return createWorker(QUEUE_NAMES.C2PA_RESIGN, processC2paResignJob, { concurrency: 2 });
}

module.exports = { processC2paResignJob, initializeC2paResignWorker };
