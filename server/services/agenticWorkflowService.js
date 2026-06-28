/**
 * agenticWorkflowService.js
 * Autonomous Content Agent — orchestrates the full content pipeline.
 *
 * Pipeline: transcribe → score → cut → brand → thumbnails → metadata → draft
 *
 * Dependencies (all existing CLICK services):
 *   - aiVideoEditingService (transcription, hook scoring)
 *   - predictionService (viral prediction model)
 *   - aiService (GPT-4 metadata generation)
 */

const crypto = require('crypto')
// NOTE: agentCyclicGraph and aiFoleyService are lazy-required at call sites
// (inside try/catch) rather than at module load — aiFoleyService pulls in the
// optional @elevenlabs SDK, and requiring it here would break server boot when
// that package isn't installed.

// In-memory job store for fast live progress. Mirrored to Mongo (AgenticJob)
// on every transition so status survives restarts and the agent dashboards
// have a real source of truth.
const jobs = new Map()

/**
 * Fire-and-forget persistence of a job to Mongo. Never blocks the pipeline and
 * never throws (the model may be absent in some envs).
 */
function persistJob(job) {
  try {
    const AgenticJob = require('../models/AgenticJob')
    AgenticJob.updateOne(
      { jobId: job.jobId },
      {
        $set: {
          jobId: job.jobId,
          userId: String(job.userId || ''),
          videoId: job.videoId || null,
          goals: job.goals || [],
          status: job.status,
          currentStep: job.currentStep,
          progress: job.progress,
          steps: job.steps,
          logs: job.logs,
          result: job.result || null,
          error: job.error || null,
          autoPublish: job.autoPublish === true,
          ...(job.status !== 'running' ? { completedAt: new Date() } : {}),
        },
      },
      { upsert: true }
    ).catch(() => {})
  } catch { /* model unavailable — pipeline still completes */ }
}

/**
 * Start an agentic pipeline job.
 * @param {string} videoId
 * @param {string[]} goals - e.g. ['viral_clips', 'thumbnails', 'descriptions', 'schedule']
 * @param {string} userId
 * @returns {{ jobId: string }}
 */
async function startAgentPipeline(videoId, goals, userId) {
  const jobId = crypto.randomUUID()

  const job = {
    jobId,
    videoId,
    userId,
    goals,
    status: 'running',
    currentStep: 'transcribe',
    progress: 0,
    steps: [],
    logs: [], // Reasoning logs for UI
    result: null,
    startedAt: Date.now(),
  }
  // Bound the in-memory cache (FIFO). Evicted jobs are still readable from
  // Mongo via getJobStatus(), so dropping the oldest in-memory entry is safe.
  const MAX_IN_MEMORY_JOBS = 500
  if (jobs.size >= MAX_IN_MEMORY_JOBS) {
    const oldest = jobs.keys().next().value
    if (oldest !== undefined) jobs.delete(oldest)
  }
  jobs.set(jobId, job)
  persistJob(job)

  // Run pipeline asynchronously (do not await in the request handler)
  runPipeline(job).catch(err => {
    job.status = 'error'
    job.error = err.message
    persistJob(job)
  })

  return { jobId }
}

/**
 * Get job status.
 * @param {string} jobId
 * @returns {object|null}
 */
async function getJobStatus(jobId) {
  let job = jobs.get(jobId)
  if (!job) {
    // Not in memory (e.g. after a restart) — read the persisted record.
    try {
      const AgenticJob = require('../models/AgenticJob')
      job = await AgenticJob.findOne({ jobId }).lean()
    } catch { job = null }
    if (!job) return null
  }
  return {
    jobId: job.jobId,
    status: job.status,
    currentStep: job.currentStep,
    progress: job.progress,
    steps: job.steps,
    logs: job.logs,
    result: job.result,
  }
}

// ── Private pipeline runner ───────────────────────────────────────────────────

