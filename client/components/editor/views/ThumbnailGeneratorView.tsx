'use client'

import React, { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { getMediaUrl } from '../../../utils/url'
import {
  ImageDown, Sparkles, Zap, Film, CheckCircle2,
  Download, RefreshCw, Type, Star, Camera, type LucideIcon
} from 'lucide-react'
import { apiPost } from '../../../lib/api'
import { Panel, Button, Badge, Input, FormField, SectionHeader } from '../../ui'
import { useTranslation } from '../../../hooks/useTranslation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThumbnailGeneratorViewProps {
  videoUrl?: string
  videoId?: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

/** Shape of POST /video/creative/thumbnail (server/routes/video/creative.js). */
interface ThumbnailApiResponse {
  success?: boolean
  thumbnailUrl?: string
  variants?: unknown[]
  message?: string
  error?: string
}

interface GeneratedThumbnail {
  url: string
  /** true when the server rendered it from the source video; false when it saved the captured frame. */
  renderedFromVideo: boolean
}

// Frame-picking tips (advice only — they don't change what the server renders).
const TIPS: { id: string; labelKey: string; tipKey: string; icon: LucideIcon }[] = [
  { id: 'action', labelKey: 'thumbnailGenerator.tipActionLabel', tipKey: 'thumbnailGenerator.tipAction', icon: Zap },
  { id: 'wide', labelKey: 'thumbnailGenerator.tipWideLabel', tipKey: 'thumbnailGenerator.tipWide', icon: Film },
  { id: 'face', labelKey: 'thumbnailGenerator.tipFaceLabel', tipKey: 'thumbnailGenerator.tipFace', icon: Star },
  { id: 'clean', labelKey: 'thumbnailGenerator.tipCleanLabel', tipKey: 'thumbnailGenerator.tipClean', icon: Type },
]

// ── Component ─────────────────────────────────────────────────────────────────

const ThumbnailGeneratorView: React.FC<ThumbnailGeneratorViewProps> = ({
  videoUrl, videoId, showToast,
}) => {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [capturedFrame, setCapturedFrame] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedThumbnail | null>(null)
  const [scrubTime, setScrubTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)

  // ── Capture frame from video at scrubTime ────────────────────────────────────
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    video.onseeked = () => {
      try {
        canvas.width = video.videoWidth || 1280
        canvas.height = video.videoHeight || 720
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no 2d context')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        setCapturedFrame(dataUrl)
        setGenerated(null)
        showToast(t('thumbnailGenerator.frameCaptured'), 'success')
      } catch {
        showToast(t('thumbnailGenerator.captureFailed'), 'error')
      }
    }
    video.currentTime = scrubTime
  }, [scrubTime, showToast, t])

  // ── Generate thumbnail via the real API ───────────────────────────────────────
  const generateThumbnail = async () => {
    if (!capturedFrame) { showToast(t('thumbnailGenerator.captureFirst'), 'error'); return }
    setGenerating(true)
    try {
      const res = await apiPost<ThumbnailApiResponse>('/video/creative/thumbnail', {
        videoId,
        frameDataUrl: capturedFrame,
        title: title.trim() || undefined,
      })
      if (!res?.success || !res.thumbnailUrl) {
        throw new Error(res?.error || t('thumbnailGenerator.generateFailed'))
      }
      const renderedFromVideo = Array.isArray(res.variants)
      setGenerated({ url: getMediaUrl(res.thumbnailUrl), renderedFromVideo })
      showToast(
        renderedFromVideo
          ? t('thumbnailGenerator.renderedFromVideo')
          : title.trim() ? t('thumbnailGenerator.savedFrameNoTitle') : t('thumbnailGenerator.savedFrame'),
        'success'
      )
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      showToast(e?.response?.data?.error || e?.message || t('thumbnailGenerator.generateFailed'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────────
  const downloadThumbnail = () => {
    if (!generated) return
    const a = document.createElement('a')
    a.href = generated.url
    a.download = `thumbnail-${Date.now()}.jpg`
    a.click()
  }

  return (
    <div className="space-y-6 pb-10 ds-anim-rise">
      {/* Header */}
      <Badge variant="outline" className="gap-2 border-orange-500/30 text-orange-500">
        <ImageDown className="h-3.5 w-3.5" aria-hidden />
        {t('thumbnailGenerator.badge')}
      </Badge>
      <SectionHeader
        as="h1"
        title={t('thumbnailGenerator.title')}
        description={t('thumbnailGenerator.description')}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">

        {/* Left — Frame Picker */}
        <div className="space-y-6">

          {/* Hidden video + canvas (used for frame capture) */}
          {videoUrl && (
            <>
              <video
                ref={videoRef}
                src={getMediaUrl(videoUrl || '')}
                className="hidden"
                crossOrigin="anonymous"
                preload="metadata"
                onLoadedMetadata={e => {
                  const d = e.currentTarget.duration
                  if (Number.isFinite(d) && d > 0) setVideoDuration(d)
                }}
              />
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}

          {/* Frame preview card */}
          <Panel variant="glass" className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-orange-500" aria-hidden />
              <span className="ds-text-label text-theme-primary">{t('thumbnailGenerator.framePicker')}</span>
            </div>

            {/* Preview */}
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl ds-surface-subtle">
              {capturedFrame ? (
                <Image src={capturedFrame} alt={t('thumbnailGenerator.capturedFrameAlt')} fill className="object-cover" unoptimized />
              ) : (
                <div className="flex flex-col items-center gap-3 text-theme-muted">
                  <Camera className="h-12 w-12" aria-hidden />
                  <p className="ds-text-caption">
                    {videoUrl ? t('thumbnailGenerator.scrubHint') : t('thumbnailGenerator.loadVideoFirst')}
                  </p>
                </div>
              )}
            </div>

            {/* Scrubber */}
            {videoUrl && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="ds-text-caption text-theme-muted">{t('thumbnailGenerator.scrubToFrame')}</span>
                  <span className="font-mono text-xs font-semibold text-indigo-500">
                    {Math.floor(scrubTime / 60)}:{String(Math.floor(scrubTime % 60)).padStart(2, '0')}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={videoDuration > 0 ? videoDuration : 300}
                  step={0.1}
                  value={scrubTime}
                  onChange={e => setScrubTime(parseFloat(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-input accent-orange-500"
                  title={t('thumbnailGenerator.frameScrubber')}
                  aria-label={t('thumbnailGenerator.frameScrubber')}
                />
                <Button
                  onClick={captureFrame}
                  className="w-full"
                  leftIcon={<Camera className="h-4 w-4" aria-hidden />}
                >
                  {t('thumbnailGenerator.captureFrame')}
                </Button>
              </div>
            )}

            {/* Title input */}
            <FormField label={t('thumbnailGenerator.titleLabel')} htmlFor="thumb-title">
              <Input
                id="thumb-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('thumbnailGenerator.titlePlaceholder')}
                title={t('thumbnailGenerator.titleLabel')}
              />
            </FormField>
          </Panel>
        </div>

        {/* Right — Generate + Output */}
        <div className="space-y-6">

          {/* Generate button */}
          <Button
            onClick={generateThumbnail}
            disabled={!capturedFrame || generating}
            loading={generating}
            size="lg"
            className="w-full"
            leftIcon={!generating ? <Sparkles className="h-5 w-5" aria-hidden /> : undefined}
          >
            {generating ? t('thumbnailGenerator.generating') : t('thumbnailGenerator.generate')}
          </Button>

          {/* Output panel — the image the server actually returned */}
          {generated && (
            <Panel variant="glass" className="space-y-5 p-6 ds-anim-rise">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                <span className="ds-text-label text-theme-primary">
                  {generated.renderedFromVideo ? t('thumbnailGenerator.resultRendered') : t('thumbnailGenerator.resultSavedFrame')}
                </span>
              </div>

              {/* Preview */}
              <div className="relative aspect-video overflow-hidden rounded-xl border border-subtle">
                <Image src={generated.url} alt={t('thumbnailGenerator.generatedAlt')} fill className="object-cover" unoptimized />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={downloadThumbnail}
                  className="flex-1"
                  leftIcon={<Download className="h-4 w-4" aria-hidden />}
                >
                  {t('thumbnailGenerator.download')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setGenerated(null); setCapturedFrame(null) }}
                  className="flex-1"
                  leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
                >
                  {t('thumbnailGenerator.newFrame')}
                </Button>
              </div>
            </Panel>
          )}

          {/* Tips card */}
          <Panel variant="glass" className="space-y-3 p-6">
            <p className="ds-text-caption text-theme-muted">{t('thumbnailGenerator.tipsTitle')}</p>
            {TIPS.map(({ id, labelKey, tipKey, icon: TipIcon }) => (
              <div key={id} className="flex items-start gap-3 py-1.5">
                <TipIcon className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" aria-hidden />
                <div>
                  <p className="ds-text-label text-theme-primary">{t(labelKey)}</p>
                  <p className="text-xs text-theme-muted">{t(tipKey)}</p>
                </div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  )
}

export default ThumbnailGeneratorView
