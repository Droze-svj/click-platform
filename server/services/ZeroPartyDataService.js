/**
 * ZeroPartyDataService (Phase 8 — ZPD interactive overlays)
 *
 * Deterministic generator that plans interactive first-party-data capture
 * overlays for a video. The overlay catalog is platform configuration (the
 * feature set we support), and the manifest is produced by deterministic logic
 * from the supplied video/product data — no random or fabricated values.
 */

const logger = require('../utils/logger');

// Supported interactive overlay types (configuration / feature catalog).
// IDs align with the dashboard's colour map (POLL/SWIPE_CHOICE/HOTSPOT/RATING/QUIZ).
const OVERLAY_TYPES = [
  { id: 'POLL', label: 'Interactive Poll', description: 'Two-to-four option tap poll to capture stated preference.' },
  { id: 'SWIPE_CHOICE', label: 'Swipe Choice', description: 'Binary swipe (this / that) for a fast preference signal.' },
  { id: 'HOTSPOT', label: 'Product Hotspot', description: 'Tappable hotspot revealing product detail on interest.' },
  { id: 'RATING', label: 'Emoji Rating', description: 'Scale rating to capture sentiment intensity.' },
  { id: 'QUIZ', label: 'Interactive Quiz', description: 'Short quiz to qualify intent and segment the viewer.' }
];

// Documented heuristic weights used ONLY to project a capture rate before any
// real first-party data has been collected. Deterministic estimate, surfaced to
// the UI as a projection ("Proj. Capture") — not measured data.
const TYPE_CAPTURE_WEIGHT = { POLL: 0.18, SWIPE_CHOICE: 0.22, HOTSPOT: 0.10, RATING: 0.14, QUIZ: 0.12 };

class ZeroPartyDataService {
  getOverlayTypes() {
    return { success: true, overlayTypes: OVERLAY_TYPES };
  }

  async generateOverlayManifest(videoData = {}, options = {}) {
    const duration = Math.max(5, Number(videoData.durationSeconds) || 60);
    const overlayCount = Math.max(1, Math.min(Number(options.overlayCount) || 1, OVERLAY_TYPES.length));
    const targetPlatform = videoData.targetPlatform || 'tiktok';
    const niche = videoData.niche || 'general';
    const product = options.productData || {};

    // Spread overlays evenly, avoiding the first/last 10% of the video.
    const usableStart = duration * 0.1;
    const usableEnd = duration * 0.9;
    const span = usableEnd - usableStart;

    const overlays = [];
    for (let i = 0; i < overlayCount; i++) {
      const type = OVERLAY_TYPES[i % OVERLAY_TYPES.length];
      const startTimeSeconds = overlayCount === 1
        ? usableStart + (span / 2)
        : usableStart + (span * (i / (overlayCount - 1)));
      overlays.push({
        id: `ov_${type.id.toLowerCase()}_${i}`,
        type: type.id,
        label: type.label,
        startTimeSeconds,
        durationSeconds: 6,
        content: this._buildContent(type.id, niche, product),
        captureConfig: { feedToRevenueOracle: true, updateSwarmConsensus: true }
      });
    }

    const projected = Math.min(
      0.95,
      overlays.reduce((sum, o) => sum + (TYPE_CAPTURE_WEIGHT[o.type] || 0.1), 0)
    );

    logger.info('ZPD overlay manifest generated', { targetPlatform, niche, overlayCount });

    return {
      success: true,
      manifest: {
        targetPlatform,
        niche,
        overlays,
        // Projection (heuristic estimate), not a measured capture rate.
        projectedCaptureRate: `${Math.round(projected * 100)}%`,
        generatedAt: new Date()
      }
    };
  }

  _buildContent(typeId, niche, product) {
    const name = product.name || 'this product';
    switch (typeId) {
    case 'POLL':
      return {
        question: `What matters most to you about ${name}?`,
        options: [
          { id: 'price', text: 'Price' },
          { id: 'quality', text: 'Quality' },
          { id: 'speed', text: 'Speed' }
        ]
      };
    case 'SWIPE_CHOICE':
      return {
        question: `Would you try ${name}?`,
        options: [
          { id: 'yes', text: 'Yes' },
          { id: 'no', text: 'Not yet' }
        ]
      };
    case 'HOTSPOT':
      return { question: `Tap to learn more about ${name}`, options: [] };
    case 'RATING':
      return { question: `How interested are you in ${name}?`, options: [] };
    case 'QUIZ':
      return {
        question: `Which best describes your ${niche} goal?`,
        options: [
          { id: 'start', text: 'Just starting' },
          { id: 'scale', text: 'Scaling up' },
          { id: 'expert', text: 'Expert' }
        ]
      };
    default:
      return { question: `Tell us what you think about ${name}`, options: [] };
    }
  }
}

module.exports = new ZeroPartyDataService();
