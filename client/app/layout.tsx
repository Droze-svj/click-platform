"use client";

import "../styles/layout-autofit.css";
import React from 'react';
import { Inter } from 'next/font/google';
import { ToastProvider } from '../contexts/ToastContext';
import ToastContainer from '../components/ToastContainer';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <div className="click-app-container">
            {children}
          </div>
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  );
}
