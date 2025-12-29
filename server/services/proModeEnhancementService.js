// Pro Mode Enhancement Service
// Command palette, advanced search, automation, dashboards

const CommandPalette = require('../models/CommandPalette');
const UserPreferences = require('../models/UserPreferences');
const logger = require('../utils/logger');

/**
 * Get command palette
 */
async function getCommandPalette(userId) {
  try {
    let palette = await CommandPalette.findOne({ userId }).lean();
    
    if (!palette) {
      palette = await createDefaultCommandPalette(userId);
    }

    return palette;
  } catch (error) {
    logger.error('Error getting command palette', { error: error.message, userId });
    throw error;
  }
}

/**
 * Create default command palette
 */
async function createDefaultCommandPalette(userId) {
  const defaultCommands = [
    { id: 'search', label: 'Search', description: 'Search content', category: 'search', shortcut: 'ctrl+k', action: 'search', keywords: ['search', 'find'], order: 1 },
    { id: 'new-content', label: 'New Content', description: 'Create new content', category: 'action', shortcut: 'ctrl+n', action: 'action:create-content', keywords: ['new', 'create'], order: 2 },
    { id: 'dashboard', label: 'Dashboard', description: 'Go to dashboard', category: 'navigation', shortcut: 'ctrl+d', action: 'navigate:/dashboard', keywords: ['dashboard', 'home'], order: 3 },
    { id: 'calendar', label: 'Calendar', description: 'Open calendar', category: 'navigation', shortcut: 'ctrl+c', action: 'navigate:/calendar', keywords: ['calendar', 'schedule'], order: 4 },
    { id: 'analytics', label: 'Analytics', description: 'View analytics', category: 'navigation', shortcut: 'ctrl+a', action: 'navigate:/analytics', keywords: ['analytics', 'stats'], order: 5 },
    { id: 'settings', label: 'Settings', description: 'Open settings', category: 'settings', shortcut: 'ctrl+,', action: 'navigate:/settings', keywords: ['settings', 'preferences'], order: 6 },
    { id: 'export', label: 'Export', description: 'Export data', category: 'action', shortcut: 'ctrl+e', action: 'action:export', keywords: ['export', 'download'], order: 7 },
    { id: 'bulk-edit', label: 'Bulk Edit', description: 'Bulk edit items', category: 'action', shortcut: 'ctrl+shift+e', action: 'action:bulk-edit', keywords: ['bulk', 'edit'], order: 8 }
  ];

  const palette = new CommandPalette({
    userId,
    commands: defaultCommands,
    settings: {
      triggerKey: 'ctrl+k',
      showOnStartup: false,
      maxResults: 10,
      fuzzySearch: true
    },
    recent: []
  });

  await palette.save();
  return palette;
}

/**
 * Search commands
 */
async function searchCommands(userId, query) {
  try {
    const palette = await getCommandPalette(userId);
    
    if (!query) {
      return palette.commands
        .filter(c => c.enabled)
        .sort((a, b) => a.order - b.order)
        .slice(0, palette.settings.maxResults);
    }

    const lowerQuery = query.toLowerCase();
    
    // Fuzzy search
    const results = palette.commands
      .filter(c => c.enabled)
      .filter(c => {
        // Match label
        if (c.label.toLowerCase().includes(lowerQuery)) return true;
        // Match description
        if (c.description.toLowerCase().includes(lowerQuery)) return true;
        // Match keywords
        if (c.keywords.some(k => k.toLowerCase().includes(lowerQuery))) return true;
        return false;
      })
      .sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.label.toLowerCase() === lowerQuery;
        const bExact = b.label.toLowerCase() === lowerQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        // Then by order
        return a.order - b.order;
      })
      .slice(0, palette.settings.maxResults);

    return results;
  } catch (error) {
    logger.error('Error searching commands', { error: error.message, userId });
    return [];
  }
}

/**
 * Execute command
 */
async function executeCommand(userId, commandId) {
  try {
    const palette = await CommandPalette.findOne({ userId });
    if (!palette) {
      throw new Error('Command palette not found');
    }

    const command = palette.commands.find(c => c.id === commandId);
    if (!command || !command.enabled) {
      throw new Error('Command not found or disabled');
    }

    // Update recent commands
    palette.recent = palette.recent.filter(c => c.commandId !== commandId);
    palette.recent.unshift({ commandId, usedAt: new Date() });
    palette.recent = palette.recent.slice(0, 10); // Keep last 10
    await palette.save();

    return {
      command,
      action: command.action
    };
  } catch (error) {
    logger.error('Error executing command', { error: error.message, userId });
    throw error;
  }
}

/**
 * Advanced search
 */
async function advancedSearch(userId, searchQuery) {
  try {
    const {
      query,
      filters = {},
      operators = {},
      sort = {},
      limit = 50
    } = searchQuery;

    // Build search query with operators
    const searchFilters = buildAdvancedFilters(filters, operators);

    // Would execute actual search
    // For now, return placeholder
    return {
      query,
      filters: searchFilters,
      results: [],
      total: 0,
      limit
    };
  } catch (error) {
    logger.error('Error performing advanced search', { error: error.message, userId });
    throw error;
  }
}

/**
 * Build advanced filters
 */
function buildAdvancedFilters(filters, operators) {
  const searchFilters = {};

  Object.entries(filters).forEach(([key, value]) => {
    const operator = operators[key] || 'equals';

    switch (operator) {
      case 'equals':
        searchFilters[key] = value;
        break;
      case 'not_equals':
        searchFilters[key] = { $ne: value };
        break;
      case 'contains':
        searchFilters[key] = { $regex: value, $options: 'i' };
        break;
      case 'greater_than':
        searchFilters[key] = { $gt: value };
        break;
      case 'less_than':
        searchFilters[key] = { $lt: value };
        break;
      case 'between':
        searchFilters[key] = { $gte: value[0], $lte: value[1] };
        break;
      case 'in':
        searchFilters[key] = { $in: value };
        break;
      case 'not_in':
        searchFilters[key] = { $nin: value };
        break;
    }
  });

  return searchFilters;
}

/**
 * Create automation rule
 */
async function createAutomationRule(userId, ruleData) {
  try {
    const preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      throw new Error('Preferences not found');
    }

    if (!preferences.proMode.enabled) {
      throw new Error('Pro mode must be enabled for automation');
    }

    // Would create automation rule
    // For now, return placeholder
    return {
      id: `rule-${Date.now()}`,
      name: ruleData.name,
      enabled: true,
      trigger: ruleData.trigger,
      actions: ruleData.actions
    };
  } catch (error) {
    logger.error('Error creating automation rule', { error: error.message, userId });
    throw error;
  }
}

/**
 * Create custom dashboard
 */
async function createCustomDashboard(userId, dashboardData) {
  try {
    const preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      throw new Error('Preferences not found');
    }

    if (!preferences.proMode.enabled) {
      throw new Error('Pro mode must be enabled for custom dashboards');
    }

    // Would create custom dashboard
    // For now, return placeholder
    return {
      id: `dashboard-${Date.now()}`,
      name: dashboardData.name,
      widgets: dashboardData.widgets || [],
      layout: dashboardData.layout || 'grid'
    };
  } catch (error) {
    logger.error('Error creating custom dashboard', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getCommandPalette,
  searchCommands,
  executeCommand,
  advancedSearch,
  createAutomationRule,
  createCustomDashboard
};


