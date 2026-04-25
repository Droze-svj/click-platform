// Automated Compliance Service
// Automated guardrail enforcement and content optimization

const AITemplate = require('../models/AITemplate');
const { validateAgainstGuardrails } = require('./aiTemplateService');
const logger = require('../utils/logger');

/**
 * Check content compliance
 */
async function checkContentCompliance(content, templateId, options = {}) {
  try {
    const template = await AITemplate.findById(templateId).lean();
    if (!template) {
      throw new Error('Template not found');
    }

    // Validate against guardrails
    const validation = validateAgainstGuardrails(content, template.guardrails);

    // Check brand style compliance
    const brandCompliance = checkBrandStyleCompliance(content, template.brandStyle);

    // Check content rules compliance
    const rulesCompliance = checkContentRulesCompliance(content, template.contentRules);

    // Overall compliance
    const isCompliant = validation.isValid && 
                       brandCompliance.isCompliant && 
                       rulesCompliance.isCompliant;

    return {
      isCompliant,
      guardrails: validation,
      brandStyle: brandCompliance,
      contentRules: rulesCompliance,
      violations: [
        ...validation.violations,
        ...brandCompliance.violations,
        ...rulesCompliance.violations
      ],
      score: calculateComplianceScore(validation, brandCompliance, rulesCompliance)
    };
  } catch (error) {
    logger.error('Error checking content compliance', { error: error.message });
    throw error;
  }
}

/**
 * Check brand style compliance
 */
function checkBrandStyleCompliance(content, brandStyle) {
  const violations = [];

  // Check don't use phrases
  if (brandStyle.dontUse) {
    brandStyle.dontUse.forEach(phrase => {
      if (content.toLowerCase().includes(phrase.toLowerCase())) {
        violations.push({
          type: 'brand_style',
          severity: 'error',
          message: `Found avoided phrase: "${phrase}"`,
          suggestion: `Remove or replace "${phrase}"`
        });
      }
    });
  }

  // Check always include
  if (brandStyle.alwaysInclude) {
    brandStyle.alwaysInclude.forEach(element => {
      if (!content.toLowerCase().includes(element.toLowerCase())) {
        violations.push({
          type: 'brand_style',
          severity: 'warning',
          message: `Missing required element: "${element}"`,
          suggestion: `Add "${element}" to content`
        });
      }
    });
  }

  // Check never include
  if (brandStyle.neverInclude) {
    brandStyle.neverInclude.forEach(element => {
      if (content.toLowerCase().includes(element.toLowerCase())) {
        violations.push({
          type: 'brand_style',
          severity: 'error',
          message: `Found prohibited element: "${element}"`,
          suggestion: `Remove "${element}" from content`
        });
      }
    });
  }

  return {
    isCompliant: violations.filter(v => v.severity === 'error').length === 0,
    violations
  };
}

/**
 * Check content rules compliance
 */
