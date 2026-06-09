'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Check, ArrowRight, Wand2, Layers, CalendarClock, LineChart } from 'lucide-react'
import { useLandingTheme } from './LandingThemeContext'
import {
  NICHE_OPTIONS, PLATFORM_OPTIONS, GOAL_OPTIONS,
  nicheLabel, platformLabel, goalLabel,
} from '../../lib/nicheCatalog'
import { glass, sectionPadding, fadeUpInView } from './_styles'

// Curated niche set for the builder (keeps the grid tidy; all map to real
// playbooks). The picker above uses a smaller marquee subset.
const BUILDER_NICHES = ['finance', 'health', 'lifestyle', 'technology', 'beauty', 'gaming', 'business', 'education']

/**
 * "Build your Click plan" — a deterministic, client-side preview (no API, no
 * fabricated numbers). It composes an honest summary of what Click actually
 * does for the visitor's niche/platforms/goal, drawing the niche line straight
 * from the real playbook blurb. Picking a niche also re-tints the whole page.
 */
export default function PlanBuilder() {
  const { niche, setNiche, accent } = useLandingTheme()
  const reduce = useReducedMotion()
  const [platforms, setPlatforms] = useState<string[]>(['tiktok', 'instagram'])
  const [goal, setGoal] = useState<string>('grow_audience')

  const togglePlatform = (v: string) =>
    setPlatforms((prev) => (prev.includes(v) ? prev.filter((p) => p !== v) : [...prev, v]))

  const nicheOpt = NICHE_OPTIONS.find((n) => n.value === niche) || null

  const plan = useMemo(() => {
    const platformText = platforms.length
      ? platforms.map(platformLabel).join(platforms.length === 2 ? ' + ' : ', ')
      : 'every feed'
    return [
      {
        icon: Wand2,
        label: 'Hooks & cuts',
        text: nicheOpt ? nicheOpt.blurb : 'Hook-first edits, niche-aware captions, and clean pacing — tuned the moment you pick a niche.',
      },
      {
        icon: Layers,
        label: 'Every format',
        text: `Auto-reframed for ${platformText} — 9:16, 1:1 and 16:9 in one pass.`,
      },
      {
        icon: CalendarClock,
        label: 'Scheduled',
        text: "Queued at your niche's peak posting window across the platforms you picked.",
      },
      {
        icon: LineChart,
        label: 'Gets sharper',
        text: `Click tracks which hooks hold attention and adapts the next edit${goal ? ` toward ${goalLabel(goal).toLowerCase()}` : ''}.`,
      },
    ]
  }, [nicheOpt, platforms, goal])

  const ctaHref = `/register?plan=free${niche ? `&niche=${encodeURIComponent(niche)}` : ''}${
    platforms.length ? `&platforms=${encodeURIComponent(platforms.join(','))}` : ''
  }${goal ? `&goal=${encodeURIComponent(goal)}` : ''}`

  return (
    <section id="plan-builder" className={`relative ${sectionPadding}`}>
      <motion.div {...fadeUpInView} className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <span className={`inline-block text-[11px] font-black uppercase tracking-[0.3em] bg-gradient-to-r ${accent.gradient} bg-clip-text text-transparent`}>
            Build your plan
          </span>
          <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight text-white">
            See exactly what Click would do for you
          </h2>
          <p className="mt-3 text-white/60 max-w-2xl mx-auto">
            Pick your niche, platforms, and goal. No signup, no fluff — just the plan Click runs on your footage.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-stretch">
          {/* Controls */}
          <div className={`${glass} rounded-3xl p-6 space-y-6`}>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-white/50 mb-3">1 · Your niche</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BUILDER_NICHES.map((v) => {
                  const opt = NICHE_OPTIONS.find((n) => n.value === v)!
                  const Icon = opt.icon
                  const active = niche === v
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNiche(active ? null : v)}
                      aria-pressed={active ? 'true' : 'false'}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-300 ${
                        active
                          ? `${accent.solidBg} text-white border-transparent ${accent.ring}`
                          : 'border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon size={18} aria-hidden />
                      <span className="text-[11px] font-bold">{opt.label.split(' ')[0]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-white/50 mb-3">2 · Where you post</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((p) => {
                  const active = platforms.includes(p.value)
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => togglePlatform(p.value)}
                      aria-pressed={active ? 'true' : 'false'}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-300 ${
                        active
                          ? `${accent.solidBg} text-white border-transparent`
                          : 'border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {active && <Check size={13} aria-hidden />}
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-white/50 mb-3">3 · Your #1 goal</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GOAL_OPTIONS.map((g) => {
                  const Icon = g.icon
                  const active = goal === g.value
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGoal(active ? '' : g.value)}
                      aria-pressed={active ? 'true' : 'false'}
                      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-300 ${
                        active
                          ? `${accent.solidBg} text-white border-transparent`
                          : 'border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon size={16} aria-hidden />
                      <span className="text-[12px] font-semibold">{g.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className={`${glass} rounded-3xl p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-white/50">Your Click plan</span>
              <span className={`text-[11px] font-bold ${accent.textAccent}`}>
                {niche ? nicheLabel(niche) : 'Pick a niche →'}
              </span>
            </div>

            <div className="flex-1 space-y-3" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.ul
                  key={`${niche}-${platforms.join()}-${goal}`}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-3"
                >
                  {plan.map((row) => {
                    const Icon = row.icon
                    return (
                      <li key={row.label} className="flex gap-3">
                        <span className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r ${accent.gradient} text-white`}>
                          <Icon size={15} aria-hidden />
                        </span>
                        <div>
                          <p className="text-[12px] font-black uppercase tracking-wider text-white/70">{row.label}</p>
                          <p className="text-sm text-white/80 leading-snug">{row.text}</p>
                        </div>
                      </li>
                    )
                  })}
                </motion.ul>
              </AnimatePresence>
            </div>

            <Link
              href={ctaHref}
              className={`mt-6 inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl text-white font-bold ${accent.solidBg} ${accent.shadow} hover:opacity-95 transition-opacity`}
            >
              Start free with this plan
              <ArrowRight size={18} aria-hidden />
            </Link>
            <p className="mt-2 text-center text-[11px] text-white/40">Free forever · No card · First export in 90 seconds</p>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
