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
import AgentClientPing from '../components/AgentClientPing'
import RouteChangeLogger from '../components/RouteChangeLogger'
import ServerPingPixel from '../components/ServerPingPixel'
import DevDebugBanner from '../components/DevDebugBanner'
import TokenStorageProbe from '../components/TokenStorageProbe'
import NavigationProbe from '../components/NavigationProbe'
import InteractionProbe from '../components/InteractionProbe'
import DebugLayout from '../components/DebugLayout'
import ErrorDashboard from '../components/ErrorDashboard'
import PWAManager from '../components/PWAManager'
import PWAInstallPrompt from '../components/PWAInstallPrompt'
import PWAUpdateHandler from '../components/PWAUpdateHandler'
import '../utils/networkDebugger' // Initialize network debugging
import '../utils/analytics' // Initialize analytics
import '../utils/rum' // Initialize RUM monitoring

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Click - AI-Powered Content Creation',
  description: 'Transform long-form content into social-ready formats with AI-powered tools',
  keywords: ['content creation', 'social media', 'AI', 'marketing', 'automation', 'content management'],
  manifest: '/manifest.json',
  themeColor: '#667eea',
  // Removed deprecated apple-mobile-web-app-capable - using mobile-web-app-capable instead
  other: {
    'mobile-web-app-capable': 'yes',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
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
              {/* Temporarily disable complex components that might make API calls */}
              {/* <Analytics /> */}
              {/* <PerformanceMonitor /> */}
              {/* <ServerPingPixel /> */}
              {/* <AgentClientPing /> */}
              {/* <RouteChangeLogger /> */}
              {/* <DevDebugBanner /> */}
              {/* <TokenStorageProbe /> */}
              {/* <NavigationProbe /> */}
              {/* <InteractionProbe /> */}
              {/* <PWARegistration /> */}
              {/* <RealtimeConnection /> */}
              {/* <OnboardingFlow /> */}
              {/* <AccessibilityFeatures /> */}
              {/* <OfflineIndicator /> */}
              {/* <KeyboardShortcutsHelper /> */}
              {/* <MobileTouchEnhancements /> */}
              <PWAManager>
                <DebugLayout>
                  {children}
                </DebugLayout>
                {/* <ErrorDashboard /> */}
                {/* <PWAInstallPrompt /> */}
                {/* <PWAUpdateHandler /> */}
              </PWAManager>
            </ToastProvider>
          </TranslationProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}

