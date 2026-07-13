#!/usr/bin/env node
/**
 * Seed five realistic test personas into MongoDB so the user can validate
 * the full Click flow as if Click were live, without each test account
 * needing a separate real OAuth handshake to every social platform.
 *
 * Per persona this creates:
 *   - User (bcrypt-hashed via the model's pre-save hook)
 *   - Workspace owned by the user
 *   - 3 Content records (1 completed w/ captions, 1 processing, 1 failed)
 *   - 3 ScheduledPost records (1 posted w/ analytics, 1 dry-run scheduled,
 *     1 cancelled — exercises every status code path)
 *   - UserStyleProfile is left empty; gets populated naturally on first
 *     edit, which is what the continuous-learning loop expects.
 *
 * Idempotent: re-running updates the existing records instead of failing
 * on unique-email conflicts. Safe to run from a script that the user
 * triggers multiple times during testing.
 *
 * Usage:
 *   node scripts/seed-test-users.js
 *
 * Env: reads MONGODB_URI from the project root .env (same path the server
 * uses), so credentials match the running app.
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Match the load order the server uses (root .env, then optional .env.local).
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

const User = require('../server/models/User');
const Workspace = require('../server/models/Workspace');
const Content = require('../server/models/Content');
const ScheduledPost = require('../server/models/ScheduledPost');

// ── Personas ──────────────────────────────────────────────────────────────
// Five distinct niche playbooks (out of the 8 in marketingKnowledge.js)
// so the strategist + variants surfaces produce visibly different replies
// when the user logs in as each.
const PERSONAS = [
  {
    name: 'Sarah Chen',
    email: 'sarah@click.test',
    password: 'TestPass123!',
    niche: 'health',
    handle: 'sarahchen',
    connected: ['twitter', 'youtube'],
    sampleTitles: [
      'Morning routine that actually moves the needle',
      'Why your protein timing is wrong',
      'Sleep hack that beat my Oura ring score',
    ],
    sampleHashtags: ['health', 'wellness', 'morningroutine'],
  },
  {
    name: 'Marcus Rodriguez',
    email: 'marcus@click.test',
    password: 'TestPass123!',
    niche: 'finance',
    handle: 'marcusmoney',
    connected: ['linkedin', 'twitter'],
    sampleTitles: [
      '5 IRA mistakes that cost me $4,237',
      'Tax loophole nobody told you about',
      'How I went from $0 to $10K MRR in 90 days',
    ],
    sampleHashtags: ['finance', 'taxes', 'sidehustle'],
  },
  {
    name: 'Emma Wallace',
    email: 'emma@click.test',
    password: 'TestPass123!',
    niche: 'education',
    handle: 'emmateaches',
    connected: ['tiktok', 'instagram'],
    sampleTitles: [
      'Things they don\'t teach you about studying',
      'My exact note-taking system explained',
      '3 frameworks that changed how I learn',
    ],
    sampleHashtags: ['education', 'studytok', 'learning'],
  },
  {
    name: 'Alex Kim',
    email: 'alex@click.test',
    password: 'TestPass123!',
    niche: 'technology',
    handle: 'alexbuilds',
    connected: ['youtube', 'twitter'],
    sampleTitles: [
      'Cursor vs Copilot — 30 day shootout',
      'Build-in-public week 6: shipping the API',
      'My terminal setup beats $100/month tools',
    ],
    sampleHashtags: ['tech', 'buildinpublic', 'developer'],
  },
  {
    name: 'Jordan Blake',
    email: 'jordan@click.test',
    password: 'TestPass123!',
    niche: 'entertainment',
    handle: 'jordanblake',
    connected: ['tiktok', 'instagram', 'twitter', 'youtube'],
    sampleTitles: [
      'When the bass drops — wait for it',
      'POV: you walk into the wrong meeting',
      'Reaction: this AI ad is unhinged',
    ],
    sampleHashtags: ['comedy', 'reaction', 'pov'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

/** Build the full oauth sub-document for a user. Connected platforms get
 *  `connected: true` + a fake username so the social-vault UI shows the
 *  "@handle" badge. We deliberately leave accessToken null — that way a
 *  real-publish attempt fails loudly with 401 instead of silently posting
 *  garbage to a real account. */
function buildOAuth({ handle, connected }) {
  const all = ['twitter', 'linkedin', 'facebook', 'youtube', 'tiktok', 'instagram'];
  const oauth = {};
  for (const p of all) {
    const isOn = connected.includes(p);
    oauth[p] = {
      connected: isOn,
      ...(isOn ? {
        connectedAt: new Date(),
        platformUsername: `@${handle}`,
        platformUserId: `seed-${p}-${handle}`,
      } : {}),
    };
  }
  return oauth;
}

