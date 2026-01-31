'use client'

interface VideoEditorClientProps {
  videoId: string
  videoUrl: string
}

export default function VideoEditorClient({ videoId, videoUrl }: VideoEditorClientProps) {
  return (
    <div>
      <h1>Video Editor Page</h1>
      <p>Video ID: {videoId}</p>
      <p>Video URL: {videoUrl}</p>
      <p>Timestamp: {new Date().toISOString()}</p>
      <p>✅ Client component loads successfully</p>
    </div>
  )
}
