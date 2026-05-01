// Video Heatmap Service
// Generate engagement heatmaps for videos

const VideoEngagementHeatmap = require('../models/VideoEngagementHeatmap');
const VideoMetrics = require('../models/VideoMetrics');
const logger = require('../utils/logger');

/**
 * Generate engagement heatmap
 */
async function generateEngagementHeatmap(postId, heatmapData) {
  try {
    const videoMetrics = await VideoMetrics.findOne({ postId }).lean();
    if (!videoMetrics) {
      throw new Error('Video metrics not found');
    }

    const {
      engagementData = [],
      retentionData = []
    } = heatmapData;

    // Combine engagement and retention data
    const heatmapPoints = [];
    const videoDuration = videoMetrics.video.duration;

    for (let second = 0; second <= videoDuration; second++) {
      const engagement = engagementData.find(d => d.second === second)?.engagement || 0;
      const views = engagementData.find(d => d.second === second)?.views || 0;
      const retention = retentionData.find(d => d.second === second)?.percentage || 0;

      // Calculate intensity (weighted combination)
      const intensity = (engagement * 0.4) + (views * 0.3) + (retention * 0.3);

      heatmapPoints.push({
        second,
        engagement,
        views,
        retention,
        intensity: Math.round(intensity * 100) / 100
      });
    }

    // Identify hotspots
    const hotspots = identifyHotspots(heatmapPoints);
    
    // Identify patterns
    const patterns = identifyPatterns(heatmapPoints);

    // Generate analysis
    const analysis = analyzeHeatmap(heatmapPoints, hotspots);

    // Create or update heatmap
    const heatmap = await VideoEngagementHeatmap.findOneAndUpdate(
      { postId },
      {
        $set: {
          postId,
          videoMetricsId: videoMetrics._id,
          workspaceId: videoMetrics.workspaceId,
          heatmap: {
            data: heatmapPoints,
            hotspots,
            averageIntensity: 0
          },
          patterns,
          analysis,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Engagement heatmap generated', { postId, hotspots: hotspots.length });
    return heatmap;
  } catch (error) {
    logger.error('Error generating engagement heatmap', { error: error.message, postId });
    throw error;
  }
}

/**
 * Identify hotspots
 */
function identifyHotspots(heatmapPoints) {
  const hotspots = [];
  const averageIntensity = heatmapPoints.reduce((sum, p) => sum + p.intensity, 0) / heatmapPoints.length;
  const threshold = averageIntensity * 1.5; // 50% above average

  let currentHotspot = null;

  heatmapPoints.forEach(point => {
    if (point.intensity >= threshold) {
      if (!currentHotspot) {
        currentHotspot = {
          startSecond: point.second,
          endSecond: point.second,
          intensity: point.intensity,
          type: determineHotspotType(point)
        };
      } else {
        currentHotspot.endSecond = point.second;
        currentHotspot.intensity = Math.max(currentHotspot.intensity, point.intensity);
      }
    } else {
      if (currentHotspot) {
        currentHotspot.reason = getHotspotReason(currentHotspot);
        hotspots.push(currentHotspot);
        currentHotspot = null;
      }
    }
  });

  // Add final hotspot if exists
  if (currentHotspot) {
    currentHotspot.reason = getHotspotReason(currentHotspot);
    hotspots.push(currentHotspot);
  }

  return hotspots;
}

/**
 * Determine hotspot type
 */
function determineHotspotType(point) {
  if (point.engagement > point.views * 0.5) return 'high_engagement';
  if (point.retention > 80) return 'high_retention';
  return 'peak';
}

/**
 * Get hotspot reason
 */
function getHotspotReason(hotspot) {
  if (hotspot.type === 'high_engagement') return 'High engagement activity';
  if (hotspot.type === 'high_retention') return 'High viewer retention';
  return 'Peak intensity';
}

/**
 * Identify patterns
 */
function identifyPatterns(heatmapPoints) {
  const patterns = {
    peakEngagement: null,
    dropOffPoints: [],
    reEngagementPoints: []
  };

  // Find peak engagement
  const peakPoint = heatmapPoints.reduce((max, point) => 
    point.engagement > max.engagement ? point : max
  , heatmapPoints[0] || { second: 0, engagement: 0 });

  patterns.peakEngagement = {
    second: peakPoint.second,
    value: peakPoint.engagement
  };

  // Find drop-off points (significant retention decrease)
  for (let i = 1; i < heatmapPoints.length; i++) {
    const prev = heatmapPoints[i - 1];
    const curr = heatmapPoints[i];
    
    if (prev.retention - curr.retention > 10) { // 10% drop
      patterns.dropOffPoints.push({
        second: curr.second,
        percentage: curr.retention,
        reason: `Retention dropped from ${prev.retention.toFixed(1)}% to ${curr.retention.toFixed(1)}%`
      });
    }
  }

  // Find re-engagement points (engagement increase after drop)
  for (let i = 1; i < heatmapPoints.length; i++) {
    const prev = heatmapPoints[i - 1];
    const curr = heatmapPoints[i];
    
    if (curr.engagement > prev.engagement * 1.5) {
      patterns.reEngagementPoints.push({
        second: curr.second,
        percentage: curr.retention
      });
    }
  }

  return patterns;
}

/**
 * Analyze heatmap
 */
function analyzeHeatmap(heatmapPoints, hotspots) {
  // Find best segment (highest average intensity)
  let bestSegment = null;
  let bestAverage = 0;

  for (let i = 0; i < heatmapPoints.length - 10; i++) {
    const segment = heatmapPoints.slice(i, i + 10);
    const average = segment.reduce((sum, p) => sum + p.intensity, 0) / segment.length;
    
    if (average > bestAverage) {
      bestAverage = average;
      bestSegment = {
        startSecond: segment[0].second,
        endSecond: segment[segment.length - 1].second,
        reason: 'Highest average engagement intensity'
      };
    }
  }

  // Find worst segment (lowest average intensity)
  let worstSegment = null;
  let worstAverage = Infinity;

  for (let i = 0; i < heatmapPoints.length - 10; i++) {
    const segment = heatmapPoints.slice(i, i + 10);
    const average = segment.reduce((sum, p) => sum + p.intensity, 0) / segment.length;
    
    if (average < worstAverage) {
      worstAverage = average;
      worstSegment = {
        startSecond: segment[0].second,
        endSecond: segment[segment.length - 1].second,
        reason: 'Lowest average engagement intensity'
      };
    }
  }

  // Generate recommendations
  const recommendations = [];
  
  if (bestSegment) {
    recommendations.push(`Highlight segment ${bestSegment.startSecond}s-${bestSegment.endSecond}s in thumbnails/previews`);
  }
  
  if (worstSegment) {
    recommendations.push(`Consider editing or removing segment ${worstSegment.startSecond}s-${worstSegment.endSecond}s`);
  }

  if (hotspots.length > 0) {
    recommendations.push(`Focus on creating content similar to hotspots (${hotspots.length} identified)`);
  }

  return {
    bestSegment,
    worstSegment,
    recommendations
  };
}

/**
 * Get engagement heatmap
 */
async function getEngagementHeatmap(postId) {
  try {
    const heatmap = await VideoEngagementHeatmap.findOne({ postId }).lean();
    if (!heatmap) {
      throw new Error('Heatmap not found');
    }

    return heatmap;
  } catch (error) {
    logger.error('Error getting engagement heatmap', { error: error.message, postId });
    throw error;
  }
}

/**
 * Pick the best timestamp (in seconds) for a video thumbnail, derived from
 * real engagement signal — never an arbitrary fallback like "first second".
 *
 * Priority of signal:
 *   1. Existing `VideoEngagementHeatmap` for this post — combined intensity
 *   2. Retention curve on `VideoMetrics` for this post — peak retention second
 *   3. Retention curves of the user's other top-performing videos on the same
 *      platform (transfer signal: where do *their* viewers stay engaged?)
 *
 * Returns `null` if no real signal exists (caller should fall back, not guess).
 */
async function pickBestThumbnailTime(postId, opts = {}) {
  try {
    // 1) Per-post heatmap
    const heatmap = await VideoEngagementHeatmap.findOne({ postId }).lean();
    if (heatmap?.heatmap?.data?.length) {
      const points = heatmap.heatmap.data;
      const peak = points.reduce((best, p) =>
        (p.intensity || 0) > (best.intensity || -1) ? p : best
      , { intensity: -1 });
      if (peak.second !== undefined && peak.intensity > 0) {
        return { second: peak.second, source: 'heatmap', confidence: 'high' };
      }
    }

    // 2) Per-post retention curve
    const metrics = await VideoMetrics.findOne({ postId }).lean();
    const curve = metrics?.retention?.curve || [];
    if (curve.length) {
      const peak = curve.reduce((best, p) =>
        (p.percentage || 0) > (best.percentage || -1) ? p : best
      , { percentage: -1 });
      if (peak.second !== undefined && peak.percentage > 0) {
        return { second: peak.second, source: 'retention', confidence: 'medium' };
      }
    }

    // 3) Cross-video transfer: peak retention second among the user's top
    // videos on the same platform. Useful for brand-new uploads that have no
    // metrics of their own yet.
    if (metrics?.workspaceId && metrics?.platform) {
      const peers = await VideoMetrics.find({
        workspaceId: metrics.workspaceId,
        platform: metrics.platform,
        postId: { $ne: postId },
        'retention.curve.0': { $exists: true },
      })
        .sort({ performanceScore: -1 })
        .limit(5)
        .select('retention video.duration')
        .lean();

      if (peers.length) {
        // Average retention across peers, normalized to fraction of duration.
        const buckets = new Map(); // ratio (0..1, 5%) -> sum, count
        for (const peer of peers) {
          const dur = peer.video?.duration || 0;
          if (!dur) continue;
          for (const p of peer.retention.curve) {
            const ratio = Math.round((p.second / dur) * 20) / 20;
            const cur = buckets.get(ratio) || { sum: 0, count: 0 };
            cur.sum += p.percentage || 0;
            cur.count += 1;
            buckets.set(ratio, cur);
          }
        }
        let bestRatio = null;
        let bestMean = -1;
        for (const [ratio, { sum, count }] of buckets) {
          const mean = sum / count;
          if (mean > bestMean) { bestMean = mean; bestRatio = ratio; }
        }
        const targetDuration = opts.videoDuration || metrics.video?.duration || 0;
        if (bestRatio !== null && targetDuration > 0) {
          return {
            second: Math.round(bestRatio * targetDuration),
            source: 'peer-retention',
            confidence: 'low',
          };
        }
      }
    }

    return null;
  } catch (error) {
    logger.warn('pickBestThumbnailTime failed', { postId, error: error.message });
    return null;
  }
}

module.exports = {
  generateEngagementHeatmap,
  getEngagementHeatmap,
  pickBestThumbnailTime
};


