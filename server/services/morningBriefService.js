// Morning Brief
// One screen a creator reads with their coffee: how the last week of posts is
// doing, what sales came in, what the audience keeps asking, what is waiting on
// them, and the ONE thing to make next. Built only from data Click actually
// holds — engagement on posted content, tracked conversions, inbound
// comments/DMs, pending sign-offs, the weekly digest's next-best actions — and
// it makes no AI call, so opening it never spends model quota. A section with
// no data says so instead of showing a made-up number.
//
// Delivery: an opt-in BriefSubscription (timezone + hour, default 07:00, and
// channels: in-app and/or email) read by a cronLock-guarded cron that runs
// every 15 minutes, so half-hour/quarter-hour timezones still get it at :00
// local. OFF unless ENABLE_BRIEF_CRONS=true AND autonomousMode allows.

const cron = require('node-cron');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { acquire, autonomousModeEnabled } = require('../utils/cronLock');
const { classifyIntent } = require('./commentTriageService');

const DAY_MS = 24 * 3600 * 1000;
const LOCK_TTL_MS = 30 * 60 * 1000;
const SWEEP_BATCH = 500;
const MAX_INBOUND = 500; // inbound comments scanned per brief
const DEFAULT_HOUR = 7;

// Words that say nothing about WHAT was asked.
const STOPWORDS = new Set((
  'a an and are as at be but by can could do does did for from get got have has how i if in is it its '
  + 'just like me my of on or please so that the their them there they this to was we what when where which '
  + 'who why will with would you your yours about any anyone also been best better good great really thanks '
  + 'thank much more some than then too very want need know make tell think should does dont cant whats hows '
  + 'video post content guys hey hi hello'
).split(' '));

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

function pctChange(current, prior) {
  const c = Number(current) || 0;
  const p = Number(prior) || 0;
  if (p <= 0) return null; // no baseline → no fabricated "+∞%"
  return round(((c - p) / p) * 100);
}

/**
 * Pure: find what the audience keeps asking. Counts, per question, the
 * distinct content words it uses; a word asked about in 2+ separate questions
 * is a theme. Returns the top themes with a real example question each (the
 * first one seen — callers pass newest first, so it is the latest phrasing).
 */
function extractQuestionThemes(questions, { max = 3, minCount = 2 } = {}) {
  const counts = new Map();
  const examples = new Map();
  for (const q of questions) {
    const text = String(q || '');
    const words = new Set(
      text.toLowerCase()
        .replace(/https?:\/\/\S+|[@#]\w+/g, ' ')
        .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/^['-]+|['-]+$/g, '').replace(/'s$/, ''))
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w)),
    );
    for (const w of words) {
      counts.set(w, (counts.get(w) || 0) + 1);
      if (!examples.has(w)) examples.set(w, text.trim().slice(0, 160));
    }
  }
  const ranked = [...counts.entries()]
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  // One theme per example question, so three themes are three different asks.
  const themes = [];
  const usedExamples = new Set();
  for (const [theme, count] of ranked) {
    const example = examples.get(theme);
    if (usedExamples.has(example)) continue;
    usedExamples.add(example);
    themes.push({ theme, count, example });
    if (themes.length >= max) break;
  }
  return themes;
}

/**
 * Pure: assemble the brief from gathered data. Every input is optional; a
 * missing source becomes an honest empty section.
 *
 * input: {
 *   now, week: {totalViews,totalEngagement,totalReach}, priorWeek: {...},
 *   sales: {day:{count,revenue,currency}, priorDay:{...}, week:{...}} | null,
 *   inbound: [{ text, createdAt }] (last 7 days), pending: { signoffs, replies },
 *   digestActions: [{ source, title, detail }]
 * }
 */
