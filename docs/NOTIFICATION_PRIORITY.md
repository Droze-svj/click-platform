# Notification priority

User notification preferences (Settings → Notifications → **Show notifications for**) filter the list by priority. When creating persisted notifications (`Notification.create`), set `priority` so "High priority only" / "High + medium" work as intended.

## Priority levels

| Priority | Use for | Examples |
|----------|---------|----------|
| **high** | Billing, security, critical alerts | Subscription expired, subscription expiring soon, payment failed, security alert |
| **medium** | Content and workflow updates (default) | Content ready, approval requested, mention, comment |
| **low** | Digests, tips, non-urgent | Weekly digest, product tips |

## Example

```javascript
const Notification = require('../models/Notification');

await Notification.create({
  userId: user._id,
  type: 'warning',
  priority: 'high',  // or 'medium' (default) or 'low'
  title: 'Subscription Expiring Soon',
  message: 'Your subscription expires in 3 days. Renew now to keep access.',
  data: { daysUntilExpiry: 3 }
});
```

If `priority` is omitted, the model default is `'medium'`. Existing documents without `priority` are treated as medium when the user has "High + medium" selected.

## Where it’s used

- **subscriptionService.js** – Subscription expired and expiring-soon notifications use `priority: 'high'`.
- **GET /api/notifications** and **GET /api/notifications/unread-count** apply the user’s priority tier from UserSettings.
