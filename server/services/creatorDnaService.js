/**
 * Creator DNA — read-side facade over the three taste stores Click already
 * keeps:
 *   - UserPreferences.styleFingerprint  (transitions / pacing / caption style)
 *   - UserStyleProfile                  (counted picks + weighted performance)
 *   - UserStyleProfile.brandVoiceCache  (cached output of brandVoiceService)
 *
 * Returns a single normalized "DNA" record that can be:
 *   • injected as Project.defaults on project create,
 *   • used to condition hookEnsembleService's variant scoring,
 *   • shown in the editor as "your style" badges.
 *
 * NOT a new persistence collection — adding one would create a 4th source of
 * truth. The facade owns aggregation and TTL only.
 */

const logger = require('../utils/logger');

const BRAND_VOICE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getModels() {
  const out = {};
  try {
    out.UserStyleProfile = require('../models/UserStyleProfile');
  } catch (err) {
    logger.warn('[creatorDna] UserStyleProfile unavailable', { error: err.message });
  }
  try {
    out.UserPreferences = require('../models/UserPreferences');
  } catch (err) {
    // Older deployments may not have UserPreferences; we degrade gracefully.
  }
  return out;
}

function topByCount(arr, max = 3) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return [...arr]
    .filter((x) => x && x.key)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, max)
    .map((x) => x.key);
}

function topByWeighted(arr, max = 3) {
  if (!Array.isArray(arr) || arr.length === 0) return []
  return [...arr]
    .filter((x) => x && x.key)
    .sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0))
    .slice(0, max)
    .map((x) => x.key)
}

function brandVoiceFromCache(cache) {
  if (!cache || !cache.computedAt) return null;
  const age = Date.now() - new Date(cache.computedAt).getTime();
  if (age > BRAND_VOICE_TTL_MS) return null;
  return {
    tone: cache.tone || null,
    style: cache.style || null,
    wordChoice: cache.wordChoice || null,
    sentenceStructure: cache.sentenceStructure || null,
    consistencyScore: typeof cache.consistencyScore === 'number' ? cache.consistencyScore : null,
    summary: cache.summary || null,
    computedAt: cache.computedAt,
  };
}

/**
 * Read-only join across the three stores.
 *
 * Returns a CreatorDNA shaped like:
 * {
 *   userId,
 *   sample: number,                // total picks the system has seen
 *   topFonts, topCaptionStyles, topAnimations, topMotions, topColorGrades, topTransitions, topHooks,
 *   topNiches, topPlatforms,
 *   weightedTopHooks, weightedTopFonts, ...,
 *   averages: { avgCutDuration, avgFontSize, ... },
 *   styleFingerprint: { ... } | null,   // from UserPreferences
 *   brandVoice: { tone, style, ... } | null,
 *   confidence: 'low' | 'medium' | 'high',
 *   computedAt
 * }
 */