function buildBrief(input = {}) {
  const now = input.now != null ? Number(input.now) : Date.now();
  const week = input.week || {};
  const priorWeek = input.priorWeek || {};

  const views = Number(week.totalViews) || 0;
  const engagement = Number(week.totalEngagement) || 0;
  const performance = (views > 0 || engagement > 0) ? {
    window: 'Posts published in the last 7 days',
    views,
    viewsChangePct: pctChange(views, priorWeek.totalViews),
    engagement,
    engagementChangePct: pctChange(engagement, priorWeek.totalEngagement),
  } : null;

  let sales = null;
  if (input.sales && ((input.sales.week && input.sales.week.count) || (input.sales.day && input.sales.day.count))) {
    const day = input.sales.day || { count: 0, revenue: 0 };
    const priorDay = input.sales.priorDay || { count: 0, revenue: 0 };
    const wk = input.sales.week || { count: 0, revenue: 0 };
    sales = {
      currency: wk.currency || day.currency || 'USD',
      last24h: { count: day.count || 0, revenue: round(day.revenue) },
      revenueChangePct: pctChange(day.revenue, priorDay.revenue),
      last7d: { count: wk.count || 0, revenue: round(wk.revenue) },
    };
  }

  const inbound = Array.isArray(input.inbound) ? input.inbound : [];
  const dayAgo = now - DAY_MS;
  const classified = inbound.map((c) => ({ ...c, intent: classifyIntent(c.text) }));
  const questions = classified.filter((c) => c.intent === 'question');
  const leads24h = classified.filter((c) => c.intent === 'lead' && new Date(c.createdAt).getTime() >= dayAgo);
  const themes = extractQuestionThemes(questions.map((c) => c.text));
  const audience = {
    window: 'Comments and DMs from the last 7 days',
    scanned: inbound.length,
    questions: questions.length,
    leads24h: leads24h.length,
    themes,
  };

  const pending = input.pending || {};
  const needsYou = [];
  if (leads24h.length) needsYou.push({ id: 'leads', count: leads24h.length, label: `${leads24h.length} buying-intent comment${leads24h.length === 1 ? '' : 's'} in the last 24h`, link: '/dashboard/features#engage' });
  if (pending.replies) needsYou.push({ id: 'replies', count: pending.replies, label: `${pending.replies} AI repl${pending.replies === 1 ? 'y' : 'ies'} waiting for your approval`, link: '/dashboard/features#engage' });
  if (pending.signoffs) needsYou.push({ id: 'signoffs', count: pending.signoffs, label: `${pending.signoffs} sign-off${pending.signoffs === 1 ? '' : 's'} waiting in Approvals`, link: '/dashboard/approvals' });

  // Make next: what the audience keeps asking beats everything — it is demand
  // you can see. Then the weekly digest's learned next-best idea. Then advice.
  let makeNext;
  const digestIdea = (Array.isArray(input.digestActions) ? input.digestActions : []).find((a) => a && a.source === 'next-best' && a.title);
  if (themes.length) {
    const t = themes[0];
    makeNext = {
      source: 'audience',
      title: `Answer this: "${t.example}"`,
      why: `"${t.theme}" came up in ${t.count} separate questions this week.`,
    };
  } else if (digestIdea) {
    makeNext = { source: 'next-best', title: digestIdea.title, why: digestIdea.detail || 'From your weekly digest, based on your top performers.' };
  } else {
    makeNext = {
      source: 'baseline',
      title: 'Answer the question you hear most',
      why: 'Not enough comments or history yet to pick for you. The question people ask you in person is a safe bet.',
    };
  }

  return {
    generatedAt: new Date(now).toISOString(),
    performance,
    sales,
    audience,
    needsYou,
    makeNext,
    hasData: Boolean(performance || sales || inbound.length || needsYou.length),
  };
}

/** Pure: the one-paragraph notification text for a brief. */
function summarize(brief) {
  const parts = [];
  if (brief.performance) parts.push(`${brief.performance.views.toLocaleString('en-US')} views on this week's posts`);
  if (brief.sales) parts.push(`${brief.sales.last24h.count} sale${brief.sales.last24h.count === 1 ? '' : 's'} in 24h`);
  if (brief.needsYou.length) parts.push(`${brief.needsYou.reduce((n, x) => n + x.count, 0)} things need you`);
  const lead = parts.length ? `${parts.join(' · ')}. ` : '';
  return `${lead}Make next: ${brief.makeNext.title}`.slice(0, 500);
}

