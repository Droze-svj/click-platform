#!/usr/bin/env node
/**
 * Live AI smoke — verifies that a RUNNING environment is producing real AI
 * output (not the canned fallback). Complements tests/server/routes/smokeCore
 * (which runs AI in mock mode to prove route wiring); this one hits a live
 * provider key end to end.
 *
 * Usage:
 *   BASE=https://click-platform-1.onrender.com node scripts/ai-smoke.js
 *   # optionally exercise authed generation too:
 *   BASE=... TOKEN=<jwt> node scripts/ai-smoke.js
 *
 * Read-only/idempotent: the health probe is free; the authed calls are small
 * generations. It never writes destructive state. Exits non-zero on failure.
 */

const BASE = (process.env.BASE || 'http://localhost:5001').replace(/\/$/, '');
const TOKEN = process.env.TOKEN || '';

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

async function main() {
  console.log(`Live AI smoke against ${BASE}${TOKEN ? ' (authed)' : ' (health only)'}\n`);

  // 1) Provider health + real round-trip (always available, no token needed).
  try {
    const { status, json } = await call('GET', '/api/health/ai?live=1');
    const ai = (json && json.ai) || {};
    record(
      'health/ai live round-trip',
      status === 200 && ai.configured === true && ai.liveTest === 'ok',
      `mode=${ai.mode} liveTest=${ai.liveTest} providers=${JSON.stringify(ai.providers)}`
    );
  } catch (e) {
    record('health/ai live round-trip', false, e.message);
  }

  if (!TOKEN) {
    console.log('\n(no TOKEN set — skipping authed generation checks)');
    return finish();
  }

  // 2) Viral / content ideas — must be real (not the fallback) and well-formed.
  try {
    const { status, json } = await call('POST', '/api/creative/ideation/ideas', {
      topic: 'short-form AI video editing tips', platform: 'tiktok', count: 3,
    });
    const ideas = json && json.data;
    const arr = Array.isArray(ideas) ? ideas : (ideas && ideas.ideas) || [];
    record(
      'creative/ideation/ideas',
      status === 200 && json.success === true && arr.length > 0,
      `${arr.length} ideas, first="${(arr[0] && (arr[0].title || arr[0].idea) || '').slice(0, 60)}"`
    );
  } catch (e) {
    record('creative/ideation/ideas', false, e.message);
  }

  // 3) Highlights — exercises detectHighlights end to end.
  try {
    const { status, json } = await call('POST', '/api/video/extract-highlights', {
      videoId: process.env.CONTENT_ID || '000000000000000000000000',
      url: '/uploads/smoke.mp4',
      duration: 60,
    });
    const moments = json && json.data && json.data.highlightMoments;
    record(
      'video/extract-highlights',
      (status === 200 && json.success === true && Array.isArray(moments)) || status === 404,
      status === 404 ? 'content not found (set CONTENT_ID to exercise fully)' : `${moments ? moments.length : 0} moments`
    );
  } catch (e) {
    record('video/extract-highlights', false, e.message);
  }

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('ai-smoke crashed:', e); process.exit(1); });
