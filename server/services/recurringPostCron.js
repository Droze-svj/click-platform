// Recurring post cron — every 5 minutes, look for active templates
// whose `nextFireAt` has elapsed, and spawn a ScheduledPost for each.
// The existing scheduler/worker pipeline picks the spawned post up
// like any other scheduled post; we don't need a separate publishing
// path.
//
// Edge cases handled:
// - User pauses the template (active=false): cron skips, fire count unchanged.
// - Template's `endsAt` passed or `maxFires` reached: template auto-deactivates.
// - Time-of-day in a non-UTC timezone: we compute the next fire instant
//   in UTC by anchoring to the template's tz.
// - Content pool rotation: each fire takes the next item via `poolCursor`.

const cron = require('node-cron');
const logger = require('../utils/logger');
const RecurringPostTemplate = require('../models/RecurringPostTemplate');
const ScheduledPost = require('../models/ScheduledPost');
const { acquire, autonomousModeEnabled } = require('../utils/cronLock');

const CRON_SCHEDULE = '*/5 * * * *';
// Lock TTL safely below the 5m cadence so a hung run doesn't permanently
// block, but long enough that a normal run finishes inside its lock.
const LOCK_TTL_MS = 4 * 60 * 1000;
let _started = false;

/**
 * Compute the next fire timestamp (UTC) for a template, starting from
 * `from` (defaults to now). Returns null if the template has expired.
 *
 * Strategy: walk forward day-by-day from `from`, and for each day check
 * if it matches one of the template's daysOfWeek. If it does, compose
 * the fire time using `timeOfDay` in the template's timezone, convert
 * back to UTC, and if that instant is after `from`, return it.
 */
function computeNextFireAt(template, from = new Date()) {
  const { daysOfWeek, timeOfDay = '09:00', timezone = 'UTC', endsAt, maxFires } = template.cadence || {};
  if (template.fireCount >= (maxFires ?? Infinity)) return null;
  if (endsAt && new Date(endsAt) <= from) return null;
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return null;

  const [hourStr, minStr] = String(timeOfDay).split(':');
  const hour = Number(hourStr);
  const minute = Number(minStr || '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  // Walk up to 14 days ahead — enough to find a match for any weekly pattern.
  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const candidate = new Date(from);
    candidate.setUTCDate(candidate.getUTCDate() + dayOffset);
    // Set the candidate's local clock to the requested HH:MM in the
    // template's tz, then read back the UTC instant. We rely on
    // Intl.DateTimeFormat to convert tz-aware → UTC.
    const fireUtc = utcInstantForLocalClock(candidate, hour, minute, timezone);
    if (!fireUtc) continue;
    const fireDay = dayOfWeekInTz(fireUtc, timezone);
    if (!daysOfWeek.includes(fireDay)) continue;
    if (fireUtc.getTime() <= from.getTime()) continue;
    if (endsAt && fireUtc > new Date(endsAt)) return null;
    return fireUtc;
  }
  return null;
}