const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Pure: the brief as an email. Everything interpolated is escaped — audience
 * comment text flows into the themes and make-next title.
 */
function renderBriefEmail(brief, { appUrl = '' } = {}) {
  const base = String(appUrl || '').replace(/\/+$/, '');
  const link = (path) => escapeHtml(`${base}${path}`);
  const money = (n, cur) => {
    try { return Number(n).toLocaleString('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }); } catch (_) { return `${n} ${cur}`; }
  };
  const pct = (p) => (p == null ? '' : ` (${p >= 0 ? '+' : ''}${p}%)`);
  const rows = [];
  if (brief.performance) {
    rows.push(`<p><strong>${escapeHtml(brief.performance.views.toLocaleString('en-US'))}</strong> views${escapeHtml(pct(brief.performance.viewsChangePct))} · <strong>${escapeHtml(brief.performance.engagement.toLocaleString('en-US'))}</strong> engagements on posts from the last 7 days</p>`);
  }
  if (brief.sales) {
    rows.push(`<p><strong>${brief.sales.last24h.count}</strong> sale(s) in 24h · ${escapeHtml(money(brief.sales.last24h.revenue, brief.sales.currency))}${escapeHtml(pct(brief.sales.revenueChangePct))}</p>`);
  }
  const themes = brief.audience.themes.map((t) => `<li>${t.count}× “${escapeHtml(t.example)}”</li>`).join('');
  const needs = brief.needsYou.map((n) => `<li><a href="${link(n.link)}">${escapeHtml(n.label)}</a></li>`).join('');

  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
<h2 style="margin:0 0 12px">Your morning brief</h2>
<div style="border:1px solid #16a34a;border-radius:8px;padding:12px;margin-bottom:16px">
<p style="margin:0;font-size:12px;color:#16a34a;text-transform:uppercase">Make next</p>
<p style="margin:6px 0 0;font-size:16px">${escapeHtml(brief.makeNext.title)}</p>
<p style="margin:6px 0 0;font-size:13px;color:#555">${escapeHtml(brief.makeNext.why)}</p>
</div>
${rows.join('\n')}
${themes ? `<p style="margin-bottom:4px">Your audience keeps asking:</p><ul>${themes}</ul>` : ''}
${needs ? `<p style="margin-bottom:4px">Needs you:</p><ul>${needs}</ul>` : ''}
<p><a href="${link('/dashboard/features#brief')}">Open the full brief</a></p>
<p style="font-size:12px;color:#777">You get this because you turned on the morning brief. Change the time or turn it off in <a href="${link('/dashboard/settings?tab=notifications')}">Settings → Notifications</a>.</p>
</div>`;
  return { subject: 'Your morning brief', html, text: `${summarize(brief)}\n\nOpen it: ${base}/dashboard/features#brief\nChange or stop: ${base}/dashboard/settings?tab=notifications` };
}

// ── I/O ──────────────────────────────────────────────────────────────────────

async function salesBetween(userId, from, to) {
  const Conversion = require('../models/Conversion');
  if (!mongoose.Types.ObjectId.isValid(String(userId))) return { count: 0, revenue: 0, currency: 'USD' };
  const rows = await Conversion.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(String(userId)),
        'conversionData.timestamp': { $gte: new Date(from), $lt: new Date(to) },
      },
    },
    { $group: { _id: '$currency', count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$conversionValue', 0] } } } },
    { $sort: { revenue: -1 } },
  ]);
  // Mixed currencies are never summed together: report the largest one.
  const top = rows[0];
  return top ? { count: top.count, revenue: top.revenue, currency: top._id || 'USD' } : { count: 0, revenue: 0, currency: 'USD' };
}

/**
 * Gather everything for one user and build the brief. Each source fails soft
 * to an empty section — one broken source never blanks the whole brief.
 */
