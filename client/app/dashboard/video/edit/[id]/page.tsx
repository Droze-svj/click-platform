'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { apiGet } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'
import { ErrorBoundary } from '../../../../../components/ErrorBoundary'

const ModernVideoEditor = dynamic(
  () => import('../../../../../components/ModernVideoEditor'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-[#020205] flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-10">
          <div className="relative w-32 h-32">
             <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
             <div className="absolute inset-0 border-4 border-white/5 rounded-[2.5rem] animate-spin-slow" />
             <div className="absolute inset-4 border-2 border-indigo-500/30 rounded-[2rem] animate-spin [animation-duration:3s]" />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-white shadow-xl shadow-white/50 animate-pulse" />
             </div>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-[14px] tracking-[0.8em] uppercase italic leading-none">KINETIC_CORE_SYNC</p>
            <p className="text-indigo-400 font-black text-[10px] tracking-[0.4em] mt-4 uppercase italic animate-pulse opacity-50">Initializing Neural Forge…</p>
          </div>
        </div>
      </div>
    ),
  }
)

interface VideoData {
  _id: string
  title: string
  status: string
  originalFile?: { url: string; filename?: string }
  fileUrl?: string
  url?: string
  editorState?: any
}

function resolveVideoUrl(video: VideoData | null): string {
  const raw = video?.originalFile?.url || video?.fileUrl || video?.url || ''
  if (!raw) return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return raw.startsWith('/') ? raw : `/${raw}`
}

export default function VideoEditPage() {
  const params   = useParams()
  const router   = useRouter()
  const { user } = useAuth()
  const videoId  = params?.id as string

  const [video,     setVideo]     = useState<VideoData | null>(null)
  const [fetchDone, setFetchDone] = useState(false)

  useEffect(() => {
    if (!user)    { router.push('/login');           return }
    if (!videoId) { router.push('/dashboard/video'); return }
    ;(async () => {
      try {
        const res  = await apiGet<any>(`/video/${videoId}`)
        // API returns { success, data: {...} } — axios wraps in res.data
        const body = res?.data ?? res
        const data = body?.data ?? body
        if (data && (data._id || data.id)) setVideo(data)
        else setVideo({ _id: videoId, title: 'Video Editor', status: 'ready' })
      } catch (err: any) {
        if (err?.response?.status === 401) { router.push('/login'); return }
        setVideo({ _id: videoId, title: 'Video Editor', status: 'ready' })
      } finally {
        setFetchDone(true)
      }
    })()
  }, [videoId, user, router])

  if (!fetchDone) {
    return (
      <div className="fixed inset-0 bg-[#020205] flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-10">
          <div className="relative w-32 h-32">
             <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
             <div className="absolute inset-0 border-4 border-white/5 rounded-[2.5rem] animate-spin-slow" />
             <div className="absolute inset-4 border-2 border-indigo-500/30 rounded-[2rem] animate-spin [animation-duration:3s]" />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-white shadow-xl shadow-white/50 animate-pulse" />
             </div>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-[14px] tracking-[0.8em] uppercase italic leading-none">KINETIC_FORGE</p>
            <p className="text-indigo-400 font-black text-[10px] tracking-[0.4em] mt-4 uppercase italic animate-pulse opacity-50">Extracting Narrative Data…</p>
          </div>
        </div>
      </div>
    )
  }

  const videoUrl = resolveVideoUrl(video)

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[#020205]">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;400;700;900&display=swap');
        body { font-family: 'Outfit', sans-serif; background: #020205; }
      `}</style>
      <ErrorBoundary>
        <ModernVideoEditor videoId={videoId} videoUrl={videoUrl} initialState={video?.editorState} />
      </ErrorBoundary>
    </div>
  )
}
