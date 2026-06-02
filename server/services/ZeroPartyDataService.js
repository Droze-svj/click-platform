const crypto = require('crypto');

class ZeroPartyDataService {
  getOverlayTypes() {
    return {
      success: true,
      overlayTypes: [
        { id: 'POLL', label: 'Interactive Poll' },
        { id: 'HOTSPOT', label: 'Product Hotspot' },
        { id: 'SLIDER', label: 'Emoji Slider' },
        { id: 'QUESTION', label: 'Q&A Overlay' },
        { id: 'QUIZ', label: 'Interactive Quiz' }
      ]
    };
  }

  async generateOverlayManifest(videoData, options = {}) {
    const targetPlatform = videoData.targetPlatform || 'tiktok';
    const durationSeconds = videoData.durationSeconds || 60;
    const overlayCount = options.overlayCount || 1;
    const productData = options.productData || { name: 'Mascara X' };

    const overlays = [];

    // First overlay is a POLL
    overlays.push({
      id: 'ov_poll_123',
      type: 'POLL',
      startTimeSeconds: 5,
      content: {
        question: `Where are you in your ${videoData.niche || 'beauty'} routine?`,
        options: ['Just Starting', 'Halfway Done', 'Finishing Touches', 'Not Started']
      },
      captureConfig: {
        feedToRevenueOracle: true
      }
    });

    // If overlayCount >= 2, add a HOTSPOT
    if (overlayCount >= 2) {
      overlays.push({
        id: 'ov_hotspot_456',
        type: 'HOTSPOT',
        startTimeSeconds: Math.floor(durationSeconds * 0.4),
        content: {
          label: productData.name
        },
        captureConfig: {
          feedToRevenueOracle: true
        }
      });
    }

    // Add general overlays if count is higher
    for (let i = 2; i < overlayCount; i++) {
      overlays.push({
        id: `ov_generic_${i}`,
        type: 'SLIDER',
        startTimeSeconds: 15 + i * 5,
        content: {
          label: 'Rate this tip'
        },
        captureConfig: {
          feedToRevenueOracle: true
        }
      });
    }

    const projectedRate = this._projectCaptureRate(targetPlatform, overlayCount);

    return {
      success: true,
      manifest: {
        targetPlatform,
        overlays,
        projectedCaptureRate: projectedRate
      }
    };
  }

  async captureInteractionEvent(_event) {
    const eventId = `event_${crypto.randomBytes(8).toString('hex')}`;
    return {
      success: true,
      eventId,
      oracleFeedback: {
        signalType: 'zero_party_interaction',
        swarmConsensusWeight: 1.8,
        recommendedAction: 'reinforce_content_vector'
      }
    };
  }

  _projectCaptureRate(platform, overlayCount) {
    const baseRate = 0.12; // 12%
    let rate = baseRate;
    if (overlayCount > 1) {
      rate = baseRate * (1 + (overlayCount - 1) * 0.3);
    }
    return (rate * 100).toFixed(1) + '%';
  }
}

module.exports = new ZeroPartyDataService();
