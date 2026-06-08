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
const mockUserId = new mongoose.Types.ObjectId();
jest.mock('../../server/middleware/auth', () => (req, res, next) => {
  req.user = {
    _id: mockUserId,
    save: jest.fn().mockResolvedValue(true)
  };
  next();
});

const mockAuth = require('../../server/middleware/auth');

app.use('/api/subscription', mockAuth, subscriptionRouter);

describe('Subscription API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/subscription/verify', () => {
    // Security: /verify derives the plan from the canonical Whop product map
    // (entitlements). An UNMAPPED product id must NEVER grant a paid tier from
    // arbitrary input — it resolves to 'free'. (The old behavior echoed the raw
    // plan_id / hardcoded 'pro', which was a privilege-escalation hole.)
    it('should resolve an unmapped WHOP product to free (no arbitrary grant)', async () => {
      axios.get.mockResolvedValue({
        data: {
          status: 'active',
          plan: { name: 'Elite 2026' },
          plan_id: 'p_unmapped_1',
          created_at: new Date().toISOString(),
          expires_at: new Date().toISOString()
        }
      });

      const response = await request(app)
        .post('/api/subscription/verify')
        .send({ whopUserId: 'user_1', whopSubscriptionId: 'sub_1' });

      expect(response.status).toBe(200);
      expect(response.body.subscription.plan).toBe('free');
    });

    it('should never grant pro for a generic/unmapped plan', async () => {
      axios.get.mockResolvedValue({
        data: {
          status: 'active',
          plan: { name: 'Basic' },
          plan_id: 'p_generic_1',
          created_at: new Date().toISOString(),
          expires_at: new Date().toISOString()
        }
      });

      const response = await request(app)
        .post('/api/subscription/verify')
        .send({ whopUserId: 'user_1', whopSubscriptionId: 'sub_1' });

      expect(response.status).toBe(200);
      expect(response.body.subscription.plan).not.toBe('pro');
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

  describe('POST /api/subscription/webhook (legacy, retired)', () => {
    // Security: the legacy UNSIGNED webhook was retired (it granted Pro with no
    // signature verification). It now returns 410 Gone and must NOT mutate the
    // user. The signed, HMAC-verified path is POST /api/webhooks/whop.
    it('should be retired (410) and never grant a plan', async () => {
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

      expect(response.status).toBe(410);
      expect(mockUser.save).not.toHaveBeenCalled();
    });
  });
});
