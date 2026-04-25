// Multi-Tenant Service
// Enhanced multi-tenancy with isolation and per-tenant features

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const User = require('../models/User');
const Workspace = require('../models/Workspace');

// Tenant registry
const tenants = new Map(); // tenantId -> tenant config

/**
 * Create tenant
 * @param {Object} tenantData - Tenant data
 * @returns {Promise<Object>} Created tenant
 */
async function createTenant(tenantData) {
  try {
    const {
      name,
      domain,
      adminEmail,
      adminPassword,
      plan = 'enterprise',
      features = {},
    } = tenantData;

    logger.info('Creating tenant', { name, domain });

    // Create workspace for tenant
    const workspace = new Workspace({
      name: `${name} Workspace`,
      type: 'tenant',
      settings: {
        customDomain: domain,
        plan,
        features,
      },
    });
    await workspace.save();

    // Create admin user
    const admin = new User({
      email: adminEmail,
      password: adminPassword, // Would be hashed
      role: 'admin',
      workspaceId: workspace._id,
      tenantId: workspace._id,
    });
    await admin.save();

    const tenant = {
      id: workspace._id.toString(),
      name,
      domain,
      workspaceId: workspace._id,
      adminId: admin._id,
      plan,
      features,
      createdAt: new Date(),
    };

    tenants.set(tenant.id, tenant);

    logger.info('Tenant created', { tenantId: tenant.id, name });

    return tenant;
  } catch (error) {
    logger.error('Error creating tenant', { error: error.message });
    captureException(error, {
      tags: { service: 'multiTenantService', action: 'createTenant' },
    });
    throw error;
  }
}

/**
 * Get tenant by ID
 * @param {string} tenantId - Tenant ID
 * @returns {Object} Tenant
 */
function getTenant(tenantId) {
  return tenants.get(tenantId);
}

/**
 * Get tenant by domain
 * @param {string} domain - Domain
 * @returns {Object} Tenant
 */
function getTenantByDomain(domain) {
  for (const tenant of tenants.values()) {
    if (tenant.domain === domain) {
      return tenant;
    }
  }
  return null;
}

/**
 * Update tenant features
 * @param {string} tenantId - Tenant ID
 * @param {Object} features - Features to update
 * @returns {Promise<Object>} Updated tenant
 */
async function updateTenantFeatures(tenantId, features) {
  try {
    const tenant = tenants.get(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    tenant.features = { ...tenant.features, ...features };
    tenants.set(tenantId, tenant);

    // Update workspace
    await Workspace.findByIdAndUpdate(tenant.workspaceId, {
      'settings.features': tenant.features,
    });

    logger.info('Tenant features updated', { tenantId, features });

    return tenant;
  } catch (error) {
    logger.error('Error updating tenant features', { error: error.message, tenantId });
    throw error;
  }
}

/**
 * Get tenant users
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Array>} Users
 */
async function getTenantUsers(tenantId) {
  try {
    const tenant = tenants.get(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const users = await User.find({ tenantId }).select('-password').lean();
    return users;
  } catch (error) {
    logger.error('Error getting tenant users', { error: error.message, tenantId });
    throw error;
  }
}

/**
 * Check if feature is enabled for tenant
 * @param {string} tenantId - Tenant ID
 * @param {string} feature - Feature name
 * @returns {boolean} Is enabled
 */
function isFeatureEnabled(tenantId, feature) {
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    return false;
  }
  return tenant.features[feature] === true;
}

/**
 * Get tenant billing info
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Billing info
 */
async function getTenantBilling(tenantId) {
  try {
    const tenant = tenants.get(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Would integrate with billing service
    return {
      tenantId,
      plan: tenant.plan,
      status: 'active',
      billingCycle: 'monthly',
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  } catch (error) {
    logger.error('Error getting tenant billing', { error: error.message, tenantId });
    throw error;
  }
}

module.exports = {
  createTenant,
  getTenant,
  getTenantByDomain,
  updateTenantFeatures,
  getTenantUsers,
  isFeatureEnabled,
  getTenantBilling,
};
