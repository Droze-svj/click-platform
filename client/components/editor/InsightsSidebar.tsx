'use client'

import React, { useState } from 'react'
import {
  Zap,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Target,
  Send,
  Calendar,
  Brain,
  Globe,
  Scissors
} from 'lucide-react'
import { ContentNiche, CaptionTextStyle } from '../../types/editor'
import { IconButton, Button, Textarea, Badge } from '../ui'
import { useTranslation } from '@/hooks/useTranslation'

// This sidebar used to show "AI Coach" scores (overall / viral / hook, FOMO,
// curiosity, an "8th Grade" readability grade, a retention heatmap) that were
// derived from Math.sin(transcript length + duration) plus canned per-niche
// advice, and "optimizer" buttons that matched keywords. All of that is gone:
// what remains are controls that really change something.
interface InsightsSidebarProps {
  niche: ContentNiche
  onNicheChange: (niche: ContentNiche) => void
  onCaptionStyleChange: (style: CaptionTextStyle) => void
  onManualOverride: (instruction: string) => void
  onScheduleUpload: () => void
  /** Opens the real Smart cleanup tool (silence / filler-word removal). */
  onOpenCleanup?: (tool: 'silence' | 'fillers') => void
  onLanguageChange?: (language: string) => void
  targetLanguage?: string
  selectedCaptionStyle?: CaptionTextStyle
  onCollapse?: () => void
}

const nicheOptions: { id: ContentNiche; label: string }[] = [
  { id: 'educational', label: 'Educational' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'b2b', label: 'B2B' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'vlog', label: 'Vlog' },
  { id: 'fitness', label: 'Fitness' },
]

const styleOptions: { id: CaptionTextStyle; label: string }[] = [
  { id: 'bold', label: '⚡ MrBeast Style' },
  { id: 'pill', label: '💊 Alex Hormozi' },
  { id: 'minimal', label: '💼 Clean Corporate' },
  { id: 'neon', label: '🌌 Pulse Gaming' },
  { id: 'kinetic', label: '🔥 Kinetic Impact' },
  { id: 'cinematic', label: '🎬 Cinematic Film' },
  { id: 'subtitle', label: '💬 Classic Subtitle' },
  { id: 'gradient', label: '🌈 Rainbow Gradient' },
  { id: 'karaoke', label: '🎤 Karaoke Spot' },
  { id: 'retro', label: '📻 Retro Vibe' }
]

