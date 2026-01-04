/**
 * Click Service Worker
 * Advanced offline support, caching, and push notifications
 */

const CACHE_NAME = 'click-v1.0.0';
const STATIC_CACHE = 'click-static-v1.0.0';
const DYNAMIC_CACHE = 'click-dynamic-v1.0.0';
const API_CACHE = 'click-api-v1.0.0';

// Cache configuration
const CACHE_CONFIG = {
  // Static assets - Cache First strategy
  static: [
    '/',
    '/manifest.json',
    '/favicon.ico',
    '/robots.txt',
    '/offline.html',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/_next/static/css/',
    '/_next/static/js/',
    '/fonts/',
    '/images/',
  ],

  // API endpoints - Network First with cache fallback
  api: [
    '/api/health',
    '/api/user/profile',
    '/api/dashboard/stats',
    '/api/content/recent',
  ],

  // Content that needs to be fresh - Network First
  fresh: [
    '/api/notifications',
    '/api/analytics',
  ],

  // Images - Cache First with expiration
  images: [
    '/uploads/',
    '/api/uploads/',
    '/images/',
  ]
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📦 Caching static assets...');
        return cache.addAll([
          '/offline.html',
          '/manifest.json',
          '/favicon.ico',
          '/icons/icon-192x192.png',
          '/icons/icon-512x512.png',
        ].filter(url => !url.includes('/_next/'))); // Skip Next.js assets initially
      }),

      // Cache API responses
      caches.open(API_CACHE).then(cache => {
        console.log('📦 Caching API endpoints...');
        return cache.addAll(CACHE_CONFIG.api);
      }).catch(err => {
        console.warn('⚠️ API cache failed (normal for offline-first):', err.message);
      }),

      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );

  console.log('✅ Service Worker installed');
});

// Activate event - cleanup old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      cleanupOldCaches(),

      // Claim all clients
      self.clients.claim(),

      // Initialize background sync
      initializeBackgroundSync(),

      // Notify clients of activation
      notifyClients('sw-activated', { timestamp: Date.now() })
    ])
  );

  console.log('✅ Service Worker activated');
});

