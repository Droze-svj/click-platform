/**
 * Push Notifications API Routes
 * Handles push notification subscriptions and sending
 */

const express = require('express')
const webpush = require('web-push')
const auth = require('../middleware/auth')
const { requireAdmin } = require('../middleware/admin')
const { assertPublicUrl } = require('../utils/urlGuard')
const router = express.Router()

// VAPID keys for push notifications (generate these for production)
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
}

// Configure web-push only if keys are available
if (vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    webpush.setVapidDetails(
      'mailto:' + (process.env.VAPID_EMAIL || 'notifications@click.com'),
      vapidKeys.publicKey,
      vapidKeys.privateKey
    )
    
  } catch (error) { /* intentionally empty */ }
} else { /* intentionally empty */ }

// In-memory storage for subscriptions (use database in production)
let pushSubscriptions = new Map()

// Get VAPID public key
router.get('/vapid-key', (req, res) => {
  res.json({
    publicKey: vapidKeys.publicKey,
    email: process.env.VAPID_EMAIL || 'notifications@click.com'
  })
})

// Subscribe to push notifications
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body
    // SECURITY: the owner is the authenticated user — NEVER a body-supplied userId
    // (which previously let anyone hijack/overwrite another user's subscription).
    const userId = String(req.user._id || req.user.id)

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' })
    }

    // SSRF guard: the endpoint is a client-supplied URL that the server (and the
    // web-push library) will POST to now and on every future /send + /broadcast.
    // Reject non-public targets (loopback/private/link-local, non-http(s)) before
    // it is ever stored or dispatched, so it can't be aimed at internal services.
    try {
      await assertPublicUrl(subscription.endpoint)
    } catch (err) {
      return res.status(400).json({ error: 'Invalid subscription endpoint' })
    }

    // Key the subscription by the authenticated owner.
    const subscriptionId = userId
    pushSubscriptions.set(subscriptionId, {
      subscription,
      userId,
      createdAt: new Date(),
      lastUsed: new Date()
    })

    

    // Send welcome notification
    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: 'Welcome to Click!',
        body: 'You\'ll now receive notifications about your content updates.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: 'welcome',
        requireInteraction: false
      }))
    } catch (error) { /* intentionally empty */ }

    res.json({
      success: true,
      subscriptionId,
      message: 'Successfully subscribed to push notifications'
    })

  } catch (error) {
    
    res.status(500).json({ error: 'Failed to subscribe to push notifications' })
  }
})

// Unsubscribe from push notifications
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body
    const userId = String(req.user._id || req.user.id)

    // Find and remove subscription — only the caller's own (match by their userId,
    // or by an endpoint that actually belongs to them).
    let removed = false
    for (const [id, subData] of pushSubscriptions.entries()) {
      if (subData.userId === userId &&
          (!subscription || !subscription.endpoint || subData.subscription.endpoint === subscription.endpoint)) {
        pushSubscriptions.delete(id)
        removed = true
        break
      }
    }

    res.json({
      success: true,
      removed,
      message: 'Successfully unsubscribed from push notifications'
    })

  } catch (error) {
    
    res.status(500).json({ error: 'Failed to unsubscribe from push notifications' })
  }
})

// Send notification to specific user — admin only (arbitrary push to any user is
// a phishing/spoofing vector; was previously fully unauthenticated).
router.post('/send/:userId', auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params
    const { title, body, icon, badge, image, url, action, data, tag, requireInteraction, silent } = req.body

    // Find user's subscription
    let userSubscription = null
    for (const [id, subData] of pushSubscriptions.entries()) {
      if (subData.userId === userId) {
        userSubscription = subData.subscription
        break
      }
    }

    if (!userSubscription) {
      return res.status(404).json({ error: 'User not subscribed to push notifications' })
    }

    // Send notification
    const payload = JSON.stringify({
      title: title || 'Click Update',
      body: body || 'You have new updates',
      icon: icon || '/icons/icon-192x192.png',
      badge: badge || '/icons/icon-192x192.png',
      image,
      data: {
        url: url || '/',
        action,
        contentId: data?.contentId,
        ...data
      },
      actions: [
        {
          action: 'view',
          title: 'View',
          icon: '/icons/view-icon.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: requireInteraction || false,
      silent: silent || false,
      tag: tag || 'content-update',
      timestamp: Date.now()
    })

    await webpush.sendNotification(userSubscription, payload)

    // Update last used timestamp
    for (const [id, subData] of pushSubscriptions.entries()) {
      if (subData.userId === userId) {
        subData.lastUsed = new Date()
        break
      }
    }

    res.json({
      success: true,
      message: 'Push notification sent successfully'
    })

  } catch (error) {
    
    res.status(500).json({ error: 'Failed to send push notification' })
  }
})

