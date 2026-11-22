'use client';

import { useState } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { Captions, Crop, Layers, Palette, Scissors } from 'lucide-react';
import { CaptionLine, StudioScene, Waveform, useCaptionTicker, type CaptionLook } from './visuals';

/**
 * What the editor itself does, shown rather than listed. Every tile maps to
 * shipped code and stays inside it:
 *  - caption looks: services/captionStyleRegistry (burned in with libass, word
 *    timing from the transcript; preview + export share bundled fonts);
 *  - grades: services/colorGradeRegistry — the CSS filters below are the
 *    registry's own preview values (saturation/contrast/temperature/sepia);
 *  - clips from long videos: highlight detection in advancedVideoEditingService;
 *  - reframe: smartReframeService (9:16, 1:1, 16:9);
 *  - timeline: the multi-track editor every auto-edit opens in.
 */

const LOOKS: { look: CaptionLook; name: string }[] = [
  { look: 'karaoke', name: 'Karaoke' },
  { look: 'pill', name: 'Pill' },
  { look: 'neon', name: 'Neon' },
  { look: 'sticker', name: 'Sticker' },
];
const CAPTION_SCRIPT = [
  ['THIS', 'CHANGED', 'EVERYTHING'],
  ['WATCH', 'TILL', 'THE', 'END'],
];

const GRADES: { id: string; name: string; filter: string; vignette: number }[] = [
  { id: 'natural', name: 'Natural', filter: 'none', vignette: 0 },
  { id: 'vibrant', name: 'Vibrant', filter: 'saturate(1.5) contrast(1.1)', vignette: 0 },
  { id: 'warm', name: 'Warm', filter: 'saturate(1.1) sepia(0.22) hue-rotate(-8deg)', vignette: 0 },
  { id: 'cool', name: 'Cool', filter: 'saturate(1.05) hue-rotate(14deg) brightness(1.03)', vignette: 0 },
  { id: 'cinematic', name: 'Cinematic', filter: 'sepia(0.18) contrast(1.08) saturate(0.95)', vignette: 0.45 },
  { id: 'noir', name: 'Noir', filter: 'grayscale(1) contrast(1.3)', vignette: 0.6 },
];

const tile = 'click-vessel !rounded-[1.6rem] p-6 md:p-7 flex flex-col overflow-hidden';
const tileTitle = 'text-xl md:text-2xl font-black tracking-tight text-surface-900 dark:text-white';
const tileBody = 'text-sm md:text-[15px] text-surface-600 dark:text-slate-300 leading-relaxed';

function TileHead({ icon: Icon, title, children }: { icon: typeof Captions; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <span className="click-aperture-icon w-10 h-10 mb-4">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </span>
      <h3 className={tileTitle}>{title}</h3>
      <p className={`${tileBody} mt-2`}>{children}</p>
    </div>
  );
}

