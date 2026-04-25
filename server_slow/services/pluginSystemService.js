// Plugin System Service
// Architecture for extensible plugin system

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');

// Plugin registry
const plugins = new Map(); // pluginId -> plugin
const pluginManifests = new Map(); // pluginId -> manifest

/**
 * Load plugin from file
 * @param {string} pluginPath - Path to plugin file
 * @returns {Promise<Object>} Plugin object
 */
async function loadPlugin(pluginPath) {
  try {
    const pluginCode = await fs.readFile(pluginPath, 'utf8');
    const manifest = JSON.parse(await fs.readFile(
      path.join(path.dirname(pluginPath), 'manifest.json'),
      'utf8'
    ));

    // Create sandboxed context for plugin
    const sandbox = {
      console,
      require: (module) => {
        // Whitelist allowed modules
        const allowed = ['crypto', 'util', 'path'];
        if (allowed.includes(module)) {
          return require(module);
        }
        throw new Error(`Module ${module} not allowed in plugin`);
      },
      module: { exports: {} },
      exports: {},
    };

    // Execute plugin in sandbox
    const script = new vm.Script(pluginCode);
    const context = vm.createContext(sandbox);
    script.runInContext(context);

    const plugin = sandbox.module.exports || sandbox.exports;

    // Validate plugin
    if (!plugin.name || !plugin.version) {
      throw new Error('Invalid plugin: missing name or version');
    }

    const pluginId = `${plugin.name}@${plugin.version}`;
    plugins.set(pluginId, plugin);
    pluginManifests.set(pluginId, manifest);

    logger.info('Plugin loaded', { pluginId, name: plugin.name });

    return {
      id: pluginId,
      plugin,
      manifest,
    };
  } catch (error) {
    logger.error('Error loading plugin', { pluginPath, error: error.message });
    throw error;
  }
}

/**
 * Register plugin
 * @param {Object} plugin - Plugin object
 * @param {Object} manifest - Plugin manifest
 * @returns {string} Plugin ID
 */
function registerPlugin(plugin, manifest) {
  try {
    const pluginId = `${plugin.name}@${plugin.version}`;

    if (plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} already registered`);
    }

    plugins.set(pluginId, plugin);
    pluginManifests.set(pluginId, manifest);

    logger.info('Plugin registered', { pluginId, name: plugin.name });

    return pluginId;
  } catch (error) {
    logger.error('Error registering plugin', { error: error.message });
    throw error;
  }
}

/**
 * Get plugin
 * @param {string} pluginId - Plugin ID
 * @returns {Object} Plugin
 */
function getPlugin(pluginId) {
  return plugins.get(pluginId);
}

/**
 * Get all plugins
 * @returns {Array} All plugins
 */
function getAllPlugins() {
  return Array.from(plugins.entries()).map(([id, plugin]) => ({
    id,
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    manifest: pluginManifests.get(id),
  }));
}

/**
 * Execute plugin hook
 * @param {string} hookName - Hook name
 * @param {*} data - Hook data
 * @returns {Promise<*>} Hook result
 */
async function executeHook(hookName, data) {
  try {
    const results = [];

    for (const [pluginId, plugin] of plugins.entries()) {
      if (plugin.hooks && plugin.hooks[hookName]) {
        try {
          const result = await plugin.hooks[hookName](data);
          results.push({
            pluginId,
            result,
          });
        } catch (error) {
          logger.error('Plugin hook error', {
            pluginId,
            hookName,
            error: error.message,
          });
          // Continue with other plugins
        }
      }
    }

    return results;
  } catch (error) {
    logger.error('Error executing hook', { hookName, error: error.message });
    throw error;
  }
}

/**
 * Unload plugin
 * @param {string} pluginId - Plugin ID
 * @returns {Promise<boolean>} Success
 */
async function unloadPlugin(pluginId) {
  try {
    const plugin = plugins.get(pluginId);
    if (plugin && plugin.cleanup) {
      await plugin.cleanup();
    }

    plugins.delete(pluginId);
    pluginManifests.delete(pluginId);

    logger.info('Plugin unloaded', { pluginId });
    return true;
  } catch (error) {
    logger.error('Error unloading plugin', { pluginId, error: error.message });
    throw error;
  }
}

/**
 * Validate plugin manifest
 * @param {Object} manifest - Plugin manifest
 * @returns {boolean} Is valid
 */
function validateManifest(manifest) {
  const required = ['name', 'version', 'description', 'author'];
  return required.every((field) => manifest[field]);
}

module.exports = {
  loadPlugin,
  registerPlugin,
  getPlugin,
  getAllPlugins,
  executeHook,
  unloadPlugin,
  validateManifest,
};
