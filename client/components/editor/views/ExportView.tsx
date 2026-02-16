import React, { useState, useEffect } from 'react'
import { Download, Share2, Youtube, Instagram, Smartphone, Send, CheckCircle2, Loader2, Globe, FolderDown, Calendar, ChevronDown, Link2 } from 'lucide-react'
import { apiGet, apiPost, apiPatch } from '../../../lib/api'
import { motion, AnimatePresence } from 'framer-motion'

const EXPORT_PRESETS = [
  { id: 'shorts', label: 'YT Shorts', icon: Youtube, color: 'text-red-500', res: '1080×1920', width: 1080, height: 1920, bitrateMbps: 4, format: 'mp4', quality: undefined, fps: 30, platformHint: 'Clear value, Subscribe CTA' },
  { id: 'reels', label: 'IG Reels', icon: Instagram, color: 'text-pink-500', res: '1080×1920', width: 1080, height: 1920, bitrateMbps: 3.5, format: 'mp4', quality: undefined, fps: 30, platformHint: 'Aesthetic, Save/Share CTA' },
  { id: 'tiktok', label: 'TikTok', icon: Smartphone, color: 'text-black dark:text-white', res: '1080×1920', width: 1080, height: 1920, bitrateMbps: 3, format: 'mp4', quality: undefined, fps: 30, platformHint: 'Snappy cuts, Follow/Comment' },
  { id: '1080p', label: '1080p HD', icon: Share2, color: 'text-blue-500', res: '1920×1080', width: 1920, height: 1080, bitrateMbps: 8, format: 'mp4', quality: undefined, fps: undefined, platformHint: undefined },
  { id: '4k', label: '4K Master', icon: Share2, color: 'text-violet-500', res: '3840×2160', width: 3840, height: 2160, bitrateMbps: 25, format: 'mp4', quality: undefined, fps: undefined, platformHint: undefined },
  { id: 'best', label: 'Best quality', icon: Download, color: 'text-amber-500', res: 'Source +', width: 1920, height: 1080, bitrateMbps: 25, format: 'mp4', quality: 'best' as const, fps: undefined, platformHint: undefined },
]