function CaptionsTile() {
  const { line, word } = useCaptionTicker(CAPTION_SCRIPT, 420, 2);
  return (
    <div className={`${tile} md:col-span-2`}>
      <TileHead icon={Captions} title="Captions that land on every word">
        Captions are timed to your voice and burned into the video in the style you pick. The preview uses the same fonts as the export, so what you see is what gets posted.
      </TileHead>
      <div className="mt-auto grid grid-cols-2 sm:grid-cols-4 gap-3" aria-hidden="true">
        {LOOKS.map(({ look, name }) => (
          <div key={look} className="flex flex-col gap-2">
            <div className="relative aspect-[9/14] rounded-xl overflow-hidden ring-1 ring-white/10 bg-black">
              <StudioScene />
              <div className="absolute inset-x-1.5 bottom-[16%] text-[15px] md:text-[17px]">
                <CaptionLine words={CAPTION_SCRIPT[line]} activeWord={word} look={look} />
              </div>
            </div>
            <span className="text-xs font-bold text-center text-surface-600 dark:text-slate-300">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GradeTile() {
  const [grade, setGrade] = useState(GRADES[2]);
  return (
    <div className={tile}>
      <TileHead icon={Palette} title="Color grades, previewed live">
        Pick a look and see it on your footage before you export. Try one:
      </TileHead>
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden ring-1 ring-white/10 bg-black mb-4" aria-hidden="true">
        <StudioScene filter={grade.filter === 'none' ? undefined : grade.filter} vignette={grade.vignette} />
        <span className="absolute top-2.5 left-2.5 px-2 py-1 rounded-md bg-black/50 backdrop-blur text-[10px] font-bold text-white tracking-wide">
          {grade.name}
        </span>
      </div>
      <div role="group" aria-label="Color grade" className="mt-auto flex flex-wrap gap-1.5">
        {GRADES.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={g.id === grade.id}
            onClick={() => setGrade(g)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 ${
              g.id === grade.id
                ? 'bg-surface-900 text-white border-surface-900 dark:bg-white dark:text-black dark:border-white'
                : 'border-surface-900/10 dark:border-white/10 text-surface-600 dark:text-slate-300 hover:border-primary-500/50'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClipsTile() {
  const reduce = useReducedMotion();
  const picks = [
    { at: 8, w: 14 },
    { at: 41, w: 12 },
    { at: 73, w: 15 },
  ];
  return (
    <div className={tile}>
      <TileHead icon={Scissors} title="Long video in, shorts out">
        Give Click a long recording and it finds the strongest moments and cuts each one into its own short.
      </TileHead>
      <div className="mt-auto space-y-4" aria-hidden="true">
        <div className="relative h-10 rounded-lg bg-surface-900/[0.04] dark:bg-white/[0.04] border border-surface-900/5 dark:border-white/5 px-1.5">
          <Waveform bars={70} className="h-full" barClassName="bg-surface-900/25 dark:bg-white/25" seed={3} />
          {picks.map((p, i) => (
            <m.span
              key={i}
              className="absolute top-0 bottom-0 rounded-md border-2 border-primary-400 bg-primary-500/20"
              style={{ left: `${p.at}%`, width: `${p.w}%` }}
              {...(reduce ? {} : { initial: { opacity: 0, scaleY: 0.4 }, whileInView: { opacity: 1, scaleY: 1 }, viewport: { once: true }, transition: { delay: 0.2 + i * 0.2, duration: 0.5 } })}
            />
          ))}
        </div>
        <div className="flex justify-between gap-2.5">
          {picks.map((_, i) => (
            <m.div
              key={i}
              className="relative flex-1 aspect-[9/16] rounded-lg overflow-hidden ring-1 ring-white/10 bg-black"
              {...(reduce ? {} : { initial: { opacity: 0, y: 14 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: 0.8 + i * 0.15, duration: 0.5 } })}
            >
              <StudioScene filter={i === 1 ? 'hue-rotate(30deg)' : i === 2 ? 'hue-rotate(-25deg) saturate(1.2)' : undefined} />
              <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/50 text-[9px] font-bold text-white">Clip {i + 1}</span>
            </m.div>
          ))}
        </div>
      </div>
    </div>
  );
}

const FRAMES = [
  { label: '9:16', w: 34, h: 100 },
  { label: '1:1', w: 60, h: 60 },
  { label: '16:9', w: 100, h: 56 },
];

function ReframeTile() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const f = FRAMES[i];
  return (
    <div className={tile}>
      <TileHead icon={Crop} title="One edit, every shape">
        Click reframes the same edit for vertical, square and wide, keeping the speaker in shot.
      </TileHead>
      <div className="relative mt-auto aspect-[16/10] rounded-xl bg-surface-900/[0.04] dark:bg-white/[0.04] border border-surface-900/5 dark:border-white/5 flex items-center justify-center" aria-hidden="true">
        <m.div
          className="relative rounded-lg overflow-hidden ring-2 ring-primary-400 bg-black shadow-[0_20px_40px_-20px_rgba(79,70,229,0.7)]"
          animate={{ width: `${f.w * 0.8}%`, height: `${f.h * 0.8}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 22 }}
        >
          <StudioScene subjectScale={f.label === '16:9' ? 0.85 : 1} />
        </m.div>
      </div>
      <div role="group" aria-label="Aspect ratio" className="mt-4 flex gap-1.5">
        {FRAMES.map((fr, idx) => (
          <button
            key={fr.label}
            type="button"
            aria-pressed={idx === i}
            onClick={() => setI(idx)}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 ${
              idx === i
                ? 'bg-surface-900 text-white border-surface-900 dark:bg-white dark:text-black dark:border-white'
                : 'border-surface-900/10 dark:border-white/10 text-surface-600 dark:text-slate-300 hover:border-primary-500/50'
            }`}
          >
            {fr.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimelineTile() {
  const tracks = [
    { name: 'Video', color: 'from-indigo-400/80 to-indigo-600/80', blocks: [18, 12, 22, 16, 14] },
    { name: 'Text', color: 'from-fuchsia-400/70 to-fuchsia-600/70', blocks: [10, 8, 14, 9, 12, 7] },
    { name: 'B-roll', color: 'from-sky-400/70 to-sky-600/70', blocks: [0, 20, 0, 18, 0] },
    { name: 'Music', color: 'from-emerald-400/70 to-emerald-600/70', blocks: [100] },
  ];
  return (
    <div className={tile}>
      <TileHead icon={Layers} title="A real timeline underneath">
        Every cut Click makes is a clip on a multi-track timeline. Move it, trim it or delete it, the same as in any editor.
      </TileHead>
      <div className="mt-auto rounded-xl bg-surface-900/[0.04] dark:bg-white/[0.04] border border-surface-900/5 dark:border-white/5 p-3" aria-hidden="true">
        <div className="flex justify-between pl-12 pr-0.5 mb-8 text-[9px] tabular-nums text-surface-400 dark:text-slate-500">
          {['0:00', '0:15', '0:30', '0:45'].map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="relative space-y-1.5">
          {tracks.map((t) => (
            <div key={t.name} className="flex items-center gap-2">
              <span className="w-10 text-[9px] font-bold uppercase tracking-wider text-surface-500 dark:text-slate-400">{t.name}</span>
              <div className="flex-1 flex gap-[3px] h-7">
                {t.blocks.map((b, i) =>
                  b === 0 ? (
                    <span key={i} className="h-full" style={{ flexGrow: 16, flexBasis: 0 }} />
                  ) : (
                    <span
                      key={i}
                      className={`relative h-full rounded bg-gradient-to-b ${t.color} ${t.name === 'Video' && i === 2 ? 'ring-2 ring-white shadow-[0_0_0_4px_rgba(99,102,241,0.35)]' : ''}`}
                      style={{ flexGrow: b, flexBasis: 0 }}
                    >
                      {t.name === 'Video' && i === 2 && (
                        <>
                          <span className="absolute left-0 inset-y-0 w-1.5 rounded-l bg-white" />
                          <span className="absolute right-0 inset-y-0 w-1.5 rounded-r bg-white" />
                          <span className="absolute -top-7 left-1/2 -ml-[26px] w-[52px] text-center px-1.5 py-0.5 rounded-md bg-surface-900 dark:bg-white text-[9px] font-bold text-white dark:text-black">
                            Trim
                          </span>
                        </>
                      )}
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
          <span className="absolute top-[-6px] bottom-[-6px] left-[62%] w-[2px] rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
        </div>
      </div>
    </div>
  );
}

export function EditorCraft() {
  return (
    <section id="editor" aria-labelledby="editor-heading" className="py-20 md:py-28 px-4 sm:px-6 font-inter scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-500 mb-4">The editor</p>
          <h2 id="editor-heading" className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.98] text-balance text-surface-900 dark:text-white mb-5">
            Built for short-form, not adapted to it
          </h2>
          <p className="text-surface-600 dark:text-slate-300 text-base md:text-lg leading-relaxed">
            The things you would do by hand in a desktop editor, with short-form defaults already set. Change anything you like.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          <CaptionsTile />
          <GradeTile />
          <ClipsTile />
          <ReframeTile />
          <TimelineTile />
        </div>
      </div>
    </section>
  );
}
