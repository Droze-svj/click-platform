'use client';

import React from 'react';
import { ToastProvider } from '../contexts/ToastContext';
import ToastContainer from './ToastContainer';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="click-app-container">
        {children}
      </div>
      <ToastContainer />
    </ToastProvider>
  );
}
