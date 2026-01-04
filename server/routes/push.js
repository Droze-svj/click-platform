/**
 * Push Notifications API Routes
 * Handles push notification subscriptions and sending
 */

const express = require('express')
const webpush = require('web-push')
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
    console.log('✅ Web push notifications configured')
  } catch (error) {
    console.warn('⚠️ Web push notifications disabled:', error.message)
  }
} else {
  console.warn('⚠️ VAPID keys not configured. Web push notifications disabled.')
}

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
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, userId } = req.body

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' })
    }

    // Store subscription (use userId as key, or generate unique ID)
    const subscriptionId = userId || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    pushSubscriptions.set(subscriptionId, {
      subscription,
      userId,
      createdAt: new Date(),
      lastUsed: new Date()
    })

    console.log(`✅ Push subscription saved for user: ${userId || 'anonymous'}`)

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
    } catch (error) {
      console.warn('⚠️ Welcome notification failed:', error.message)
    }

    res.json({
      success: true,
      subscriptionId,
      message: 'Successfully subscribed to push notifications'
    })

  } catch (error) {
    console.error('❌ Push subscription failed:', error)
    res.status(500).json({ error: 'Failed to subscribe to push notifications' })
  }
})

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req, res) => {
  try {
    const { subscription, userId } = req.body

    // Find and remove subscription
    let removed = false
    for (const [id, subData] of pushSubscriptions.entries()) {
      if (subData.userId === userId ||
          (subscription && subData.subscription.endpoint === subscription.endpoint)) {
        pushSubscriptions.delete(id)
        removed = true
        console.log(`✅ Push subscription removed for user: ${userId || 'anonymous'}`)
        break
      }
    }

    res.json({
      success: true,
      removed,
      message: 'Successfully unsubscribed from push notifications'
    })

  } catch (error) {
    console.error('❌ Push unsubscribe failed:', error)
    res.status(500).json({ error: 'Failed to unsubscribe from push notifications' })
  }
})

// Send notification to specific user
router.post('/send/:userId', async (req, res) => {
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
    console.error('❌ Send push notification failed:', error)
    res.status(500).json({ error: 'Failed to send push notification' })
  }
})

// Send notification to all subscribers
router.post('/broadcast', async (req, res) => {
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
        console.warn('⚠️ Failed to send to subscription:', error.message)
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
    console.error('❌ Broadcast failed:', error)
    res.status(500).json({ error: 'Failed to send broadcast notification' })
  }
})

// Get subscription statistics
router.get('/stats', (req, res) => {
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

// Test push notification
router.post('/test', async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    // Send test notification
    const testResult = await sendTestNotification(userId)

    res.json({
      success: true,
      message: 'Test notification sent',
      result: testResult
    })

  } catch (error) {
    console.error('❌ Test notification failed:', error)
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
setInterval(() => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
  let cleaned = 0

  for (const [id, subData] of pushSubscriptions.entries()) {
    if (new Date(subData.lastUsed) < cutoff) {
      pushSubscriptions.delete(id)
      cleaned++
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old push subscriptions`)
  }
}, 24 * 60 * 60 * 1000) // Daily cleanup

module.exports = router
