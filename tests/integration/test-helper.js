// Integration Test Helper Functions

const mongoose = require('mongoose');
const User = require('../../server/models/User');
const Content = require('../../server/models/Content');
const Workflow = require('../../server/models/Workflow');

/**
 * Create a test user
 */
async function createTestUser(email = 'test@example.com', role = 'user') {
  const user = new User({
    name: 'Test User',
    email,
    password: 'hashedpassword',
    role,
    subscription: { status: 'active', plan: 'pro' },
  });
  await user.save();
  return user;
}

/**
 * Create test content
 */
async function createTestContent(userId, options = {}) {
  const content = new Content({
    userId,
    title: options.title || 'Test Content',
    body: options.body || 'Test content body',
    type: options.type || 'article',
    status: options.status || 'published',
    platform: options.platform || 'instagram',
    views: options.views || 0,
    likes: options.likes || 0,
    ...options,
  });
  await content.save();
  return content;
}

/**
 * Create test workflow
 */
async function createTestWorkflow(userId, options = {}) {
  const workflow = new Workflow({
    userId,
    name: options.name || 'Test Workflow',
    description: options.description || 'Test workflow description',
    triggers: options.triggers || [
      { type: 'event', config: { event: 'test' } },
    ],
    actions: options.actions || [
      { type: 'test', config: {} },
    ],
    conditions: options.conditions || [],
    advanced: options.advanced || false,
    ...options,
  });
  await workflow.save();
  return workflow;
}

/**
 * Clean up test data
 */
async function cleanupTestData(userId) {
  await Content.deleteMany({ userId });
  await Workflow.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
}

/**
 * Get auth token (mock)
 */
function getAuthToken(userId) {
  // In production, this would generate a real JWT
  return `test-token-${userId}`;
}

/**
 * Wait for async operation
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  createTestUser,
  createTestContent,
  createTestWorkflow,
  cleanupTestData,
  getAuthToken,
  wait,
};






