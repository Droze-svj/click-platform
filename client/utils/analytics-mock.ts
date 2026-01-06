// Mock analytics functions to fix build issues
// These are placeholder implementations for development

export function trackPageView(path?: string, title?: string) {
  if (process.env.NODE_ENV === 'development') {
    console.log('Page view tracked:', path, title)
  }
}

export function trackPWAEvent(event: string, data?: Record<string, any>) {
  if (process.env.NODE_ENV === 'development') {
    console.log('PWA event tracked:', event, data)
  }
}
