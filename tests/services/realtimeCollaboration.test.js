const RealtimeCollaborationService = require('../../server/services/realtimeCollaborationService');
const Content = require('../../server/models/Content');
const User = require('../../server/models/User');

// Mock dependencies
jest.mock('../../server/models/Content');
jest.mock('../../server/models/User');
jest.mock('../../server/services/realtimeService', () => ({
  emitToUser: jest.fn(),
  emitToRoom: jest.fn(),
  broadcast: jest.fn(),
}));

jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('RealtimeCollaborationService', () => {
  const contentId = 'content_123';
  const userId = 'user_456';
  const socketId = 'socket_789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Management', () => {
    it('should allow joining an editing session', () => {
      const result = RealtimeCollaborationService.joinEditingSession(contentId, userId, socketId);
      expect(result.success).toBe(true);
      expect(result.activeUsers).toContain(userId.toString());
    });

    it('should notify other users when a user joins', () => {
      const otherUserId = 'other_user_999';
      RealtimeCollaborationService.joinEditingSession(contentId, otherUserId, 'other_socket');
      
      const { emitToUser: mockEmit } = require('../../server/services/realtimeService');
      
      RealtimeCollaborationService.joinEditingSession(contentId, userId, socketId);
      
      expect(mockEmit).toHaveBeenCalledWith(otherUserId.toString(), 'collaboration:user-joined', expect.any(Object));
    });
  });

  describe('Heartbeats & Inactivity', () => {
    it('should update lastActivity on heartbeat', () => {
      RealtimeCollaborationService.joinEditingSession(contentId, userId, socketId);
      // No errors should occur
      expect(() => RealtimeCollaborationService.handleHeartbeat(contentId, userId)).not.toThrow();
    });
  });

  describe('Conflict Locking', () => {
    it('should allow locking a segment', () => {
      RealtimeCollaborationService.joinEditingSession(contentId, userId, socketId);
      const result = RealtimeCollaborationService.lockSegment(contentId, userId, 'segment_0');
      expect(result.success).toBe(true);
    });

    it('should prevent other users from locking the same segment', () => {
      const otherUserId = 'user_999';
      RealtimeCollaborationService.joinEditingSession(contentId, userId, socketId);
      RealtimeCollaborationService.joinEditingSession(contentId, otherUserId, 'other_socket');
      
      RealtimeCollaborationService.lockSegment(contentId, userId, 'segment_0');
      
      const result = RealtimeCollaborationService.lockSegment(contentId, otherUserId, 'segment_0');
      expect(result.success).toBe(false);
      expect(result.lockedBy).toBe(userId.toString());
    });

    it('should allow locking after unlocking', () => {
      const otherUserId = 'user_999';
      RealtimeCollaborationService.joinEditingSession(contentId, userId, socketId);
      RealtimeCollaborationService.joinEditingSession(contentId, otherUserId, 'other_socket');
      
      RealtimeCollaborationService.lockSegment(contentId, userId, 'segment_0');
      RealtimeCollaborationService.unlockSegment(contentId, userId, 'segment_0');
      
      const result = RealtimeCollaborationService.lockSegment(contentId, otherUserId, 'segment_0');
      expect(result.success).toBe(true);
    });
  });
});
