// Advanced Content Generation Service

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate content with advanced options
 */
async function generateAdvancedContent(prompt, options = {}) {
  try {
    const {
      style = 'engaging',
      tone = 'professional',
      length = 'medium',
      format = 'paragraph',
      includeHashtags = true,
      includeCTA = true,
      targetAudience = 'general',
      keywords = [],
    } = options;

    const lengthMap = {
      short: 100,
      medium: 300,
      long: 800,
    };

    const maxTokens = lengthMap[length] || 300;

    const enhancedPrompt = `${prompt}

Requirements:
- Style: ${style}
- Tone: ${tone}
- Length: ${length} (approximately ${maxTokens} words)
- Format: ${format}
${includeHashtags ? '- Include relevant hashtags' : ''}
${includeCTA ? '- Include call-to-action' : ''}
- Target Audience: ${targetAudience}
${keywords.length > 0 ? `- Include keywords: ${keywords.join(', ')}` : ''}

Generate high-quality content that meets all requirements.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert content writer. Generate high-quality, engaging content that meets all specified requirements.',
        },
        {
          role: 'user',
          content: enhancedPrompt,
        },
      ],
      temperature: 0.8,
      max_tokens: maxTokens * 2, // Token estimate
    });

    const content = response.choices[0].message.content;

    logger.info('Advanced content generated', { style, tone, length });
    return {
      content,
      metadata: {
        style,
        tone,
        length,
        format,
        wordCount: content.split(/\s+/).length,
        characterCount: content.length,
      },
    };
  } catch (error) {
    logger.error('Generate advanced content error', { error: error.message });
    throw error;
  }
}

/**
 * Generate content variations
 */
async function generateContentVariations(originalContent, count = 3) {
  try {
    const variations = [];

    for (let i = 0; i < count; i++) {
      const prompt = `Create a variation of this content with a different angle or approach:

Original:
${originalContent}

Variation ${i + 1}:
- Maintain core message
- Use different angle/perspective
- Vary tone slightly
- Keep same length

Provide the variation:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a creative content writer. Create engaging variations while maintaining the core message.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.9,
        max_tokens: 1000,
      });

      variations.push({
        variation: i + 1,
        content: response.choices[0].message.content,
        angle: getVariationAngle(i),
      });
    }

    logger.info('Content variations generated', { count: variations.length });
    return variations;
  } catch (error) {
    logger.error('Generate content variations error', { error: error.message });
    throw error;
  }
}

/**
 * Get variation angle
 */
function getVariationAngle(index) {
  const angles = [
    'question-based',
    'storytelling',
    'data-driven',
    'personal',
    'educational',
  ];
  return angles[index % angles.length];
}

/**
 * Generate content from template
 */
async function generateFromAdvancedTemplate(templateType, variables, options = {}) {
  try {
    const {
      style = 'professional',
      tone = 'engaging',
      length = 'medium',
    } = options;

    const templates = {
      'how-to': {
        structure: ['Hook', 'Problem', 'Solution Steps', 'Tips', 'Conclusion'],
        style: 'educational',
      },
      'list': {
        structure: ['Introduction', 'List Items', 'Summary'],
        style: 'engaging',
      },
      'story': {
        structure: ['Setup', 'Conflict', 'Resolution', 'Lesson'],
        style: 'narrative',
      },
      'comparison': {
        structure: ['Introduction', 'Option A', 'Option B', 'Comparison', 'Recommendation'],
        style: 'analytical',
      },
    };

    const template = templates[templateType] || templates['how-to'];

    const prompt = `Generate content using the ${templateType} template:

Variables:
${JSON.stringify(variables, null, 2)}

Structure: ${template.structure.join(' → ')}
Style: ${style}
Tone: ${tone}
Length: ${length}

For each section, provide:
1. Section name
2. Content text
3. Key points

Format as JSON object with sections array, each containing: name, content, keyPoints (array)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a template-based content generator. Create structured content following templates.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2500,
    });

    const contentText = response.choices[0].message.content;
    
    let content;
    try {
      content = JSON.parse(contentText);
    } catch (error) {
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse template content');
      }
    }

    logger.info('Content generated from advanced template', { templateType });
    return content;
  } catch (error) {
    logger.error('Generate from advanced template error', { error: error.message, templateType });
    throw error;
  }
}

module.exports = {
  generateAdvancedContent,
  generateContentVariations,
  generateFromAdvancedTemplate,
};






