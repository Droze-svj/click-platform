'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import { useTranslation } from '@/hooks/useTranslation';

interface NicheInfo {
  niche: string;
  label: string;
  audiencePsychology?: {
    core_desires: string[];
    core_fears: string[];
    buying_triggers: string[];
  };
  hookPatterns?: string[];
  contentArchetypes?: string[];
  ctaPatterns?: string[];
  topObjections?: string[];
  postingCadence?: { optimal_days: string[]; reasons: string };
  bestFormats?: Record<string, string[]>;
}

interface HookType {
  type: string;
  label: string;
  description: string;
}

interface NicheStrategyPanelProps {
  currentNiche?: string;
  currentPlatform?: string;
  onNicheChange?: (niche: string) => void;
  onHookSelect?: (hook: string) => void;
  className?: string;
}

const SECTION_ICONS: Record<string, string> = {
  desires: '✨', fears: '⚠️', triggers: '🎯', hooks: '🎣', archetypes: '🎬', ctas: '📣', objections: '🤔', cadence: '📅'
};

export default function NicheStrategyPanel({ currentNiche = 'fitness', currentPlatform = 'tiktok', onNicheChange, onHookSelect, className = '' }: NicheStrategyPanelProps) {
  const { t } = useTranslation();
  const [allNiches, setAllNiches] = useState<{value: string; label: string}[]>([]);
  const [nicheInfo, setNicheInfo] = useState<NicheInfo | null>(null);
  const [hookTypes, setHookTypes] = useState<HookType[]>([]);
  const [selectedNiche, setSelectedNiche] = useState(currentNiche);
  const [activeSection, setActiveSection] = useState<'hooks' | 'psychology' | 'archetype' | 'cta'>('hooks');
  const [loading, setLoading] = useState(false);
  const [copiedHook, setCopiedHook] = useState<string | null>(null);

  const fetchHookTypes = useCallback(async () => {
    try {
      const data: any = await apiGet(`/intelligence/niche/${encodeURIComponent(currentNiche)}/hooks?count=5`);
      if (data?.hookTypes) setHookTypes(data.hookTypes);
    } catch { /* silent — empty hook list degrades gracefully */ }
  }, [currentNiche]);

  useEffect(() => {
    fetchNiches();
    fetchHookTypes();
  }, [fetchHookTypes]);

  useEffect(() => {
    fetchNicheIntel(selectedNiche);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNiche, currentPlatform]);

  const fetchNiches = async () => {
    try {
      const data: any = await apiGet('/intelligence/niches');
      if (data?.success && Array.isArray(data.niches)) setAllNiches(data.niches);
    } catch { /* silent */ }
  };

  const fetchNicheIntel = async (niche: string) => {
    setLoading(true);
    try {
      const data: any = await apiGet(`/intelligence/niche/${encodeURIComponent(niche)}`);
      if (data?.success && data.intel) setNicheInfo(data.intel);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const handleNicheChange = (niche: string) => {
    setSelectedNiche(niche);
    onNicheChange?.(niche);
  };

  const copyHook = (hook: string) => {
    navigator.clipboard.writeText(hook).catch(() => {});
    setCopiedHook(hook);
    setTimeout(() => setCopiedHook(null), 2000);
  };

  const SECTIONS = [
    { id: 'hooks', label: `🎣 ${t('nicheStrategyPanel.tabHooks')}` },
    { id: 'psychology', label: `🧠 ${t('nicheStrategyPanel.tabPsychology')}` },
    { id: 'archetype', label: `🎬 ${t('nicheStrategyPanel.tabContentTypes')}` },
    { id: 'cta', label: `📣 ${t('nicheStrategyPanel.tabCtas')}` }
  ] as const;

  return (
    // Outer wrapper uses theme tokens so the panel sits cleanly on either
    // light or dark pages. Inner sections keep their dark "console" look
    // (intentional — they're tactical-readout style).
    <div
      className={`niche-strategy-panel ${className} bg-[var(--click-panel-bg)] border border-[var(--glass-border)] shadow-[var(--glass-glow)]`}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        fontFamily: '"Outfit", "Inter", sans-serif',
      }}
    >
      {/* The inner intelligence-console block stays dark for legibility of
          its existing white-on-dark text. */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1a0d 0%, #1a1a0d 100%)',
        borderRadius: 14,
        border: '1px solid rgba(0, 200, 100, 0.15)',
        margin: 4,
        overflow: 'hidden',
      }}>
      {/* Header + Niche Picker */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,200,100,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>🧬</span>
          <div>
            <div style={{ color: '#00c864', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>{t('nicheStrategyPanel.headerTitle')}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{t('nicheStrategyPanel.headerSubtitle')}</div>
          </div>
        </div>
        <select
          title={t('nicheStrategyPanel.selectNicheTitle')}
          value={selectedNiche}
          onChange={e => handleNicheChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(0,200,100,0.2)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            outline: 'none',
            fontFamily: 'inherit'
          }}
        >
          {allNiches.map(n => <option key={n.value} value={n.value} style={{ background: '#1a1a2e' }}>{n.label}</option>)}
        </select>
      </div>

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
        {SECTIONS.map(s => (
          <button
            type="button"
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              flex: '0 0 auto',
              padding: '9px 14px',
              background: activeSection === s.id ? 'rgba(0,200,100,0.12)' : 'transparent',
              border: 'none',
              borderBottom: activeSection === s.id ? '2px solid #00c864' : '2px solid transparent',
              color: activeSection === s.id ? '#00c864' : 'rgba(255,255,255,0.4)',
              fontSize: 12, fontWeight: activeSection === s.id ? 700 : 400,
              cursor: 'pointer'
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>{t('nicheStrategyPanel.loading')}</div>
      ) : nicheInfo ? (
        <div style={{ overflowY: 'auto', maxHeight: 380, padding: 14 }}>

          {/* HOOKS Section */}
          {activeSection === 'hooks' && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '0 0 10px' }}>
                {t('nicheStrategyPanel.hooksIntro', { label: nicheInfo.label })}
              </p>
              {(nicheInfo.hookPatterns || []).map((hook, i) => (
                <div key={i} style={{ marginBottom: 8, padding: '10px 12px', background: 'rgba(0,200,100,0.06)', border: '1px solid rgba(0,200,100,0.12)', borderRadius: 8 }}>
                  <div style={{ color: '#e0ffe0', fontSize: 12, lineHeight: 1.5, marginBottom: 6 }}>
                    {hook}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => copyHook(hook)}
                      style={{ padding: '3px 10px', background: 'rgba(0,200,100,0.12)', border: '1px solid rgba(0,200,100,0.2)', borderRadius: 5, color: '#00c864', fontSize: 11, cursor: 'pointer' }}
                    >
                      {copiedHook === hook ? `✅ ${t('nicheStrategyPanel.copied')}` : `📋 ${t('nicheStrategyPanel.copy')}`}
                    </button>
                    {onHookSelect && (
                      <button
                        type="button"
                        onClick={() => onHookSelect(hook)}
                        style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'rgba(255,255,255,0.6)', fontSize: 11, cursor: 'pointer' }}
                      >
                        {t('nicheStrategyPanel.useInEditor')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PSYCHOLOGY Section */}
          {activeSection === 'psychology' && nicheInfo.audiencePsychology && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <PsychologyCard icon="✨" title={t('nicheStrategyPanel.coreDesires')} items={nicheInfo.audiencePsychology.core_desires} color="#00c864" />
              <PsychologyCard icon="⚠️" title={t('nicheStrategyPanel.coreFears')} items={nicheInfo.audiencePsychology.core_fears} color="#ffb400" />
              <PsychologyCard icon="🎯" title={t('nicheStrategyPanel.buyingTriggers')} items={nicheInfo.audiencePsychology.buying_triggers} color="#a855f7" />
            </div>
          )}

          {/* CONTENT TYPES Section */}
          {activeSection === 'archetype' && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '0 0 10px' }}>
                {t('nicheStrategyPanel.archetypeIntro', { label: nicheInfo.label })}
              </p>
              {(nicheInfo.contentArchetypes || []).map((arc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#00c864', fontSize: 12, fontWeight: 700, minWidth: 22 }}>#{i + 1}</div>
                  <div style={{ color: '#e0ffe0', fontSize: 12 }}>{arc.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                </div>
              ))}

              {nicheInfo.postingCadence && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(0,200,100,0.06)', borderRadius: 8, border: '1px solid rgba(0,200,100,0.12)' }}>
                  <div style={{ color: '#00c864', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>📅 {t('nicheStrategyPanel.bestPostingDays')}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                    {nicheInfo.postingCadence.optimal_days.map(day => (
                      <span key={day} style={{ padding: '2px 8px', background: 'rgba(0,200,100,0.15)', borderRadius: 4, color: '#00c864', fontSize: 11 }}>{day}</span>
                    ))}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{nicheInfo.postingCadence.reasons}</div>
                </div>
              )}
            </div>
          )}

          {/* CTA Section */}
          {activeSection === 'cta' && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '0 0 10px' }}>
                {t('nicheStrategyPanel.ctaIntro', { label: nicheInfo.label })}
              </p>
              {(nicheInfo.ctaPatterns || []).map((cta, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ fontSize: 16 }}>📣</span>
                  <div style={{ flex: 1, color: '#e0e0ff', fontSize: 12 }}>{cta}</div>
                  <button
                    type="button"
                    onClick={() => copyHook(cta)}
                    style={{ padding: '3px 8px', background: 'rgba(0,200,100,0.1)', border: '1px solid rgba(0,200,100,0.2)', borderRadius: 4, color: '#00c864', fontSize: 11, cursor: 'pointer' }}
                  >
                    {copiedHook === cta ? '✅' : '📋'}
                  </button>
                </div>
              ))}

              {nicheInfo.topObjections && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>🤔 {t('nicheStrategyPanel.topObjections')}</div>
                  {nicheInfo.topObjections.map((obj, i) => (
                    <div key={i} style={{ padding: '6px 10px', marginBottom: 5, background: 'rgba(255,100,0,0.07)', borderRadius: 6, border: '1px solid rgba(255,100,0,0.12)', color: 'rgba(255,200,150,0.8)', fontSize: 12 }}>
                      "{obj}"
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}

function PsychologyCard({ icon, title, items, color }: { icon: string; title: string; items: string[]; color: string }) {
  return (
    <div style={{ padding: '10px 12px', background: `${color}08`, borderRadius: 8, border: `1px solid ${color}20` }}>
      <div style={{ color, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{icon} {title}</div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 4 }}>
          <span style={{ color, fontSize: 10, marginTop: 2 }}>•</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}
