// Video SEO Scorecard — the vidIQ "signature" feature, owned natively. Scores a
// video's packaging (title / description / tags / thumbnail) against a target
// keyword + platform best practices into a 0–100 score with actionable fixes.
// The scoring is a PURE core (deterministic, unit-tested, no I/O); an optional
// AI layer rewrites the metadata. The whole point vs vidIQ: the fixes can be
// applied straight back onto the content (closed loop).

const { aiCallJson } = require('../utils/aiRouter');

// Per-platform packaging norms.
const PLATFORM = {
  youtube: { titleMin: 40, titleMax: 70, descMin: 200, tagsMin: 8, tagsMax: 15, descWeight: 25 },
  tiktok: { titleMin: 15, titleMax: 50, descMin: 60, tagsMin: 3, tagsMax: 8, descWeight: 18 },
  instagram: { titleMin: 15, titleMax: 60, descMin: 80, tagsMin: 5, tagsMax: 12, descWeight: 20 },
  shorts: { titleMin: 20, titleMax: 60, descMin: 80, tagsMin: 4, tagsMax: 10, descWeight: 18 },
  x: { titleMin: 10, titleMax: 70, descMin: 40, tagsMin: 1, tagsMax: 5, descWeight: 15 },
};

const CTA_RE = /\b(subscribe|follow|comment|like|share|check out|link in|sign up|join|watch|download|grab|get yours)\b/i;
const POWER_RE = /\b(how|why|secret|proven|ultimate|fast|easy|free|best|stop|never|mistake|worst|insane|crazy|nobody)\b/i;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => (typeof t === 'string' ? t : (t && (t.name || t.label || t.tag || t.text))))
    .filter((t) => typeof t === 'string' && t.trim())
    .map((t) => t.trim());
}

function hasKeyword(text, kw) {
  if (!kw || !text) return false;
  return String(text).toLowerCase().includes(String(kw).toLowerCase());
}

/**
 * PURE: score a video's SEO packaging.
 *   meta: { title, description, tags, thumbnail }
 *   options: { targetKeyword, platform }
 * → { score, grade, subscores, issues:[{field,severity,message,fix}], strengths }
 */
function scoreVideoSeo(meta = {}, options = {}) {
  const platform = String(options.platform || 'youtube').toLowerCase();
  const cfg = PLATFORM[platform] || PLATFORM.youtube;
  const kw = options.targetKeyword ? String(options.targetKeyword).trim() : null;

  const title = String(meta.title || '').trim();
  const description = String(meta.description || '').trim();
  const tags = normalizeTags(meta.tags);
  const thumbnail = meta.thumbnail || meta.thumbnailUrl || null;

  const issues = [];
  const strengths = [];

  // ── Title (weight 30) ──
  let titleScore = 0;
  if (!title) {
    issues.push({ field: 'title', severity: 'critical', message: 'No title.', fix: 'Add a keyword-led title.' });
  } else {
    const len = title.length;
    if (len >= cfg.titleMin && len <= cfg.titleMax) { titleScore += 35; strengths.push('Title length is in the ideal range.'); }
    else {
      titleScore += 15;
      issues.push({ field: 'title', severity: 'medium', message: `Title is ${len} chars (ideal ${cfg.titleMin}–${cfg.titleMax}).`, fix: `Rewrite to ${cfg.titleMin}–${cfg.titleMax} characters.` });
    }
    if (kw) {
      if (hasKeyword(title, kw)) {
        titleScore += 35;
        const pos = title.toLowerCase().indexOf(kw.toLowerCase());
        if (pos <= Math.floor(title.length / 2)) { titleScore += 10; strengths.push('Target keyword is front-loaded in the title.'); }
        else issues.push({ field: 'title', severity: 'low', message: 'Keyword appears late in the title.', fix: 'Move the keyword toward the front.' });
      } else {
        issues.push({ field: 'title', severity: 'high', message: 'Title is missing the target keyword.', fix: `Include "${kw}" in the title.` });
      }
    }
    if (POWER_RE.test(title) || /\d/.test(title)) { titleScore += 15; strengths.push('Title uses a power word / number.'); }
    else issues.push({ field: 'title', severity: 'low', message: 'Title has no number or power word.', fix: 'Add a number or curiosity/authority word.' });
    if (title === title.toUpperCase() && len > 8) {
      titleScore -= 10;
      issues.push({ field: 'title', severity: 'low', message: 'Title is ALL CAPS (spammy).', fix: 'Use title case.' });
    }
  }
  titleScore = clamp(titleScore, 0, 100);

  // ── Description (platform-weighted) ──
  let descScore = 0;
  if (!description) {
    issues.push({ field: 'description', severity: platform === 'youtube' ? 'high' : 'medium', message: 'No description.', fix: 'Add a keyword-rich description with a CTA.' });
  } else {
    if (description.length >= cfg.descMin) { descScore += 40; strengths.push('Description has enough depth.'); }
    else issues.push({ field: 'description', severity: 'medium', message: `Description is short (${description.length} < ${cfg.descMin}).`, fix: `Expand to at least ${cfg.descMin} characters.` });
    if (kw) {
      if (hasKeyword(description.slice(0, 160), kw)) { descScore += 35; strengths.push('Keyword appears early in the description.'); }
      else if (hasKeyword(description, kw)) { descScore += 20; issues.push({ field: 'description', severity: 'low', message: 'Keyword is late in the description.', fix: 'Mention the keyword in the first 2 lines.' }); }
      else issues.push({ field: 'description', severity: 'medium', message: 'Description is missing the keyword.', fix: `Work "${kw}" into the opening lines.` });
    }
    if (CTA_RE.test(description)) { descScore += 25; strengths.push('Description includes a call to action.'); }
    else issues.push({ field: 'description', severity: 'low', message: 'No call to action in the description.', fix: 'Add a CTA (subscribe / follow / link).' });
  }
  descScore = clamp(descScore, 0, 100);

  // ── Tags (weight 20) ──
  let tagScore = 0;
  if (!tags.length) {
    issues.push({ field: 'tags', severity: 'medium', message: 'No tags.', fix: `Add ${cfg.tagsMin}–${cfg.tagsMax} relevant tags.` });
  } else {
    if (tags.length >= cfg.tagsMin && tags.length <= cfg.tagsMax) { tagScore += 50; strengths.push('Good number of tags.'); }
    else { tagScore += 25; issues.push({ field: 'tags', severity: 'low', message: `${tags.length} tags (ideal ${cfg.tagsMin}–${cfg.tagsMax}).`, fix: `Aim for ${cfg.tagsMin}–${cfg.tagsMax} tags.` }); }
    if (kw) {
      if (tags.some((t) => hasKeyword(t, kw))) { tagScore += 50; strengths.push('Target keyword is in the tags.'); }
      else issues.push({ field: 'tags', severity: 'medium', message: 'Tags do not include the target keyword.', fix: `Add "${kw}" and close variants as tags.` });
    } else {
      tagScore += 25;
    }
  }
  tagScore = clamp(tagScore, 0, 100);

  // ── Thumbnail (weight 15) — presence only (image analysis is a separate step) ──
  let thumbScore = 0;
  if (thumbnail) { thumbScore = 80; strengths.push('A custom thumbnail is set.'); }
  else issues.push({ field: 'thumbnail', severity: 'high', message: 'No custom thumbnail.', fix: 'Add a high-contrast custom thumbnail with a face/large text.' });

  // ── Keyword targeting (weight 10) ──
  let keywordScore = null;
  if (!kw) {
    issues.push({ field: 'keyword', severity: 'high', message: 'No target keyword set — you are flying blind on discoverability.', fix: 'Pick a target keyword (use the keyword explorer).' });
  } else {
    const hits = [hasKeyword(title, kw), hasKeyword(description, kw), tags.some((t) => hasKeyword(t, kw))].filter(Boolean).length;
    keywordScore = clamp(Math.round((hits / 3) * 100), 0, 100);
    if (hits === 3) strengths.push('Keyword is consistent across title, description, and tags.');
  }

  // Weighted overall. When there's no keyword, redistribute its 10% across the rest.
  const w = { title: 30, description: cfg.descWeight, tags: 20, thumbnail: 15, keyword: 10 };
  const parts = [
    { s: titleScore, w: w.title },
    { s: descScore, w: w.description },
    { s: tagScore, w: w.tags },
    { s: thumbScore, w: w.thumbnail },
  ];
  if (keywordScore !== null) parts.push({ s: keywordScore, w: w.keyword });
  const totalW = parts.reduce((a, p) => a + p.w, 0);
  const score = Math.round(parts.reduce((a, p) => a + p.s * p.w, 0) / totalW);

  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  const SEV = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => (SEV[a.severity] ?? 9) - (SEV[b.severity] ?? 9));

  return {
    score,
    grade,
    platform,
    targetKeyword: kw,
    subscores: { title: titleScore, description: descScore, tags: tagScore, thumbnail: thumbScore, keyword: keywordScore },
    issues,
    strengths,
    quickWins: issues.filter((i) => i.severity === 'critical' || i.severity === 'high').slice(0, 3),
  };
}