function checkContentRulesCompliance(content, contentRules) {
  const violations = [];

  // Check length
  if (contentRules.minLength && content.length < contentRules.minLength) {
    violations.push({
      type: 'content_rules',
      severity: 'error',
      message: `Content is too short (${content.length} < ${contentRules.minLength})`,
      suggestion: `Add ${contentRules.minLength - content.length} more characters`
    });
  }

  if (contentRules.maxLength && content.length > contentRules.maxLength) {
    violations.push({
      type: 'content_rules',
      severity: 'warning',
      message: `Content exceeds maximum length (${content.length} > ${contentRules.maxLength})`,
      suggestion: `Remove ${content.length - contentRules.maxLength} characters`
    });
  }

  // Check hashtags
  if (contentRules.requireHashtags) {
    const hashtags = content.match(/#\w+/g) || [];
    if (hashtags.length < (contentRules.minHashtags || 1)) {
      violations.push({
        type: 'content_rules',
        severity: 'error',
        message: `Missing hashtags (found ${hashtags.length}, need ${contentRules.minHashtags || 1})`,
        suggestion: `Add ${(contentRules.minHashtags || 1) - hashtags.length} more hashtags`
      });
    }
    if (contentRules.maxHashtags && hashtags.length > contentRules.maxHashtags) {
      violations.push({
        type: 'content_rules',
        severity: 'warning',
        message: `Too many hashtags (${hashtags.length} > ${contentRules.maxHashtags})`,
        suggestion: `Remove ${hashtags.length - contentRules.maxHashtags} hashtags`
      });
    }
  }

  // Check CTA
  if (contentRules.requireCTA) {
    const ctaKeywords = ['click', 'learn', 'visit', 'sign up', 'buy', 'shop', 'download'];
    const hasCTA = ctaKeywords.some(keyword => content.toLowerCase().includes(keyword));
    
    if (!hasCTA) {
      violations.push({
        type: 'content_rules',
        severity: 'error',
        message: 'Missing call-to-action (CTA)',
        suggestion: `Add a CTA at the ${contentRules.ctaPlacement || 'end'}`
      });
    }
  }

  return {
    isCompliant: violations.filter(v => v.severity === 'error').length === 0,
    violations
  };
}

/**
 * Calculate compliance score
 */
function calculateComplianceScore(validation, brandCompliance, rulesCompliance) {
  const totalViolations = validation.violations.length + 
                         brandCompliance.violations.length + 
                         rulesCompliance.violations.length;

  const errorViolations = validation.violations.filter(v => v.severity === 'error').length +
                          brandCompliance.violations.filter(v => v.severity === 'error').length +
                          rulesCompliance.violations.filter(v => v.severity === 'error').length;

  // Score: 100 - (errors * 20) - (warnings * 5)
  const score = Math.max(0, 100 - (errorViolations * 20) - ((totalViolations - errorViolations) * 5));

  return score;
}

/**
 * Auto-fix compliance issues
 */
async function autoFixCompliance(content, templateId, violations) {
  try {
    let fixedContent = content;

    // Fix avoid phrases
    violations
      .filter(v => v.type === 'avoid_phrase' || (v.type === 'brand_style' && v.message.includes('avoided')))
      .forEach(violation => {
        const phrase = extractPhraseFromViolation(violation);
        if (phrase) {
          // Replace with placeholder or remove
          fixedContent = fixedContent.replace(new RegExp(phrase, 'gi'), '[REMOVED]');
        }
      });

    // Add missing required phrases
    violations
      .filter(v => v.type === 'require_phrase' || (v.type === 'brand_style' && v.message.includes('Missing')))
      .forEach(violation => {
        const phrase = extractPhraseFromViolation(violation);
        if (phrase && !fixedContent.toLowerCase().includes(phrase.toLowerCase())) {
          fixedContent += ` ${phrase}`;
        }
      });

    // Add missing hashtags
    const hashtagViolations = violations.filter(v => v.message.includes('hashtag'));
    if (hashtagViolations.length > 0) {
      const hashtagsNeeded = extractNumberFromViolation(hashtagViolations[0]);
      if (hashtagsNeeded > 0) {
        fixedContent += ` ${'#hashtag'.repeat(hashtagsNeeded)}`;
      }
    }

    // Add missing CTA
    const ctaViolations = violations.filter(v => v.message.includes('CTA') || v.message.includes('call-to-action'));
    if (ctaViolations.length > 0) {
      fixedContent += ' Learn more.';
    }

    return {
      original: content,
      fixed: fixedContent,
      changes: fixedContent !== content,
      remainingViolations: [] // Would re-check
    };
  } catch (error) {
    logger.error('Error auto-fixing compliance', { error: error.message });
    throw error;
  }
}

/**
 * Extract phrase from violation
 */
function extractPhraseFromViolation(violation) {
  const match = violation.message.match(/"([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Extract number from violation
 */
function extractNumberFromViolation(violation) {
  const match = violation.message.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Get optimization suggestions
 */
async function getOptimizationSuggestions(content, templateId) {
  try {
    const template = await AITemplate.findById(templateId).lean();
    if (!template) {
      return [];
    }

    const suggestions = [];

    // Length optimization
    if (template.contentRules.maxLength && content.length > template.contentRules.maxLength * 0.9) {
      suggestions.push({
        type: 'length',
        priority: 'medium',
        message: 'Content is approaching maximum length',
        suggestion: 'Consider shortening to leave room for hashtags/CTA'
      });
    }

    // Engagement optimization
    if (!content.includes('?') && !content.includes('!')) {
      suggestions.push({
        type: 'engagement',
        priority: 'low',
        message: 'Content lacks engagement elements',
        suggestion: 'Consider adding questions or exclamations to increase engagement'
      });
    }

    // CTA optimization
    if (template.contentRules.requireCTA && template.contentRules.ctaPlacement === 'end') {
      const lastSentence = content.split('.').pop() || '';
      const ctaKeywords = ['click', 'learn', 'visit', 'sign up'];
      if (!ctaKeywords.some(kw => lastSentence.toLowerCase().includes(kw))) {
        suggestions.push({
          type: 'cta',
          priority: 'medium',
          message: 'CTA may not be prominent enough',
          suggestion: 'Consider moving CTA to the end or making it more prominent'
        });
      }
    }

    return suggestions;
  } catch (error) {
    logger.error('Error getting optimization suggestions', { error: error.message });
    return [];
  }
}

module.exports = {
  checkContentCompliance,
  autoFixCompliance,
  getOptimizationSuggestions
};


