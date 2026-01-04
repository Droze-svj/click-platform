'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Sparkles,
  Sun,
  Zap,
  Flame,
  Snowflake,
  Heart,
  Star,
  Circle,
  Triangle,
  Square,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react'
import { EffectsIcon } from './icons/VideoIcons'
import { useToast } from '../contexts/ToastContext'

interface ParticleSystem {
  id: string
  name: string
  type: 'fire' | 'snow' | 'stars' | 'hearts' | 'sparks' | 'bubbles' | 'confetti' | 'dust'
  enabled: boolean
  particleCount: number
  size: { min: number, max: number }
  speed: { min: number, max: number }
  lifetime: number
  color: string
  opacity: number
  gravity: number
  wind: number
  spawnRate: number
  position: { x: number, y: number }
  area: { width: number, height: number }
}

interface LensFlare {
  id: string
  name: string
  enabled: boolean
  position: { x: number, y: number }
  intensity: number
  color: string
  size: number
  elements: Array<{
    type: 'circle' | 'star' | 'hexagon' | 'ring'
    size: number
    offset: number
    opacity: number
    color: string
  }>
}

interface LightEffect {
  id: string
  name: string
  type: 'god-rays' | 'spotlight' | 'rim-light' | 'ambient'
  enabled: boolean
  position: { x: number, y: number }
  intensity: number
  color: string
  angle: number
  spread: number
  softness: number
}

interface MotionEffect {
  id: string
  name: string
  type: 'blur' | 'ghost' | 'echo' | 'strobe'
  enabled: boolean
  intensity: number
  duration: number
  frequency: number
}

interface AdvancedVisualEffectsProps {
  onEffectChange: (effects: {
    particleSystems: ParticleSystem[]
    lensFlares: LensFlare[]
    lightEffects: LightEffect[]
    motionEffects: MotionEffect[]
  }) => void
  currentEffects?: {
    particleSystems: ParticleSystem[]
    lensFlares: LensFlare[]
    lightEffects: LightEffect[]
    motionEffects: MotionEffect[]
  }
}