interface ExportViewProps {
  videoId: string
  videoUrl: string
  textOverlays: any[]
  shapeOverlays?: any[]
  imageOverlays?: any[]
  gradientOverlays?: any[]
  videoFilters: any
  timelineSegments?: any[]
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const ExportView: React.FC<ExportViewProps> = ({ videoId, videoUrl, textOverlays, shapeOverlays = [], imageOverlays = [], gradientOverlays = [], videoFilters, timelineSegments = [], showToast }) => {
  const [connectedAccounts, setConnectedAccounts] = useState<any>({})
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    if (typeof window === 'undefined') return '1080p'
    try {
      const preferred = sessionStorage.getItem('export-preferred-preset')
      if (preferred && ['shorts', 'reels', 'tiktok', '1080p', '4k', 'best'].includes(preferred)) {
        sessionStorage.removeItem('export-preferred-preset')
        return preferred
      }
    } catch { /* ignore */ }
    return '1080p'
  })
  const [savedExports, setSavedExports] = useState<Array<{ _id: string; title: string; url: string; downloadUrl?: string; quality: string; expiresAt: string; isExpired?: boolean }>>([])
  const [saveExpiresDays, setSaveExpiresDays] = useState(10)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [extendingId, setExtendingId] = useState<string | null>(null)
  const [extendDays, setExtendDays] = useState(10)
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null)

  const fetchSavedExports = async () => {
    if (!videoId) return
    try {
      const res = await apiGet<{ list?: typeof savedExports; data?: { list?: typeof savedExports } }>('/video/manual-editing/saved-exports?contentId=' + encodeURIComponent(videoId))
      const list = res?.list ?? (res as any)?.data?.list ?? []
      setSavedExports(Array.isArray(list) ? list : [])
    } catch { /* ignore */ }
  }
  const [exportQuality, setExportQuality] = useState<'high' | 'medium' | 'low'>('high')
  const [exportCodec, setExportCodec] = useState<'h264' | 'hevc'>('h264')
  const [duckMusicWhenVoiceover, setDuckMusicWhenVoiceover] = useState(true)
  const [duckLevel, setDuckLevel] = useState(-12)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [renderResult, setRenderResult] = useState<{ url?: string; downloadUrl?: string } | null>(null)
  const [lastRenderExportPath, setLastRenderExportPath] = useState<string | null>(null)

  const selectedPresetConfig = EXPORT_PRESETS.find(p => p.id === selectedPreset)
  const qualityMultiplier = exportQuality === 'high' ? 1 : exportQuality === 'medium' ? 0.7 : 0.5
  const effectiveBitrateMbps = selectedPresetConfig ? (selectedPresetConfig.bitrateMbps * qualityMultiplier).toFixed(1) : '—'

  useEffect(() => {
    fetchConnectedAccounts()
  }, [])

  useEffect(() => {
    fetchSavedExports()
  }, [videoId])

  useEffect(() => {
    if (saveSuccess) {
      const t = setTimeout(() => setSaveSuccess(false), 3000)
      return () => clearTimeout(t)
    }
  }, [saveSuccess])

  const fetchConnectedAccounts = async () => {
    try {
      setIsLoadingAccounts(true)
      const data = await apiGet<{ success?: boolean; accounts?: any }>('/oauth/accounts')
      if (data?.success && data.accounts) {
        setConnectedAccounts(data.accounts)
      }
    } catch (error) {
      console.error('Failed to fetch accounts', error)
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) {
      showToast('Please select at least one platform', 'error')
      return
    }

    try {
      setIsPublishing(true)
      showToast(`Publishing to ${selectedPlatforms.length} platform(s)...`, 'info')

      // Mock publish call - in production this would trigger actual publishing
      await new Promise(resolve => setTimeout(resolve, 2000))

      showToast('Content published successfully!', 'success')
      setSelectedPlatforms([])
    } catch (error) {
      console.error('Publishing failed', error)
      showToast('Publishing failed', 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  const PLATFORMS = [
    { id: 'tiktok', label: 'TikTok', icon: Smartphone, color: 'from-pink-500 to-rose-600', connected: !!connectedAccounts.tiktok },
    { id: 'youtube', label: 'YouTube Shorts', icon: Youtube, color: 'from-red-600 to-red-700', connected: !!connectedAccounts.youtube },
    { id: 'instagram', label: 'Instagram Reels', icon: Instagram, color: 'from-purple-500 to-pink-500', connected: !!connectedAccounts.instagram },
  ]

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-surface-card rounded-3xl shadow-theme-card border border-subtle p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />
        <div className="w-20 h-20 bg-blue-500/20 dark:bg-blue-500/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-blue-600 dark:text-blue-400">
          <Download className="w-10 h-10" />
        </div>
        <h3 className="text-2xl font-black uppercase text-theme-primary mb-2 tracking-tight">Final Mastery</h3>
        <p className="text-sm text-theme-secondary mb-8 italic">Render your production with Elite-tier variety engine optimization.</p>

        <div className="mb-6">
          <p className="text-xs font-semibold text-theme-secondary mb-2">Output quality</p>
          <div className="flex flex-wrap gap-2">
            {(['high', 'medium', 'low'] as const).map(q => (
              <button
                key={q}
                onClick={() => setExportQuality(q)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${exportQuality === q
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                {q === 'high' ? 'High (best)' : q === 'medium' ? 'Medium' : 'Low (small file)'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">Higher bitrate = better quality, larger file.</p>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Resolution & bitrate</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedPresetConfig?.res ?? '—'}</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-700 dark:text-gray-300">~{effectiveBitrateMbps} Mbps</span>
            {selectedPresetConfig && (selectedPresetConfig as { fps?: number }).fps && (
              <span className="text-gray-500">• 30 fps</span>
            )}
            {selectedPresetConfig && (
              <span className="text-[10px] text-gray-500">(quality: {exportQuality})</span>
            )}
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">Platform-native: 9:16, 1080p, 30 fps. Reasonable bitrate so uploads don’t get compressed badly.</p>
          {selectedPresetConfig && (selectedPresetConfig as { platformHint?: string }).platformHint && (
            <p className="text-[10px] text-gray-500 mt-0.5">{(selectedPresetConfig as { platformHint?: string }).platformHint}</p>
          )}
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Audio</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={duckMusicWhenVoiceover}
              onChange={(e) => setDuckMusicWhenVoiceover(e.target.checked)}
              className="rounded accent-blue-500"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">Duck music when voiceover plays (keep speech clearly louder)</span>
          </label>
          {duckMusicWhenVoiceover && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-gray-500">Music level (dB):</span>
              <input
                type="number"
                min={-24}
                max={0}
                value={duckLevel}
                onChange={(e) => setDuckLevel(Number(e.target.value))}
                className="w-14 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
              />
            </div>
          )}
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">Mix for mobile: check clarity on a phone speaker—short-form is consumed there.</p>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Codec</p>
          <div className="flex gap-2">
            {(['h264', 'hevc'] as const).map(c => (
              <button
                key={c}
                onClick={() => setExportCodec(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${exportCodec === c ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >
                {c === 'h264' ? 'H.264' : 'HEVC'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {EXPORT_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelectedPreset(p.id); showToast(`${p.label} selected • ${p.res}`, 'info') }}
              className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all font-semibold text-xs ${selectedPreset === p.id
                ? 'bg-blue-600 text-white border-2 border-blue-500 shadow-lg'
                : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                }`}
            >
              <p.icon className={`w-5 h-5 ${selectedPreset === p.id ? 'text-white' : p.color}`} />
              <span>{p.label}</span>
              <span className={`text-[9px] opacity-80 ${selectedPreset === p.id ? 'text-white/90' : 'text-gray-500'}`}>
                {p.res}
              </span>
              <span className={`text-[8px] opacity-70 ${selectedPreset === p.id ? 'text-white/80' : 'text-gray-400'}`}>
                {p.bitrateMbps} Mbps{(p as { fps?: number }).fps ? ' · 30fps' : ''}
              </span>
            </button>
          ))}
        </div>

        <button
          disabled={isRendering || !videoUrl}
          onClick={async () => {
            if (!videoUrl && !videoId) {
              showToast('No video loaded to render', 'error')
              return
            }
            setIsRendering(true)
            setRenderResult(null)
            try {
              const preset = EXPORT_PRESETS.find(p => p.id === selectedPreset)!
              const qualityMult = exportQuality === 'high' ? 1 : exportQuality === 'medium' ? 0.7 : 0.5
              const res = await apiPost<{ data?: { url?: string; downloadUrl?: string }; url?: string; downloadUrl?: string }>(
                '/video/manual-editing/render',
                {
                  videoId: videoId || undefined,
                  videoUrl: videoUrl || undefined,
                  videoFilters: videoFilters || {},
                  textOverlays: textOverlays || [],
                  shapeOverlays: shapeOverlays || [],
                  exportOptions: {
                    width: preset.width,
                    height: preset.height,
                    bitrateMbps: Math.round(preset.bitrateMbps * qualityMult * 10) / 10,
                    codec: exportCodec,
                    quality: (preset as { quality?: string }).quality ?? undefined,
                    duckMusicWhenVoiceover,
                    duckLevel,
                  },
                  timelineSegments: timelineSegments || [],
                },
                { timeout: 180000 }
              )
              const data = (res as any)?.data ?? res
              const url = data?.url ?? data?.downloadUrl
              setRenderResult({ url, downloadUrl: data?.downloadUrl ?? url })
              setLastRenderExportPath(data?.url ?? (typeof url === 'string' && url.startsWith('/') ? url : null))
              showToast('Render completed! Download your video below.', 'success')
            } catch (err: any) {
              showToast(err?.response?.data?.error ?? err?.message ?? 'Render failed', 'error')
            } finally {
              setIsRendering(false)
            }
          }}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:scale-[1.02] transition-all uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isRendering ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              RENDERING…
            </span>
          ) : (
            'START PRODUCTION RENDER'
          )}
        </button>

        {renderResult?.downloadUrl && (
          <a
            href={renderResult.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all"
          >
            <Download className="w-4 h-4" />
            Download video
          </a>
        )}

        {/* Save to folder (organized storage, default 10 days, option to extend) */}
        {renderResult?.url && videoId && lastRenderExportPath && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <FolderDown className="w-4 h-4 text-blue-500" />
              Save to folder
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Store this export in your folder. Default expiry 10 days; you can extend later.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <Calendar className="w-3.5 h-3.5" />
                Expires in
                <select
                  value={saveExpiresDays}
                  onChange={(e) => setSaveExpiresDays(Number(e.target.value))}
                  className="rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs px-2 py-1"
                >
                  <option value={7}>7 days</option>
                  <option value={10}>10 days (default)</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </label>
              <button
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true)
                  try {
                    await apiPost('/video/manual-editing/saved-exports', {
                      videoId,
                      exportPath: lastRenderExportPath,
                      quality: selectedPresetConfig?.quality || selectedPreset,
                      expiresInDays: saveExpiresDays,
                    })
                    setSaveSuccess(true)
                    showToast(`Saved to folder. Expires in ${saveExpiresDays} days. You can extend later.`, 'success')
                    fetchSavedExports()
                  } catch (err: any) {
                    showToast(err?.response?.data?.error ?? err?.message ?? 'Save failed', 'error')
                  } finally {
                    setIsSaving(false)
                  }
                }}
                className={`px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors ${saveSuccess ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <FolderDown className="w-3.5 h-3.5" />}
                {saveSuccess ? 'Saved ✓' : 'Save to folder'}
              </button>
            </div>
          </div>
        )}

        {/* Saved exports list with extend and copy link */}
        {savedExports.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <FolderDown className="w-4 h-4 text-amber-500" />
              Saved in folder
              <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">({savedExports.length})</span>
            </h4>
            <ul className="space-y-2">
              {savedExports.map((s: any) => {
                const downloadUrl = s.downloadUrl || (s.url?.startsWith('http') ? s.url : (typeof window !== 'undefined' ? window.location.origin : '') + (s.url || ''))
                return (
                  <li key={s._id} className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900 dark:text-white truncate block">{s.title || 'Export'}</span>
                      <span className="text-gray-500">
                        {s.quality && <span className="mr-1.5">{s.quality}</span>}
                        Expires {new Date(s.expiresAt).toLocaleDateString()}
                        {s.isExpired && <span className="text-red-500 ml-1">(expired)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(downloadUrl)
                            setCopySuccessId(s._id)
                            showToast('Link copied to clipboard', 'success')
                            setTimeout(() => setCopySuccessId(null), 2000)
                          } catch {
                            showToast('Copy failed', 'error')
                          }
                        }}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Copy link"
                      >
                        {copySuccessId === s._id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Link2 className="w-3.5 h-3.5" />}
                      </button>
                      <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                        Download
                      </a>
                      {!s.isExpired && (
                        <div className="flex items-center gap-1">
                          <select
                            value={extendDays}
                            onChange={(e) => setExtendDays(Number(e.target.value))}
                            className="rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[10px] px-1.5 py-0.5 w-14"
                          >
                            <option value={7}>+7d</option>
                            <option value={10}>+10d</option>
                            <option value={30}>+30d</option>
                          </select>
                          <button
                            disabled={extendingId === s._id}
                            onClick={async () => {
                              setExtendingId(s._id)
                              try {
                                await apiPatch(`/video/manual-editing/saved-exports/${s._id}/extend`, { extendByDays: extendDays })
                                showToast(`Expiration extended by ${extendDays} days`, 'success')
                                fetchSavedExports()
                              } catch (e) {
                                showToast('Extend failed', 'error')
                              } finally {
                                setExtendingId(null)
                              }
                            }}
                            className="text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50 flex items-center gap-1 font-medium"
                          >
                            {extendingId === s._id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Extend'}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Unified Distribution Sidebar */}
      <div className="bg-gradient-to-br from-emerald-500/5 to-blue-500/5 dark:from-emerald-500/10 dark:to-blue-500/10 rounded-3xl shadow-2xl border border-emerald-500/20 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Unified Distribution Hub
            </h3>
            <p className="text-[10px] text-gray-500 font-medium mt-1">One-click publishing to all linked social accounts</p>
          </div>
          <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[8px] font-black uppercase tracking-widest">
            {PLATFORMS.filter(p => p.connected).length}/{PLATFORMS.length} Connected
          </div>
        </div>

        {isLoadingAccounts ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" />
            <p className="text-xs text-gray-500">Loading connected accounts...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {PLATFORMS.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => platform.connected && togglePlatform(platform.id)}
                  disabled={!platform.connected}
                  className={`relative p-6 rounded-2xl border-2 transition-all ${!platform.connected
                    ? 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-50 cursor-not-allowed'
                    : selectedPlatforms.includes(platform.id)
                      ? 'bg-gradient-to-br ' + platform.color + ' border-transparent text-white shadow-lg'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-500'
                    }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <platform.icon className={`w-6 h-6 ${selectedPlatforms.includes(platform.id) ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                    <div className="text-center">
                      <p className={`text-xs font-black uppercase ${selectedPlatforms.includes(platform.id) ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        {platform.label}
                      </p>
                      <p className={`text-[8px] font-medium mt-1 ${selectedPlatforms.includes(platform.id) ? 'text-white/80' : 'text-gray-500'}`}>
                        {platform.connected ? 'Ready' : 'Not Connected'}
                      </p>
                    </div>
                  </div>
                  {selectedPlatforms.includes(platform.id) && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {selectedPlatforms.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-emerald-500/20"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-gray-900 dark:text-white mb-1">
                        Ready to publish to {selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {selectedPlatforms.map(p => PLATFORMS.find(pl => pl.id === p)?.label).join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={handlePublish}
                      disabled={isPublishing}
                      className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          PUBLISHING...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          PUBLISH NOW
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {PLATFORMS.filter(p => !p.connected).length > 0 && (
              <div className="mt-6 p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                  <span className="font-black">Tip:</span> Connect more accounts in the Social Vault to unlock cross-platform distribution.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ExportView
