// Script generation service using AI

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * Generate YouTube video script with Strategic Upgrades (Phase 11)
 * Includes: 3-Hook A/B Testing, Trend Integration, and Pacing Heatmaps
 */
async function generateYouTubeScript(topic, options = {}) {
  const liveTrendService = require('./liveTrendService');
  const trends = await liveTrendService.getLatestTrends(options.platform || 'tiktok');
  const strategy = await liveTrendService.getTrendStrategy(trends);

  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback script');
    return generateFallbackScript('youtube', topic, options);
  }

  const {
    duration = 10,
    tone = strategy.recommendedTone || 'professional',
    targetAudience = 'general audience',
  } = options;

  try {
    const prompt = `Create a ${duration}-minute YouTube video script about "${topic}".

    Current Trend Strategy: ${strategy.mold} (${strategy.explanation})

    Requirements:
    - Target audience: ${targetAudience}
    - Tone: ${tone}
    - Include 3 distinct "3-Second Hooks" (Visual/Audio combinations)
    - Provide an "Engagement Score" (1-100) for each hook based on current trends.
    - Break the script into segments with word counts for pacing analysis.
    - Word count: approximately ${duration * 150} words.

    Format the script as JSON:
    {
      "title": "Script title",
      "strategyMold": "${strategy.mold}",
      "hooks": [
        { "hook": "Variant 1 text", "visual": "Visual description", "engagementScore": 85 },
        { "hook": "Variant 2 text", "visual": "Visual description", "engagementScore": 92 },
        { "hook": "Variant 3 text", "visual": "Visual description", "engagementScore": 78 }
      ],
      "segments": [
        { "title": "Intro", "content": "Text...", "duration": 0.5, "words": 75 },
        { "title": "Point 1", "content": "Text...", "duration": 2, "words": 300 }
      ],
      "conclusion": "Conclusion text",
      "callToAction": "CTA text",
      "hashtags": ["#ht1", "#ht2"]
    }`;

    const content = await geminiGenerate(prompt, { temperature: 0.8, maxTokens: 3000 });
    const script = JSON.parse(content);

    // Calculate Pacing Heatmap
    const pacingHeatmap = script.segments.map(s => {
      const density = s.words / (s.duration * 60); // words per second
      return {
        section: s.title,
        density,
        status: density > 3 ? 'too-dense' : density < 1.5 ? 'too-slow' : 'optimal',
        recommendation: density > 3 ? 'Add B-roll to break up text' : density < 1.5 ? 'Increase energy or add music' : 'Maintain pacing'
      };
    });

    // Combine into full script text
    let fullScript = (script.segments[0]?.content || '') + '\n\n';
    script.segments.slice(1).forEach(s => {
      fullScript += `${s.title}\n${s.content}\n\n`;
    });
    fullScript += script.conclusion;

    return {
      ...script,
      script: fullScript,
      pacingHeatmap,
      wordCount: fullScript.split(/\s+/).length,
      duration
    };
  } catch (error) {
    logger.error('Strategic YouTube script error', { error: error.message, topic });
    return generateFallbackScript('youtube', topic, options);
  }
}

/**
 * Generate podcast script
 */
async function generatePodcastScript(topic, options = {}) {
  if (!geminiConfigured) {
    return generateFallbackScript('podcast', topic, options);
  }

  const {
    duration = 30,
    tone = 'conversational',
    targetAudience = 'general audience',
    format = 'solo' // solo, interview, panel
  } = options;

  try {
    const prompt = `Create a ${duration}-minute ${format} podcast script about "${topic}".

Requirements:
- Target audience: ${targetAudience}
- Tone: ${tone}
- Format: ${format}
- Include engaging introduction
- Include 5-7 main discussion points
- Include natural conversation flow
- Add transitions and segues
- Include conclusion and call-to-action
- Word count: approximately ${duration * 150} words

Format as JSON with structure similar to YouTube script but adapted for podcast format.`;

    const fullPrompt = `You are an expert podcast scriptwriter.\n\n${prompt}`;
    const content = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 3000 });
    const script = JSON.parse(content);

    let fullScript = script.introduction + '\n\n';
    script.mainPoints.forEach((point) => {
      fullScript += `${point.title}\n${point.content}\n\n`;
    });
    fullScript += script.conclusion;
    if (script.callToAction) {
      fullScript += `\n\n${script.callToAction}`;
    }

    return {
      ...script,
      script: fullScript,
      wordCount: fullScript.split(/\s+/).length,
      duration
    };
  } catch (error) {
    logger.error('Podcast script generation error', { error: error.message, topic });
    return generateFallbackScript('podcast', topic, options);
  }
}

/**
 * Generate social media script
 */
async function generateSocialMediaScript(topic, options = {}) {
  if (!geminiConfigured) {
    return generateFallbackScript('social-media', topic, options);
  }

  const {
    platform = 'instagram',
    tone = 'engaging',
    includeHashtags = true
  } = options;

  const platformLimits = {
    instagram: 2200,
    twitter: 280,
    linkedin: 3000,
    facebook: 5000
  };

  const maxLength = platformLimits[platform] || 1000;

  try {
    const prompt = `Create a ${platform} post script about "${topic}".

Requirements:
- Platform: ${platform}
- Tone: ${tone}
- Maximum length: ${maxLength} characters
- ${includeHashtags ? 'Include 5-10 relevant hashtags' : 'No hashtags'}
- Make it engaging and shareable
- Include a call-to-action
- Format as JSON with: title, content, hashtags, callToAction`;

    const fullPrompt = `You are an expert social media content creator.\n\n${prompt}`;
    const content = await geminiGenerate(fullPrompt, { temperature: 0.8, maxTokens: 500 });
    const script = JSON.parse(content);

    let fullScript = script.content || '';
    if (script.callToAction) {
      fullScript += `\n\n${script.callToAction}`;
    }
    if (script.hashtags && script.hashtags.length > 0) {
      fullScript += `\n\n${script.hashtags.join(' ')}`;
    }

    return {
      ...script,
      script: fullScript,
      wordCount: fullScript.split(/\s+/).length
    };
  } catch (error) {
    logger.error('Social media script generation error', { error: error.message, topic });
    return generateFallbackScript('social-media', topic, options);
  }
}