export default function AdvancedVisualEffects({
  onEffectChange,
  currentEffects
}: AdvancedVisualEffectsProps) {
  const [activeTab, setActiveTab] = useState<'particles' | 'lights' | 'lenses' | 'motion'>('particles')
  const [particleSystems, setParticleSystems] = useState<ParticleSystem[]>(
    currentEffects?.particleSystems || []
  )
  const [lensFlares, setLensFlares] = useState<LensFlare[]>(
    currentEffects?.lensFlares || []
  )
  const [lightEffects, setLightEffects] = useState<LightEffect[]>(
    currentEffects?.lightEffects || []
  )
  const [motionEffects, setMotionEffects] = useState<MotionEffect[]>(
    currentEffects?.motionEffects || []
  )
  const [previewMode, setPreviewMode] = useState(false)
  const { showToast } = useToast()

  // Update parent component when effects change
  useEffect(() => {
    onEffectChange({
      particleSystems,
      lensFlares,
      lightEffects,
      motionEffects
    })
  }, [particleSystems, lensFlares, lightEffects, motionEffects, onEffectChange])

  const addParticleSystem = useCallback((type: ParticleSystem['type']) => {
    const newSystem: ParticleSystem = {
      id: `particle-${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Effect`,
      type,
      enabled: true,
      particleCount: 50,
      size: { min: 2, max: 8 },
      speed: { min: 1, max: 3 },
      lifetime: 3000,
      color: type === 'fire' ? '#FF4500' :
             type === 'snow' ? '#FFFFFF' :
             type === 'stars' ? '#FFD700' :
             type === 'hearts' ? '#FF69B4' :
             type === 'sparks' ? '#FFFF00' :
             type === 'bubbles' ? '#87CEEB' :
             type === 'confetti' ? '#FF6B6B' : '#D3D3D3',
      opacity: 0.8,
      gravity: type === 'snow' || type === 'hearts' ? 0.1 : type === 'fire' ? -0.05 : 0,
      wind: 0,
      spawnRate: 10,
      position: { x: 50, y: 50 },
      area: { width: 100, height: 100 }
    }

    setParticleSystems(prev => [...prev, newSystem])
    showToast(`Added ${type} particle system`, 'success')
  }, [showToast])

  const addLensFlare = useCallback(() => {
    const newFlare: LensFlare = {
      id: `flare-${Date.now()}`,
      name: 'Lens Flare',
      enabled: true,
      position: { x: 20, y: 20 },
      intensity: 0.8,
      color: '#FFFFFF',
      size: 100,
      elements: [
        { type: 'circle', size: 20, offset: 0, opacity: 0.9, color: '#FFFFFF' },
        { type: 'star', size: 40, offset: 30, opacity: 0.7, color: '#FFFF00' },
        { type: 'hexagon', size: 15, offset: 60, opacity: 0.5, color: '#FF6B6B' },
        { type: 'ring', size: 25, offset: 90, opacity: 0.3, color: '#87CEEB' }
      ]
    }

    setLensFlares(prev => [...prev, newFlare])
    showToast('Added lens flare effect', 'success')
  }, [showToast])

  const addLightEffect = useCallback((type: LightEffect['type']) => {
    const newLight: LightEffect = {
      id: `light-${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Light`,
      type,
      enabled: true,
      position: { x: 50, y: 50 },
      intensity: 0.7,
      color: type === 'god-rays' ? '#FFD700' :
             type === 'spotlight' ? '#FFFFFF' :
             type === 'rim-light' ? '#87CEEB' : '#FFE4B5',
      angle: 45,
      spread: 30,
      softness: 0.5
    }

    setLightEffects(prev => [...prev, newLight])
    showToast(`Added ${type} light effect`, 'success')
  }, [showToast])

  const addMotionEffect = useCallback((type: MotionEffect['type']) => {
    const newMotion: MotionEffect = {
      id: `motion-${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Motion`,
      type,
      enabled: true,
      intensity: 0.5,
      duration: 200,
      frequency: type === 'strobe' ? 10 : 1
    }

    setMotionEffects(prev => [...prev, newMotion])
    showToast(`Added ${type} motion effect`, 'success')
  }, [showToast])

  const removeEffect = useCallback((type: 'particles' | 'lights' | 'lenses' | 'motion', id: string) => {
    switch (type) {
      case 'particles':
        setParticleSystems(prev => prev.filter(system => system.id !== id))
        break
      case 'lights':
        setLightEffects(prev => prev.filter(light => light.id !== id))
        break
      case 'lenses':
        setLensFlares(prev => prev.filter(flare => flare.id !== id))
        break
      case 'motion':
        setMotionEffects(prev => prev.filter(motion => motion.id !== id))
        break
    }
    showToast('Effect removed', 'success')
  }, [showToast])

  const toggleEffect = useCallback((type: 'particles' | 'lights' | 'lenses' | 'motion', id: string) => {
    switch (type) {
      case 'particles':
        setParticleSystems(prev => prev.map(system =>
          system.id === id ? { ...system, enabled: !system.enabled } : system
        ))
        break
      case 'lights':
        setLightEffects(prev => prev.map(light =>
          light.id === id ? { ...light, enabled: !light.enabled } : light
        ))
        break
      case 'lenses':
        setLensFlares(prev => prev.map(flare =>
          flare.id === id ? { ...flare, enabled: !flare.enabled } : flare
        ))
        break
      case 'motion':
        setMotionEffects(prev => prev.map(motion =>
          motion.id === id ? { ...motion, enabled: !motion.enabled } : motion
        ))
        break
    }
  }, [])

  const updateParticleSystem = useCallback((id: string, updates: Partial<ParticleSystem>) => {
    setParticleSystems(prev => prev.map(system =>
      system.id === id ? { ...system, ...updates } : system
    ))
  }, [])

  const updateLensFlare = useCallback((id: string, updates: Partial<LensFlare>) => {
    setLensFlares(prev => prev.map(flare =>
      flare.id === id ? { ...flare, ...updates } : flare
    ))
  }, [])

  const updateLightEffect = useCallback((id: string, updates: Partial<LightEffect>) => {
    setLightEffects(prev => prev.map(light =>
      light.id === id ? { ...light, ...updates } : light
    ))
  }, [])

  const updateMotionEffect = useCallback((id: string, updates: Partial<MotionEffect>) => {
    setMotionEffects(prev => prev.map(motion =>
      motion.id === id ? { ...motion, ...updates } : motion
    ))
  }, [])

  const resetAllEffects = useCallback(() => {
    setParticleSystems([])
    setLensFlares([])
    setLightEffects([])
    setMotionEffects([])
    showToast('All effects reset', 'info')
  }, [showToast])

  const tabs = [
    { id: 'particles', label: 'Particles', icon: Sparkles, count: particleSystems.length },
    { id: 'lights', label: 'Lights', icon: Sun, count: lightEffects.length },
    { id: 'lenses', label: 'Lens Flares', icon: Circle, count: lensFlares.length },
    { id: 'motion', label: 'Motion', icon: EffectsIcon, count: motionEffects.length }
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Advanced Visual Effects
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Cinematic particle systems, lighting effects, and motion graphics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`p-2 rounded-lg transition-colors ${
                previewMode
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {previewMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={resetAllEffects}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
              title="Reset all effects"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 p-4 text-center transition-colors relative ${
                activeTab === tab.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-500 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm font-medium">{tab.label}</div>
              {tab.count > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'particles' && (
          <div className="space-y-6">
            {/* Preset Particle Systems */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Particle Presets</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { type: 'fire' as const, icon: Flame, color: 'from-red-500 to-orange-500' },
                  { type: 'snow' as const, icon: Snowflake, color: 'from-blue-200 to-white' },
                  { type: 'stars' as const, icon: Star, color: 'from-yellow-400 to-yellow-600' },
                  { type: 'hearts' as const, icon: Heart, color: 'from-pink-500 to-red-500' },
                  { type: 'sparks' as const, icon: Zap, color: 'from-yellow-500 to-orange-500' },
                  { type: 'bubbles' as const, icon: Circle, color: 'from-blue-400 to-cyan-400' },
                  { type: 'confetti' as const, icon: Square, color: 'from-purple-500 to-pink-500' },
                  { type: 'dust' as const, icon: Sparkles, color: 'from-gray-400 to-gray-600' }
                ].map(preset => {
                  const Icon = preset.icon
                  return (
                    <button
                      key={preset.type}
                      onClick={() => addParticleSystem(preset.type)}
                      className={`p-4 bg-gradient-to-br ${preset.color} text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-md`}
                    >
                      <Icon className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm font-medium capitalize">{preset.type}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Active Particle Systems */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Active Effects</h4>
              <div className="space-y-3">
                {particleSystems.map(system => (
                  <div key={system.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleEffect('particles', system.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            system.enabled
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {system.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-white">{system.name}</h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{system.type}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeEffect('particles', system.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        ×
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Particles: {system.particleCount}
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="200"
                          value={system.particleCount}
                          onChange={(e) => updateParticleSystem(system.id, {
                            particleCount: parseInt(e.target.value)
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Speed: {system.speed.max}
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="10"
                          step="0.1"
                          value={system.speed.max}
                          onChange={(e) => updateParticleSystem(system.id, {
                            speed: { ...system.speed, max: parseFloat(e.target.value) }
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Opacity: {Math.round(system.opacity * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.1"
                          value={system.opacity}
                          onChange={(e) => updateParticleSystem(system.id, {
                            opacity: parseFloat(e.target.value)
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Color
                        </label>
                        <input
                          type="color"
                          value={system.color}
                          onChange={(e) => updateParticleSystem(system.id, {
                            color: e.target.value
                          })}
                          className="w-full h-8 rounded border border-gray-300 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {particleSystems.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No particle effects added yet</p>
                    <p className="text-sm">Choose a preset above to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lights' && (
          <div className="space-y-6">
            {/* Light Effect Types */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Light Effects</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { type: 'god-rays' as const, name: 'God Rays', color: 'from-yellow-400 to-orange-500' },
                  { type: 'spotlight' as const, name: 'Spotlight', color: 'from-white to-gray-300' },
                  { type: 'rim-light' as const, name: 'Rim Light', color: 'from-cyan-400 to-blue-500' },
                  { type: 'ambient' as const, name: 'Ambient', color: 'from-purple-400 to-pink-500' }
                ].map(lightType => (
                  <button
                    key={lightType.type}
                    onClick={() => addLightEffect(lightType.type)}
                    className={`p-4 bg-gradient-to-br ${lightType.color} text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-md`}
                  >
                    <Sun className="w-6 h-6 mx-auto mb-2" />
                    <div className="text-sm font-medium">{lightType.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Light Effects */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Active Lights</h4>
              <div className="space-y-3">
                {lightEffects.map(light => (
                  <div key={light.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleEffect('lights', light.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            light.enabled
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {light.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-white">{light.name}</h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{light.type}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeEffect('lights', light.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        ×
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Intensity: {Math.round(light.intensity * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={light.intensity}
                          onChange={(e) => updateLightEffect(light.id, {
                            intensity: parseFloat(e.target.value)
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Color
                        </label>
                        <input
                          type="color"
                          value={light.color}
                          onChange={(e) => updateLightEffect(light.id, {
                            color: e.target.value
                          })}
                          className="w-full h-8 rounded border border-gray-300 dark:border-gray-600"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Angle: {light.angle}°
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={light.angle}
                          onChange={(e) => updateLightEffect(light.id, {
                            angle: parseInt(e.target.value)
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Spread: {light.spread}°
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="180"
                          value={light.spread}
                          onChange={(e) => updateLightEffect(light.id, {
                            spread: parseInt(e.target.value)
                          })}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {lightEffects.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Sun className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No light effects added yet</p>
                    <p className="text-sm">Choose a light type above to illuminate your video</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lenses' && (
          <div className="space-y-6">
            {/* Add Lens Flare Button */}
            <div>
              <button
                onClick={addLensFlare}
                className="w-full p-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-200 transform hover:scale-105 shadow-md"
              >
                <div className="flex items-center justify-center gap-2">
                  <Sun className="w-6 h-6" />
                  <span className="font-medium">Add Lens Flare</span>
                </div>
              </button>
            </div>

            {/* Active Lens Flares */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Active Lens Flares</h4>
              <div className="space-y-3">
                {lensFlares.map(flare => (
                  <div key={flare.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleEffect('lenses', flare.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            flare.enabled
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {flare.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-white">{flare.name}</h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Lens flare effect</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeEffect('lenses', flare.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        ×
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Intensity: {Math.round(flare.intensity * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={flare.intensity}
                          onChange={(e) => updateLensFlare(flare.id, {
                            intensity: parseFloat(e.target.value)
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Color
                        </label>
                        <input
                          type="color"
                          value={flare.color}
                          onChange={(e) => updateLensFlare(flare.id, {
                            color: e.target.value
                          })}
                          className="w-full h-8 rounded border border-gray-300 dark:border-gray-600"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Size: {flare.size}px
                        </label>
                        <input
                          type="range"
                          min="20"
                          max="200"
                          value={flare.size}
                          onChange={(e) => updateLensFlare(flare.id, {
                            size: parseInt(e.target.value)
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Position X: {flare.position.x}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={flare.position.x}
                          onChange={(e) => updateLensFlare(flare.id, {
                            position: { ...flare.position, x: parseInt(e.target.value) }
                          })}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {lensFlares.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Sun className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No lens flares added yet</p>
                    <p className="text-sm">Add a lens flare to create cinematic lighting effects</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'motion' && (
          <div className="space-y-6">
            {/* Motion Effect Types */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Motion Effects</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { type: 'blur' as const, name: 'Motion Blur', color: 'from-blue-500 to-cyan-500' },
                  { type: 'ghost' as const, name: 'Ghost Echo', color: 'from-purple-500 to-pink-500' },
                  { type: 'echo' as const, name: 'Time Echo', color: 'from-green-500 to-teal-500' },
                  { type: 'strobe' as const, name: 'Strobe', color: 'from-red-500 to-orange-500' }
                ].map(motionType => (
                  <button
                    key={motionType.type}
                    onClick={() => addMotionEffect(motionType.type)}
                    className={`p-4 bg-gradient-to-br ${motionType.color} text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-md`}
                  >
                    <Zap className="w-6 h-6 mx-auto mb-2" />
                    <div className="text-sm font-medium">{motionType.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Motion Effects */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Active Effects</h4>
              <div className="space-y-3">
                {motionEffects.map(motion => (
                  <div key={motion.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleEffect('motion', motion.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            motion.enabled
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {motion.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-white">{motion.name}</h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{motion.type}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeEffect('motion', motion.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        ×
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Intensity: {Math.round(motion.intensity * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={motion.intensity}
                          onChange={(e) => updateMotionEffect(motion.id, {
                            intensity: parseFloat(e.target.value)
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Duration: {motion.duration}ms
                        </label>
                        <input
                          type="range"
                          min="50"
                          max="1000"
                          value={motion.duration}
                          onChange={(e) => updateMotionEffect(motion.id, {
                            duration: parseInt(e.target.value)
                          })}
                          className="w-full"
                        />
                      </div>

                      {motion.type === 'strobe' && (
                        <>
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                              Frequency: {motion.frequency}Hz
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="30"
                              value={motion.frequency}
                              onChange={(e) => updateMotionEffect(motion.id, {
                                frequency: parseInt(e.target.value)
                              })}
                              className="w-full"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {motionEffects.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No motion effects added yet</p>
                    <p className="text-sm">Choose a motion effect above to add dynamic movement</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
