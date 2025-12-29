// Test Data Fixtures

/**
 * Generate test user data
 */
function generateTestUser() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  
  return {
    name: `E2E Test User ${timestamp}`,
    email: `e2e-test-${timestamp}-${random}@example.com`,
    password: 'TestPassword123!',
    company: 'E2E Test Company',
  };
}

/**
 * Generate test content data
 */
function generateTestContent() {
  return {
    title: `E2E Test Content ${Date.now()}`,
    text: 'This is test content created during E2E testing. It contains enough text to test content creation flows.',
    type: 'article',
    platforms: ['twitter', 'linkedin'],
    tags: ['e2e', 'testing'],
  };
}

/**
 * Generate test video data
 */
function generateTestVideoData() {
  return {
    title: `E2E Test Video ${Date.now()}`,
    description: 'Test video description for E2E testing',
    duration: 60,
    format: 'mp4',
  };
}

/**
 * Generate test social post data
 */
function generateTestSocialPost() {
  return {
    text: `E2E Test Post ${Date.now()}`,
    platforms: ['twitter'],
    scheduled: false,
  };
}

/**
 * Predefined test users for different scenarios
 */
const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'AdminPassword123!',
    name: 'Admin User',
    role: 'admin',
  },
  regular: {
    email: 'user@test.com',
    password: 'UserPassword123!',
    name: 'Regular User',
    role: 'user',
  },
  premium: {
    email: 'premium@test.com',
    password: 'PremiumPassword123!',
    name: 'Premium User',
    role: 'user',
    subscription: 'premium',
  },
};

/**
 * Test content templates
 */
const contentTemplates = {
  shortPost: {
    title: 'Short Post',
    text: 'This is a short social media post.',
    type: 'post',
    platforms: ['twitter'],
  },
  longArticle: {
    title: 'Long Article',
    text: 'This is a longer article with multiple paragraphs. It contains more detailed information and is suitable for platforms like LinkedIn or blog posts.',
    type: 'article',
    platforms: ['linkedin'],
  },
  videoContent: {
    title: 'Video Content',
    text: 'This is content for a video post.',
    type: 'video',
    platforms: ['instagram', 'facebook'],
  },
};

module.exports = {
  generateTestUser,
  generateTestContent,
  generateTestVideoData,
  generateTestSocialPost,
  testUsers,
  contentTemplates,
};



