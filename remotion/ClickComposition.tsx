/**
 * Stub composition for Remotion: React → video with programmatic keyframes.
 * Remotion injects `frame` and `fps`; or use useCurrentFrame() / useVideoConfig() inside.
 * This file is valid React; install Remotion and register in Root.tsx to render.
 */

import React from 'react'

export const ClickComposition: React.FC<{ frame?: number; fps?: number }> = ({ frame = 0, fps = 30 }) => {
  const t = frame / fps
  const scale = 1 + 0.1 * Math.sin(t * 0.5)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f0f12',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          color: '#f59e0b',
          fontSize: 48,
          fontWeight: 'bold',
        }}
      >
        Click · frame {frame}
      </div>
    </div>
  )
}
