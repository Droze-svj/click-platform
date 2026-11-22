'use client'

import ClickLogo from '../components/ClickLogo'
import ClickAmbientCanvas from '../components/click/ClickAmbientCanvas'
import ClickSignal from '../components/click/ClickSignal'

export default function Loading() {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-x-clip px-6"
      role="status"
      aria-live="polite"
      aria-label="Loading Click"
    >
      <ClickAmbientCanvas variant="auth" positioning="absolute" />

      <div className="relative z-10 click-vessel px-10 py-10 flex flex-col items-center gap-6 ds-anim-rise">
        <div className="click-aperture-icon w-20 h-20">
          <ClickSignal state="synthesizing" size="lg" />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <ClickLogo size={26} showWordmark />
          <p className="ds-text-caption text-theme-muted">
            Preparing your workspace…
          </p>
        </div>
      </div>
    </div>
  )
}
