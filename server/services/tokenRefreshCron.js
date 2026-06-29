// Token refresh cron — keeps OAuth access tokens fresh so the scheduled
// post worker never trips on an expired token while the user sleeps.
//
// Strategy: every 30 minutes, scan every user's connected accounts; for any
// account whose `expiresAt` is within the refresh window (90 min by default),
// call that platform's refresh function. Platforms with no expiry concept
// (Twitter PKCE issues 2h tokens, LinkedIn 60d, Facebook 60d, Google 1h,
// TikTok 24h) are all handled the same way because OAuthStorage normalises
// the `expiresAt` field across them.
//
// Failures are logged but never thrown — a single bad refresh shouldn't
// halt the rest of the loop. Permanent failures (revoked token, account
// disconnected on the platform side) need user action; we just stop trying.

const cron = require('node-cron');
const logger = require('../utils/logger');
const OAuthStorage = require('../utils/oauthStorage');
const { createClient } = require('@supabase/supabase-js');
const { acquire, autonomousModeEnabled } = require('../utils/cronLock');

const REFRESH_WINDOW_MS = 90 * 60 * 1000; // refresh anything expiring in <90m
const CRON_SCHEDULE = '*/30 * * * *'; // every 30 minutes
// Lock TTL: longer than the worst-case run we've observed plus headroom,
// so the lock doesn't auto-release mid-loop and let a second replica
// fire. 25m gives us a healthy margin under the 30m schedule.
const LOCK_TTL_MS = 25 * 60 * 1000;

let _started = false;

// Registry of refresh callers, keyed by platform. Each entry returns a
// fresh access token on success, throws on permanent failure. We resolve
// the function name (`refreshAccessToken` vs `refreshToken`) per-service
// because the platform services were authored at different times.
function getRefreshFn(platform) {
  try {
    switch (platform) {
    case 'google': {
      const svc = require('./googleOAuthService');
      return (userId, accountId) => svc.refreshAccessToken(userId, accountId);
    }
    case 'facebook': {
      const svc = require('./facebookOAuthService');
      return (userId) => svc.refreshAccessToken(userId);
    }
    case 'linkedin': {
      const svc = require('./linkedinOAuthService');
      return (userId) => svc.refreshAccessToken(userId);
    }
    case 'twitter': {
      const svc = require('./twitterOAuthService');
      return (userId) => svc.refreshToken(userId);
    }
    case 'tiktok': {
      const svc = require('./tiktokOAuthService');
      return (userId) => svc.refreshAccessToken(userId);
    }
    case 'youtube': {
      const svc = require('./youtubeOAuthService');
      return typeof svc.refreshAccessToken === 'function'
        ? (userId) => svc.refreshAccessToken(userId)
        : null;
    }
    case 'instagram': {
      const svc = require('./instagramOAuthService');
      return typeof svc.refreshAccessToken === 'function'
        ? (userId) => svc.refreshAccessToken(userId)
        : null;
    }
    default:
      return null;
    }
  } catch (err) {
    logger.warn('Token refresh: failed to load platform service', { platform, error: err.message });
    return null;
  }
}

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function isExpiringSoon(expiresAt) {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  if (!Number.isFinite(exp)) return false;
  return exp - Date.now() < REFRESH_WINDOW_MS;
}

async function runOnce() {
  if (!autonomousModeEnabled()) {
    logger.info('Token refresh cron skipped — autonomous mode disabled');
    return;
  }
  // Distributed lock — prevents a second replica (or fast-fire scheduler)
  // from running the same scan concurrently. Falls back to an in-process
  // memory flag when Redis is unavailable.
  const release = await acquire('tokenRefresh', LOCK_TTL_MS);
  if (!release) {
    logger.info('Token refresh cron skipped — another worker holds the lock');
    return;
  }
  const stats = { scanned: 0, refreshed: 0, failed: 0, skipped: 0 };
  try {
    // Paginate the scan so a large user base isn't loaded into memory all at once.
    const PAGE = 500;
    let _page = 0;
    let hasMore = true;
    while (hasMore) {
      const { data: users, error } = await supabase()
        .from('users')
        .select('id, social_links')
        .not('social_links', 'is', null)
        .range(_page * PAGE, _page * PAGE + PAGE - 1);
      if (error) {
        logger.error('Token refresh: Supabase fetch failed', { error: error.message });
        break;
      }
      if (!users || users.length === 0) break;

      for (const user of users) {
        const oauth = user.social_links?.oauth || {};
        for (const [platform, row] of Object.entries(oauth)) {
          if (!row || typeof row !== 'object') continue;
          // Walk accounts[] if it exists; fall back to the legacy flat shape
          // (single primary token at the row root) so legacy users get
          // refreshed too while their data migrates over time.
          const accounts = Array.isArray(row.accounts) && row.accounts.length > 0
            ? row.accounts
            : (row.accessToken ? [{ accountId: row.platformUserId || 'primary', expiresAt: row.expiresAt, refreshToken: row.refreshToken }] : []);
          for (const acc of accounts) {
            stats.scanned += 1;
            if (!acc.refreshToken) { stats.skipped += 1; continue; }
            if (!isExpiringSoon(acc.expiresAt)) { stats.skipped += 1; continue; }
            const refreshFn = getRefreshFn(platform);
            if (!refreshFn) { stats.skipped += 1; continue; }
            try {
              await refreshFn(user.id, acc.accountId);
              stats.refreshed += 1;
              logger.info('Token refreshed', { userId: user.id, platform, accountId: acc.accountId });
            } catch (err) {
              stats.failed += 1;
              logger.warn('Token refresh failed', {
                userId: user.id,
                platform,
                accountId: acc.accountId,
                error: err.message,
              });
            // No re-throw — keep walking the queue.
            }
          }
        }
      }
      hasMore = users.length === PAGE; // a full page may mean more remain; a short page is the last
      _page += 1;
    }
    logger.info('Token refresh cron complete', stats);
  } catch (err) {
    logger.error('Token refresh cron failed', { error: err.message });
  } finally {
    await release();
  }
}

function startTokenRefreshCron() {
  if (_started) return;
  _started = true;
  // First run after 60s so boot isn't slowed by a Supabase scan.
  setTimeout(() => { runOnce().catch((e) => logger.error('Initial token refresh failed', { error: e.message })); }, 60 * 1000);
  cron.schedule(CRON_SCHEDULE, () => {
    runOnce().catch((e) => logger.error('Token refresh tick failed', { error: e.message }));
  });
  logger.info('Token refresh cron started', { schedule: CRON_SCHEDULE, windowMinutes: REFRESH_WINDOW_MS / 60000 });
}

module.exports = {
  startTokenRefreshCron,
  runOnce,
};
