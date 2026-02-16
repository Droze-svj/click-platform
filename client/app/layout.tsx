import './globals.css'
import type { Metadata, Viewport } from 'next'

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
import { PreferencesProvider } from '../hooks/usePreferences'
import LangAttribute from '../components/LangAttribute'
import { ToastProvider } from '../contexts/ToastContext'
import PerformanceMonitor from '../components/PerformanceMonitor'
import Analytics from '../components/Analytics'
import AgentClientPing from '../components/AgentClientPing'
import RouteChangeLogger from '../components/RouteChangeLogger'
import ServerPingPixel from '../components/ServerPingPixel'
import DevDebugBanner from '../components/DevDebugBanner'
import TokenStorageProbe from '../components/TokenStorageProbe'
import NavigationProbe from '../components/NavigationProbe'
import StorageProbe from '../components/StorageProbe'
import SystemStatusProbe from '../components/SystemStatusProbe'
import InteractionProbe from '../components/InteractionProbe'
// import ErrorRecoverySystem, { RecoveryStatusDisplay } from '../components/ErrorRecoverySystem'
import DebugLayout from '../components/DebugLayout'
import ErrorDashboard from '../components/ErrorDashboard'
import PWAManager from '../components/PWAManager'
import PWAInstallPrompt from '../components/PWAInstallPrompt'
import PWAUpdateHandler from '../components/PWAUpdateHandler'
import '../utils/networkDebugger' // Initialize network debugging
import '../utils/analytics' // Initialize analytics
import '../utils/rum' // Initialize RUM monitoring

// Use CSS font (see globals.css) instead of next/font to avoid ETIMEDOUT on iCloud Drive
const fontClassName = 'font-app-sans'

// Avoid "Response body disturbed or locked" when reusing cached responses
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Click — AI‑Powered Content Creation',
  description: 'Create, repurpose, and publish content across 6 platforms. AI‑powered tools, smart scheduling, and analytics in one workspace.',
  keywords: ['content creation', 'social media', 'AI', 'marketing', 'automation', 'content management', 'Click'],
  manifest: '/manifest.json',
  // Removed deprecated apple-mobile-web-app-capable - using mobile-web-app-capable instead
  other: {
    'mobile-web-app-capable': 'yes',
  },
  // Temporarily remove og-image references to prevent 404s
  // openGraph: {
  //   type: 'website',
  //   title: 'Click - AI-Powered Content Creation',
  //   description: 'Transform long-form content into social-ready formats with AI-powered tools',
  //   siteName: 'Click',
  //   images: [
  //     {
  //       url: '/og-image.png',
  //       width: 1200,
  //       height: 630,
  //       alt: 'Click - AI-Powered Content Creation',
  //     },
  //   ],
  // },
  // twitter: {
  //   card: 'summary_large_image',
  //   title: 'Click - AI-Powered Content Creation',
  //   description: 'Transform long-form content into social-ready formats with AI-powered tools',
  //   images: ['/og-image.png'],
  // },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#667eea',
  viewportFit: 'cover', /* Enables safe-area-inset for notches/home indicator */
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={fontClassName}>
        <ErrorBoundary>
          <PreferencesProvider>
            <TranslationProvider>
              <LangAttribute />
              <ToastProvider>
                <Analytics />
                <PerformanceMonitor />
                <AgentClientPing />
                <DevDebugBanner />
                {/* Temporarily disable aggressive probes to resolve 500 errors */}
                {/* <ErrorRecoverySystem /> */}
                <TokenStorageProbe />
                {/* <NavigationProbe /> */}
                {/* <StorageProbe /> */}
                {/* <SystemStatusProbe /> */}
                <InteractionProbe />
                <PWARegistration />
                <RealtimeConnection />
                <OnboardingFlow />
                <OfflineIndicator />
                <PWAManager>
                  <DebugLayout>
                    {children}
                    {/* <RecoveryStatusDisplay /> */}
                  </DebugLayout>
                  <PWAInstallPrompt />
                  <PWAUpdateHandler />
                </PWAManager>
              </ToastProvider>
            </TranslationProvider>
          </PreferencesProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}