/**
 * Generate blog post script/outline
 */
async function generateBlogScript(topic, options = {}) {
  if (!geminiConfigured) {
    return generateFallbackScript('blog', topic, options);
  }

  const {
    wordCount = 1500,
    tone = 'professional',
    includeSEO = true
  } = options;

  try {
    const prompt = `Create a blog post script/outline about "${topic}".

Requirements:
- Word count: approximately ${wordCount} words
- Tone: ${tone}
- ${includeSEO ? 'Include SEO keywords and meta description' : 'No SEO needed'}
- Include introduction, 3-5 main sections, and conclusion
- Make it engaging and informative
- Format as JSON with: title, introduction, sections (array with title and content), conclusion, keywords, metaDescription`;

    const fullPrompt = `You are an expert blog writer and SEO specialist.\n\n${prompt}`;
    const content = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 2000 });
    const script = JSON.parse(content);

    let fullScript = script.introduction + '\n\n';
    script.sections.forEach((section) => {
      fullScript += `## ${section.title}\n\n${section.content}\n\n`;
    });
    fullScript += script.conclusion;

    return {
      ...script,
      script: fullScript,
      wordCount: fullScript.split(/\s+/).length
    };
  } catch (error) {
    logger.error('Blog script generation error', { error: error.message, topic });
    return generateFallbackScript('blog', topic, options);
  }
}

/**
 * Generate email script
 */
async function generateEmailScript(topic, options = {}) {
  if (!geminiConfigured) {
    return generateFallbackScript('email', topic, options);
  }

  const {
    type = 'marketing', // marketing, newsletter, sales, support
    tone = 'professional',
    length = 'medium' // short, medium, long
  } = options;

  const lengthMap = {
    short: 100,
    medium: 300,
    long: 600
  };

  try {
    const prompt = `Create a ${type} email script about "${topic}".

Requirements:
- Type: ${type}
- Tone: ${tone}
- Length: ${length} (approximately ${lengthMap[length]} words)
- Include subject line
- Include engaging opening
- Clear body content
- Include call-to-action
- Format as JSON with: subject, opening, body, callToAction`;

    const fullPrompt = `You are an expert email copywriter.\n\n${prompt}`;
    const content = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 800 });
    const script = JSON.parse(content);

    const fullScript = `${script.subject}\n\n${script.opening}\n\n${script.body}\n\n${script.callToAction}`;

    return {
      ...script,
      script: fullScript,
      wordCount: fullScript.split(/\s+/).length
    };
  } catch (error) {
    logger.error('Email script generation error', { error: error.message, topic });
    return generateFallbackScript('email', topic, options);
  }
}

/**
 * Fallback script generator
 */
function generateFallbackScript(type, topic, options = {}) {
  const templates = {
    youtube: {
      introduction: `Hey everyone! Welcome back to the channel. Today, we're diving into ${topic}.`,
      mainPoints: [
        { title: 'What is it?', content: `Let's start by understanding what ${topic} really means.`, duration: 2 },
        { title: 'Why it matters', content: `Here's why ${topic} is important for you.`, duration: 3 },
        { title: 'How to use it', content: `Now let's see how you can apply ${topic} in your life.`, duration: 3 }
      ],
      conclusion: `So there you have it - everything you need to know about ${topic}.`,
      callToAction: `If you found this helpful, don't forget to like and subscribe!`
    },
    podcast: {
      introduction: `Welcome to today's episode where we're exploring ${topic}.`,
      mainPoints: [
        { title: 'Introduction', content: `Let's start by introducing ${topic}.`, duration: 5 },
        { title: 'Deep dive', content: `Now let's take a deeper look at ${topic}.`, duration: 10 },
        { title: 'Practical tips', content: `Here are some practical ways to apply ${topic}.`, duration: 10 }
      ],
      conclusion: `That wraps up our discussion on ${topic}.`,
      callToAction: `Thanks for listening! Be sure to subscribe for more episodes.`
    },
    'social-media': {
      content: `Check out this amazing insight about ${topic}! 🚀\n\nThis is something you need to know.`,
      hashtags: ['#content', '#tips', '#growth'],
      callToAction: 'What do you think? Share your thoughts below! 👇'
    },
    blog: {
      introduction: `In this post, we'll explore ${topic} and how it can benefit you.`,
      sections: [
        { title: 'Understanding the Basics', content: `Let's start with the fundamentals of ${topic}.` },
        { title: 'Key Benefits', content: `Here are the main benefits of ${topic}.` },
        { title: 'Getting Started', content: `Ready to get started with ${topic}? Here's how.` }
      ],
      conclusion: `In conclusion, ${topic} offers numerous benefits worth exploring.`
    },
    email: {
      subject: `Everything you need to know about ${topic}`,
      opening: `Hi there!`,
      body: `I wanted to share some insights about ${topic} with you.`,
      callToAction: `Click here to learn more!`
    }
  };

  const template = templates[type] || templates.youtube;
  return {
    ...template,
    title: `${topic} - ${type} Script`,
    keywords: [topic],
    hashtags: template.hashtags || [],
    wordCount: 500
  };
}

module.exports = {
  generateYouTubeScript,
  generatePodcastScript,
  generateSocialMediaScript,
  generateBlogScript,
  generateEmailScript
};