/**
 * AI rewrite of the packaging optimized for the target keyword. Returns suggested
 * title/description/tags (does NOT auto-apply). Falls back to a light
 * deterministic suggestion when AI is unavailable (never fabricated metrics).
 */
async function generateSeoRewrite(meta = {}, options = {}) {
  const platform = String(options.platform || 'youtube').toLowerCase();
  const cfg = PLATFORM[platform] || PLATFORM.youtube;
  const kw = options.targetKeyword ? String(options.targetKeyword).trim() : '';
  const title = String(meta.title || '').trim();
  const description = String(meta.description || '').trim();
  const tags = normalizeTags(meta.tags);

  const fallback = {
    title: title || (kw ? `${kw}: ${platform === 'youtube' ? 'The Complete Guide' : 'Watch This'}` : title),
    description: description,
    tags: kw ? Array.from(new Set([kw, ...tags])).slice(0, cfg.tagsMax) : tags,
    source: 'template',
  };

  const prompt =
    `Rewrite this ${platform} video's packaging to rank for the keyword "${kw}". ` +
    `Keep it truthful to the content; do not invent claims.\n` +
    `Current title: "${title.slice(0, 200)}"\n` +
    `Current description: "${description.slice(0, 600)}"\n` +
    `Return JSON: {"title":"≤${cfg.titleMax} chars, keyword front-loaded","description":"≥${cfg.descMin} chars, keyword in first line, ends with a CTA","tags":["${cfg.tagsMin}-${cfg.tagsMax} tags incl. the keyword + variants"]}`;

  try {
    const r = await aiCallJson(prompt, null, { taskType: 'seo-rewrite', temperature: 0.6, maxTokens: 700, userId: options.userId });
    if (r && (r.title || r.description || Array.isArray(r.tags))) {
      return {
        title: (r.title && String(r.title).slice(0, 140)) || fallback.title,
        description: (r.description && String(r.description)) || fallback.description,
        tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t)).filter(Boolean).slice(0, cfg.tagsMax) : fallback.tags,
        source: 'ai',
      };
    }
  } catch (_) { /* fall through to template */ }
  return fallback;
}

module.exports = { scoreVideoSeo, generateSeoRewrite, normalizeTags, PLATFORM };
