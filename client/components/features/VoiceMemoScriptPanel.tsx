'use client'

import { useEffect, useRef, useState } from 'react'
import { handleApiError } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { platformLabel } from './platformLabel'
import {
  transcribeMemo, writeMemoScript, saveMemoScript,
  type Platform, type ScriptFormat, type MemoScriptResult, type SavedMemoScript,
} from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'linkedin', 'facebook']
const FORMATS: ScriptFormat[] = ['short', 'long']
// The memo is a quick brain-dump, not a take — stop recording at 2 minutes.
const MAX_RECORD_SECONDS = 120

const canRecord = () =>
  typeof window !== 'undefined' &&
  typeof (window as any).MediaRecorder !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Voice Memo → Script: record (or upload) a 2-minute brain-dump, review the
 * transcript, and get a # Hook / # Body / # CTA script with a QA checklist.
 */
export default function VoiceMemoScriptPanel() {
  const { t } = useTranslation()
  const formatLabels: Record<string, string> = {
    short: t('creatorTools.voiceMemo.formatShort'),
    long: t('creatorTools.voiceMemo.formatLong'),
  }
  const [memo, setMemo] = useState('')
  const [platform, setPlatform] = useState<Platform>('tiktok')
  const [format, setFormat] = useState<ScriptFormat>('short')
  const [result, setResult] = useState<MemoScriptResult | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [writing, setWriting] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [recordable, setRecordable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<SavedMemoScript | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setRecordable(canRecord())
    return () => stopTracks()
  }, [])

  function stopTracks() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function transcribe(audio: Blob, filename: string) {
    setTranscribing(true); setError(null)
    try {
      const { transcript } = await transcribeMemo(audio, filename)
      setMemo(transcript)
    } catch (e) {
      setError(handleApiError(e) || t('creatorTools.voiceMemo.transcribeFailed'))
    } finally {
      setTranscribing(false)
    }
  }

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data) }
      recorder.onstop = () => {
        stopTracks()
        setRecording(false)
        const type = recorder.mimeType || 'audio/webm'
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        transcribe(new Blob(chunks, { type }), `memo.${ext}`)
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setElapsed(0)
      const startedAt = Date.now()
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000)
        setElapsed(s)
        if (s >= MAX_RECORD_SECONDS) stopRecording()
      }, 1000)
    } catch {
      stopTracks()
      setError(t('creatorTools.voiceMemo.micBlocked'))
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) transcribe(file, file.name)
  }

  async function write() {
    if (!memo.trim()) { setError(t('creatorTools.voiceMemo.memoRequired')); return }
    setWriting(true); setError(null); setCopied(false); setSaved(null)
    try {
      setResult(await writeMemoScript({ memo, platform, format }))
    } catch (e) {
      setError(handleApiError(e) || t('creatorTools.voiceMemo.writeFailed'))
    } finally {
      setWriting(false)
    }
  }

  async function save(requestApproval: boolean) {
    if (!result) return
    setSaving(true); setError(null)
    try {
      setSaved(await saveMemoScript({ script: result.script, format: result.format, requestApproval }))
    } catch (e) {
      setError(handleApiError(e) || t('creatorTools.voiceMemo.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function copyMarkdown() {
    if (!result) return
    try { await navigator.clipboard?.writeText(result.markdown); setCopied(true) } catch { /* ignore */ }
  }

  function downloadMarkdown() {
    if (!result || typeof URL.createObjectURL !== 'function') return
    const url = URL.createObjectURL(new Blob([result.markdown], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'script.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const busy = transcribing || writing

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.voiceMemo.title')}</h2>
        <p className="text-xs text-theme-muted">{t('creatorTools.voiceMemo.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {recordable && (
          recording ? (
            <button
              type="button" data-testid="memo-stop" onClick={stopRecording}
              className="rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white"
            >
              {t('creatorTools.voiceMemo.stop', { elapsed: fmtClock(elapsed), max: fmtClock(MAX_RECORD_SECONDS) })}
            </button>
          ) : (
            <button
              type="button" data-testid="memo-record" onClick={startRecording} disabled={busy}
              className="rounded-lg border border-strong px-3 py-1.5 text-sm text-theme-primary disabled:opacity-50"
            >
              {t('creatorTools.voiceMemo.record')}
            </button>
          )
        )}
        <label className="cursor-pointer rounded-lg border border-strong px-3 py-1.5 text-sm text-theme-primary">
          {t('creatorTools.voiceMemo.uploadAudio')}
          <input
            data-testid="memo-file" type="file" accept="audio/*" onChange={onFile}
            disabled={busy || recording} className="sr-only"
          />
        </label>
        {transcribing && <span data-testid="memo-transcribing" className="text-xs text-theme-secondary">{t('creatorTools.voiceMemo.transcribing')}</span>}
      </div>

      <textarea
        data-testid="memo-input"
        aria-label={t('creatorTools.voiceMemo.transcriptLabel')}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={4}
        placeholder={t('creatorTools.voiceMemo.transcriptPlaceholder')}
        className="w-full rounded-lg bg-background border border-default p-2 text-sm text-theme-primary"
      />
      <div className="flex gap-2">
        <select
          data-testid="memo-platform" aria-label={t('creatorTools.common.platform')} value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{platformLabel(t, p)}</option>)}
        </select>
        <select
          data-testid="memo-format" aria-label={t('creatorTools.common.format')} value={format}
          onChange={(e) => setFormat(e.target.value as ScriptFormat)}
          className="rounded bg-background border border-default p-1 text-sm text-theme-primary"
        >
          {FORMATS.map((f) => <option key={f} value={f}>{formatLabels[f] ?? f}</option>)}
        </select>
      </div>
      <button
        type="button"
        data-testid="memo-run"
        onClick={write}
        disabled={busy || recording}
        className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {writing ? t('creatorTools.voiceMemo.writing') : t('creatorTools.voiceMemo.writeScript')}
      </button>

      {error && <p data-testid="memo-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div data-testid="memo-result" className="space-y-3">
          <div className="rounded-lg bg-background border border-default p-3 space-y-2 text-sm text-theme-primary">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">{t('creatorTools.voiceMemo.hook')}</p>
            <p data-testid="memo-hook">{result.script.hook}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">{t('creatorTools.voiceMemo.body')}</p>
            <ol className="list-decimal space-y-1 pl-5" data-testid="memo-body">
              {result.script.body.map((beat, i) => <li key={i}>{beat}</li>)}
            </ol>
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-400">{t('creatorTools.voiceMemo.cta')}</p>
            <p data-testid="memo-cta">{result.script.cta}</p>
            {result.script.brollCues.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">{t('creatorTools.voiceMemo.brollCues')}</p>
                <ul className="list-disc space-y-1 pl-5 text-theme-secondary">
                  {result.script.brollCues.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </>
            )}
          </div>

          <div data-testid="memo-qa" className="space-y-1">
            <p className="text-xs text-theme-secondary">
              {result.qa.passed
                ? t('creatorTools.voiceMemo.qaPassed', { seconds: result.qa.estimatedSeconds })
                : t('creatorTools.voiceMemo.qaNeedsLook', { seconds: result.qa.estimatedSeconds })}
            </p>
            <ul className="space-y-1">
              {result.qa.checks.map((c) => (
                <li key={c.id} data-testid="memo-qa-item" className={`text-xs ${c.ok ? 'text-theme-secondary' : 'text-amber-600 dark:text-amber-400'}`}>
                  {c.ok ? '✓' : '!'} {c.message}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <button
              type="button" data-testid="memo-copy" onClick={copyMarkdown}
              className="text-xs text-theme-secondary hover:text-theme-primary"
            >
              {copied ? t('creatorTools.common.copied') : t('creatorTools.voiceMemo.copyMarkdown')}
            </button>
            <button
              type="button" data-testid="memo-download" onClick={downloadMarkdown}
              className="text-xs text-theme-secondary hover:text-theme-primary"
            >
              {t('creatorTools.voiceMemo.downloadMarkdown')}
            </button>
          </div>

          {saved ? (
            <div data-testid="memo-saved" className="space-y-1 text-xs">
              <p className="text-theme-secondary">
                {t('creatorTools.voiceMemo.saved')}{' '}<a href={`/dashboard/scripts/${saved.scriptId}`} className="underline hover:text-theme-primary">{t('creatorTools.voiceMemo.openInScripts')}</a>
                {saved.approvalId && (
                  <> · <a href="/dashboard/approvals" className="underline hover:text-theme-primary">{t('creatorTools.voiceMemo.waitingSignOff')}</a></>
                )}
              </p>
              {saved.approvalError && <p className="text-amber-600 dark:text-amber-400">{saved.approvalError}</p>}
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button" data-testid="memo-approve" onClick={() => save(true)} disabled={saving}
                className="rounded-lg bg-primary hover:bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? t('creatorTools.voiceMemo.saving') : t('creatorTools.voiceMemo.sendForApproval')}
              </button>
              <button
                type="button" data-testid="memo-save" onClick={() => save(false)} disabled={saving}
                className="rounded-lg border border-strong px-3 py-1.5 text-xs text-theme-primary disabled:opacity-50"
              >
                {t('creatorTools.voiceMemo.saveToScripts')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
