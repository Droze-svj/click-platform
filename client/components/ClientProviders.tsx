'use client';

import React from 'react';
import { ToastProvider } from '../contexts/ToastContext';
import { WorkflowProvider } from '../contexts/WorkflowContext';
import { PreferencesProvider } from '../hooks/usePreferences';
import { TranslationProvider } from '../hooks/useTranslation';
import ThemeProvider from '../components/ThemeProvider';
import LayoutPreferencesProvider from '../contexts/LayoutPreferencesContext';
import LocaleSync from '../components/LocaleSync';
import ToastContainer from '../components/ToastContainer';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LayoutPreferencesProvider>
      <PreferencesProvider>
        <TranslationProvider>
          <ThemeProvider>
            <ToastProvider>
              <WorkflowProvider>
                <LocaleSync />
                <div className="click-app-container">
                  {children}
                </div>
                <ToastContainer />
              </WorkflowProvider>
            </ToastProvider>
          </ThemeProvider>
        </TranslationProvider>
      </PreferencesProvider>
    </LayoutPreferencesProvider>
  );
}
