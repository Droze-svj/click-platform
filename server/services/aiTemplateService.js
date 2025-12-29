// AI Template Service
// Manage AI templates with guardrails and brand rules

const AITemplate = require('../models/AITemplate');
const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Create or update AI template
 */
async function createOrUpdateTemplate(templateData) {
  try {
    const {
      templateId,
      name,
      clientWorkspaceId,
      agencyWorkspaceId,
      prompt,
      systemMessage,
      guardrails,
      brandStyle,
      contentRules,
      platformRules,
      settings,
      createdBy
    } = templateData;

    let template;

    if (templateId) {
      template = await AITemplate.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Update
      if (name) template.name = name;
      if (prompt) template.prompt = prompt;
      if (systemMessage !== undefined) template.systemMessage = systemMessage;
      if (guardrails) template.guardrails = guardrails;
      if (brandStyle) template.brandStyle = { ...template.brandStyle, ...brandStyle };
      if (contentRules) template.contentRules = { ...template.contentRules, ...contentRules };
      if (platformRules) template.platformRules = { ...template.platformRules, ...platformRules };
      if (settings) template.settings = { ...template.settings, ...settings };
    } else {
      // Create
      template = new AITemplate({
        name,
        clientWorkspaceId,
        agencyWorkspaceId,
        prompt,
        systemMessage,
        guardrails: guardrails || [],
        brandStyle: brandStyle || {},
        contentRules: contentRules || {},
        platformRules: platformRules || {},
        settings: settings || {},
        createdBy
      });
    }

    await template.save();

    logger.info('AI template saved', { templateId: template._id, agencyWorkspaceId });
    return template;
  } catch (error) {
    logger.error('Error creating/updating template', { error: error.message });
    throw error;
  }
}

/**
 * Get templates
 */
async function getTemplates(agencyWorkspaceId, clientWorkspaceId = null) {
  try {
    const query = {
      agencyWorkspaceId,
      isActive: true
    };

    if (clientWorkspaceId) {
      query.clientWorkspaceId = clientWorkspaceId;
    }

    const templates = await AITemplate.find(query)
      .populate('createdBy', 'name email')
      .sort({ isDefault: -1, usageCount: -1, createdAt: -1 })
      .lean();

    return templates;
  } catch (error) {
    logger.error('Error getting templates', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Generate content using template
 */
async function generateContentWithTemplate(templateId, input, options = {}) {
  try {
    const template = await AITemplate.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Build prompt with guardrails
    const fullPrompt = buildPromptWithGuardrails(template, input, options);

    // Generate content
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: template.systemMessage || 'You are a professional content writer.'
        },
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      temperature: template.settings.temperature,
      max_tokens: template.settings.maxTokens,
      top_p: template.settings.topP,
      frequency_penalty: template.settings.frequencyPenalty,
      presence_penalty: template.settings.presencePenalty
    });

    const generatedContent = response.choices[0].message.content;

    // Validate against guardrails
    const validation = validateAgainstGuardrails(generatedContent, template.guardrails);

    // Update usage
    template.usageCount++;
    template.lastUsed = new Date();
    await template.save();

    return {
      content: generatedContent,
      validation,
      template: {
        id: template._id,
        name: template.name
      }
    };
  } catch (error) {
    logger.error('Error generating content with template', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Build prompt with guardrails
 */
function buildPromptWithGuardrails(template, input, options) {
  let prompt = template.prompt.replace('{{input}}', input);

  // Add brand style
  if (template.brandStyle.tone) {
    prompt += `\n\nTone: ${template.brandStyle.tone}`;
  }
  if (template.brandStyle.voice) {
    prompt += `\n\nBrand Voice: ${template.brandStyle.voice}`;
  }

  // Add do's and don'ts
  if (template.brandStyle.doUse && template.brandStyle.doUse.length > 0) {
    prompt += `\n\nUse these phrases/words: ${template.brandStyle.doUse.join(', ')}`;
  }
  if (template.brandStyle.dontUse && template.brandStyle.dontUse.length > 0) {
    prompt += `\n\nAvoid these phrases/words: ${template.brandStyle.dontUse.join(', ')}`;
  }
  if (template.brandStyle.alwaysInclude && template.brandStyle.alwaysInclude.length > 0) {
    prompt += `\n\nAlways include: ${template.brandStyle.alwaysInclude.join(', ')}`;
  }
  if (template.brandStyle.neverInclude && template.brandStyle.neverInclude.length > 0) {
    prompt += `\n\nNever include: ${template.brandStyle.neverInclude.join(', ')}`;
  }

  // Add content rules
  if (template.contentRules.minLength) {
    prompt += `\n\nMinimum length: ${template.contentRules.minLength} characters`;
  }
  if (template.contentRules.maxLength) {
    prompt += `\n\nMaximum length: ${template.contentRules.maxLength} characters`;
  }
  if (template.contentRules.requireCTA) {
    prompt += `\n\nInclude a call-to-action (CTA) at the ${template.contentRules.ctaPlacement}`;
  }
  if (template.contentRules.requireHashtags) {
    prompt += `\n\nInclude ${template.contentRules.minHashtags || 3}-${template.contentRules.maxHashtags || 5} hashtags`;
  }

  // Add platform-specific rules
  if (options.platform && template.platformRules[options.platform]) {
    prompt += `\n\nPlatform-specific rules for ${options.platform}: ${JSON.stringify(template.platformRules[options.platform])}`;
  }

  // Add guardrails
  if (template.guardrails && template.guardrails.length > 0) {
    prompt += '\n\nGuardrails:';
    template.guardrails.forEach(guardrail => {
      switch (guardrail.type) {
        case 'avoid_phrase':
          prompt += `\n- DO NOT use: "${guardrail.value}"`;
          break;
        case 'require_phrase':
          prompt += `\n- MUST include: "${guardrail.value}"`;
          break;
        case 'tone_requirement':
          prompt += `\n- Tone must be: ${guardrail.value}`;
          break;
        case 'cta_requirement':
          prompt += `\n- CTA requirement: ${guardrail.value}`;
          break;
      }
    });
  }

  return prompt;
}

/**
 * Validate against guardrails
 */
function validateAgainstGuardrails(content, guardrails) {
  const violations = [];

  guardrails.forEach(guardrail => {
    switch (guardrail.type) {
      case 'avoid_phrase':
        if (content.toLowerCase().includes(guardrail.value.toLowerCase())) {
          violations.push({
            type: guardrail.type,
            severity: guardrail.severity,
            message: `Found avoided phrase: "${guardrail.value}"`,
            suggestion: guardrail.description || 'Remove or replace this phrase'
          });
        }
        break;
      case 'require_phrase':
        if (!content.toLowerCase().includes(guardrail.value.toLowerCase())) {
          violations.push({
            type: guardrail.type,
            severity: guardrail.severity,
            message: `Missing required phrase: "${guardrail.value}"`,
            suggestion: guardrail.description || 'Add this required phrase'
          });
        }
        break;
    }
  });

  return {
    isValid: violations.filter(v => v.severity === 'error' || v.severity === 'block').length === 0,
    violations
  };
}

module.exports = {
  createOrUpdateTemplate,
  getTemplates,
  generateContentWithTemplate
};


