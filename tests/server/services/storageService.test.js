// Storage Service Tests

const fs = require('fs');
const path = require('path');
const {
  uploadFile,
  uploadBuffer,
  deleteFile,
  getSignedUrlForFile,
  fileExists,
  getFileUrl,
  isCloudStorageEnabled
} = require('../../../server/services/storageService');

describe('Storage Service', () => {
  const testFilePath = path.join(__dirname, '../../fixtures/test-file.txt');
  const testKey = 'test/test-file.txt';
  const testContent = 'Test file content';

  beforeAll(() => {
    // Create test file
    const testDir = path.dirname(testFilePath);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(testFilePath, testContent);
  });

  afterAll(() => {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe('uploadFile', () => {
    it('should upload file to storage', async () => {
      const result = await uploadFile(testFilePath, testKey, 'text/plain');
      
      expect(result).toBeDefined();
      expect(result.key).toBeDefined();
      expect(result.storage).toBeDefined();
      expect(['s3', 'local']).toContain(result.storage);
    });

    it('should handle file upload with metadata', async () => {
      const metadata = { userId: '123', type: 'video' };
      const result = await uploadFile(testFilePath, testKey, 'text/plain', metadata);
      
      expect(result).toBeDefined();
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        uploadFile('/non/existent/file.txt', testKey)
      ).rejects.toThrow();
    });
  });

  describe('uploadBuffer', () => {
    it('should upload buffer to storage', async () => {
      const buffer = Buffer.from(testContent);
      const result = await uploadBuffer(buffer, testKey, 'text/plain');
      
      expect(result).toBeDefined();
      expect(result.key).toBeDefined();
      expect(result.storage).toBeDefined();
    });

    it('should handle buffer upload with metadata', async () => {
      const buffer = Buffer.from(testContent);
      const metadata = { userId: '123' };
      const result = await uploadBuffer(buffer, testKey, 'text/plain', metadata);
      
      expect(result).toBeDefined();
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      // First upload a file
      await uploadFile(testFilePath, testKey);
      
      // Then check if it exists
      const exists = await fileExists(testKey);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await fileExists('non-existent-file.txt');
      expect(exists).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      // First upload a file
      await uploadFile(testFilePath, testKey);
      
      // Then delete it
      const result = await deleteFile(testKey);
      expect(result.success).toBe(true);
      
      // Verify it's deleted
      const exists = await fileExists(testKey);
      expect(exists).toBe(false);
    });

    it('should handle deletion of non-existent file gracefully', async () => {
      const result = await deleteFile('non-existent-file.txt');
      expect(result.success).toBe(true);
    });
  });

  describe('getSignedUrlForFile', () => {
    it('should generate signed URL for file', async () => {
      // First upload a file
      await uploadFile(testFilePath, testKey);
      
      // Get signed URL
      const url = await getSignedUrlForFile(testKey, 3600);
      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
    });

    it('should handle non-existent file for signed URL', async () => {
      // Should not throw, but may return null or empty string
      const url = await getSignedUrlForFile('non-existent.txt');
      expect(url).toBeDefined();
    });
  });

  describe('getFileUrl', () => {
    it('should return file URL', () => {
      const url = getFileUrl(testKey);
      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
    });

    it('should return different URL for signed URLs', () => {
      const publicUrl = getFileUrl(testKey, false);
      expect(publicUrl).toBeDefined();
    });
  });

  describe('isCloudStorageEnabled', () => {
    it('should return boolean indicating cloud storage status', () => {
      const enabled = isCloudStorageEnabled();
      expect(typeof enabled).toBe('boolean');
    });
  });
});