async function getBriefForUser(userId, { now = Date.now() } = {}) {
  const soft = async (label, fn, fallback) => {
    try { return await fn(); } catch (err) {
      logger.warn('[brief] source failed', { source: label, error: err.message });
      return fallback;
    }
  };
  const bi = require('./businessIntelligenceService');
  const SocialReply = require('../models/SocialReply');
  const PerformanceDigest = require('../models/PerformanceDigest');
  const { getPendingApprovalsCount } = require('./approvalService');

  const weekAgo = new Date(now - 7 * DAY_MS);
  const [week, twoWeeks, day, priorDay, salesWeek, inbound, replies, signoffs, digest] = await Promise.all([
    soft('engagement', () => bi.getEngagementMetrics(userId, weekAgo), {}),
    soft('engagement-prior', () => bi.getEngagementMetrics(userId, new Date(now - 14 * DAY_MS)), {}),
    soft('sales-24h', () => salesBetween(userId, now - DAY_MS, now), null),
    soft('sales-prior-24h', () => salesBetween(userId, now - 2 * DAY_MS, now - DAY_MS), null),
    soft('sales-7d', () => salesBetween(userId, weekAgo, now), null),
    soft('inbound', () => SocialReply.find({ userId: String(userId), createdAt: { $gte: weekAgo } })
      .select('inboundText createdAt').sort({ createdAt: -1 }).limit(MAX_INBOUND).lean(), []),
    soft('pending-replies', () => SocialReply.countDocuments({ userId: String(userId), status: 'pending_approval' }), 0),
    soft('pending-signoffs', () => getPendingApprovalsCount(userId), 0),
    soft('digest', () => PerformanceDigest.findOne({ userId: String(userId) }).sort({ periodStart: -1 }).select('nextActions').lean(), null),
  ]);

  // Prior week = (last 14 days) − (last 7 days), same as the weekly digest.
  const sub = (k) => Math.max(0, (Number(twoWeeks[k]) || 0) - (Number(week[k]) || 0));
  return buildBrief({
    now,
    week,
    priorWeek: { totalViews: sub('totalViews'), totalEngagement: sub('totalEngagement') },
    sales: salesWeek ? { day, priorDay, week: salesWeek } : null,
    inbound: (inbound || []).map((r) => ({ text: r.inboundText, createdAt: r.createdAt })),
    pending: { replies, signoffs },
    digestActions: (digest && digest.nextActions) || [],
  });
}

// ── Delivery ─────────────────────────────────────────────────────────────────

function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (_) { return false; }
}