/** Compute the UTC instant for "HH:MM on this calendar day in this tz". */
function utcInstantForLocalClock(dateUtc, hour, minute, timezone) {
  try {
    // Get the YYYY-MM-DD of dateUtc as seen in the template's timezone.
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const ymd = fmt.format(dateUtc); // "2026-05-15"
    // Build an ISO string for that local clock-time. Naive — but accurate
    // enough at minute granularity, which is what we schedule at.
    const isoLocal = `${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    // Compute the offset for the template's tz at that local instant by
    // round-tripping through Intl. The result is the UTC instant.
    const tzOffsetMin = tzOffsetMinutes(timezone, new Date(isoLocal + 'Z'));
    const utcMs = new Date(isoLocal + 'Z').getTime() - tzOffsetMin * 60 * 1000;
    return new Date(utcMs);
  } catch (err) {
    logger.warn('recurringPostCron: bad timezone, falling back to UTC', { timezone, error: err.message });
    return new Date(Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth(), dateUtc.getUTCDate(), hour, minute, 0));
  }
}

function tzOffsetMinutes(timezone, atDate) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(atDate).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return Math.round((asUtc - atDate.getTime()) / 60000);
}

function dayOfWeekInTz(dateUtc, timezone) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
  const day = dtf.format(dateUtc);
  // Map short weekday name → 0..6 (Sunday=0)
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[day] ?? 0;
}

function nextContentFromTemplate(template) {
  if (Array.isArray(template.contentPool) && template.contentPool.length > 0) {
    const idx = (template.poolCursor || 0) % template.contentPool.length;
    return { content: template.contentPool[idx], newCursor: idx + 1 };
  }
  return { content: template.content || { text: '', mediaUrl: '', hashtags: [] }, newCursor: template.poolCursor };
}

async function runOnce() {
  if (!autonomousModeEnabled()) return;
  // Distributed lock — prevents duplicate ScheduledPosts when the app runs
  // on more than one replica. The previous in-process flag only guarded
  // double-runs inside a single Node process, so a horizontally-scaled
  // deploy would fire each recurring post twice.
  const release = await acquire('recurringPosts', LOCK_TTL_MS);
  if (!release) return;
  const stats = { evaluated: 0, fired: 0, deactivated: 0, errors: 0 };
  try {
    const now = new Date();
    const due = await RecurringPostTemplate.find({
      active: true,
      $or: [{ nextFireAt: null }, { nextFireAt: { $lte: now } }],
    }).limit(500);

    for (const tpl of due) {
      stats.evaluated += 1;
      try {
        // First time we see this template (nextFireAt unset): just project
        // the next fire and save — don't fire retroactively.
        if (!tpl.nextFireAt) {
          tpl.nextFireAt = computeNextFireAt(tpl, now);
          if (!tpl.nextFireAt) {
            tpl.active = false;
            stats.deactivated += 1;
          }
          await tpl.save();
          continue;
        }

        // Pre-flight: confirm the template's target platform still has
        // a connected account for this user. The previous version
        // blindly created ScheduledPosts for templates whose platform
        // the user had since disconnected — so a user who unhooked
        // TikTok kept piling up `failed_permanent` rows every cadence
        // tick for the lifetime of the template. We now auto-pause the
        // template AND surface a notification so the user knows why.
        try {
          const oauthService = require('./oauthService');
          const accounts = await oauthService.listSocialAccounts(tpl.userId, tpl.platform);
          const hasAny = Array.isArray(accounts) && accounts.length > 0;
          const hasSpecific = tpl.accountId
            ? accounts.some((a) => a.accountId === tpl.accountId || a.platformUserId === tpl.accountId)
            : hasAny;
          if (!hasAny || !hasSpecific) {
            logger.warn('Recurring template auto-paused — platform/account no longer connected', {
              templateId: String(tpl._id), userId: String(tpl.userId), platform: tpl.platform, accountId: tpl.accountId,
            });
            tpl.active = false;
            tpl.nextFireAt = null;
            await tpl.save();
            stats.deactivated += 1;
            // Best-effort in-app notification so the user can either
            // reconnect the platform or delete the template.
            try {
              const notificationService = require('./notificationService');
              await notificationService.createNotification(
                tpl.userId,
                'Recurring schedule paused',
                `Your recurring ${tpl.platform} schedule was paused because the account is no longer connected. Reconnect to resume.`,
                'warning',
                '/dashboard/recurring',
                { category: 'recurring', priority: 'normal', context: { templateId: String(tpl._id), platform: tpl.platform } },
              );
            } catch (_) { /* notification is best-effort */ }
            continue;
          }
        } catch (preflightErr) {
          // Don't pause the template on a transient storage hiccup; let
          // the post go through and the worker will surface the real
          // error if credentials are actually missing.
          logger.warn('Recurring pre-flight check failed; continuing', {
            templateId: String(tpl._id), error: preflightErr.message,
          });
        }

        const { content, newCursor } = nextContentFromTemplate(tpl);
        await ScheduledPost.create({
          userId: tpl.userId,
          platform: tpl.platform,
          accountId: tpl.accountId,
          content: {
            text: content.text || '',
            mediaUrl: content.mediaUrl || '',
            hashtags: content.hashtags || [],
          },
          scheduledTime: now,
          holdUntil: null,
          status: 'scheduled',
        });

        tpl.fireCount += 1;
        tpl.lastFiredAt = now;
        tpl.poolCursor = newCursor;
        const next = computeNextFireAt(tpl, now);
        if (!next) {
          tpl.active = false;
          tpl.nextFireAt = null;
          stats.deactivated += 1;
        } else {
          tpl.nextFireAt = next;
        }
        await tpl.save();
        stats.fired += 1;
      } catch (err) {
        stats.errors += 1;
        logger.warn('recurringPostCron: template fire failed', { templateId: tpl._id, error: err.message });
      }
    }

    if (stats.evaluated > 0) {
      logger.info('Recurring post cron tick', stats);
    }
  } catch (err) {
    logger.error('Recurring post cron failed', { error: err.message });
  } finally {
    await release();
  }
}

function startRecurringPostCron() {
  if (_started) return;
  _started = true;
  // Wait 30s for app boot to finish before the first tick.
  setTimeout(() => { runOnce().catch((e) => logger.error('Initial recurring cron failed', { error: e.message })); }, 30 * 1000);
  cron.schedule(CRON_SCHEDULE, () => {
    runOnce().catch((e) => logger.error('Recurring cron tick failed', { error: e.message }));
  });
  logger.info('Recurring post cron started', { schedule: CRON_SCHEDULE });
}

module.exports = {
  startRecurringPostCron,
  runOnce,
  computeNextFireAt,
};
