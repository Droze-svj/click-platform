// Email Service Tests

const { sendEmail, sendWelcomeEmail, sendPasswordResetEmail } = require('../../../server/services/emailService');

describe('Email Service', () => {
  const testEmail = 'test@example.com';
  const testName = 'Test User';

  describe('sendEmail', () => {
    it('should send an email', async () => {
      const result = await sendEmail(
        testEmail,
        'Test Subject',
        'welcome',
        { name: testName }
      );

      // In test environment, email might be mocked
      expect(result).toBeDefined();
    });

    it('should handle invalid email', async () => {
      await expect(
        sendEmail('invalid-email', 'Subject', 'welcome', {})
      ).rejects.toThrow();
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email', async () => {
      const result = await sendWelcomeEmail(testEmail, testName);
      expect(result).toBeDefined();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      const resetToken = 'test-token-123';
      const result = await sendPasswordResetEmail(testEmail, resetToken);
      expect(result).toBeDefined();
    });
  });
});






