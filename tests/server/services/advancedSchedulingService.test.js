const { 
  convertToUTC, 
  detectConflicts, 
  bulkReschedule, 
  processRecurringSchedules,
  scheduleWithTimezone
} = require('../../../server/services/advancedSchedulingService');
const ScheduledPost = require('../../../server/models/ScheduledPost');
const RecurringSchedule = require('../../../server/models/RecurringSchedule');
const Content = require('../../../server/models/Content');

jest.mock('../../../server/models/ScheduledPost');
jest.mock('../../../server/models/RecurringSchedule');
jest.mock('../../../server/models/Content');
jest.mock('../../../server/utils/logger');

describe('AdvancedSchedulingService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('convertToUTC', () => {
    it('should return the same date if timezone is UTC', () => {
      const date = new Date('2026-05-01T10:00:00Z');
      const result = convertToUTC(date, 'UTC');
      expect(result.toISOString()).toBe(date.toISOString());
    });

    it('should correctly convert EST to UTC', () => {
      // EST is UTC-5 (EDT is UTC-4, May is EDT)
      const dateString = '2026-05-01T10:00:00';
      const result = convertToUTC(dateString, 'America/New_York');
      
      // 10:00 AM New York time in May (EDT) should be 2:00 PM UTC
      expect(result.getUTCHours()).toBe(14);
    });

    it('should fallback to original date on invalid timezone', () => {
      const date = new Date();
      const result = convertToUTC(date, 'Invalid/Timezone');
      expect(result.getTime()).toBe(date.getTime());
    });
  });

  describe('detectConflicts', () => {
    it('should return hasConflicts: true if overlapping posts exist', async () => {
      const mockConflicts = [{ _id: '1', scheduledTime: new Date() }];
      ScheduledPost.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockConflicts)
      });

      const result = await detectConflicts('user1', new Date(), 'twitter');
      expect(result.hasConflicts).toBe(true);
      expect(result.conflictCount).toBe(1);
    });

    it('should return hasConflicts: false if no overlapping posts', async () => {
      ScheduledPost.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      });

      const result = await detectConflicts('user1', new Date(), 'twitter');
      expect(result.hasConflicts).toBe(false);
    });
  });

  describe('bulkReschedule', () => {
    it('should update multiple posts with a time shift', async () => {
      const mockPosts = [
        { _id: 'p1', scheduledTime: new Date('2026-05-01T10:00:00Z'), save: jest.fn() },
        { _id: 'p2', scheduledTime: new Date('2026-05-01T11:00:00Z'), save: jest.fn() }
      ];
      ScheduledPost.find.mockResolvedValue(mockPosts);

      const oneHour = 60 * 60 * 1000;
      const result = await bulkReschedule('user1', ['p1', 'p2'], oneHour);

      expect(result.updated).toBe(2);
      expect(mockPosts[0].scheduledTime.toISOString()).toBe('2026-05-01T11:00:00.000Z');
      expect(mockPosts[0].save).toHaveBeenCalled();
    });
  });

  describe('scheduleWithTimezone', () => {
    it('should throw error if content is not found', async () => {
      Content.findById.mockResolvedValue(null);
      await expect(scheduleWithTimezone('u1', 'c1', 'twitter', new Date())).rejects.toThrow('Content not found');
    });

    it('should create a new scheduled post with converted UTC time', async () => {
      Content.findById.mockResolvedValue({ 
        _id: 'c1', 
        userId: 'u1', 
        title: 'Test' 
      });
      
      const mockSave = jest.fn().mockResolvedValue({ _id: 'sp1' });
      ScheduledPost.mockImplementation(() => ({
        save: mockSave
      }));

      await scheduleWithTimezone('u1', 'c1', 'twitter', '2026-05-01T10:00:00', 'America/New_York');
      
      // Verify ScheduledPost was instantiated with correct data
      const args = ScheduledPost.mock.calls[0][0];
      expect(args.timezone).toBe('America/New_York');
      expect(args.scheduledTime.getUTCHours()).toBe(14); // 10AM EDT -> 2PM UTC
    });
  });
});