// Fetch event - implement different caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (except for navigation requests)
  if (request.method !== 'GET' && request.mode !== 'navigate') {
    return;
  }

  // Skip external requests (except for allowed domains)
  if (!url.origin.includes(self.location.origin) &&
      !url.origin.includes('fonts.googleapis.com') &&
      !url.origin.includes('fonts.gstatic.com')) {
    return;
  }

  // Choose caching strategy based on request type
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request));
  } else if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isImageRequest(url)) {
    event.respondWith(cacheFirstWithExpiration(request));
  } else if (isFreshContent(url)) {
    event.respondWith(networkFirstStrategy(request));
  } else {
    // Default: Stale While Revalidate for HTML pages
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = { title: 'Click Update', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || 'You have new content updates',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    image: data.image,
    data: {
      url: data.url || '/',
      action: data.action,
      contentId: data.contentId
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
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    tag: data.tag || 'content-update',
    renotify: data.renotify || true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Click', options)
      .then(() => {
        // Notify clients about the push
        return notifyClients('push-received', data);
      })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);

  event.notification.close();

  const { action, data } = event.notification;

  let url = '/';

  if (action === 'view' && data?.url) {
    url = data.url;
  } else if (data?.contentId) {
    url = `/content/${data.contentId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if there's already a window/tab open with the target URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }

        // If not, open a new window/tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);

  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  } else if (event.tag === 'analytics-sync') {
    event.waitUntil(syncAnalytics());
  } else if (event.tag === 'offline-actions') {
    event.waitUntil(processOfflineActions());
  }
});

// Message event - communicate with main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;

    case 'UPDATE_CACHE':
      event.waitUntil(updateCache(data.urls));
      break;

    case 'REGISTER_SYNC':
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        self.registration.sync.register(data.tag).catch(err => {
          console.warn('⚠️ Background sync not supported:', err.message);
        });
      }
      break;

    default:
      console.log('📨 Unknown message type:', type);
  }
});

// Periodically clean up expired cache entries
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cleanup-cache') {
    event.waitUntil(cleanupExpiredCache());
  }
});

// ====================
// CACHE STRATEGIES
// ====================

// Cache First Strategy - for static assets
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ Cache First strategy failed:', error.message);
    return new Response('Offline - Asset not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First Strategy - for dynamic content
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ Network request failed, trying cache:', error.message);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline fallback
    return getOfflineFallback(request);
  }
}

// Stale While Revalidate Strategy - for HTML pages
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(error => {
    console.warn('⚠️ Network request failed:', error.message);
    return cachedResponse || getOfflineFallback(request);
  });

  return cachedResponse || fetchPromise;
}

// Cache First with Expiration - for images
async function cacheFirstWithExpiration(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Check if cache is still fresh (24 hours)
    const cacheTime = new Date(cachedResponse.headers.get('sw-cache-time') || 0);
    const now = new Date();
    const age = now - cacheTime;

    if (age < 24 * 60 * 60 * 1000) { // 24 hours
      return cachedResponse;
    }
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      const headers = new Headers(responseClone.headers);
      headers.set('sw-cache-time', new Date().toISOString());

      const responseWithTimestamp = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers
      });

      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, responseWithTimestamp);
    }
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ Cache First with Expiration failed:', error.message);
    return cachedResponse || getOfflineFallback(request);
  }
}

// ====================
// UTILITY FUNCTIONS
// ====================

function isStaticAsset(url) {
  return CACHE_CONFIG.static.some(pattern =>
    url.pathname.includes(pattern) ||
    url.pathname.match(new RegExp(pattern.replace(/\*/g, '.*')))
  );
}

function isApiRequest(url) {
  return CACHE_CONFIG.api.some(pattern =>
    url.pathname.startsWith(pattern)
  );
}

function isImageRequest(url) {
  return CACHE_CONFIG.images.some(pattern =>
    url.pathname.startsWith(pattern) ||
    url.pathname.includes('.jpg') ||
    url.pathname.includes('.png') ||
    url.pathname.includes('.webp') ||
    url.pathname.includes('.svg')
  );
}

function isFreshContent(url) {
  return CACHE_CONFIG.fresh.some(pattern =>
    url.pathname.startsWith(pattern)
  );
}

// Enhanced offline detection
let isOffline = !navigator.onLine
let offlineStartTime = null
let connectionAttempts = 0

function updateOfflineStatus(offline) {
  const wasOffline = isOffline
  isOffline = offline

  if (offline && !wasOffline) {
    offlineStartTime = Date.now()
    console.log('📱 Device went offline')
    notifyClients('offline-status-changed', { offline: true, timestamp: offlineStartTime })
  } else if (!offline && wasOffline) {
    const offlineDuration = offlineStartTime ? Date.now() - offlineStartTime : 0
    console.log(`🌐 Device back online after ${Math.round(offlineDuration / 1000)}s`)
    notifyClients('offline-status-changed', {
      offline: false,
      timestamp: Date.now(),
      offlineDuration
    })
    offlineStartTime = null
    connectionAttempts = 0
  }
}

// Listen for online/offline events
self.addEventListener('online', () => updateOfflineStatus(false))
self.addEventListener('offline', () => updateOfflineStatus(true))

// Periodic connectivity check
setInterval(async () => {
  if (isOffline) {
    connectionAttempts++
    try {
      // Try to fetch a small resource to test connectivity
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache'
      })
      if (response.ok) {
        updateOfflineStatus(false)
      }
    } catch (error) {
      // Still offline, but log connection attempts
      if (connectionAttempts % 10 === 0) { // Log every 10 attempts (5 minutes)
        console.log(`📱 Still offline after ${connectionAttempts} connection attempts`)
      }
    }
  }
}, 30000) // Check every 30 seconds when offline

async function getOfflineFallback(request) {
  const url = new URL(request.url);

  // For HTML pages, return offline page
  if (request.headers.get('accept').includes('text/html')) {
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }
  }

  // For images, return a placeholder
  if (isImageRequest(url)) {
    return new Response('', {
      status: 404,
      statusText: 'Image not available offline'
    });
  }

  // For API requests, return cached data if available
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Default offline response
  return new Response(JSON.stringify({
    error: 'Offline',
    message: 'This content is not available offline',
    offline: true
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name =>
    name !== CACHE_NAME &&
    name !== STATIC_CACHE &&
    name !== DYNAMIC_CACHE &&
    name !== API_CACHE &&
    !name.startsWith('workbox-') // Keep Workbox caches if used
  );

  console.log('🧹 Cleaning up old caches:', oldCaches);

  return Promise.all(
    oldCaches.map(cacheName => caches.delete(cacheName))
  );
}

async function cleanupExpiredCache() {
  const cache = await caches.open(DYNAMIC_CACHE);
  const keys = await cache.keys();

  const expiredRequests = [];

  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const cacheTime = new Date(response.headers.get('sw-cache-time') || 0);
      const now = new Date();
      const age = now - cacheTime;

      // Remove items older than 7 days
      if (age > 7 * 24 * 60 * 60 * 1000) {
        expiredRequests.push(request);
      }
    }
  }

  console.log('🗑️ Removing expired cache entries:', expiredRequests.length);

  return Promise.all(
    expiredRequests.map(request => cache.delete(request))
  );
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  console.log('🧹 Clearing all caches:', cacheNames);

  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

async function updateCache(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  console.log('🔄 Updating cache for:', urls);

  return Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn('⚠️ Failed to cache:', url, error.message);
      }
    })
  );
}

async function initializeBackgroundSync() {
  // Register periodic sync for cache cleanup (if supported)
  if ('periodicSync' in self.registration) {
    try {
      await self.registration.periodicSync.register('cleanup-cache', {
        minInterval: 24 * 60 * 60 * 1000 // 24 hours
      });
      console.log('✅ Periodic cache cleanup registered');
    } catch (error) {
      console.warn('⚠️ Periodic sync not available:', error.message);
    }
  }
}

async function syncContent() {
  console.log('🔄 Syncing content...');

  try {
    // Fetch latest content from API
    const response = await fetch('/api/content/sync');
    if (response.ok) {
      const newContent = await response.json();

      // Update cache with new content
      const cache = await caches.open(API_CACHE);
      await cache.put('/api/content/recent', new Response(JSON.stringify(newContent)));

      // Notify clients
      await notifyClients('content-synced', { count: newContent.length });

      console.log('✅ Content synced:', newContent.length, 'items');
    }
  } catch (error) {
    console.warn('⚠️ Content sync failed:', error.message);
  }
}

async function syncAnalytics() {
  console.log('📊 Syncing analytics...');

  try {
    // Get stored analytics data
    const analyticsData = localStorage.getItem('offline-analytics');
    if (analyticsData) {
      const response = await fetch('/api/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: analyticsData
      });

      if (response.ok) {
        localStorage.removeItem('offline-analytics');
        console.log('✅ Analytics synced');
      }
    }
  } catch (error) {
    console.warn('⚠️ Analytics sync failed:', error.message);
  }
}

async function processOfflineActions() {
  console.log('⚡ Processing offline actions...');

  try {
    // Get stored offline actions
    const actions = JSON.parse(localStorage.getItem('offline-actions') || '[]');

    if (actions.length > 0) {
      for (const action of actions) {
        try {
          const response = await fetch(action.url, {
            method: action.method,
            headers: action.headers,
            body: JSON.stringify(action.data)
          });

          if (response.ok) {
            console.log('✅ Offline action processed:', action.type);
          }
        } catch (error) {
          console.warn('⚠️ Offline action failed:', action.type, error.message);
        }
      }

      // Clear processed actions
      localStorage.removeItem('offline-actions');
    }
  } catch (error) {
    console.warn('⚠️ Offline actions processing failed:', error.message);
  }
}

async function notifyClients(type, data) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type, data });
  });
}

// ====================
// PUSH NOTIFICATION HELPERS
// ====================

// Subscribe to push notifications
async function subscribeToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const response = await fetch('/api/push/vapid-key');
    const vapidKey = await response.json();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey.publicKey)
    });

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    console.log('✅ Push notifications subscribed');
    return subscription;
  } catch (error) {
    console.warn('⚠️ Push subscription failed:', error.message);
    return null;
  }
}

// Unsubscribe from push notifications
async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      console.log('✅ Push notifications unsubscribed');
    }
  } catch (error) {
    console.warn('⚠️ Push unsubscribe failed:', error.message);
  }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ====================
// DEBUGGING HELPERS
// ====================

// Log cache contents (for debugging)
async function logCacheContents() {
  const cacheNames = await caches.keys();
  console.log('📦 Cache Contents:');

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    console.log(`  ${cacheName}: ${requests.length} items`);
  }
}

// Make functions available globally for debugging
self.logCacheContents = logCacheContents;
self.clearAllCaches = clearAllCaches;
self.subscribeToPush = subscribeToPush;
self.unsubscribeFromPush = unsubscribeFromPush;

console.log('🚀 Click Service Worker loaded:', CACHE_NAME);