# Click API JavaScript SDK

Official JavaScript/TypeScript SDK for the Click API.

## Installation

```bash
npm install @click/api-client
```

## Usage

### Basic Setup

```javascript
import ClickClient from '@click/api-client';

const client = new ClickClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.click.com',
  version: 'v1', // or 'v2'
});
```

### Authentication

```javascript
// Register
await client.register('user@example.com', 'password123', 'User Name');

// Login
const response = await client.login('user@example.com', 'password123');
// Token is automatically stored

// Get current user
const user = await client.getCurrentUser();
```

### Content Management

```javascript
// Get all content
const content = await client.getContent();

// Get specific content
const item = await client.getContent('content-id');

// Create content
const newContent = await client.createContent({
  title: 'My Content',
  type: 'article',
  text: 'Content text here...',
  platforms: ['twitter', 'linkedin'],
});

// Update content
await client.updateContent('content-id', {
  title: 'Updated Title',
});

// Delete content
await client.deleteContent('content-id');
```

### Video Upload

```javascript
const file = document.querySelector('input[type="file"]').files[0];

const video = await client.uploadVideo(file, {
  title: 'My Video',
  description: 'Video description',
});
```

### Search

```javascript
const results = await client.search('query', {
  type: 'video',
  limit: 20,
});
```

### Social Media

```javascript
// Connect social account
await client.connectSocial('twitter');

// Post to social media
await client.postToSocial('content-id', 'twitter');
```

### Analytics

```javascript
const analytics = await client.getAnalytics({
  period: 30, // days
  type: 'content',
});
```

## Error Handling

```javascript
try {
  const content = await client.getContent('invalid-id');
} catch (error) {
  console.error('Error:', error.message);
}
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { ClickClient, Content, User } from '@click/api-client';

const client = new ClickClient({
  apiKey: 'your-key',
});

const content: Content = await client.getContent('id');
```

## API Versioning

The SDK supports API versioning:

```javascript
const client = new ClickClient({
  apiKey: 'your-key',
  version: 'v2', // Use v2 API
});
```

## License

MIT






