const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const User = require('../../server/models/User');
const subscriptionRouter = require('../../server/routes/subscription');
const axios = require('axios');

// Mock axios for WHOP API
jest.mock('axios');

// Mock logger
jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Setup express for testing
const app = express();
app.use(express.json());

// Mock auth middleware
const mockAuth = (req, res, next) => {
  req.user = {
    _id: new mongoose.Types.ObjectId(),
    save: jest.fn().mockResolvedValue(true)
  };
  next();
};

app.use('/api/subscription', mockAuth, subscriptionRouter);

describe('Subscription API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/subscription/verify', () => {
    it('should map WHOP Elite plan to internal elite tier', async () => {
      axios.get.mockResolvedValue({
        data: {
          status: 'active',
          plan: { name: 'Elite 2026' },
          plan_id: 'p_elite_1',
          created_at: new Date().toISOString(),
          expires_at: new Date().toISOString()
        }
      });

      const response = await request(app)
        .post('/api/subscription/verify')
        .send({ whopUserId: 'user_1', whopSubscriptionId: 'sub_1' });

      expect(response.status).toBe(200);
      expect(response.body.tier).toBe('elite');
    });

    it('should map generic plan to starter tier', async () => {
      axios.get.mockResolvedValue({
        data: {
          status: 'active',
          plan: { name: 'Basic Starter' },
          plan_id: 'p_starter_1',
          created_at: new Date().toISOString(),
          expires_at: new Date().toISOString()
        }
      });

      const response = await request(app)
        .post('/api/subscription/verify')
        .send({ whopUserId: 'user_1', whopSubscriptionId: 'sub_1' });

      expect(response.status).toBe(200);
      expect(response.body.tier).toBe('starter');
    });

    it('should return 403 if subscription is not active', async () => {
      axios.get.mockResolvedValue({
        data: {
          status: 'cancelled',
          plan: { name: 'Elite' }
        }
      });

      const response = await request(app)
        .post('/api/subscription/verify')
        .send({ whopUserId: 'user_1', whopSubscriptionId: 'sub_1' });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/subscription/webhook', () => {
    it('should process subscription.created and update user tier', async () => {
      // Mock User.findOne
      const mockUser = {
        _id: 'user_123',
        tier: 'free',
        subscription: {},
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/subscription/webhook')
        .send({
          event: 'subscription.created',
          data: {
            id: 'sub_123',
            status: 'active',
            plan: { name: 'Pro Plan' },
            created_at: new Date().toISOString(),
            expires_at: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      expect(mockUser.tier).toBe('pro');
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