/** Three Content records per persona, exercising completed/processing/failed
 *  status code paths. The completed one carries seeded captions + transcript
 *  so the captions auto-translate route has something to translate. */
async function seedContent({ user, persona }) {
  const baseCaption = 'This is a sample transcript. Hello and welcome to my channel. Today we are going to talk about something important. Stay tuned.';
  const sampleSegments = [
    { start: 0, end: 3.2, text: 'This is a sample transcript.' },
    { start: 3.2, end: 6.1, text: 'Hello and welcome to my channel.' },
    { start: 6.1, end: 10.5, text: 'Today we are going to talk about something important.' },
    { start: 10.5, end: 13.0, text: 'Stay tuned.' },
  ];
  const userIdString = String(user._id);

  const docs = [
    {
      userId: userIdString,
      type: 'video',
      title: persona.sampleTitles[0],
      description: `${persona.niche} content — completed render with captions ready.`,
      status: 'completed',
      transcript: baseCaption,
      language: 'en',
      captions: {
        text: baseCaption,
        language: 'en',
        format: 'srt',
        segments: sampleSegments,
        words: [],
        formatted: sampleSegments.map((s, i) => `${i + 1}\n00:00:0${Math.floor(s.start)},000 --> 00:00:0${Math.floor(s.end)},000\n${s.text}\n`).join('\n'),
        generatedAt: new Date(),
        translations: {},
      },
    },
    {
      userId: userIdString,
      type: 'video',
      title: persona.sampleTitles[1],
      description: `${persona.niche} content — currently processing, simulates the loading UI.`,
      status: 'processing',
    },
    {
      userId: userIdString,
      type: 'video',
      title: persona.sampleTitles[2],
      description: `${persona.niche} content — render failed, exercises the error UI.`,
      status: 'failed',
    },
  ];

  // Idempotent: clear this user's seeded test content first so re-runs are
  // clean. Real user content (anything created via the actual app) wouldn't
  // exist on these test accounts — they're fresh.
  await Content.deleteMany({ userId: userIdString });
  const created = await Content.insertMany(docs);
  return created;
}

/** Three ScheduledPost records per persona — one already posted (with
 *  synthetic analytics so the analytics page renders), one scheduled with
 *  dryRun:true (hits the safety-hold cancel-window UI), one cancelled. */
async function seedScheduledPosts({ user, persona, contentIds }) {
  const userIdString = String(user._id);
  const platform = persona.connected[0]; // primary platform for posts
  const text = `${persona.sampleTitles[0]} #${persona.sampleHashtags.join(' #')}`;
  const now = Date.now();

  const docs = [
    // 1. Posted 2 days ago with synthetic analytics
    {
      userId: userIdString,
      contentId: contentIds[0],
      platform,
      content: { text, hashtags: persona.sampleHashtags },
      scheduledTime: new Date(now - 2 * 86400000),
      status: 'posted',
      postedAt: new Date(now - 2 * 86400000 + 30000),
      platformPostId: `seed-${persona.handle}-posted-${now}`,
      analytics: {
        impressions: 4218,
        views: 4218,
        likes: 312,
        comments: 28,
        shares: 47,
        engagement: 387,
        reach: 3804,
        uniqueReach: 3804,
        engagementBreakdown: {
          likes: 312, comments: 28, shares: 47,
          retweets: 0, saves: 22, clicks: 0, reactions: 0,
        },
        syncedAt: new Date(),
      },
      lastAnalyticsSync: new Date(),
    },
    // 2. Scheduled 24h ahead, dryRun so it can be safely walked through the
    //    publish flow without hitting real APIs.
    {
      userId: userIdString,
      contentId: contentIds[0],
      platform,
      content: { text: persona.sampleTitles[1], hashtags: persona.sampleHashtags },
      scheduledTime: new Date(now + 86400000),
      // holdUntil null because the safety hold only matters for posts that
      // would fire imminently. A 24h-future scheduled time has plenty of
      // cancel window naturally.
      dryRun: true,
      status: 'scheduled',
    },
    // 3. Cancelled (so the cancelled-status UI gets exercised)
    {
      userId: userIdString,
      contentId: contentIds[0],
      platform,
      content: { text: persona.sampleTitles[2], hashtags: persona.sampleHashtags },
      scheduledTime: new Date(now - 86400000),
      status: 'cancelled',
    },
  ];

  await ScheduledPost.deleteMany({ userId: userIdString });
  return ScheduledPost.insertMany(docs);
}

/** Workspace per user — type 'brand' (single-creator default), member is
 *  themselves with full owner permissions so the workspaces UI renders. */