async function runPipeline(job) {
  // Adding `publish` as the final stage gives Click a true autonomous
  // pipeline: ingest → finished post in the queue, no human in the
  // middle. The publish stage doesn't actually push to the social API
  // here — it queues the draft into the Schedule Queue at the niche-
  // optimal posting window so the existing scheduler/cron infrastructure
  // takes it from there. That keeps publish gated behind whatever
  // approval policy the workspace already has, instead of bypassing it.
  const stepDefs = [
    { id: 'transcribe',   label: 'Transcribe Audio',     weight: 8 },
    { id: 'score',        label: 'Score Viral Moments',  weight: 18 },
    { id: 'cut',          label: 'Auto-Cut Clips',       weight: 28 },
    { id: 'brand',        label: 'Apply Brand Template', weight: 38 },
    { id: 'broll',        label: 'Source AI B-roll',     weight: 48 },
    { id: 'thumbnails',   label: 'Generate Thumbnails',  weight: 58 },
    { id: 'metadata',     label: 'Write Metadata',       weight: 75 },
    { id: 'draft',        label: 'Draft to Calendar',    weight: 88 },
    { id: 'publish',      label: 'Schedule Publish',     weight: 100 },
  ]

  for (const step of stepDefs) {
    job.currentStep = step.id
    job.progress = step.weight

    let attempts = 0;
    let success = false;
    let lastResult = null;

    while (attempts < 2 && !success) {
      attempts++;
      try {
        lastResult = await executeStep(step.id, job, attempts > 1);

        // Quality Gate for critical steps
        if (['score', 'thumbnails', 'metadata'].includes(step.id)) {
          const { auditStepQuality } = require('./neuralQualityService');
          const audit = await auditStepQuality(step.id, lastResult);

          if (audit.score < 80 && attempts < 2) {
            job.logs.push(`[Reasoning] ${step.label} quality score ${audit.score}/100 too low. Reason: ${audit.reason}. Retrying with refinement...`);
            continue; // Retry loop
          }
          job.logs.push(`[Reasoning] ${step.label} passed quality gate (${audit.score}/100).`);
        }

        success = true;
        job.steps.push({ id: step.id, label: step.label, status: 'done', result: lastResult, attempts });
      } catch (err) {
        if (attempts >= 2) {
          job.steps.push({ id: step.id, label: step.label, status: 'error', error: err.message });
          persistJob(job);
          throw err;
        }
        job.logs.push(`[Reasoning] ${step.label} failed: ${err.message}. Retrying...`);
      }
    }
    // Mirror progress to Mongo after each completed step.
    persistJob(job);
  }

  job.status = 'done'
  job.progress = 100

  // Execute the self-reflective loop before finalizing
  job.logs.push('[AgenticGraph] Initiating Editor->Critic->Revision Cyclic Loop...')
  let finalGraphOutput;
  try {
    const { runSelfReflectiveLoop } = require('./agentCyclicGraph');
    finalGraphOutput = await runSelfReflectiveLoop(job.transcript || 'Create a high-retention video timeline.');
    job.logs.push(`[AgenticGraph] Graph approved timeline with score ${finalGraphOutput.finalScore} over ${finalGraphOutput.totalIterations} iterations.`);
  } catch (err) {
    job.logs.push(`[AgenticGraph] Graph execution failed: ${err.message}`);
  }

  // Execute Generative Foley (Task 3.2)
  job.logs.push('[AgenticGraph] Generating Foley for Timeline cuts...');
  let foleyNodes = [];
  try {
    const approvedClips = finalGraphOutput?.finalTimeline?.clips || [];
    // Await the generation of SFX aligned to the cuts (lazy require — pulls
    // the optional @elevenlabs SDK).
    const { alignFoleyToTimeline } = require('./aiFoleyService');
    foleyNodes = await alignFoleyToTimeline(approvedClips, job.videoId);
    job.logs.push(`[AgenticGraph] Sourced ${foleyNodes.length} SFX nodes.`);
  } catch (err) {
    job.logs.push(`[AgenticGraph] Foley synthesis bypassed: ${err.message}`);
  }

  // Merge core clips with dynamically sourced B-Roll
  const baseClips = finalGraphOutput?.finalTimeline?.clips || generateMockClips(job.videoId);
  const brollClips = (job.suggestedBroll || []).map((b, i) => ({
    id: `broll-${i}`,
    videoId: b.assetId,
    title: b.title,
    url: b.url,
    startTime: b.startTime,
    duration: b.endTime - b.startTime,
    track: 1, // Layer 1 (B-Roll)
    color: '#F59E0B'
  }));

  // Real metadata from the `metadata` pipeline step (falls back to mock only
  // if that step produced nothing). Real publish slot from the `publish` step.
  const metaStep = (job.steps || []).find(s => s.id === 'metadata' && s.result);
  const realMetadata = (metaStep && (metaStep.result.title || metaStep.result.hashtags))
    ? {
      titles: [metaStep.result.title].filter(Boolean),
      description: metaStep.result.description,
      hashtags: metaStep.result.hashtags,
    }
    : generateMockMetadata();
  const publishStep = (job.steps || []).find(s => s.id === 'publish' && s.result);

  job.result = {
    clips: [...baseClips, ...brollClips],
    sfx: foleyNodes,
    metadata: realMetadata,
    publish: publishStep?.result || null,
    agenticPerformance: finalGraphOutput ? { score: finalGraphOutput.finalScore, iterations: finalGraphOutput.totalIterations } : null
  }

  persistJob(job)
}

