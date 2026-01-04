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
};


