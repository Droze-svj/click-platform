import { EngagementScore, ContentNiche } from '../types/editor';

export function calculateEngagementScore(
  transcript: string,
  niche: ContentNiche,
  duration: number
): EngagementScore {
  // In a real scenario, this would call Gemini 1.5 Pro or a specialized model.
  // We mock the multi-dimensional ranking system logic.

  const safeDuration = Number.isNaN(duration) || !duration ? 60 : duration;
  const safeTranscriptLength = transcript ? transcript.length : 0;
  const seed = safeTranscriptLength + safeDuration;
  const mockRandom = (offset: number) => (Math.sin(seed + offset) + 1) / 2;

  // Recalibration based on Niche
  const nicheMultipliers: Record<ContentNiche, number> = {
    educational: 1.2,
    gaming: 1.5,
    b2b: 0.8,
    comedy: 1.8,
    vlog: 1.3,
    fitness: 1.4
  };

  const multiplier = nicheMultipliers[niche] || 1.0;

  const hookStrength = Math.min(100, Math.floor(mockRandom(1) * 100 * multiplier));
  const sentimentDensity = Math.min(100, Math.floor(mockRandom(2) * 100));
  const trendAlignment = Math.min(100, Math.floor(mockRandom(3) * 100));

  const viralPotential = Math.floor((hookStrength * 0.4 + sentimentDensity * 0.3 + trendAlignment * 0.3));

  // Generate a mock retention heatmap (one score per 5% of duration)
  const heatmapPoints = 20;
  const retentionHeatmap = Array.from({ length: heatmapPoints }).map((_, i) => {
    const decay = 1 - (i / heatmapPoints) * 0.5; // Basic drop-off
    const spike = i === 0 ? 1.2 : (mockRandom(i + 10) > 0.8 ? 1.1 : 1.0);
    return Math.min(100, Math.floor(mockRandom(i) * 100 * decay * spike));
  });

  return {
    overall: Math.floor((viralPotential + retentionHeatmap[0]) / 2),
    viralPotential,
    hookStrength,
    sentimentDensity,
    trendAlignment,
    retentionHeatmap
  };
}
