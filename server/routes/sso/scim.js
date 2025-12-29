// SCIM Routes

const express = require('express');
const {
  createSCIMUser,
  updateSCIMUser,
  deleteSCIMUser,
  getSCIMUser,
  listSCIMUsers,
} = require('../../services/ssoSCIMService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

// SCIM authentication middleware (Bearer token)
const scimAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  // In production, verify SCIM token
  if (!token || token !== process.env.SCIM_TOKEN) {
    return sendError(res, 'Unauthorized', 401);
  }

  req.scimProvider = req.headers['x-provider-id'] || 'default';
  next();
};

router.use(scimAuth);

/**
 * SCIM 2.0 - Create User
 */
router.post('/Users', asyncHandler(async (req, res) => {
  try {
    const user = await createSCIMUser(req.body, req.scimProvider);
    res.status(201).json(user);
  } catch (error) {
    logger.error('SCIM create user error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * SCIM 2.0 - Get User
 */
router.get('/Users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const user = await getSCIMUser(id, req.scimProvider);
    res.json(user);
  } catch (error) {
    logger.error('SCIM get user error', { error: error.message, userId: id });
    sendError(res, error.message, 404);
  }
}));

/**
 * SCIM 2.0 - Update User
 */
router.put('/Users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const user = await updateSCIMUser(id, req.body, req.scimProvider);
    res.json(user);
  } catch (error) {
    logger.error('SCIM update user error', { error: error.message, userId: id });
    sendError(res, error.message, 500);
  }
}));

/**
 * SCIM 2.0 - Delete User
 */
router.delete('/Users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    await deleteSCIMUser(id, req.scimProvider);
    res.status(204).send();
  } catch (error) {
    logger.error('SCIM delete user error', { error: error.message, userId: id });
    sendError(res, error.message, 500);
  }
}));

/**
 * SCIM 2.0 - List Users
 */
router.get('/Users', asyncHandler(async (req, res) => {
  const {
    startIndex = 1,
    count = 100,
    filter,
  } = req.query;

  try {
    const result = await listSCIMUsers(req.scimProvider, {
      startIndex: parseInt(startIndex),
      count: parseInt(count),
      filter,
    });
    res.json(result);
  } catch (error) {
    logger.error('SCIM list users error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






