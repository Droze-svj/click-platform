// Advanced Content Generation Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');
const { safeJsonParse } = require('../utils/aiHelper');

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

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot generate content');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are an expert content writer. Generate high-quality, engaging content that meets all specified requirements.\n\n${enhancedPrompt}`;
    const content = await geminiGenerate(fullPrompt, { temperature: 0.8, maxTokens: maxTokens * 2 });

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

      if (!geminiConfigured) {
        logger.warn('Google AI API key not configured, cannot generate content variations');
        throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
      }

      const fullPrompt = `You are a creative content writer. Create engaging variations while maintaining the core message.\n\n${prompt}`;
      const variationContent = await geminiGenerate(fullPrompt, { temperature: 0.9, maxTokens: 1000 });

      variations.push({
        variation: i + 1,
        content: variationContent,
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
 * High-fidelity local template fallback generator when remote AI models fail/timeout
 */
function generateLocalTemplateFallback(templateType, variables) {
  const topic = variables.topic || 'Autonomy & Sovereignty';
  const steps = variables.steps || 3;
  
  if (templateType === 'list') {
    return {
      sections: [
        {
          name: "Introduction",
          content: `In the dynamic creator economy of 2026, mastering ${topic} is key. Here are the top elements you need to know.`,
          keyPoints: ["Positioning", "Growth"]
        },
        {
          name: "List Items",
          content: `1. Leverage automated visual blueprints to scale output.\n2. Ingest Creator-DNA matrices to personalize hook structures.\n3. Cycle color grades dynamically to guarantee visual diversity.`,
          keyPoints: ["Automation", "Personalization", "Visual Shuffling"]
        },
        {
          name: "Summary",
          content: `By automating these steps, you transition from coordinator to sovereign director.`,
          keyPoints: ["Autonomy", "Scale"]
        }
      ]
    };
  }
  
  if (templateType === 'story') {
    return {
      sections: [
        {
          name: "Setup",
          content: `Traditional editing workflows were a constant bottleneck, draining creative drive.`,
          keyPoints: ["High operational friction"]
        },
        {
          name: "Conflict",
          content: `Scaling output required either sacrificing quality or working 80 hours a week.`,
          keyPoints: ["Creativity drain", "Inefficiency"]
        },
        {
          name: "Resolution",
          content: `We calibrated Click's autonomous multi-agent swarm to orchestrate visual scripts and asset sourcing instantly.`,
          keyPoints: ["Workflow efficiency"]
        },
        {
          name: "Lesson",
          content: `Creative sovereignty is achieved by deploying high-fidelity semantic automation.`,
          keyPoints: ["Sovereign director"]
        }
      ]
    };
  }
  
  if (templateType === 'comparison') {
    return {
      sections: [
        {
          name: "Introduction",
          content: `Let's compare manual video workflows against Click's autonomous AI pipeline.`,
          keyPoints: ["Comparison setup"]
        },
        {
          name: "Option A",
          content: `Manual pipeline: 6 hours per video, high fatigue, static formats.`,
          keyPoints: ["Operational drag"]
        },
        {
          name: "Option B",
          content: `Autonomous pipeline: 30 seconds per video, high-fidelity Creator-DNA personalization.`,
          keyPoints: ["Zero operational drag"]
        },
        {
          name: "Comparison",
          content: `Click delivers a 10x speed boost while maintaining highly unique layouts.`,
          keyPoints: ["Speed & Quality"]
        },
        {
          name: "Recommendation",
          content: `Shift your stack to the autonomous swarm and focus purely on strategic vision.`,
          keyPoints: ["Ultimate choice"]
        }
      ]
    };
  }
  
  // Default 'how-to'
  return {
    sections: [
      {
        name: "Hook",
        content: `Want to master ${topic} in 2026? This secret hack will change your workflow forever. 🚀`,
        keyPoints: ["Pattern interrupt", "Value hook"]
      },
      {
        name: "Problem",
        content: `Traditional editing pipelines are fragmented, manual, and drain creative energy.`,
        keyPoints: ["Operational friction", "Time drain"]
      },
      {
        name: "Solution Steps",
        content: `Leverage Click's advanced neural workflow: 1. Feed the prompts, 2. Synthesize visual blueprints, 3. Deploy.`,
        keyPoints: ["Speed", "Precision", "Automation"]
      },
      {
        name: "Tips",
        content: `Configure spacing, letter tracking, and high-energy transitions to maximize retention spikes.`,
        keyPoints: ["Typographic control", "Visual alignment"]
      },
      {
        name: "Conclusion",
        content: `Sovereignty is yours. Click AI transitions you from coordinator to director.`,
        keyPoints: ["Claim freedom", "Scale growth"]
      }
    ]
  };
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

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, falling back to local template generation');
      return generateLocalTemplateFallback(templateType, variables);
    }

    const fullPrompt = `You are a template-based content generator. Create structured content following templates.\n\n${prompt}`;
    let contentText;
    try {
      contentText = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 2500 });
    } catch (genError) {
      logger.warn('Gemini request failed in template generation, utilizing local fallback', { error: genError.message });
      return generateLocalTemplateFallback(templateType, variables);
    }

    if (!contentText) {
      logger.warn('Gemini returned empty text in template generation, utilizing local fallback');
      return generateLocalTemplateFallback(templateType, variables);
    }

    const content = safeJsonParse(contentText, null);
    if (!content) {
      logger.warn('Failed to parse template content returned from Gemini, utilizing local fallback');
      return generateLocalTemplateFallback(templateType, variables);
    }

    logger.info('Content generated from advanced template', { templateType });
    return content;
  } catch (error) {
    logger.error('Generate from advanced template error, utilizing local fallback', { error: error.message, templateType });
    try {
      return generateLocalTemplateFallback(templateType, variables);
    } catch (fallbackError) {
      throw error;
    }
  }
}

module.exports = {
  generateAdvancedContent,
  generateContentVariations,
  generateFromAdvancedTemplate,
};






