// Email Template Engine

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Load email template
 */
function loadTemplate(templateName) {
  try {
    const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
    
    if (!fs.existsSync(templatePath)) {
      logger.warn('Email template not found', { templateName });
      return null;
    }

    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    logger.error('Failed to load email template', { error: error.message, templateName });
    return null;
  }
}

/**
 * Render template with variables
 */
function renderTemplate(template, variables = {}) {
  if (!template) return '';

  let rendered = template;

  // Replace variables {{variable}}
  // Values are escaped for HTML (user text is stored as typed). Keys ending in
  // Url/Html are trusted markup/links built by the server.
  const { escapeHtml } = require('./escapeHtml');
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    const raw = variables[key] || '';
    const value = /(Url|Html)$/.test(key) ? String(raw) : escapeHtml(raw);
    rendered = rendered.replace(regex, () => value);
  });

  // Default variables
  const defaults = {
    year: new Date().getFullYear(),
    unsubscribeUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/settings/privacy` : '#',
    privacyUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/privacy` : '#',
    supportUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/support` : '#',
  };

  Object.keys(defaults).forEach(key => {
    if (!variables[key]) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, defaults[key]);
    }
  });

  return rendered;
}

/**
 * Get email template with variables
 */
function getEmailTemplate(templateName, variables = {}) {
  const baseTemplate = loadTemplate('base');
  const contentTemplate = loadTemplate(templateName);

  if (!baseTemplate) {
    // Fallback to content template only
    return contentTemplate ? renderTemplate(contentTemplate, variables) : '';
  }

  if (!contentTemplate) {
    logger.warn('Content template not found, using base only', { templateName });
  }

  // Merge templates
  const merged = baseTemplate.replace('{{content}}', contentTemplate || '');
  return renderTemplate(merged, variables);
}

module.exports = {
  loadTemplate,
  renderTemplate,
  getEmailTemplate,
};




