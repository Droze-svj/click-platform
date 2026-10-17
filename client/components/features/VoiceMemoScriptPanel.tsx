'use client'

import { useEffect, useRef, useState } from 'react'
import { handleApiError } from '@/lib/api'
import {
  transcribeMemo, writeMemoScript, saveMemoScript,
  type Platform, type ScriptFormat, type MemoScriptResult, type SavedMemoScript,
} from '@/lib/featuresApi'

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'linkedin', 'facebook']
const FORMATS: { value: ScriptFormat; label: string }[] = [
  { value: 'short', label: 'Short-form' },
  { value: 'long', label: 'Long-form' },
]
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
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function transcribe(audio: Blob, filename: string) {
    setTranscribing(true); setError(null)
    try {
      const { transcript } = await transcribeMemo(audio, filename)
      setMemo(transcript)
    } catch (e) {
      setError(handleApiError(e) || 'Could not transcribe that memo')
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
      setError('Microphone access was blocked. Allow it, or upload a memo instead.')
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
    if (!memo.trim()) { setError('Record a memo or type your raw thoughts first.'); return }
    setWriting(true); setError(null); setCopied(false); setSaved(null)
    try {
      setResult(await writeMemoScript({ memo, platform, format }))
    } catch (e) {
      setError(handleApiError(e) || 'Failed to write the script')
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
      setError(handleApiError(e) || 'Failed to save the script')
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
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-white">Voice memo → script</h2>
        <p className="text-xs text-zinc-500">Brain-dump for up to 2 minutes. Get a hook, body and CTA you can record.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {recordable && (
          recording ? (
            <button
              type="button" data-testid="memo-stop" onClick={stopRecording}
              className="rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white"
            >
              ■ Stop · {fmtClock(elapsed)} / {fmtClock(MAX_RECORD_SECONDS)}
            </button>
          ) : (
            <button
              type="button" data-testid="memo-record" onClick={startRecording} disabled={busy}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50"
            >
              ● Record memo
            </button>
          )
        )}
        <label className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200">
          Upload audio
          <input
            data-testid="memo-file" type="file" accept="audio/*" onChange={onFile}
            disabled={busy || recording} className="sr-only"
          />
        </label>
        {transcribing && <span data-testid="memo-transcribing" className="text-xs text-zinc-400">Transcribing…</span>}
      </div>

      <textarea
        data-testid="memo-input"
        aria-label="Memo transcript"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={4}
        placeholder="Your memo transcript appears here. Or just type your raw thoughts."
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <div className="flex gap-2">
        <select
          data-testid="memo-platform" aria-label="Platform" value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          data-testid="memo-format" aria-label="Format" value={format}
          onChange={(e) => setFormat(e.target.value as ScriptFormat)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-sm text-zinc-200"
        >
          {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <button
        type="button"
        data-testid="memo-run"
        onClick={write}
        disabled={busy || recording}
        className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {writing ? 'Writing…' : 'Write script'}
      </button>

      {error && <p data-testid="memo-error" className="text-sm text-red-400">{error}</p>}

      {result && (
        <div data-testid="memo-result" className="space-y-3">
          <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 space-y-2 text-sm text-zinc-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">Hook</p>
            <p data-testid="memo-hook">{result.script.hook}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">Body</p>
            <ol className="list-decimal space-y-1 pl-5" data-testid="memo-body">
              {result.script.body.map((beat, i) => <li key={i}>{beat}</li>)}
            </ol>
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-400">CTA</p>
            <p data-testid="memo-cta">{result.script.cta}</p>
            {result.script.brollCues.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">B-roll cues</p>
                <ul className="list-disc space-y-1 pl-5 text-zinc-400">
                  {result.script.brollCues.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </>
            )}
          </div>

          <div data-testid="memo-qa" className="space-y-1">
            <p className="text-xs text-zinc-400">
              QA {result.qa.passed ? 'passed' : 'needs a look'} · ~{result.qa.estimatedSeconds}s spoken
            </p>
            <ul className="space-y-1">
              {result.qa.checks.map((c) => (
                <li key={c.id} data-testid="memo-qa-item" className={`text-xs ${c.ok ? 'text-zinc-400' : 'text-amber-400'}`}>
                  {c.ok ? '✓' : '!'} {c.message}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <button
              type="button" data-testid="memo-copy" onClick={copyMarkdown}
              className="text-xs text-zinc-400 hover:text-white"
            >
              {copied ? 'Copied ✓' : 'Copy script.md'}
            </button>
            <button
              type="button" data-testid="memo-download" onClick={downloadMarkdown}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Download script.md
            </button>
          </div>

          {saved ? (
            <div data-testid="memo-saved" className="space-y-1 text-xs">
              <p className="text-zinc-300">
                Saved. <a href={`/dashboard/scripts/${saved.scriptId}`} className="underline hover:text-white">Open in Scripts</a>
                {saved.approvalId && (
                  <> · <a href="/dashboard/approvals" className="underline hover:text-white">Waiting for your sign-off in Approvals</a></>
                )}
              </p>
              {saved.approvalError && <p className="text-amber-400">{saved.approvalError}</p>}
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button" data-testid="memo-approve" onClick={() => save(true)} disabled={saving}
                className="rounded-lg bg-green-500/90 px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Send for approval'}
              </button>
              <button
                type="button" data-testid="memo-save" onClick={() => save(false)} disabled={saving}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
              >
                Save to Scripts
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