async function seedWorkspace({ user }) {
  const userIdString = String(user._id);
  const existing = await Workspace.findOne({ ownerId: userIdString });
  if (existing) return existing;
  const ws = new Workspace({
    name: `${user.name}'s Studio`,
    type: 'brand',
    ownerId: userIdString,
    userId: userIdString, // schema-level requirement separate from members[].userId
    members: [{
      userId: userIdString,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
      permissions: {
        canCreate: true, canEdit: true, canDelete: true, canPublish: true,
        canSchedule: true, canManageMembers: true, canManageSettings: true,
        canViewAnalytics: true, canExportData: true,
        canApprove: true, canReject: true, canRequestChanges: true,
        canManageWorkflows: true, canManageIntegrations: true,
        canAccessAPI: true, canManageBilling: true,
      },
    }],
  });
  await ws.save();
  return ws;
}

/** Upsert a User. The pre-save hook hashes the password automatically when
 *  it's modified, so we set the plaintext on `password` and let the model
 *  bcrypt it. On re-runs we reset password too so the credentials in the
 *  printed table always work. */
async function upsertUser(persona) {
  let user = await User.findOne({ email: persona.email });
  if (!user) {
    user = new User({
      email: persona.email,
      name: persona.name,
      password: persona.password,
      niche: persona.niche,
      role: 'user',
      status: 'active',
      emailVerified: true,
      subscription: {
        status: 'active',
        plan: 'pro',
        startDate: new Date(),
      },
      oauth: buildOAuth(persona),
    });
  } else {
    // Re-run path: refresh password, niche, oauth state in case the test
    // matrix has changed since last run.
    user.name = persona.name;
    user.password = persona.password;
    user.niche = persona.niche;
    user.subscription = { status: 'active', plan: 'pro', startDate: user.subscription?.startDate || new Date() };
    user.oauth = buildOAuth(persona);
    user.markModified('password'); // ensure pre-save hook re-hashes
  }
  await user.save();
  return user;
}

// ── Seeding (assumes an already-open mongoose connection) ──────────────────
// Exported so the server can run it in-process on its in-memory test DB
// (the standalone CLI below can't reach that ephemeral instance). Idempotent.
async function seedTestPersonas({ verbose = false } = {}) {
  const results = [];
  for (const persona of PERSONAS) {
    if (verbose) process.stdout.write(`  · ${persona.name.padEnd(20)} `);
    const user = await upsertUser(persona);
    const ws = await seedWorkspace({ user });
    const contents = await seedContent({ user, persona });
    const posts = await seedScheduledPosts({ user, persona, contentIds: contents.map((c) => c._id) });
    results.push({
      name: persona.name,
      email: persona.email,
      password: persona.password,
      niche: persona.niche,
      userId: String(user._id),
      workspaceId: String(ws._id),
      contents: contents.length,
      posts: posts.length,
    });
    if (verbose) console.log(`✅ user ${String(user._id).slice(-6)} · ws ${String(ws._id).slice(-6)} · ${contents.length} content · ${posts.length} posts`);
  }
  return results;
}

function printCredentials(results) {
  console.log('');
  console.log('═'.repeat(74));
  console.log('  CREDENTIALS — TEST THESE AT http://localhost:3010/login');
  console.log('═'.repeat(74));
  for (const r of results) {
    console.log(`  ${r.name.padEnd(20)} ${r.email.padEnd(22)} ${r.password.padEnd(15)} (${r.niche})`);
  }
  console.log('═'.repeat(74));
  console.log('');
  console.log('All five users have:');
  console.log('  · subscription = pro/active (no paywalls)');
  console.log('  · oauth platforms shown as "Connected" in /dashboard/social');
  console.log('    (UI walks the connected state but real publish would 401 — use');
  console.log('     the dry-run scheduled post per user to safely exercise publish)');
  console.log('  · 3 Content records (completed/processing/failed) per user');
  console.log('  · 3 ScheduledPost records (posted/dry-run-scheduled/cancelled) per user');
  console.log('');
}

// ── CLI ────────────────────────────────────────────────────────────────────
async function main() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is missing. Cannot seed.');
    process.exit(1);
  }
  console.log('🌱 Seeding five test personas into', MONGODB_URI.replace(/:\/\/[^@]+@/, '://***@'));
  await mongoose.connect(require('../server/utils/dbSafety').assertSafeScriptDbUri(MONGODB_URI, {
    allowProd: process.argv.includes('--prod'),
    scriptName: 'seed-test-users',
  }));
  const results = await seedTestPersonas({ verbose: true });
  printCredentials(results);
  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { seedTestPersonas, printCredentials, PERSONAS };

// Only run the CLI when invoked directly — requiring this module (e.g. from the
// server's in-memory boot seed) must NOT connect or exit the process.
if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Seeding failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
}
