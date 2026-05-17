"use client";

import "../styles/layout-autofit.css";
import "./globals.css";
import React from 'react';
import { Inter, Playfair_Display, Caveat, JetBrains_Mono, VT323 } from 'next/font/google';
import { ToastProvider } from '../contexts/ToastContext';
import { WorkflowProvider } from '../contexts/WorkflowContext';
import { PreferencesProvider } from '../hooks/usePreferences';
import { TranslationProvider } from '../hooks/useTranslation';
import { ThemeProvider } from '../components/ThemeProvider';
import ToastContainer from '../components/ToastContainer';
import { CookieConsent } from '../components/CookieConsent';
import LocaleSync from '../components/LocaleSync';

// Body default
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Caption fonts — exposed as CSS variables so `var(--font-…)` works inside
// inline style strings (e.g. in TextMotionStudioView and any caption renderer).
const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
});
const caveat = Caveat({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-caveat',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
});
const vt323 = VT323({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400'],
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
                </WorkflowProvider>
              </ToastProvider>
            </TranslationProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
