'use client';

import React from 'react';
import BrandKit from '../../../components/BrandKit';
import { Type, Clapperboard, HardDrive } from 'lucide-react';
import ToastContainer from '../../../components/ToastContainer';
import { useTranslation } from '../../../hooks/useTranslation';
import { Panel, SectionHeader, PageShell } from '../../../components/ui';

export default function BrandKitPage() {
  const { t } = useTranslation();

  return (
    <PageShell width="wide" className="ds-bg-mesh-soft min-h-screen overflow-x-hidden">
      <ToastContainer />

      {/* Header (global DashboardHeader provides the breadcrumb) */}
      <SectionHeader
        as="h1"
        title={t('brandKitPage.title')}
        description={t('brandKitPage.description')}
        className="mb-6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Panel variant="glass">
            <h2 className="ds-text-h3 text-theme-primary mb-4">{t('brandKitPage.howUsedTitle')}</h2>
            <ul className="space-y-3">
              {[
                { icon: Clapperboard, text: t('brandKitPage.howUsedClips') },
                { icon: Type, text: t('brandKitPage.howUsedEditor') },
                { icon: HardDrive, text: t('brandKitPage.howUsedStorage') },
              ].map(({ icon: ItemIcon, text }) => (
                <li key={text} className="ds-surface-subtle flex items-start gap-3 p-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ItemIcon size={18} aria-hidden />
                  </span>
                  <span className="text-sm text-theme-secondary pt-1.5">{text}</span>
                </li>
              ))}
            </ul>
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
    </PageShell>
  );
}
