"use client";

import "../styles/layout-autofit.css";
import "./globals.css";
import "./export-fonts.css";
import React from 'react';
// Fonts are bundled (app/fonts, SIL OFL — see app/fonts/OFL.txt) rather than
// fetched from Google at build time: next/font/google broke the Render build
// (2026-11-13) when Google's CSS gave the builder a URL its loader couldn't
// parse, and a deploy shouldn't depend on a third party answering.
import localFont from 'next/font/local';
import { ToastProvider } from '../contexts/ToastContext';
import { WorkflowProvider } from '../contexts/WorkflowContext';
import { PreferencesProvider } from '../hooks/usePreferences';
import { TranslationProvider } from '../hooks/useTranslation';
import { ThemeProvider } from '../components/ThemeProvider';
import ToastContainer from '../components/ToastContainer';
import { CookieConsent } from '../components/CookieConsent';
import LocaleSync from '../components/LocaleSync';
import PerformanceMonitor from '../components/PerformanceMonitor';
import MotionProvider from '../components/MotionProvider';

// Body default
const inter = localFont({
  src: './fonts/Inter-normal-100-900.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-inter',
});

// Caption fonts — exposed as CSS variables so `var(--font-…)` works inside
// inline style strings (e.g. in TextMotionStudioView and any caption renderer).
const playfair = localFont({
  src: [
    { path: './fonts/PlayfairDisplay-normal-400-900.woff2', weight: '400 900', style: 'normal' },
    { path: './fonts/PlayfairDisplay-italic-400-900.woff2', weight: '400 900', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-playfair',
});
const caveat = localFont({
  src: './fonts/Caveat-normal-400-700.woff2',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  variable: '--font-caveat',
});
const jetbrains = localFont({
  src: './fonts/JetBrainsMono-normal-400-700.woff2',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  variable: '--font-jetbrains',
});
const vt323 = localFont({
  src: './fonts/VT323-normal-400.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-vt323',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const fontVars = `${inter.variable} ${playfair.variable} ${caveat.variable} ${jetbrains.variable} ${vt323.variable}`;
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <title>Click — AI video editor + multi-platform scheduler for creators</title>
        <meta
          name="description"
          content="Turn one raw clip into a week of niche-tuned posts. Click edits, captions, and schedules to TikTok, Reels, Shorts, X, and LinkedIn — and learns from every post you ship."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* Preconnect to Google Fonts CDN — next/font already preloads
            individual files, but the early TLS handshake helps first paint. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />

        <meta property="og:title" content="Click — AI video editor + multi-platform scheduler" />
        <meta
          property="og:description"
          content="One clip in. A week of niche-tuned posts out. Click edits, captions, and publishes to every platform — and learns from each post you ship."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/opengraph-image" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Click — AI video editor + multi-platform scheduler" />
        <meta
          name="twitter:description"
          content="One clip in. A week of niche-tuned posts out. Click edits, captions, and publishes to every platform — and learns from each post you ship."
        />
        <meta name="twitter:image" content="/opengraph-image" />

        <link rel="icon" href="/favicon.ico" />
        
        {/* Anti-Flash Theme Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('click-theme') || 'dark';
                  var resolved = theme;
                  if (theme === 'system') {
                    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.classList.add(resolved);
                  document.documentElement.setAttribute('data-theme', resolved);
                  document.documentElement.style.colorScheme = resolved;
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-noise-grain`}>
        <MotionProvider>
        <ThemeProvider>
          <PreferencesProvider>
            <TranslationProvider>
              <ToastProvider>
                <WorkflowProvider>
                  <LocaleSync />
                  <div className="click-app-container">
                    {children}
                  </div>
                  <ToastContainer />
                  {/* Cookie consent banner. Renders client-side only; shows
                      once per browser, persists choice to localStorage,
                      and dispatches a window event for any analytics
                      loader to subscribe to. GDPR/ePrivacy-aware: no
                      cookie wall, no pre-ticked options. */}
                  <CookieConsent />
                  {/* Core Web Vitals + runtime health. Built long ago but never
                      mounted, so the app had no performance telemetry at all.
                      Renders nothing and stays inert outside production unless
                      NEXT_PUBLIC_ANALYTICS_ENDPOINT is set. */}
                  <PerformanceMonitor />
                </WorkflowProvider>
              </ToastProvider>
            </TranslationProvider>
          </PreferencesProvider>
        </ThemeProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
