'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Server, ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import InfrastructureDashboard from '../../../components/InfrastructureDashboard';
import ToastContainer from '../../../components/ToastContainer';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';

export const dynamic = 'force-dynamic';

export default function InfrastructurePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const checkAdmin = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;

        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        const userData = data.user || data.data?.user;
        const isAdm = userData?.role === 'admin' || userData?.isAdmin === true;
        setIsAdmin(isAdm);
      } catch (error) {
        console.error('Failed to check admin status', error);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user, router]);

  if (loading) return (
    <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center py-48" aria-busy="true">
      <Server size={40} className="text-theme-muted animate-pulse mb-4" aria-hidden />
      <span className="ds-text-caption">{t('infrastructurePage.loading')}</span>
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="ds-bg-mesh-soft min-h-screen flex items-center justify-center p-6">
        <div className="ds-surface-card p-8 max-w-lg w-full">
          <EmptyState
            icon={ShieldAlert}
            title={t('infrastructurePage.accessDeniedTitle')}
            description={t('infrastructurePage.accessDeniedBody')}
            action={
              <Button variant="primary" leftIcon={<ArrowLeft size={16} aria-hidden />} onClick={() => router.push('/dashboard')}>
                {t('infrastructurePage.returnToBase')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto text-theme-primary">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Server size={20} aria-hidden />
              </span>
              {t('infrastructurePage.title')}
            </span>
          }
          description={t('infrastructurePage.subtitle')}
          className="mb-6"
          actions={
            <Button
              variant="secondary"
              size="md"
              onClick={() => window.location.reload()}
              title={t('infrastructurePage.refreshTelemetry')}
              aria-label={t('infrastructurePage.refreshTelemetry')}
              leftIcon={<RefreshCw size={16} aria-hidden />}
            >
              {t('infrastructurePage.refreshTelemetry')}
            </Button>
          }
        />

        <div className="ds-surface-card p-4 sm:p-6">
          <InfrastructureDashboard />
        </div>
      </div>
    </ErrorBoundary>
  );
}
