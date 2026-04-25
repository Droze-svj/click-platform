// Workflow Templates Catalog Service
// Provides lightweight, prebuilt templates for the UI under /api/workflows/templates.

const Workflow = require('../models/Workflow');
const logger = require('../utils/logger');

// UI expects:
// - templates: Record<id, {name, description, triggers, actions, category}>
// - categories: Record<category, Array<{id, name}>>
const WORKFLOW_TEMPLATES = {
  'content-to-posts': {
    name: 'Content → Social Posts',
    description: 'Generate multi-platform social posts from a long-form text input.',
    category: 'content',
    triggers: [{ type: 'event', config: { event: 'manual' } }],
    actions: [
      { type: 'generate_content', config: { platforms: ['twitter', 'linkedin', 'instagram'] } },
    ],
  },
  'video-to-clips': {
    name: 'Video → Clips',
    description: 'Upload a long video, generate clips, and prepare for posting.',
    category: 'video',
    triggers: [{ type: 'event', config: { event: 'upload_video' } }],
    actions: [
      { type: 'upload_video', config: {} },
      { type: 'export', config: { format: 'mp4' } },
    ],
  },
  'script-to-quote': {
    name: 'Script → Quote Cards',
    description: 'Generate a script and create quote cards from key lines.',
    category: 'creative',
    triggers: [{ type: 'event', config: { event: 'manual' } }],
    actions: [
      { type: 'generate_script', config: { type: 'youtube' } },
      { type: 'create_quote', config: { style: 'modern' } },
    ],
  },
};

function getWorkflowTemplates() {
  return WORKFLOW_TEMPLATES;
}

function getTemplateCategories() {
  const categories = {};
  for (const [id, tmpl] of Object.entries(WORKFLOW_TEMPLATES)) {
    const cat = tmpl.category || 'other';
    categories[cat] = categories[cat] || [];
    categories[cat].push({ id, name: tmpl.name });
  }
  return categories;
}

/**
 * Suggest template IDs for the user based on workflow history (auto-adapt to user workflows).
 * Returns template IDs in suggested order; use when no history, returns default order.
 */
async function getSuggestedTemplateIds(userId) {
  const defaultOrder = ['content-to-posts', 'video-to-clips', 'script-to-quote'];
  try {
    const UserSettings = require('../models/UserSettings');
    const lastUsed = await UserSettings.findOne({ userId: String(userId) }).lean();
    const lastId = lastUsed?.preferences?.lastUsedWorkflowTemplateId;
    if (lastId && WORKFLOW_TEMPLATES[lastId]) {
      const rest = defaultOrder.filter(id => id !== lastId);
      return [lastId, ...rest];
    }
  } catch (_) { /* ignore */ }
  try {
    const { getUserPreferences } = require('./workflowService');
    const prefs = await getUserPreferences(userId);
    const actions = prefs?.commonActions || {};
    const platforms = prefs?.preferredPlatforms || [];
    let ordered = [];
    const contentScore = (actions.generate_content || 0) + (platforms.length > 1 ? 2 : 0);
    const videoScore = actions.upload_video || actions.export || 0;
    const scriptScore = actions.generate_script || actions.create_quote || 0;
    if (videoScore >= contentScore && videoScore >= scriptScore) {
      ordered = ['video-to-clips', 'content-to-posts', 'script-to-quote'];
    } else if (scriptScore >= contentScore && scriptScore >= videoScore) {
      ordered = ['script-to-quote', 'content-to-posts', 'video-to-clips'];
    } else {
      ordered = [...defaultOrder];
    }
    return ordered.filter(id => WORKFLOW_TEMPLATES[id]);
  } catch (e) {
    return defaultOrder;
  }
}

async function createFromTemplate(userId, templateId, customizations = {}) {
  const template = WORKFLOW_TEMPLATES[templateId];
  if (!template) {
    const err = new Error('Template not found');
    err.statusCode = 404;
    throw err;
  }

  const name = customizations.name || template.name;
  const description = customizations.description || template.description;

  // Map actions to Workflow.steps for compatibility with existing workflow model.
  const steps = (template.actions || []).map((a, idx) => ({
    order: idx + 1,
    action: a.type,
    config: a.config || {},
    conditions: {},
  }));

  const workflow = new Workflow({
    userId,
    name,
    description,
    steps,
    triggers: template.triggers || [],
    actions: template.actions || [],
    isTemplate: false,
    isActive: true,
    tags: [template.category].filter(Boolean),
  });

  await workflow.save();
  logger.info('Workflow created from catalog template', { userId, templateId, workflowId: workflow._id });
  return workflow;
}

module.exports = {
  getWorkflowTemplates,
  getTemplateCategories,
  createFromTemplate,
  getSuggestedTemplateIds,
};