export const InsightsSidebar: React.FC<InsightsSidebarProps> = ({
  niche,
  onNicheChange,
  onCaptionStyleChange,
  onManualOverride,
  onScheduleUpload,
  onOpenCleanup,
  onLanguageChange,
  targetLanguage = 'en',
  selectedCaptionStyle = 'bold',
  onCollapse
}) => {
  const { t } = useTranslation()
  const [overrideText, setOverrideText] = useState('')

  const submitOverride = () => {
    if (!overrideText.trim()) return
    onManualOverride(overrideText)
    setOverrideText('')
  }

  return (
    <div className="ds-surface-elevated flex flex-col h-full border-l border-border w-80 p-6 overflow-y-auto custom-scrollbar">

      {/* Sidebar Header with Collapse Button */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border shrink-0">
         <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h2 className="ds-text-label text-theme-primary">{t('insightsSidebar.title')}</h2>
         </div>
         <IconButton aria-label="Collapse insights sidebar" variant="ghost" size="sm" onClick={onCollapse}>
            <ChevronRight className="w-4 h-4" />
         </IconButton>
      </div>

      <div className="space-y-6">
        {/* Quick fixes — open the real Smart cleanup tool, where the user reviews
            the detected cuts before anything is removed. */}
        {onOpenCleanup && (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-primary" />
                <h3 className="ds-text-label text-theme-secondary">{t('insightsSidebar.quickFixes')}</h3>
              </div>
              <p className="ds-text-caption text-theme-muted leading-relaxed">{t('insightsSidebar.quickFixesHint')}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={() => onOpenCleanup('silence')}>
                  {t('insightsSidebar.removeSilences')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onOpenCleanup('fillers')}>
                  {t('insightsSidebar.removeFillers')}
                </Button>
              </div>
            </div>

            <div className="h-px bg-border" />
          </>
        )}

        {/* Niche Recalibration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="ds-text-label text-theme-secondary">Audience niche</h3>
          </div>
          <p className="ds-text-caption text-theme-muted -mt-2">{t('insightsSidebar.nicheHint')}</p>
          <div className="grid grid-cols-2 gap-2">
            {nicheOptions.map((opt) => (
              <Button
                key={opt.id}
                variant={niche === opt.id ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => onNicheChange(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* AI Director language — biases the AI's generated script/plan. This does
            NOT translate your captions; use "Translate captions" in the Edit tab for
            that. (Kept honest: this control used to be labelled a "Neural Translation"
            output but only ever fed the AI Director.) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-500" />
              <h3 className="ds-text-label text-theme-secondary">AI script language</h3>
            </div>
            <Badge variant="outline">AI Director</Badge>
          </div>
          <p className="ds-text-caption text-theme-muted -mt-2">Guides the AI's generated script. To translate on-screen captions, use “Translate captions” in the Edit tab.</p>
          <div className="relative group">
            <select
              value={targetLanguage}
              onChange={(e) => {
                if (onLanguageChange) onLanguageChange(e.target.value)
              }}
              title="Select Target Language"
              className="w-full ds-surface-card rounded-xl py-3 px-4 ds-text-body font-medium text-theme-primary appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all cursor-pointer"
            >
              <option value="en" className="bg-[#0a0a0a]">🇺🇸 English</option>
              <option value="es" className="bg-[#0a0a0a]">🇪🇸 Spanish (Español)</option>
              <option value="fr" className="bg-[#0a0a0a]">🇫🇷 French (Français)</option>
              <option value="de" className="bg-[#0a0a0a]">🇩🇪 German (Deutsch)</option>
              <option value="it" className="bg-[#0a0a0a]">🇮🇹 Italian (Italiano)</option>
              <option value="pt" className="bg-[#0a0a0a]">🇵🇹 Portuguese (Português)</option>
              <option value="ru" className="bg-[#0a0a0a]">🇷🇺 Russian (Русский)</option>
              <option value="ja" className="bg-[#0a0a0a]">🇯🇵 Japanese (日本語)</option>
              <option value="ko" className="bg-[#0a0a0a]">🇰🇷 Korean (한국어)</option>
              <option value="zh" className="bg-[#0a0a0a]">🇨🇳 Chinese (中文)</option>
              <option value="ar" className="bg-[#0a0a0a]">🇦🇪 Arabic (العربية)</option>
              <option value="hi" className="bg-[#0a0a0a]">🇮🇳 Hindi (हिन्दी)</option>
              <option value="nl" className="bg-[#0a0a0a]">🇳🇱 Dutch (Nederlands)</option>
              <option value="pl" className="bg-[#0a0a0a]">🇵🇱 Polish (Polski)</option>
              <option value="tr" className="bg-[#0a0a0a]">🇹🇷 Turkish (Türkçe)</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none group-hover:text-theme-primary transition-colors" />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Caption Style Mood-Switcher */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="ds-text-label text-theme-secondary">Caption style</h3>
          </div>
          <div className="relative group">
            <select
              value={selectedCaptionStyle}
              onChange={(e) => onCaptionStyleChange(e.target.value as CaptionTextStyle)}
              title="Select caption text style"
              className="w-full ds-surface-card rounded-xl py-3 px-4 ds-text-body font-medium text-theme-primary appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all cursor-pointer"
            >
              {styleOptions.map(opt => (
                <option key={opt.id} value={opt.id} className="bg-[#0a0a0a]">{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none group-hover:text-theme-primary transition-colors" />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Quick command — only "add title …" is handled here; anything else is
            handed to the AI assistant rather than pretending it was applied. */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="ds-text-label text-theme-secondary">{t('insightsSidebar.quickCommand')}</h3>
          </div>
          <p className="ds-text-caption text-theme-muted -mt-2">{t('insightsSidebar.quickCommandHint')}</p>
          <div className="relative">
            <Textarea
              value={overrideText}
              onChange={(e) => setOverrideText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitOverride() }
              }}
              placeholder={t('insightsSidebar.quickCommandPlaceholder')}
              title={t('insightsSidebar.quickCommand')}
              className="h-24 resize-none pr-12"
            />
            <IconButton
              aria-label="Send command"
              variant="primary"
              size="sm"
              disabled={!overrideText.trim()}
              onClick={submitOverride}
              className="absolute bottom-3 right-3 h-8 w-8"
            >
              <Send className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        </div>

        {/* Scheduling Action */}
        <Button
          variant="gradient"
          size="lg"
          onClick={onScheduleUpload}
          leftIcon={<Calendar className="w-4 h-4" />}
          className="w-full mt-6"
        >
          Schedule launch
        </Button>
      </div>
    </div>
  )
}