/** Pure: local { date: 'YYYY-MM-DD', hour } for an instant in a timezone. */
function localClock(nowMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

/** Pure: should this subscription get its brief at `nowMs`? */
function isDue(sub, nowMs) {
  if (!sub || !sub.enabled || !isValidTimeZone(sub.timezone)) return false;
  const { date, hour } = localClock(nowMs, sub.timezone);
  const target = Number.isInteger(sub.hour) ? sub.hour : DEFAULT_HOUR;
  return hour === target && sub.lastSentLocalDate !== date;
}

/** Is an email provider configured on this server? */
function emailDeliveryAvailable() {
  try { return Boolean(require('./emailService').isEmailServiceAvailable()); } catch (_) { return false; }
}

async function defaultGetUserEmail(userId) {
  const User = require('../models/User');
  if (!mongoose.Types.ObjectId.isValid(String(userId))) return null;
  const u = await User.findById(userId).select('email').lean();
  return (u && u.email) || null;
}

/**
 * Send one brief over the subscriber's channels. Resolves true when at least
 * one channel delivered; throws when every chosen channel failed.
 */
async function sendBrief(sub, brief, deps) {
  const channels = sub.channels || {};
  const errors = [];
  let delivered = 0;
  if (channels.inApp !== false) {
    try {
      // 'high' priority: this is a brief the user explicitly scheduled, so an
      // "alerts: high only" preference must not silently drop it.
      const doc = await deps.notify(sub.userId, 'Your morning brief', summarize(brief), 'info', '/dashboard/features#brief', {
        category: 'brief', priority: 'high', data: { makeNext: brief.makeNext },
      });
      // null = skipped because in-app notifications are switched off in Settings.
      if (doc === null) throw new Error('in-app notifications are turned off in Settings');
      delivered += 1;
    } catch (err) { errors.push(`in-app: ${err.message}`); }
  }
  if (channels.email === true) {
    try {
      const to = await deps.getUserEmail(sub.userId);
      if (!to) throw new Error('no email address on the account');
      const res = await deps.sendEmail({ to, ...renderBriefEmail(brief, { appUrl: deps.appUrl }) });
      if (res && res.success === false) throw new Error(res.error || 'email not sent');
      delivered += 1;
    } catch (err) { errors.push(`email: ${err.message}`); }
  }
  if (!delivered) throw new Error(errors.join('; ') || 'no delivery channel selected');
  return true;
}

/** Send every brief that is due now. `deps` injectable for tests. */
async function deliverDueBriefs(nowMs = Date.now(), deps = {}) {
  const BriefSubscription = deps.BriefSubscription || require('../models/BriefSubscription');
  const getBrief = deps.getBriefForUser || getBriefForUser;
  const sendDeps = {
    notify: deps.createNotification || require('./notificationService').createNotification,
    sendEmail: deps.sendEmail || ((opts) => require('./emailService').sendEmail(opts)),
    getUserEmail: deps.getUserEmail || defaultGetUserEmail,
    appUrl: deps.appUrl != null ? deps.appUrl : (process.env.FRONTEND_URL || ''),
  };

  let sent = 0; let failed = 0; let after = null;
  for (;;) {
    const filter = after ? { enabled: true, _id: { $gt: after } } : { enabled: true };
    const batch = await BriefSubscription.find(filter).sort({ _id: 1 }).limit(SWEEP_BATCH).lean();
    if (!batch.length) break;
    for (const sub of batch) {
      if (!isDue(sub, nowMs)) continue;
      try {
        const brief = await getBrief(sub.userId, { now: nowMs });
        await sendBrief(sub, brief, sendDeps);
        // Mark per local date so the next 15-minute tick (or a restart) in the
        // same hour never double-sends.
        await BriefSubscription.updateOne({ _id: sub._id }, { $set: { lastSentLocalDate: localClock(nowMs, sub.timezone).date } });
        sent += 1;
      } catch (err) {
        failed += 1;
        logger.warn('[brief] delivery failed', { userId: String(sub.userId), error: err.message });
      }
    }
    after = batch[batch.length - 1]._id;
    if (batch.length < SWEEP_BATCH) break;
  }
  if (sent || failed) logger.info('[brief] delivery run complete', { sent, failed });
  return { sent, failed };
}

let tasks = [];

function briefEnabled() {
  return String(process.env.ENABLE_BRIEF_CRONS || '').toLowerCase() === 'true' && autonomousModeEnabled();
}

function startBriefCron() {
  if (tasks.length) return tasks;
  if (!briefEnabled()) {
    logger.info('[brief] disabled (set ENABLE_BRIEF_CRONS=true to activate).');
    return tasks;
  }
  // Every 15 minutes: send briefs whose local delivery hour it now is. The
  // first tick inside that hour is :00 local for every timezone offset that is
  // a multiple of 15 minutes (India +5:30, Nepal +5:45 included); later ticks
  // in the hour catch up after a restart, and lastSentLocalDate stops repeats.
  tasks.push(cron.schedule('*/15 * * * *', async () => {
    if (!briefEnabled() || mongoose.connection.readyState !== 1) return;
    const release = await acquire('briefCron:deliver', LOCK_TTL_MS);
    if (!release) return; // another instance holds it
    try { await deliverDueBriefs(); } catch (err) {
      logger.warn('[brief] delivery run failed', { error: err.message });
    } finally { await release(); }
  }));
  logger.info('[brief] started (ENABLE_BRIEF_CRONS=true): delivery check every 15 minutes.');
  return tasks;
}

function stopBriefCron() {
  for (const t of tasks) { try { t.stop(); } catch (_) { /* ignore */ } }
  tasks = [];
}

module.exports = {
  DEFAULT_HOUR,
  extractQuestionThemes,
  buildBrief,
  summarize,
  renderBriefEmail,
  getBriefForUser,
  emailDeliveryAvailable,
  sendBrief,
  isValidTimeZone,
  localClock,
  isDue,
  deliverDueBriefs,
  startBriefCron,
  stopBriefCron,
  briefEnabled,
};
