const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Mock external heavy services before loading routes
jest.mock('../../server/services/robustExportService', () => ({
  createExportJob: jest.fn().mockImplementation((userId, exportData) =>
    Promise.resolve({
      id: 'job-123-' + (exportData.format || 'mp4'),
      _id: 'job-123-' + (exportData.format || 'mp4'),
      userId,
      export: exportData,
      status: 'pending',
    })
  ),
  getExportJobStatus: jest.fn().mockResolvedValue({ status: 'completed', progress: 100 }),
  retryExport: jest.fn().mockResolvedValue({ id: 'job-retry', status: 'pending' }),
}));

jest.mock('../../server/services/exportEnhancementService', () => ({
  createExportTemplate: jest.fn().mockResolvedValue({ id: 'tmpl-1' }),
  getExportTemplates: jest.fn().mockResolvedValue([]),
  useExportTemplate: jest.fn().mockResolvedValue({ id: 'job-from-tmpl' }),
  getExportHistory: jest.fn().mockResolvedValue([]),
  getExportAnalytics: jest.fn().mockResolvedValue({ total: 0 }),
  scheduleExport: jest.fn().mockResolvedValue({ id: 'scheduled-1' }),
}));

jest.mock('../../server/services/exportValidationService', () => ({
  validateExportRequest: jest.fn().mockResolvedValue({ valid: true }),
  generateExportPreview: jest.fn().mockResolvedValue({ previewUrl: 'https://example.com/p.jpg' }),
}));

jest.mock('../../server/services/exportNotificationService', () => ({
  notifyExportEvent: jest.fn().mockResolvedValue(),
}));

jest.mock('../../server/services/usageService', () => ({
  incrementUsage: jest.fn().mockResolvedValue(),
}));

jest.mock('../../server/middleware/tierGate', () => ({
  addTierContext: (req, res, next) => next(),
  checkExportQuota: (req, res, next) => next(),
}));

// Mock auth middleware to supply test user
jest.mock('../../server/middleware/auth', () => (req, res, next) => {
  req.user = { _id: '507f1f77bcf86cd799439011', id: '507f1f77bcf86cd799439011', role: 'user' };
  next();
});

const exportRouter = require('../../server/routes/export');
const proModeRouter = require('../../server/routes/pro-mode');
const { errorHandler } = require('../../server/middleware/errorHandler');

describe('Saving and Exporting Endpoints & User Preferred Configurations', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/export', exportRouter);
    app.use('/api/pro-mode', proModeRouter);
    app.use(errorHandler);
  });

  describe('Export Endpoints', () => {
    it('POST /api/export/batch initiates multi-format batch exports', async () => {
      const res = await request(app)
        .post('/api/export/batch')
        .send({
          videoId: 'vid-999',
          formatIds: ['9:16', '16:9', '1:1'],
          options: { autoVault: true },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results).toHaveLength(3);
      expect(res.body.data.results[0]).toEqual(
        expect.objectContaining({
          format: '9:16',
          jobId: expect.any(String),
          status: 'pending',
        })
      );
    });

    it('POST /api/export/batch validates missing videoId or empty formats', async () => {
      const res = await request(app)
        .post('/api/export/batch')
        .send({ videoId: '', formatIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/videoId and a non-empty formatIds array are required/i);
    });

    it('POST /api/export creates a single export job', async () => {
      const res = await request(app)
        .post('/api/export')
        .send({
          type: 'content',
          format: 'mp4',
          filters: { quality: '1080p' },
          options: { codec: 'h264' },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
    });
  });

  describe('User Preferred Configurations & Pro Mode Settings', () => {
    it('PUT /api/pro-mode/configuration/:category updates workflow preferences', async () => {
      // Mock UserPreferences findOne
      const UserPreferences = require('../../server/models/UserPreferences');
      const mockPrefs = {
        userId: '507f1f77bcf86cd799439011',
        configuration: {
          workflows: { autoSave: true, autoSaveInterval: 30 },
        },
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(UserPreferences, 'findOne').mockResolvedValue(mockPrefs);

      const res = await request(app)
        .put('/api/pro-mode/configuration/workflows')
        .send({
          autoSave: true,
          autoSaveInterval: 15,
          showAdvancedOptions: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPrefs.configuration.workflows.autoSaveInterval).toBe(15);
      expect(mockPrefs.configuration.workflows.showAdvancedOptions).toBe(true);
      expect(mockPrefs.markModified).toHaveBeenCalledWith('configuration');
      expect(mockPrefs.save).toHaveBeenCalled();
    });

    it('PUT /api/pro-mode/configuration/ui updates UI theme and density preferences', async () => {
      const UserPreferences = require('../../server/models/UserPreferences');
      const mockPrefs = {
        userId: '507f1f77bcf86cd799439011',
        configuration: {},
        ui: { theme: 'light', density: 'comfortable' },
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(UserPreferences, 'findOne').mockResolvedValue(mockPrefs);

      const res = await request(app)
        .put('/api/pro-mode/configuration/ui')
        .send({
          theme: 'dark',
          density: 'compact',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPrefs.ui.theme).toBe('dark');
      expect(mockPrefs.ui.density).toBe('compact');
      expect(mockPrefs.markModified).toHaveBeenCalledWith('ui');
      expect(mockPrefs.save).toHaveBeenCalled();
    });

    it('PUT /api/pro-mode/brand-kit saves custom brand colors and caption settings', async () => {
      const UserPreferences = require('../../server/models/UserPreferences');
      const mockPrefs = {
        userId: '507f1f77bcf86cd799439011',
        brandKit: {},
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(UserPreferences, 'findOne').mockResolvedValue(mockPrefs);

      const res = await request(app)
        .put('/api/pro-mode/brand-kit')
        .send({
          primaryColor: '#6366F1',
          accentColor: '#EC4899',
          titleFont: 'Inter',
          captionStyle: 'modern',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPrefs.brandKit.primaryColor).toBe('#6366F1');
      expect(mockPrefs.brandKit.accentColor).toBe('#EC4899');
      expect(mockPrefs.markModified).toHaveBeenCalledWith('brandKit');
    });

    it('POST /api/pro-mode/shortcuts saves custom shortcut configurations', async () => {
      const UserPreferences = require('../../server/models/UserPreferences');
      const mockPrefs = {
        userId: '507f1f77bcf86cd799439011',
        shortcuts: { custom: [] },
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(UserPreferences, 'findOne').mockResolvedValue(mockPrefs);

      const res = await request(app)
        .post('/api/pro-mode/shortcuts')
        .send({
          key: 'ctrl+shift+e',
          action: 'export_multi_format',
          description: 'Quick export multi-format',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPrefs.shortcuts.custom).toHaveLength(1);
      expect(mockPrefs.shortcuts.custom[0].key).toBe('ctrl+shift+e');
      expect(mockPrefs.markModified).toHaveBeenCalledWith('shortcuts');
    });
  });
});
