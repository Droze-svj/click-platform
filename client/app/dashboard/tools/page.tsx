'use client'

/**
 * AI Tools Hub — discovery surface for every advanced editing capability
 * Click ships. Every tool routes the user into the actual editor where
 * the work happens. There is intentionally no in-page op runner: AI tools
 * belong inside the editor next to the video they operate on.
 *   - Silence / filler / edit-by-text → editor with SmartCleanup panel
 *     auto-opened on the selected tool
 *   - Style + effects + captions → editor with the right category active
 *   - Long-form / blog-to-reel → forge + content surfaces
 */

import Link from 'next/link'
import {
  ArrowRight, Scissors, Music, Zap, Bot, Wand2,
  Subtitles, Type, Sparkles, FileText
} from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'

interface Tool {
  id: string
  title: string
  blurb: string
  icon: any
  accent: string
  /** Where this tool lives. Always a dashboard route — work happens in
   *  the editor, never on this page. */
  link: string
  cta: string
}

const TOOLS: Tool[] = [
  {
    id: 'remove-silence',
    title: 'AI Pause & Silence Remover',
    blurb: 'Detects silent gaps in your recording and tightens the cut. Three sensitivity levels and a min-gap slider.',
    icon: Scissors,
    accent: 'from-amber-500/30 to-amber-700/10 text-amber-300 border-amber-500/30',
    // Land on the video picker; the editor exposes "AI cleanup" in the
    // QuickActions rail so this tool is one click away once a project
    // is open. Query string preselects the right tool.
    link: '/dashboard/video?aiTool=silence',
    cta: 'Open editor → AI cleanup',
  },
  {
    id: 'remove-fillers',
    title: 'Cut Recording Mistakes',
    blurb: 'Strips "um / uh / like / you know" plus dead air. One-click clean-up powered by the auto-edit pipeline.',
    icon: Wand2,
    accent: 'from-rose-500/30 to-rose-700/10 text-rose-300 border-rose-500/30',
    link: '/dashboard/video?aiTool=fillers',
    cta: 'Open editor → AI cleanup',
  },
  {
    id: 'long-to-short',
    title: 'Long → Viral Short Clips',
    blurb: 'Auto-edit converts long-form footage into multiple platform-ready vertical clips, ranked by predicted virality.',
    icon: Zap,
    accent: 'from-indigo-500/30 to-indigo-700/10 text-indigo-300 border-indigo-500/30',
    link: '/dashboard/forge',
    cta: 'Open AI Video Creator',
  },
  {
    id: 'background-music',
    title: 'Add Background Music',
    blurb: 'Auto-pick from a curated music library or generate AI music sized to your clip. Beat-synced cuts and ducking included.',
    icon: Music,
    accent: 'from-emerald-500/30 to-emerald-700/10 text-emerald-300 border-emerald-500/30',
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
  {
    id: 'background-removal',
    title: 'AI Background Removal & Effects',
    blurb: 'Chroma key, masking, motion graphics, color curves, EQ + ducking. Full effects suite in the manual editor.',
    icon: Bot,
    accent: 'from-fuchsia-500/30 to-fuchsia-700/10 text-fuchsia-300 border-fuchsia-500/30',
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
  {
    id: 'blog-to-reel',
    title: 'Blog / Video → Marketing Reel',
    blurb: 'Paste a blog post or drop a video — Click drafts platform-specific reels, captions, and hashtags in one pass.',
    icon: FileText,
    accent: 'from-cyan-500/30 to-cyan-700/10 text-cyan-300 border-cyan-500/30',
    link: '/dashboard/content',
    cta: 'Open Content AI',
  },
  {
    id: 'captions',
    title: 'Auto Subtitles + Online Editor',
    blurb: 'Whisper-grade transcription, multi-language captions, word-level timing, and an inline editor that syncs to playback.',
    icon: Subtitles,
    accent: 'from-sky-500/30 to-sky-700/10 text-sky-300 border-sky-500/30',
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
  {
    id: 'edit-by-text',
    title: 'Edit by Editing Text',
    blurb: 'Descript-style. Mark seconds-ranges to keep — the video re-cuts to match. Lives next to the timeline in the editor.',
    icon: Type,
    accent: 'from-violet-500/30 to-violet-700/10 text-violet-300 border-violet-500/30',
    link: '/dashboard/video?aiTool=edit-by-text',
    cta: 'Open editor → AI cleanup',
  },
  {
    id: 'cinematic',
    title: '3D Style & Cinematic Effects',
    blurb: 'Cinematic color grade, film grain, 3D tilt/zoom, motion-blur, beat-synced transitions. Apply per-clip from the editor.',
    icon: Sparkles,
    accent: 'from-orange-500/30 to-orange-700/10 text-orange-300 border-orange-500/30',
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
]

export default function ToolsHubPage() {
  const { t } = useTranslation()
  return (
    <main className="min-h-screen px-8 md:px-16 py-12 max-w-[1500px] mx-auto">
      <header className="mb-12">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500 dark:text-indigo-400 italic mb-3">{t('toolsPage.eyebrow')}</p>
        <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase leading-none mb-4">
          {t('toolsPage.heading')}
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl">
          {t('toolsPage.subheading')}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.id}
              href={tool.link}
              className="group relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] backdrop-blur-xl p-7 h-full flex flex-col transition-all hover:border-slate-300 dark:hover:border-white/30 hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${tool.accent} blur-2xl opacity-50 group-hover:opacity-80 transition-opacity`} />
              <div className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${tool.accent} border flex items-center justify-center mb-5 shadow-lg`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2 leading-tight">{t(`toolsPage.tools.${tool.id}.title`)}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6 flex-1">{t(`toolsPage.tools.${tool.id}.blurb`)}</p>
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-300 group-hover:text-indigo-500 dark:group-hover:text-indigo-200 transition-colors">
                {t(`toolsPage.tools.${tool.id}.cta`)}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
