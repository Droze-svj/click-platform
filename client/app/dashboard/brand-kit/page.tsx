'use client';

import React from 'react';
import BrandKit from '../../../components/BrandKit';
import { Palette, ShieldCheck, RefreshCw } from 'lucide-react';
import ToastContainer from '../../../components/ToastContainer';
import { useTranslation } from '../../../hooks/useTranslation';
import { Panel, SectionHeader, Badge } from '../../../components/ui';

export default function BrandKitPage() {
  const { t } = useTranslation();

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
      <ToastContainer />

      {/* Header (global DashboardHeader provides the breadcrumb) */}
      <SectionHeader
        as="h1"
        title={t('brandKitPage.title')}
        description={t('brandKitPage.identityCoreDesc')}
        className="mb-6"
        actions={
          <Badge className="bg-primary/10 text-primary gap-1.5">
            <Palette size={14} aria-hidden />
            {t('brandKitPage.multiProfileReady')}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Panel variant="glass">
            <h2 className="ds-text-h3 text-theme-primary mb-2">{t('brandKitPage.identityCore')}</h2>
            <p className="ds-text-body text-theme-muted mb-6">{t('brandKitPage.identityCoreDesc')}</p>
            <div className="space-y-3 pt-6 border-t border-[var(--border-subtle)]">
              <div className="ds-surface-subtle flex items-center gap-3 p-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <ShieldCheck size={20} aria-hidden />
                </span>
                <span className="ds-text-label text-theme-secondary">{t('brandKitPage.featureEncryption')}</span>
              </div>
              <div className="ds-surface-subtle flex items-center gap-3 p-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <RefreshCw size={20} aria-hidden />
                </span>
                <span className="ds-text-label text-theme-secondary">{t('brandKitPage.featureSync')}</span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-8">
          <Panel variant="glass" className="ds-anim-rise">
            <BrandKit
              onApply={(kit) => {
                console.log('Brand applied globally:', kit.primaryColor);
              }}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