// Send notification to all subscribers — admin only (was unauthenticated spam).
router.post('/broadcast', auth, requireAdmin, async (req, res) => {
  try {
    const { title, body, icon, badge, image, url, action, data, tag, requireInteraction, silent, userIds } = req.body

    const payload = JSON.stringify({
      title: title || 'Click Broadcast',
      body: body || 'Important update available',
      icon: icon || '/icons/icon-192x192.png',
      badge: badge || '/icons/icon-192x192.png',
      image,
      data: {
        url: url || '/',
        action,
        ...data
      },
      actions: [
        {
          action: 'view',
          title: 'View',
          icon: '/icons/view-icon.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: requireInteraction || true,
      silent: silent || false,
      tag: tag || 'broadcast',
      timestamp: Date.now()
    })

    let sent = 0
    let failed = 0

    // Send to specified users or all users
    const targetSubscriptions = userIds
      ? Array.from(pushSubscriptions.entries()).filter(([id, sub]) =>
        userIds.includes(sub.userId))
      : Array.from(pushSubscriptions.values())

    for (const subData of targetSubscriptions) {
      try {
        await webpush.sendNotification(subData.subscription, payload)
        sent++
        subData.lastUsed = new Date()
      } catch (error) {
        
        failed++

        // Remove invalid subscriptions
        if (error.statusCode === 410) {
          for (const [id, sub] of pushSubscriptions.entries()) {
            if (sub.subscription.endpoint === subData.subscription.endpoint) {
              pushSubscriptions.delete(id)
              break
            }
          }
        }
      }
    }

    res.json({
      success: true,
      sent,
      failed,
      total: sent + failed,
      message: `Broadcast sent to ${sent} subscribers`
    })

  } catch (error) {
    
    res.status(500).json({ error: 'Failed to send broadcast notification' })
  }
})

// Get subscription statistics — admin only (leaks all subscriber ids/endpoints).
router.get('/stats', auth, requireAdmin, (req, res) => {
  const stats = {
    totalSubscriptions: pushSubscriptions.size,
    activeToday: Array.from(pushSubscriptions.values()).filter(sub =>
      new Date(sub.lastUsed).toDateString() === new Date().toDateString()
    ).length,
    activeThisWeek: Array.from(pushSubscriptions.values()).filter(sub =>
      new Date(sub.lastUsed) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length,
    subscriptions: Array.from(pushSubscriptions.entries()).map(([id, sub]) => ({
      id,
      userId: sub.userId,
      createdAt: sub.createdAt,
      lastUsed: sub.lastUsed,
      endpoint: sub.subscription.endpoint.substring(0, 50) + '...'
    }))
  }

  res.json(stats)
})

// Test push notification — sends only to the authenticated caller's own device.
router.post('/test', auth, async (req, res) => {
  try {
    const userId = String(req.user._id || req.user.id)

    // Send test notification
    const testResult = await sendTestNotification(userId)

    res.json({
      success: true,
      message: 'Test notification sent',
      result: testResult
    })

  } catch (error) {
    
    res.status(500).json({ error: 'Failed to send test notification' })
  }
})

// Helper function to send test notification
async function sendTestNotification(userId) {
  let userSubscription = null
  for (const [id, subData] of pushSubscriptions.entries()) {
    if (subData.userId === userId) {
      userSubscription = subData.subscription
      break
    }
  }

  if (!userSubscription) {
    throw new Error('User not subscribed to push notifications')
  }

  const payload = JSON.stringify({
    title: '🧪 Test Notification',
    body: 'This is a test push notification from Click!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'test',
    requireInteraction: false,
    data: {
      url: '/dashboard',
      action: 'test'
    }
  })

  await webpush.sendNotification(userSubscription, payload)
  return { sent: true, timestamp: new Date() }
}

// Clean up old/invalid subscriptions periodically
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
    let cleaned = 0

    for (const [id, subData] of pushSubscriptions.entries()) {
      if (new Date(subData.lastUsed) < cutoff) {
        pushSubscriptions.delete(id)
        cleaned++
      }
    }

    if (cleaned > 0) { /* intentionally empty */ }
  }, 24 * 60 * 60 * 1000) // Daily cleanup
}

module.exports = router
