'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import AIMultiModelSelector from '../../../components/AIMultiModelSelector';
import AIRecommendations from '../../../components/AIRecommendations';
import PredictiveAnalytics from '../../../components/PredictiveAnalytics';
import {
  Brain, TrendingUp, Sparkles, BarChart3,
  Cpu, Activity, ChevronRight, Sparkle, RefreshCw, type LucideIcon
} from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { CardSkeleton } from '../../../components/LoadingSkeleton';
import ToastContainer from '../../../components/ToastContainer';
import { Panel, Button, IconButton, SectionHeader } from '../../../components/ui';
import { cn } from '../../../lib/utils';

export default function CognitiveLogicMatrixPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (!user && typeof window !== 'undefined') {
      router.push('/login');
    }
  }, [user, router]);

  if (!isClient || !user) {
    return (
      <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center py-48" aria-busy="true">
        <Brain size={56} className="text-primary animate-spin mb-8" aria-hidden />
        <p className="ds-text-label text-theme-muted">{t('aiPage.loading')}</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: t('aiPage.tabOverview'), icon: Activity },
    { id: 'models', label: t('aiPage.tabModels'), icon: Cpu },
    { id: 'recommendations', label: t('aiPage.tabSynthesis'), icon: Sparkles },
    { id: 'analytics', label: t('aiPage.tabForecasts'), icon: TrendingUp },
  ];

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1900px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('aiPage.title')}
          className="mb-6"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 p-1 rounded-lg ds-surface-subtle overflow-x-auto max-w-full">
                {tabs.map(tab => {
                  const TIcon = tab.icon
                  return (
                    <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}
                      title={tab.label}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-3 h-8 text-xs font-medium transition-colors whitespace-nowrap',
                        activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary'
                      )}
                    >
                      <TIcon size={14} aria-hidden /> <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
              <IconButton variant="secondary" size="md" onClick={() => window.location.reload()} title={t('aiPage.reloadParadigms')} aria-label={t('aiPage.reloadParadigms')}>
                <RefreshCw size={16} aria-hidden />
              </IconButton>
            </div>
          }
        />

        <ErrorBoundary>
          <div>
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <ParadigmCard
                  icon={Cpu}
                  title={t('aiPage.cardLogicTitle')}
                  desc={t('aiPage.cardLogicDesc')}
                  buttonText={t('aiPage.cardLogicButton')}
                  onClick={() => setActiveTab('models')}
                />
                <ParadigmCard
                  icon={Sparkle}
                  title={t('aiPage.cardSynthesisTitle')}
                  desc={t('aiPage.cardSynthesisDesc')}
                  buttonText={t('aiPage.cardSynthesisButton')}
                  onClick={() => setActiveTab('recommendations')}
                />
                <ParadigmCard
                  icon={BarChart3}
                  title={t('aiPage.cardForecastsTitle')}
                  desc={t('aiPage.cardForecastsDesc')}
                  buttonText={t('aiPage.cardForecastsButton')}
                  onClick={() => setActiveTab('analytics')}
                />
              </div>
            )}

            {activeTab === 'models' && (
              <Suspense fallback={<CardSkeleton />}>
                <AIMultiModelSelector />
              </Suspense>
            )}

            {activeTab === 'recommendations' && (
              <Suspense fallback={<CardSkeleton />}>
                <AIRecommendations />
              </Suspense>
            )}

            {activeTab === 'analytics' && (
              <Suspense fallback={<CardSkeleton />}>
                <PredictiveAnalytics />
              </Suspense>
            )}
          </div>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}

function ParadigmCard({ icon: Icon, title, desc, buttonText, onClick }: { icon: LucideIcon; title: string; desc: string; buttonText: string; onClick: () => void }) {
  return (
    <Panel variant="bento" className="group flex flex-col h-full">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary mb-5">
        <Icon size={22} aria-hidden />
      </div>
      <h2 className="ds-text-h3 text-theme-primary leading-tight mb-2">{title}</h2>
      <p className="text-sm text-theme-muted leading-relaxed mb-6 flex-1">{desc}</p>
      <Button variant="secondary" size="md" onClick={onClick} className="w-full justify-between" rightIcon={<ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" aria-hidden />}>
        {buttonText}
      </Button>
    </Panel>
  )
}
