# Recommended Database Indexes

Use these to optimize common queries. Apply via Mongoose schema `index: true` or `schema.index()` or MongoDB shell.

## Content

- `userId` (already common)
- `userId + status`
- `userId + type`
- `userId + createdAt` (for recent/feed)
- `workspaceId + status`
- `tags` (multikey for array search)
- `title` (text index if you search by title)

## Video / Content with originalFile

- `userId + 'originalFile.url'` (if you look up by URL)
- `status + createdAt` (for processing queues)

## SocialConnection

- `userId + platform` (unique per user per platform)
- `userId + isActive`

## ScheduledPost

- `userId + platform + scheduledAt`
- `status + scheduledAt` (for cron)
- `contentId` (if you look up by content)

## Job / Queue documents (if stored in MongoDB)

- `status + createdAt`
- `userId + status`

## Applying in Mongoose

In the schema:

```js
contentSchema.index({ userId: 1, status: 1 });
contentSchema.index({ userId: 1, createdAt: -1 });
contentSchema.index({ workspaceId: 1, status: 1 });
```

Or in a migration script:

```js
const conn = await mongoose.createConnection(MONGODB_URI);
await conn.db.collection('contents').createIndex({ userId: 1, status: 1 });
await conn.db.collection('contents').createIndex({ userId: 1, createdAt: -1 });
```

Run after deployment or via a one-off script. Check slow query logs to add more indexes as needed.