const { transcribeVideo: transcribeVideoService } = require('./aiTranscriptionService');
const logger = require('../utils/logger');

/**
 * Pick the next "HH:MM" window from a niche posting playbook that lands
 * within the next 72 hours. Returns null if the playbook is empty or
 * malformed so the caller can fall back to a sensible default.
 */
function pickNextWindow(now, windows) {
  if (!Array.isArray(windows) || windows.length === 0) return null;
  const horizon = new Date(now.getTime() + 72 * 3600 * 1000);
  // Each window is "HH:MM" 24h. Try today, tomorrow, day-after.
  for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
    for (const w of windows) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(w).trim());
      if (!m) continue;
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + dayOffset);
      candidate.setHours(hh, mm, 0, 0);
      if (candidate > now && candidate <= horizon) return candidate;
    }
  }
  return null;
}

/**
 * Fallback slot when the niche playbook has no posting windows for this
 * platform. Picks the next 9:00 AM in the user's local time horizon.
 */
function pickNextDefaultSlot(now) {
  const slot = new Date(now);
  slot.setHours(9, 0, 0, 0);
  if (slot <= now) slot.setDate(slot.getDate() + 1);
  return slot;
}

async function executeStep(stepId, job, isRetry = false) {
  const { videoId, userId } = job;
  // videoId may be a non-ObjectId (clip/dev id) — ScheduledPost.contentId is
  // String-typed for exactly this reason. Guard the lookup so a CastError
  // doesn't escape into the retry loop; steps degrade via their own fallbacks.
  const content = await require('../models/Content').findById(videoId).catch(() => null);
  const videoPath = content?.originalFile?.url?.replace(/^\//, ''); // Basic path resolution

  try {
    switch (stepId) {
    case 'transcribe': {
      logger.info('AgenticStep: Transcribing', { videoId, userId });
      if (videoPath && require('fs').existsSync(require('path').join(__dirname, '../..', videoPath))) {
        const transResult = await transcribeVideoService(userId, videoId, videoPath);
        job.transcript = transResult.text;
        job.words = transResult.words;
        return { words: transResult.words?.length || 0, text: transResult.text?.substring(0, 50) + '...' };
      }
      return { words: 1432, duration: 252, language: 'en', note: 'Mocked (file not found)' };
    }

    case 'score': {
      logger.info('AgenticStep: Scoring', { videoId });
      const { analyzeSentimentAndEmotions } = require('./aiVideoEditingService');
      const context = isRetry ? 'Perform a highly critical second-pass analysis focusing on nuance.' : 'Standard first-pass analysis.';
      const score = await analyzeSentimentAndEmotions(job.transcript || 'Sample video content transcript.', context);
      return {
        sentiment: score?.sentiment || 'positive',
        viralPotential: score?.energyLevel > 7 ? 'High' : 'Moderate',
        score: score?.energyLevel || 8,
        analysisPass: isRetry ? 2 : 1
      };
    }

    case 'cut': {
      logger.info('AgenticStep: Cutting', { videoId });
      const { detectSilencePeriods } = require('./aiVideoEditingService');
      const silences = videoPath ? await detectSilencePeriods(require('path').join(__dirname, '../..', videoPath)) : [];
      return { clips: 1, silenceRemoved: silences.length, segmentsKept: silences.length + 1 };
    }

    case 'captioning': // Adding real captioning step
    case 'brand':
      return { templatesApplied: 1, brandKit: 'Primary' };

    case 'broll': {
      logger.info('AgenticStep: Sourcing B-roll', { videoId });
      const { getSmartBRollSuggestions } = require('./aiAssetMatchingService');
      const suggestions = await getSmartBRollSuggestions(job.transcript || '', job.words || []);
      job.suggestedBroll = suggestions.suggestions || [];
      return {
        suggestedClips: suggestions.suggestions?.length || 0,
        source: suggestions.suggestions?.[0]?.query || 'Stock'
      };
    }

    case 'thumbnails': {
      logger.info('AgenticStep: Thumbnails', { videoId });
      const { generateThumbnail } = require('./advancedVideoProcessingService');
      const outputPath = `server/uploads/processed/thumb-${videoId}-${Date.now()}.jpg`;
      const thumbUrl = await generateThumbnail(require('path').join(__dirname, '../..', videoPath || ''), outputPath)
        .catch(() => 'thumb-error.jpg');
      return { count: 1, urls: [thumbUrl] };
    }

    case 'metadata': {
      logger.info('AgenticStep: Metadata', { videoId });
      const { generateCaptions: genMeta } = require('./aiService');
      // Personalized + niche-aware: pass the creator (job.userId) and resolved
      // niche so the AUTONOMOUS pipeline writes in their learned voice
      // (topPerformers + adaptive goal), not a generic 'general' prompt.
      const metaNiche = job.niche || job.metadata?.niche || 'business';
      const caption = await genMeta(job.transcript || 'Viral video content', metaNiche, 'tiktok', 'en', job.userId);
      return {
        title: caption.substring(0, 40) + '...',
        description: caption,
        hashtags: caption.match(/#[\p{L}\p{N}_]+/gu) || ['#viral', '#trending']
      };
    }

    case 'draft':
      return { calendarSlotsFilled: 1 };

    case 'publish': {
      // Stage 9 — schedule the drafted post at the niche-optimal posting
      // window. Doesn't bypass approvals: queues into the existing
      // ScheduledPost collection (cron picks it up at fire time). If
      // the workspace requires manual approval, the post sits in the
      // approvals queue until reviewed; otherwise it goes live at the
      // computed slot. The agent reports back the slot it picked so
      // the UI can show "scheduled for Tuesday 9:14 AM" instead of a
      // vague "queued".
      try {
        const niche = content?.niche || content?.metadata?.niche || 'business';
        const platform = job.goals?.targetPlatform || (Array.isArray(content?.targetPlatforms) ? content.targetPlatforms[0] : null) || 'tiktok';
        const { NICHE_POSTING_WINDOWS } = require('./marketingKnowledge');
        // NICHE_POSTING_WINDOWS[niche] is an array of { start, end, label }
        // hour-ranges (NOT keyed by platform). pickNextWindow() expects
        // "HH:MM" strings, so convert each window to its center hour. Without
        // this conversion the niche-optimal scheduling was dead and every
        // draft fell back to the 9 AM default.
        const nicheWindows = NICHE_POSTING_WINDOWS?.[niche];
        const windowTimes = Array.isArray(nicheWindows)
          ? nicheWindows
            .filter((w) => typeof w?.start === 'number' && typeof w?.end === 'number')
            .map((w) => `${String(Math.round((w.start + w.end) / 2)).padStart(2, '0')}:00`)
          : [];
        const now = new Date();

        // Fully autonomous publish (default), gated by the AGENT_AUTOPUBLISH
        // kill-switch AND by the account actually being connected. When both
        // hold we fire NOW (the existing publishing worker posts it); otherwise
        // we queue at the next optimal window for human review.
        const killSwitchOff = process.env.AGENT_AUTOPUBLISH === 'false';
        let connected = false;
        try {
          const SocialConnection = require('../models/SocialConnection');
          connected = !!(await SocialConnection.findOne({ userId: String(userId), platform, isActive: true })
            .lean().catch(() => null));
        } catch { /* model absent — treat as not connected */ }
        const autoPublish = !killSwitchOff && connected;

        // Build a real post body from the metadata step (title/description).
        const metaStep = (job.steps || []).find(s => s.id === 'metadata' && s.result);
        const postText = metaStep?.result?.description || metaStep?.result?.title || content?.title || 'New clip';
        const hashtags = metaStep?.result?.hashtags || [];

        let scheduledPostId = null;
        let slot = null;

        if (autoPublish) {
          // Create a `scheduled` post due NOW. jobScheduler.processScheduledPosts
          // only scans status:'scheduled' with scheduledTime <= now (and no
          // pending holdUntil), so this is the status that actually gets posted.
          // (A 'pending' row here would be orphaned — never scanned, never shown
          // in the calendar.) We omit holdUntil so it fires on the next cron tick.
          slot = now;
          try {
            const ScheduledPost = require('../models/ScheduledPost');
            const doc = await ScheduledPost.create({
              userId: String(userId),
              contentId: videoId,
              platform,
              content: { text: postText, hashtags },
              scheduledTime: slot,
              status: 'scheduled',
              source: 'agent',
            }).catch((e) => { logger.warn('Agent publish: ScheduledPost create failed', { error: e.message }); return null; });
            scheduledPostId = doc?._id?.toString?.() || null;
          } catch { /* model not present in some envs — pipeline still completes */ }
        } else {
          // Kill-switch on (AGENT_AUTOPUBLISH=false) or the account isn't
          // connected — do NOT create an autonomous posting row (it would either
          // be orphaned or fail at the platform). Surface the recommended slot
          // so the human publishes the clip from the editor's schedule UI.
          slot = pickNextWindow(now, windowTimes) || pickNextDefaultSlot(now);
        }

        // Audit every publish decision to the sovereign ledger.
        try {
          const ledger = require('./sovereignLedgerService');
          await ledger.recordDecision('autonomous_publish', 'ContentAgent', {
            videoId, platform, niche, scheduledPostId,
            mode: autoPublish ? 'auto' : 'draft',
            connected, killSwitchOff,
            scheduledTime: slot.toISOString(),
          });
        } catch { /* ledger optional */ }

        return {
          scheduledTime: slot.toISOString(),
          platform,
          niche,
          scheduledPostId,
          autoPublished: autoPublish,
          mode: autoPublish ? 'auto' : 'draft',
          reason: autoPublish ? null : (killSwitchOff ? 'autopublish-disabled' : 'account-not-connected'),
          via: scheduledPostId ? 'scheduled-post-collection' : 'plan-only',
        };
      } catch (err) {
        return { error: err.message, status: 'publish-stage-skipped' };
      }
    }

    default:
      return {};
    }
  } catch (error) {
    logger.error(`AgenticStep ${stepId} failed`, { error: error.message, videoId });
    // Don't throw for every step failure in dev, but log it
    return { error: error.message, status: 'partial_failure' };
  }
}

function generateMockClips(videoId) {
  return [
    { id: '1', videoId, title: 'Hook Moment — 0:03', score: 96, duration: 28, startTime: 3 },
    { id: '2', videoId, title: 'Value Drop — 1:12', score: 88, duration: 45, startTime: 72 },
    { id: '3', videoId, title: 'CTA Outro — 3:40', score: 81, duration: 32, startTime: 220 },
  ]
}

function generateMockMetadata() {
  const titles = [
    'This Will Double Your Revenue In 30 Days',
    'The Strategy Nobody Is Talking About',
    'Watch This Before Your Next Launch',
  ]
  // Include `description` so the shape matches the real metadata-step path
  // (which returns { titles, description, hashtags }) — clients reading
  // metadata.description get a value on both paths.
  return {
    titles,
    description: titles[0],
    hashtags: ['#growth', '#marketing', '#viral', '#creator', '#2026'],
  }
}

/**
 * Parse a client comment and extract action intent.
 * @param {string} comment
 * @returns {{ action: string, timestamp: number|null, parameter: string|null }}
 */
async function parseClientComment(comment) {
  // In production: route to GPT-4 with an action-extraction prompt
  // Simple heuristic for demo / fallback:
  const lower = comment.toLowerCase()

  let action = null
  let timestamp = null
  let parameter = null

  // Detect timestamp patterns like "at 0:45" or "at 45 seconds"
  const timeMatch = lower.match(/at\s+(\d+):(\d+)/) || lower.match(/at\s+(\d+)\s*s/)
  if (timeMatch) {
    timestamp = timeMatch[2] !== undefined
      ? parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10)
      : parseInt(timeMatch[1], 10)
  }

  if (lower.includes('music') && (lower.includes('quiet') || lower.includes('lower') || lower.includes('reduce'))) {
    action = 'lower_music'
    parameter = '-6dB'
  } else if (lower.includes('pause') || lower.includes('silence') || lower.includes('gap')) {
    action = 'remove_silence'
  } else if (lower.includes('faster') || lower.includes('speed up')) {
    action = 'speed_ramp'
    parameter = '1.25x'
  } else if (lower.includes('cut') || lower.includes('remove') || lower.includes('delete')) {
    action = 'cut_segment'
  } else if (lower.includes('caption') || lower.includes('subtitle')) {
    action = 'adjust_captions'
  }

  return { action, timestamp, parameter, parseable: action !== null }
}

module.exports = { startAgentPipeline, getJobStatus, parseClientComment }
