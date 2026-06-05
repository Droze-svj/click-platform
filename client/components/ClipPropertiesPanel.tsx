'use client'

import { useState } from 'react'
import { Settings, Volume2, Zap, Move, RotateCw, Maximize2, Key, Film } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

interface TimelineClip {
  id: string
  name: string
  type: 'video' | 'audio' | 'text' | 'transition' | 'image'
  properties?: {
    volume?: number
    speed?: number
    opacity?: number
    position?: { x: number; y: number }
    scale?: { x: number; y: number }
    rotation?: number
    filters?: any
  }
  keyframes?: Array<{
    id: string
    time: number
    property: string
    value: any
  }>
}

interface ClipPropertiesPanelProps {
  clip: TimelineClip | null
  onUpdate: (updates: Partial<TimelineClip>) => void
  onClose: () => void
}

export default function ClipPropertiesPanel({ clip, onUpdate, onClose }: ClipPropertiesPanelProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'basic' | 'motion' | 'audio' | 'keyframes'>('basic')

  if (!clip) return null

  return (
    <div className="bg-gray-800 border-t border-gray-700 p-4 max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
          <Settings className="w-4 h-4" />
          {t('clipPropertiesPanel.titleWithName', { name: clip.name })}
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-700">
        {[
          { id: 'basic', label: t('clipPropertiesPanel.tabBasic'), icon: Film },
          { id: 'motion', label: t('clipPropertiesPanel.tabMotion'), icon: Move },
          { id: 'audio', label: t('clipPropertiesPanel.tabAudio'), icon: Volume2 },
          { id: 'keyframes', label: t('clipPropertiesPanel.tabKeyframes'), icon: Key }
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon className="w-3 h-3 inline mr-1" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Basic Properties */}
      {activeTab === 'basic' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-300 mb-2">{t('clipPropertiesPanel.speed')}</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.1"
                max="4"
                step="0.1"
                value={clip.properties?.speed ?? 1}
                onChange={(e) => onUpdate({
                  properties: {
                    ...clip.properties,
                    speed: parseFloat(e.target.value)
                  }
                })}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-12 text-right">
                {(clip.properties?.speed ?? 1).toFixed(2)}x
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-2">{t('clipPropertiesPanel.opacity')}</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={clip.properties?.opacity ?? 100}
                onChange={(e) => onUpdate({
                  properties: {
                    ...clip.properties,
                    opacity: parseInt(e.target.value)
                  }
                })}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-12 text-right">
                {clip.properties?.opacity ?? 100}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Motion Properties */}
      {activeTab === 'motion' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-300 mb-2">{t('clipPropertiesPanel.positionX')}</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="-100"
                max="100"
                value={clip.properties?.position?.x ?? 0}
                onChange={(e) => onUpdate({
                  properties: {
                    ...clip.properties,
                    position: {
                      x: parseInt(e.target.value),
                      y: clip.properties?.position?.y ?? 0
                    }
                  }
                })}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-16 text-right">
                {clip.properties?.position?.x ?? 0}%
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-2">{t('clipPropertiesPanel.positionY')}</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="-100"
                max="100"
                value={clip.properties?.position?.y ?? 0}
                onChange={(e) => onUpdate({
                  properties: {
                    ...clip.properties,
                    position: {
                      x: clip.properties?.position?.x ?? 0,
                      y: parseInt(e.target.value)
                    }
                  }
                })}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-16 text-right">
                {clip.properties?.position?.y ?? 0}%
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-2">{t('clipPropertiesPanel.scale')}</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="200"
                value={(clip.properties?.scale?.x ?? 100)}
                onChange={(e) => onUpdate({
                  properties: {
                    ...clip.properties,
                    scale: {
                      x: parseInt(e.target.value),
                      y: parseInt(e.target.value)
                    }
                  }
                })}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-16 text-right">
                {clip.properties?.scale?.x ?? 100}%
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-2">{t('clipPropertiesPanel.rotation')}</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="-180"
                max="180"
                value={clip.properties?.rotation ?? 0}
                onChange={(e) => onUpdate({
                  properties: {
                    ...clip.properties,
                    rotation: parseInt(e.target.value)
                  }
                })}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-16 text-right">
                {clip.properties?.rotation ?? 0}°
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Audio Properties */}
      {activeTab === 'audio' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-300 mb-2">{t('clipPropertiesPanel.volume')}</label>
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-gray-400" />
              <input
                type="range"
                min="0"
                max="100"
                value={clip.properties?.volume ?? 100}
                onChange={(e) => onUpdate({
                  properties: {
                    ...clip.properties,
                    volume: parseInt(e.target.value)
                  }
                })}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-12 text-right">
                {clip.properties?.volume ?? 100}%
              </span>
            </div>
          </div>

          <div className="bg-gray-900 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">{t('clipPropertiesPanel.audioFade')}</div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('clipPropertiesPanel.fadeIn')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue="0"
                  className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('clipPropertiesPanel.fadeOut')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue="0"
                  className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyframes */}
      {activeTab === 'keyframes' && (
        <div className="space-y-2">
          {clip.keyframes && clip.keyframes.length > 0 ? (
            clip.keyframes.map(kf => (
              <div key={kf.id} className="bg-gray-900 rounded p-2 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-300 font-medium">{kf.property}</div>
                    <div className="text-gray-500">{t('clipPropertiesPanel.timeValue', { time: kf.time.toFixed(2), value: kf.value })}</div>
                  </div>
                  <button className="text-red-400 hover:text-red-300">{t('clipPropertiesPanel.delete')}</button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 text-xs py-4">
              {t('clipPropertiesPanel.noKeyframes')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
