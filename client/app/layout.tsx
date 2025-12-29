import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import ErrorBoundary from '../components/ErrorBoundary'
import OfflineIndicator from '../components/OfflineIndicator'
import AccessibilityFeatures from '../components/AccessibilityFeatures'
import KeyboardShortcuts from '../components/KeyboardShortcuts'
import KeyboardShortcutsHelper from '../components/KeyboardShortcutsHelper'
import MobileTouchEnhancements from '../components/MobileTouchEnhancements'
import PWARegistration from '../components/PWARegistration'
import RealtimeConnection from '../components/RealtimeConnection'
import OnboardingFlow from '../components/OnboardingFlow'
import { TranslationProvider } from '../hooks/useTranslation'
import { ToastProvider } from '../contexts/ToastContext'
import PerformanceMonitor from '../components/PerformanceMonitor'
import Analytics from '../components/Analytics'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Click - AI-Powered Content Creation',
  description: 'Transform long-form content into social-ready formats with AI-powered tools',
  keywords: ['content creation', 'social media', 'AI', 'marketing', 'automation', 'content management'],
  manifest: '/manifest.json',
  themeColor: '#667eea',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Click',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  openGraph: {
    type: 'website',
    title: 'Click - AI-Powered Content Creation',
    description: 'Transform long-form content into social-ready formats with AI-powered tools',
    siteName: 'Click',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Click - AI-Powered Content Creation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Click - AI-Powered Content Creation',
    description: 'Transform long-form content into social-ready formats with AI-powered tools',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <TranslationProvider>
            <ToastProvider>
            <Analytics />
            <PerformanceMonitor />
            <PWARegistration />
            <RealtimeConnection />
            <OnboardingFlow />
            <AccessibilityFeatures />
            <OfflineIndicator />
            <KeyboardShortcuts />
            <KeyboardShortcutsHelper />
            <MobileTouchEnhancements />
            {children}
            </ToastProvider>
          </TranslationProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}

