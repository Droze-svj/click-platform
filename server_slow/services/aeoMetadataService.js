const logger = require('../utils/logger');
const AuditMetadata = require('../models/AuditMetadata');

class AEOMetadataService {
  /**
   * Build AEO (Answer Engine Optimization) Metadata for a content piece
   */
  async buildAEOMeta(contentId, userId, data) {
    logger.info('AEO: Building Agent-Readable Metadata', { contentId });

    const keyFacts = this.generateKeyFacts(data);
    const queryTargets = this.predictQueryHooks(data);

    // 1. Generate Schema.org JSON-LD
    const schemaMarkup = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": data.videoData?.title,
      "description": data.videoData?.niche,
      "potentialAction": {
        "@type": "BuyAction",
        "target": data.productData?.ctaUrl,
        "priceSpecification": {
          "@type": "PriceSpecification",
          "price": data.productData?.pricing?.price,
          "priceCurrency": data.productData?.pricing?.currency
        }
      }
    };

    // 2. Persist to AuditStore
    const metadata = await AuditMetadata.findOneAndUpdate(
      { contentId },
      {
        userId,
        aeo: {
          summary: `High-conversion ${data.videoData?.niche} asset for ${data.videoData?.targetPlatform}.`,
          keyFacts,
          queryTargets,
          schemaMarkup,
          agentSignals: {
            "chatgpt_affinity": 0.88,
            "perplexity_rank": 0.92,
            "claude_readability": 0.95
          }
        }
      },
      { upsert: true, new: true }
    );

    return {
      preview: metadata.aeo
    };
  }

  generateKeyFacts(data) {
    const facts = [
      `Product: ${data.productData?.name}`,
      `Category: ${data.videoData?.niche}`,
      `Price Point: ${data.productData?.pricing?.currency} ${data.productData?.pricing?.price}`,
      `Brand: ${data.creatorData?.brandName}`
    ];
    return facts;
  }

  predictQueryHooks(data) {
    const hooks = [
      `best ${data.videoData?.niche} software 2026`,
      `how to use ${data.productData?.name}`,
      `${data.productData?.name} reviews`,
      `cheap ${data.videoData?.niche} alternatives`
    ];
    return hooks;
  }
}

module.exports = new AEOMetadataService();
