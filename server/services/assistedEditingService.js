// Assisted Editing Service
// Generate variants, partial edits, tone adjustments

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * Generate multiple variants
 */
async function generateVariants(content, count = 5, options = {}) {
  try {
    const { preserveStructure = true, varyTone = true, varyLength = true, focusArea = null } = options;

    const variants = [];

    for (let i = 0; i < count; i++) {
      const variant = await generateSingleVariant(content, i, {
        preserveStructure,
        varyTone,
        varyLength,
        focusArea
      });
      variants.push(variant);
    }

    logger.info('Variants generated', { count: variants.length });
    return variants;
  } catch (error) {
    logger.error('Error generating variants', { error: error.message });
    throw error;
  }
}

/**
 * Generate single variant
 */
async function generateSingleVariant(content, index, options) {
  if (!geminiConfigured) {
    throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
  }

  const prompt = buildVariantPrompt(content, index, options);
  const fullPrompt = `You are a creative content writer. Generate variations of content while maintaining the core message.\n\n${prompt}`;
  const response = await geminiGenerate(fullPrompt, {
    temperature: 0.8 + index * 0.1,
    maxTokens: 500
  });

  return {
    id: `variant_${Date.now()}_${index}`,
    content: response || content,
    index: index + 1,
    description: getVariantDescription(index, options)
  };
}

function buildVariantPrompt(content, index, options) {
  let prompt = `Generate a variation of this content:\n\n"${content}"\n\n`;

  if (options.focusArea === 'hook') {
    prompt += 'Focus on creating a different, more engaging opening/hook while keeping the rest similar.';
  } else if (options.focusArea === 'cta') {
    prompt += 'Focus on creating a different call-to-action while keeping the rest similar.';
  } else if (options.focusArea === 'body') {
    prompt += 'Focus on rewriting the body/main content while keeping the hook and CTA similar.';
  } else {
    prompt += 'Create a variation that maintains the core message but uses different wording, structure, or approach.';
  }

  if (options.varyTone) {
    prompt += `\n\nVary the tone slightly (variation ${index + 1} of 5).`;
  }

  if (options.varyLength) {
    const lengthVariations = ['slightly shorter', 'similar length', 'slightly longer', 'much shorter', 'much longer'];
    prompt += `\n\nMake it ${lengthVariations[index % lengthVariations.length]}.`;
  }

  return prompt;
}

function getVariantDescription(index, options) {
  const descriptions = [
    'More direct and concise',
    'More engaging and conversational',
    'More professional and formal',
    'More creative and unique',
    'More persuasive and action-oriented'
  ];
  return descriptions[index] || `Variant ${index + 1}`;
}

/**
 * Improve specific section
 */
async function improveSection(content, section, options = {}) {
  try {
    const { sectionType = 'hook', improvementType = 'enhance', tone = null } = options;

    const prompt = buildImprovementPrompt(content, section, sectionType, improvementType, tone);

    if (!geminiConfigured) {
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a content editor. Improve specific sections of content.\n\n${prompt}`;
    const improved = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 500 });

    return {
      original: section,
      improved: improved || section,
      sectionType,
      improvementType
    };
  } catch (error) {
    logger.error('Error improving section', { error: error.message });
    throw error;
  }
}

function buildImprovementPrompt(content, section, sectionType, improvementType, tone) {
  let prompt = `Improve the ${sectionType} section of this content:\n\nFull content: "${content}"\n\nSection to improve: "${section}"\n\n`;

  switch (improvementType) {
    case 'enhance':
      prompt += 'Enhance this section to make it more engaging and effective.';
      break;
    case 'shorten':
      prompt += 'Make this section more concise while keeping the key message.';
      break;
    case 'expand':
      prompt += 'Expand this section with more detail and context.';
      break;
    case 'rephrase':
      prompt += 'Rephrase this section with different wording while keeping the meaning.';
      break;
  }

  if (tone) {
    prompt += `\n\nAdjust tone to be more ${tone}.`;
  }

  return prompt;
}

/**
 * Rewrite for specific tone
 */
async function rewriteForTone(content, targetTone, options = {}) {
  try {
    const { platform = null, preserveLength = false } = options;

    let prompt = `Rewrite this content for a ${targetTone} tone:\n\n"${content}"\n\n`;

    if (platform) {
      prompt += `\n\nOptimize for ${platform} platform.`;
    }

    if (preserveLength) {
      prompt += '\n\nMaintain similar length.';
    }

    if (!geminiConfigured) {
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a tone specialist. Rewrite content to match specific tones.\n\n${prompt}`;
    const rewritten = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 500 });

    return {
      original: content,
      rewritten: rewritten || content,
      targetTone,
      platform
    };
  } catch (error) {
    logger.error('Error rewriting for tone', { error: error.message });
    throw error;
  }
}

/**
 * Generate hook variations
 */
async function generateHookVariations(content, count = 5) {
  try {
    const hook = content.split('.')[0] || content.substring(0, 100);

    const variants = await generateVariants(hook, count, {
      focusArea: 'hook',
      preserveStructure: false
    });

    return variants.map((v) => ({
      ...v,
      fullContent: content.replace(hook, v.content)
    }));
  } catch (error) {
    logger.error('Error generating hook variations', { error: error.message });
    throw error;
  }
}

module.exports = {
  generateVariants,
  improveSection,
  rewriteForTone,
  generateHookVariations
};
