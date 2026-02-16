// Test Server Setup for Integration Tests

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ path: '.env.test' });

// Import routes
const aiMultiModelRoutes = require('../../server/routes/ai/multi-model');
const aiRecommendationsRoutes = require('../../server/routes/ai/recommendations');
const aiPredictiveRoutes = require('../../server/routes/ai/predictive');
const aiContentGenRoutes = require('../../server/routes/ai/content-generation');
const infrastructureCacheRoutes = require('../../server/routes/infrastructure/cache');
const infrastructureLoadBalancerRoutes = require('../../server/routes/infrastructure/load-balancer');
const infrastructureDatabaseRoutes = require('../../server/routes/infrastructure/database');
const infrastructureResourcesRoutes = require('../../server/routes/infrastructure/resources');
const workflowAdvancedRoutes = require('../../server/routes/workflows/advanced');
const workflowTemplatesRoutes = require('../../server/routes/workflows/templates');
const healthRoutes = require('../../server/routes/health');

// Mock auth middleware for testing
const mockAuth = (req, res, next) => {
  // In real tests, verify token and set user
  const userId = req.headers['x-test-user-id'];
  if (!userId && !req.headers['authorization']) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  req.user = { _id: userId || 'test-user-id' };
  next();
};

const mockAdminAuth = (req, res, next) => {
  const isAdmin = req.headers['x-test-admin'] === 'true';
  const userId = req.headers['x-test-user-id'] || 'admin-user-id';
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  req.user = { _id: userId, role: 'admin', isAdmin: true };
  next();
};

function createTestApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Test routes with mock auth
  app.use('/api/ai/multi-model', mockAuth, aiMultiModelRoutes);
  app.use('/api/ai/recommendations', mockAuth, aiRecommendationsRoutes);
  app.use('/api/ai/predictive', mockAuth, aiPredictiveRoutes);
  app.use('/api/ai/content-generation', mockAuth, aiContentGenRoutes);
  app.use('/api/infrastructure/cache', mockAdminAuth, infrastructureCacheRoutes);
  app.use('/api/infrastructure/load-balancer', mockAdminAuth, infrastructureLoadBalancerRoutes);
  app.use('/api/infrastructure/database', mockAdminAuth, infrastructureDatabaseRoutes);
  app.use('/api/infrastructure/resources', mockAdminAuth, infrastructureResourcesRoutes);
  app.use('/api/workflows/advanced', mockAuth, workflowAdvancedRoutes);
  app.use('/api/workflows/templates', mockAuth, workflowTemplatesRoutes);
  app.use('/api/health', healthRoutes);

  // Error handler
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  return app;
}

module.exports = createTestApp;

