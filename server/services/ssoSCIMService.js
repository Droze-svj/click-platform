// SCIM (System for Cross-domain Identity Management) Service

const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * SCIM 2.0 User Provisioning
 */

/**
 * Create user via SCIM
 */
async function createSCIMUser(scimUser, providerId) {
  try {
    const email = scimUser.emails?.[0]?.value;
    const name = scimUser.displayName || `${scimUser.name?.givenName || ''} ${scimUser.name?.familyName || ''}`.trim();

    if (!email) {
      throw new Error('Email is required');
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // Update existing user
      user.name = name || user.name;
      if (!user.ssoProviders) {
        user.ssoProviders = [];
      }
      if (!user.ssoProviders.includes(providerId)) {
        user.ssoProviders.push(providerId);
      }
      user.ssoId = scimUser.id || user.ssoId;
      user.emailVerified = true;
      await user.save();
    } else {
      // Create new user
      user = new User({
        email,
        name: name || email.split('@')[0],
        ssoProviders: [providerId],
        ssoId: scimUser.id,
        emailVerified: true,
        // Generate random password (user will use SSO)
        password: require('crypto').randomBytes(32).toString('hex'),
      });
      await user.save();
    }

    logger.info('SCIM user created/updated', { userId: user._id, providerId });
    return formatSCIMUser(user);
  } catch (error) {
    logger.error('Create SCIM user error', { error: error.message, providerId });
    throw error;
  }
}

/**
 * Update user via SCIM
 */
async function updateSCIMUser(scimUserId, scimUser, providerId) {
  try {
    const user = await User.findOne({ ssoId: scimUserId, ssoProviders: providerId });

    if (!user) {
      throw new Error('User not found');
    }

    // Update user attributes
    if (scimUser.displayName) {
      user.name = scimUser.displayName;
    }
    if (scimUser.emails?.[0]?.value) {
      user.email = scimUser.emails[0].value;
    }
    if (scimUser.active !== undefined) {
      user.status = scimUser.active ? 'active' : 'suspended';
    }

    await user.save();

    logger.info('SCIM user updated', { userId: user._id, providerId });
    return formatSCIMUser(user);
  } catch (error) {
    logger.error('Update SCIM user error', { error: error.message, scimUserId });
    throw error;
  }
}

/**
 * Delete user via SCIM
 */
async function deleteSCIMUser(scimUserId, providerId) {
  try {
    const user = await User.findOne({ ssoId: scimUserId, ssoProviders: providerId });

    if (!user) {
      throw new Error('User not found');
    }

    // Soft delete or hard delete based on policy
    user.status = 'deleted';
    await user.save();

    logger.info('SCIM user deleted', { userId: user._id, providerId });
    return { success: true };
  } catch (error) {
    logger.error('Delete SCIM user error', { error: error.message, scimUserId });
    throw error;
  }
}

/**
 * Get user via SCIM
 */
async function getSCIMUser(scimUserId, providerId) {
  try {
    const user = await User.findOne({ ssoId: scimUserId, ssoProviders: providerId });

    if (!user) {
      throw new Error('User not found');
    }

    return formatSCIMUser(user);
  } catch (error) {
    logger.error('Get SCIM user error', { error: error.message, scimUserId });
    throw error;
  }
}

/**
 * List users via SCIM
 */
async function listSCIMUsers(providerId, options = {}) {
  try {
    const { startIndex = 1, count = 100, filter = null } = options;

    const query = { ssoProviders: providerId };

    // Parse SCIM filter (simplified)
    if (filter) {
      // Example: userName eq "user@example.com"
      const match = filter.match(/userName eq "([^"]+)"/);
      if (match) {
        query.email = match[1];
      }
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .skip(startIndex - 1)
        .limit(count)
        .lean(),
      User.countDocuments(query),
    ]);

    return {
      totalResults: total,
      startIndex,
      itemsPerPage: count,
      Resources: users.map(formatSCIMUser),
    };
  } catch (error) {
    logger.error('List SCIM users error', { error: error.message, providerId });
    throw error;
  }
}

/**
 * Format user as SCIM resource
 */
function formatSCIMUser(user) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: user.ssoId || user._id.toString(),
    userName: user.email,
    displayName: user.name,
    name: {
      formatted: user.name,
      familyName: user.name.split(' ').pop() || '',
      givenName: user.name.split(' ')[0] || '',
    },
    emails: [
      {
        value: user.email,
        primary: true,
      },
    ],
    active: user.status !== 'suspended' && user.status !== 'deleted',
    meta: {
      resourceType: 'User',
      created: user.createdAt,
      lastModified: user.updatedAt || user.createdAt,
    },
  };
}

module.exports = {
  createSCIMUser,
  updateSCIMUser,
  deleteSCIMUser,
  getSCIMUser,
  listSCIMUsers,
};






