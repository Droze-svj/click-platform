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
  Subtitles, Type, Sparkles, FileText, type LucideIcon
} from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'
import { Panel, SectionHeader } from '../../../components/ui'

interface Tool {
  id: string
  title: string
  blurb: string
  icon: LucideIcon
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
    link: '/dashboard/video?aiTool=fillers',
    cta: 'Open editor → AI cleanup',
  },
  {
    id: 'long-to-short',
    title: 'Long → Viral Short Clips',
    blurb: 'Auto-edit converts long-form footage into multiple platform-ready vertical clips, ranked by predicted virality.',
    icon: Zap,
    link: '/dashboard/forge',
    cta: 'Open AI Video Creator',
  },
  {
    id: 'background-music',
    title: 'Add Background Music',
    blurb: 'Auto-pick from a curated music library or generate AI music sized to your clip. Beat-synced cuts and ducking included.',
    icon: Music,
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
  {
    id: 'background-removal',
    title: 'AI Background Removal & Effects',
    blurb: 'Chroma key, masking, motion graphics, color curves, EQ + ducking. Full effects suite in the manual editor.',
    icon: Bot,
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
  {
    id: 'blog-to-reel',
    title: 'Blog / Video → Marketing Reel',
    blurb: 'Paste a blog post or drop a video — Click drafts platform-specific reels, captions, and hashtags in one pass.',
    icon: FileText,
    link: '/dashboard/content',
    cta: 'Open Content AI',
  },
  {
    id: 'captions',
    title: 'Auto Subtitles + Online Editor',
    blurb: 'Whisper-grade transcription, multi-language captions, word-level timing, and an inline editor that syncs to playback.',
    icon: Subtitles,
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
  {
    id: 'edit-by-text',
    title: 'Edit by Editing Text',
    blurb: 'Descript-style. Mark seconds-ranges to keep — the video re-cuts to match. Lives next to the timeline in the editor.',
    icon: Type,
    link: '/dashboard/video?aiTool=edit-by-text',
    cta: 'Open editor → AI cleanup',
  },
  {
    id: 'cinematic',
    title: '3D Style & Cinematic Effects',
    blurb: 'Cinematic color grade, film grain, 3D tilt/zoom, motion-blur, beat-synced transitions. Apply per-clip from the editor.',
    icon: Sparkles,
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
]

export default function ToolsHubPage() {
  const { t } = useTranslation()
  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1500px] mx-auto overflow-x-hidden text-theme-primary">
      <SectionHeader
        as="h1"
        title={t('toolsPage.heading')}
        description={t('toolsPage.subheading')}
        className="mb-8"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <Link key={tool.id} href={tool.link} className="group">
              <Panel variant="bento" className="h-full flex flex-col">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary mb-5">
                  <Icon className="w-5 h-5" aria-hidden />
                </div>
                <h3 className="ds-text-h3 text-theme-primary leading-tight mb-2">{t(`toolsPage.tools.${tool.id}.title`)}</h3>
                <p className="text-sm text-theme-muted leading-relaxed mb-6 flex-1">{t(`toolsPage.tools.${tool.id}.blurb`)}</p>
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  {t(`toolsPage.tools.${tool.id}.cta`)}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden />
                </div>
              </Panel>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
