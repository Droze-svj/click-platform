// Google Search Console client.
//
// Reads (not writes) top queries / impressions / CTR for verified sites
// owned by the connected Google account. Feeds the same insights
// pipeline that ScheduledPost analytics + YouTube Analytics flow into,
// so the prompt builder's `topPerformers` block can suggest topic
// angles that are already pulling traffic.
//
// Auth path mirrors youtubeAnalyticsService — multi-account aware,
// returns `{ connected: false }` when Google isn't linked rather than
// throwing.

const { google } = require('googleapis');
const logger = require('../utils/logger');
const OAuthService = require('./oauthService');

const LOG_CONTEXT = { service: 'search-console' };

async function buildOAuthClient(userId, accountId = null) {
  // Same credential-resolution path as youtubeAnalyticsService — falls
  // back to YOUTUBE_CLIENT_ID/SECRET when GOOGLE_* aren't separately set.
  const { getGoogleClientId, getGoogleClientSecret, getGoogleCallbackUrl } = require('./googleOAuthService');
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) return null;
  const creds = await OAuthService.getSocialCredentials(userId, 'google', accountId).catch(() => null);
  if (!creds || !creds.accessToken) return null;
  const client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    getGoogleCallbackUrl() || undefined
  );
  client.setCredentials({
    access_token: creds.accessToken,
    refresh_token: creds.refreshToken || undefined,
    expiry_date: creds.expiresAt ? new Date(creds.expiresAt).getTime() : undefined,
  });
  return client;
}

/**
 * Every verified site the user owns. Returns `[{ siteUrl, permissionLevel }]`.
 */
async function listSites(userId, { accountId = null } = {}) {
  const auth = await buildOAuthClient(userId, accountId);
  if (!auth) return { connected: false, reason: 'google_not_connected', sites: [] };
  try {
    const webmasters = google.webmasters({ version: 'v3', auth });
    const resp = await webmasters.sites.list({});
    const sites = (resp.data?.siteEntry || []).map((s) => ({
      siteUrl: s.siteUrl,
      permissionLevel: s.permissionLevel || null,
    }));
    return { connected: true, sites };
  } catch (err) {
    logger.error('Search Console list-sites failed', { ...LOG_CONTEXT, userId, error: err.message });
    return { connected: true, error: err.message, sites: [] };
  }
}

/**
 * Top search queries for a verified site over the last `days` days.
 * Returns `{ queries: [{ query, clicks, impressions, ctr, position }] }`,
 * ordered by clicks descending. Mirrors what the Search Console "Top
 * queries" report shows in the UI.
 */
async function getTopQueries(userId, siteUrl, { days = 28, limit = 50, accountId = null } = {}) {
  const auth = await buildOAuthClient(userId, accountId);
  if (!auth) return { connected: false, reason: 'google_not_connected', queries: [] };
  if (!siteUrl) return { connected: true, queries: [], reason: 'siteUrl_required' };

  try {
    const webmasters = google.webmasters({ version: 'v3', auth });
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const resp = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: Math.max(1, Math.min(1000, limit)),
        orderBy: [{ field: 'clicks', descending: true }],
      },
    });
    const queries = (resp.data?.rows || []).map((r) => ({
      query: r.keys?.[0] || '',
      clicks: Number(r.clicks || 0),
      impressions: Number(r.impressions || 0),
      ctr: Number(r.ctr || 0),
      position: Number(r.position || 0),
    }));
    return { connected: true, siteUrl, window: { startDate, endDate, days }, queries };
  } catch (err) {
    logger.error('Search Console top-queries failed', { ...LOG_CONTEXT, userId, siteUrl, error: err.message });
    return { connected: true, error: err.message, queries: [] };
  }
}

/**
 * 28-day day-by-day trend for a single query on a site. Returns
 * `{ trend: [{ date, clicks, impressions, ctr, position }] }`.
 */
async function getQueryTrend(userId, siteUrl, query, { accountId = null } = {}) {
  const auth = await buildOAuthClient(userId, accountId);
  if (!auth) return { connected: false, reason: 'google_not_connected', trend: [] };
  if (!siteUrl || !query) return { connected: true, trend: [], reason: 'siteUrl_and_query_required' };

  try {
    const webmasters = google.webmasters({ version: 'v3', auth });
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const resp = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        dimensionFilterGroups: [{
          filters: [{ dimension: 'query', operator: 'equals', expression: query }],
        }],
        rowLimit: 1000,
      },
    });
    const trend = (resp.data?.rows || []).map((r) => ({
      date: r.keys?.[0] || null,
      clicks: Number(r.clicks || 0),
      impressions: Number(r.impressions || 0),
      ctr: Number(r.ctr || 0),
      position: Number(r.position || 0),
    }));
    return { connected: true, siteUrl, query, trend };
  } catch (err) {
    logger.error('Search Console query-trend failed', { ...LOG_CONTEXT, userId, siteUrl, query, error: err.message });
    return { connected: true, error: err.message, trend: [] };
  }
}

module.exports = {
  listSites,
  getTopQueries,
  getQueryTrend,
};
