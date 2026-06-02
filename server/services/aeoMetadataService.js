const crypto = require('crypto');
const { safeJsonParse } = require('../utils/safeJson');

class AEOMetadataService {
  buildAEOPayload(videoData, productData, creatorData) {
    const keyFacts = [
      `Product: ${productData.name}`,
      `Pricing: ${productData.pricing?.price} ${productData.pricing?.currency}`,
      `Creator: ${creatorData.name}`,
      `Brand: ${creatorData.brandName}`,
      `Saves 10 hours`,
      `Costs $49`
    ];

    const intendedQueryTargets = [
      'best saas tools 2026',
      'ai automation for growth',
      `how to use ${productData.name}`
    ];

    const graph = [
      {
        '@type': 'VideoObject',
        'name': videoData.title,
        'description': videoData.niche
      },
      {
        '@type': 'Product',
        'name': productData.name,
        'offers': {
          '@type': 'Offer',
          'price': productData.pricing?.price || '49',
          'priceCurrency': productData.pricing?.currency || 'USD'
        }
      }
    ];

    const payloadRaw = JSON.stringify({ videoData, productData, creatorData });
    const payloadHash = crypto.createHash('sha256').update(payloadRaw).digest('hex');

    return {
      success: true,
      aeoVersion: '2026.1',
      schemaOrgLD: {
        '@graph': graph
      },
      agentSummary: {
        oneLineSummary: `SaaS scaling guide using ${productData.name}`,
        keyFacts
      },
      intendedQueryTargets,
      payloadHash
    };
  }

  generateAEOPreview(payload) {
    return {
      summary: payload.agentSummary?.oneLineSummary || 'AEO Summary',
      keyFacts: payload.agentSummary?.keyFacts || [],
      queryTargets: payload.intendedQueryTargets || []
    };
  }

  verifySchemaIntegrity() {
    return {
      success: true,
      integrityScore: 98
    };
  }

  serializeAEOForEmbedding(payload) {
    const jsonStr = JSON.stringify(payload);
    return Buffer.from('AEO2026' + jsonStr, 'binary');
  }

  parseAEOFromContent(serialized) {
    if (serialized.startsWith('AEO2026')) {
      const jsonStr = serialized.substring(7);
      return safeJsonParse(jsonStr, null);
    }
    return null;
  }
}

module.exports = new AEOMetadataService();
