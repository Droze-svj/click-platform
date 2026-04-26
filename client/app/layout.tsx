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
