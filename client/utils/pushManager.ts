/**
 * Push Notification Manager
 * Handles push notification subscriptions and interactions
 */

interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface PushOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  url?: string
  action?: string
  data?: any
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
}

class PushNotificationManager {
  private vapidKey: string | null = null
  private subscription: PushSubscription | null = null
  private isSupported: boolean

  constructor() {
    this.isSupported = this.checkSupport()
    if (this.isSupported) {
      this.initialize()
    }
  }

  /**
   * Check if push notifications are supported
   */
  private checkSupport(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  /**
   * Initialize push notification manager
   */
  private async initialize() {
    try {
      // Get VAPID key from server
      await this.fetchVapidKey()

      // Check existing permission
      this.checkExistingPermission()

      console.log('✅ Push notification manager initialized')
    } catch (error) {
      console.warn('⚠️ Push notification initialization failed:', error.message)
    }
  }

  /**
   * Fetch VAPID public key from server
   */
  private async fetchVapidKey() {
    try {
      const response = await fetch('/api/push/vapid-key')
      if (response.ok) {
        const data = await response.json()
        this.vapidKey = data.publicKey
      }
    } catch (error) {
      console.warn('Failed to fetch VAPID key:', error.message)
    }
  }

  /**
   * Check existing permission and subscription
   */
  private async checkExistingPermission() {
    if (Notification.permission === 'granted') {
      await this.getExistingSubscription()
    }
  }

  /**
   * Request push notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      throw new Error('Push notifications not supported')
    }

    try {
      const permission = await Notification.requestPermission()

      if (permission === 'granted') {
        await this.subscribe()
        return true
      } else {
        console.warn('Push notification permission denied')
        return false
      }
    } catch (error) {
      console.error('Error requesting push permission:', error)
      return false
    }
  }

  /**
   * Subscribe to push notifications
   */
  private async subscribe() {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidKey!)
      })

      this.subscription = subscription

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription)

      console.log('✅ Push notifications subscribed')
      return subscription

    } catch (error) {
      console.error('❌ Push subscription failed:', error)
      throw error
    }
  }

  /**
   * Get existing subscription
   */
  private async getExistingSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        this.subscription = subscription
        console.log('✅ Existing push subscription found')
      }
    } catch (error) {
      console.warn('Failed to get existing subscription:', error.message)
    }
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription) {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
              auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
            }
          },
          userId: this.getUserId() // You'll need to implement this
        })
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`)
      }

      console.log('✅ Subscription sent to server')
    } catch (error) {
      console.error('❌ Failed to send subscription to server:', error)
      throw error
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    try {
      if (this.subscription) {
        await this.subscription.unsubscribe()
        this.subscription = null

        // Notify server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: this.subscription.endpoint,
            userId: this.getUserId()
          })
        })

        console.log('✅ Push notifications unsubscribed')
      }
    } catch (error) {
      console.error('❌ Push unsubscribe failed:', error)
      throw error
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<void> {
    try {
      const userId = this.getUserId()
      if (!userId) {
        throw new Error('User not authenticated')
      }

      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`)
      }

      console.log('✅ Test notification sent')
    } catch (error) {
      console.error('❌ Test notification failed:', error)
      throw error
    }
  }

  /**
   * Send notification to user (server-side)
   */
  async sendNotification(userId: string, options: PushOptions): Promise<void> {
    try {
      const response = await fetch(`/api/push/send/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options)
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`)
      }

      console.log('✅ Notification sent to user:', userId)
    } catch (error) {
      console.error('❌ Send notification failed:', error)
      throw error
    }
  }

  /**
   * Broadcast notification to all users
   */
  async broadcastNotification(options: PushOptions, userIds?: string[]): Promise<void> {
    try {
      const response = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...options,
          userIds
        })
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`)
      }

      console.log('✅ Notification broadcast sent')
    } catch (error) {
      console.error('❌ Broadcast notification failed:', error)
      throw error
    }
  }

  /**
   * Get push notification statistics
   */
  async getStats() {
    try {
      const response = await fetch('/api/push/stats')
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.warn('Failed to get push stats:', error.message)
    }
    return null
  }

  /**
   * Check if push notifications are supported and enabled
   */
  isEnabled(): boolean {
    return this.isSupported &&
           Notification.permission === 'granted' &&
           !!this.subscription
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): NotificationPermission {
    return Notification.permission
  }

  /**
   * Get user ID (implement based on your auth system)
   */
  private getUserId(): string | null {
    // This should be implemented based on your authentication system
    // For example:
    // return localStorage.getItem('userId') || null
    return 'current-user-id' // Placeholder
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }

  /**
   * Show local notification (fallback)
   */
  showLocalNotification(options: PushOptions) {
    if (Notification.permission === 'granted') {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/icons/icon-192x192.png',
        badge: options.badge,
        image: options.image,
        tag: options.tag,
        requireInteraction: options.requireInteraction,
        silent: options.silent,
        data: options.data
      })

      notification.onclick = () => {
        if (options.url) {
          window.focus()
          window.location.href = options.url
        }
        notification.close()
      }

      // Auto-close after 5 seconds unless interaction required
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 5000)
      }
    }
  }
}

// Create singleton instance
const pushManager = new PushNotificationManager()

// Global push functions for components
if (typeof window !== 'undefined') {
  (window as any).pushManager = {
    requestPermission: () => pushManager.requestPermission(),
    unsubscribe: () => pushManager.unsubscribe(),
    sendTestNotification: () => pushManager.sendTestNotification(),
    sendNotification: (userId: string, options: PushOptions) =>
      pushManager.sendNotification(userId, options),
    broadcastNotification: (options: PushOptions, userIds?: string[]) =>
      pushManager.broadcastNotification(options, userIds),
    getStats: () => pushManager.getStats(),
    isEnabled: () => pushManager.isEnabled(),
    getPermissionStatus: () => pushManager.getPermissionStatus(),
    showLocalNotification: (options: PushOptions) =>
      pushManager.showLocalNotification(options)
  }
}

export default pushManager


