"use client";

import "../styles/layout-autofit.css";
import "./globals.css";
import React from 'react';
import { Inter, Playfair_Display, Caveat, JetBrains_Mono, VT323 } from 'next/font/google';
import { ToastProvider } from '../contexts/ToastContext';
import { WorkflowProvider } from '../contexts/WorkflowContext';
import { PreferencesProvider } from '../hooks/usePreferences';
import { TranslationProvider } from '../hooks/useTranslation';
import ToastContainer from '../components/ToastContainer';
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
    <html lang="en" className={fontVars}>
      <head>
        <title>Click — Content Intelligence for High-Velocity Creators</title>
        <meta
          name="description"
          content="Click is the premium command center for high-velocity creators. Niche-aware AI auto-edits, predicts retention, and lands every clip on every platform — automatically."
        />
        <meta name="theme-color" content="#050505" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        <meta property="og:title" content="Click — Content Intelligence" />
        <meta
          property="og:description"
          content="Niche-aware AI auto-edits, retention forecasts, and omni-channel publishing for high-velocity creators."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/opengraph-image" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Click — Content Intelligence" />
        <meta
          name="twitter:description"
          content="Niche-aware AI auto-edits, retention forecasts, and omni-channel publishing for high-velocity creators."
        />
        <meta name="twitter:image" content="/opengraph-image" />

        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={inter.className}>
        <PreferencesProvider>
          <TranslationProvider>
            <ToastProvider>
              <WorkflowProvider>
                <LocaleSync />
                <div className="click-app-container">
                  {children}
                </div>
                <ToastContainer />
              </WorkflowProvider>
            </ToastProvider>
          </TranslationProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