async function getCreatorDNA(userId) {
  if (!userId) {
    return { userId: null, confidence: 'low', empty: true };
  }
  const { UserStyleProfile, UserPreferences } = getModels();

  let profile = null;
  let prefs = null;
  if (UserStyleProfile) {
    try {
      profile = await UserStyleProfile.findOne({ userId }).lean();
    } catch (err) {
      logger.warn('[creatorDna] UserStyleProfile read failed', { userId, error: err.message });
    }
  }
  if (UserPreferences) {
    try {
      prefs = await UserPreferences.findOne({ userId }).lean();
    } catch {
      /* optional */
    }
  }

  const dna = {
    userId,
    sample: profile?.totalPicks ?? 0,
    topFonts: topByCount(profile?.fonts),
    topCaptionStyles: topByCount(profile?.captionStyles),
    topAnimations: topByCount(profile?.animations),
    topMotions: topByCount(profile?.motions),
    topColorGrades: topByCount(profile?.colorGrades),
    topTransitions: topByCount(profile?.transitions),
    topHooks: topByCount(profile?.hooks),
    topNiches: topByCount(profile?.niches),
    topPlatforms: topByCount(profile?.platforms),

    weightedTopFonts: topByWeighted(profile?.weightedFonts),
    weightedTopCaptionStyles: topByWeighted(profile?.weightedCaptionStyles),
    weightedTopAnimations: topByWeighted(profile?.weightedAnimations),
    weightedTopMotions: topByWeighted(profile?.weightedMotions),
    weightedTopColorGrades: topByWeighted(profile?.weightedColorGrades),
    weightedTopTransitions: topByWeighted(profile?.weightedTransitions),
    weightedTopHooks: topByWeighted(profile?.weightedHooks),
    
    // ── Extended Performance DNA Facets ──
    weightedTopPacing: topByWeighted(profile?.weightedPacing),
    weightedTopVoiceTones: topByWeighted(profile?.weightedVoiceTones),
    weightedTopCtaCategories: topByWeighted(profile?.weightedCtaCategories),
    weightedTopHashtags: topByWeighted(profile?.weightedHashtags),

    averages: profile?.averages ?? null,

    styleFingerprint: prefs?.styleFingerprint ?? null,

    brandVoice: brandVoiceFromCache(profile?.brandVoiceCache),

    computedAt: new Date().toISOString(),
  };

  // 1. Visual/Aesthetic Affinity Index
  const topFontScore = profile?.weightedFonts?.[0]?.performanceScore ?? 0;
  const topCaptionScore = profile?.weightedCaptionStyles?.[0]?.performanceScore ?? 0;
  const fontName = profile?.weightedFonts?.[0]?.key || 'Default font';
  const captionName = profile?.weightedCaptionStyles?.[0]?.key || 'Default caption style';

  dna.aestheticAffinityIndex = {
    metrics: {
      fontAffinity: topFontScore > 0 ? `+${(topFontScore * 100).toFixed(1)}%` : '0%',
      captionAffinity: topCaptionScore > 0 ? `+${(topCaptionScore * 100).toFixed(1)}%` : '0%',
    },
    verdict: topFontScore > 0 || topCaptionScore > 0
      ? `Visual telemetry shows using font "${fontName}" and caption style "${captionName}" provides an average retention booster of +${((topFontScore + topCaptionScore) / 2 * 100).toFixed(1)}% against baseline edits.`
      : 'Baseline metrics settle inside the standard deviation. Continue publishing with structured visual grids to build affinity scores.'
  };

  // 2. Engagement Diffusion Analysis
  const topHookStyle = profile?.weightedHooks?.[0]?.key || 'curiosity-gap';
  const platformMatches = profile?.platforms || [];
  const primaryPlatform = platformMatches.sort((a,b) => b.count - a.count)[0]?.key || 'tiktok';

  // The hook's measured retention delta, when the learning loop has one. There
  // is no "diffusion" or "distribution score" telemetry behind this — a fixed
  // '+18.4%' used to be reported here as though it were measured, and the
  // verdict asserted "~18% higher" for every creator regardless of their data.
  const topHookScore = profile?.weightedHooks?.[0]?.performanceScore ?? 0;
  const topHookSamples = profile?.weightedHooks?.[0]?.sampleSize ?? 0;

  dna.engagementDiffusionAnalysis = {
    metrics: {
      primaryPlatform: primaryPlatform.toUpperCase(),
      // Real EMA retention delta for this hook style, or null when unmeasured.
      hookRetentionDelta: topHookSamples > 0 ? `${topHookScore >= 0 ? '+' : ''}${(topHookScore * 100).toFixed(1)}%` : null,
      hookSampleSize: topHookSamples,
    },
    verdict: topHookSamples > 0
      ? `Across ${topHookSamples} measured post${topHookSamples === 1 ? '' : 's'}, your "${topHookStyle}" hooks retain ${Math.abs(topHookScore * 100).toFixed(1)}% ${topHookScore >= 0 ? 'better' : 'worse'} than your own baseline. ${primaryPlatform.toUpperCase()} is where you publish most.`
      : `"${topHookStyle}" is the hook style you reach for most often on ${primaryPlatform.toUpperCase()}. Publish a few more and Click can measure how it actually retains.`
  };

  // 3. Recommendations derived from the creator's own most-used choices.
  // These are suggestions built from real preference data — they no longer
  // quote invented statistics ("15% deeper", "12% longer") as if measured.
  const hookVibe = profile?.weightedHooks?.[0]?.key || null;
  const pacingVibe = profile?.weightedPacing?.[0]?.key || null;
  const ctaVibe = profile?.weightedCtaCategories?.[0]?.key || null;

  dna.neuroMarketingRecommendations = [
    hookVibe
      ? `HOOK: You open with "${hookVibe}" more than any other pattern. Lead with it while it's working, and A/B one alternative per batch so you find out when it stops.`
      : 'HOOK: No dominant hook pattern yet — try a few distinct openings so Click can learn which one holds your audience.',
    pacingVibe
      ? `PACING: Your edits settle around a "${pacingVibe}" rhythm. Keep it consistent so your feed reads as one voice.`
      : 'PACING: Not enough edits yet to detect your rhythm.',
    ctaVibe
      ? `CALL TO ACTION: "${ctaVibe}" is your most-used close. Match it to the goal of each clip rather than defaulting to it every time.`
      : 'CALL TO ACTION: No dominant CTA yet — pick one per clip and Click will learn which converts for you.',
  ];

  // Confidence is a function of how much data we've actually seen.
  if (dna.sample >= 50) dna.confidence = 'high';
  else if (dna.sample >= 10) dna.confidence = 'medium';
  else dna.confidence = 'low';

  return dna;
}

/**
 * Project defaults derived from CreatorDNA. Returns a concise object the
 * editor can spread into a new Project's `settings` so first-frame defaults
 * already match the creator's taste. No nulls bubble up — falls back to
 * sensible defaults so brand-new users still get a working editor.
 */
async function projectDefaultsFromDNA(userId) {
  const dna = await getCreatorDNA(userId);
  return {
    fontFamily: dna.topFonts[0] || 'Inter',
    captionStyle: dna.topCaptionStyles[0] || 'default',
    transition: dna.topTransitions[0] || 'crossfade',
    colorGrade: dna.topColorGrades[0] || null,
    motion: dna.topMotions[0] || null,
    preferredHooks: dna.topHooks.slice(0, 3),
    avgCutDuration: dna.averages?.avgCutDuration ?? null,
    brandTone: dna.brandVoice?.tone ?? null,
    confidence: dna.confidence,
  };
}

module.exports = {
  getCreatorDNA,
  projectDefaultsFromDNA,
  BRAND_VOICE_TTL_MS,
};
