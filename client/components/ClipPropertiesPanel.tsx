'use client'

import { useState } from 'react'
import { Settings, Volume2, Zap, Move, RotateCw, Maximize2, Key, Film } from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState<'basic' | 'motion' | 'audio' | 'keyframes'>('basic')

  if (!clip) return null

  return (
    <div className="bg-gray-800 border-t border-gray-700 p-4 max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Clip Properties - {clip.name}
        </h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-700">
        {[
          { id: 'basic', label: 'Basic', icon: Film },
          { id: 'motion', label: 'Motion', icon: Move },
          { id: 'audio', label: 'Audio', icon: Volume2 },
          { id: 'keyframes', label: 'Keyframes', icon: Key }
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
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
            <label className="block text-xs text-gray-300 mb-2">Speed</label>
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
            <label className="block text-xs text-gray-300 mb-2">Opacity</label>
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
            <label className="block text-xs text-gray-300 mb-2">Position X</label>
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
            <label className="block text-xs text-gray-300 mb-2">Position Y</label>
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
            <label className="block text-xs text-gray-300 mb-2">Scale</label>
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
            <label className="block text-xs text-gray-300 mb-2">Rotation</label>
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
            <label className="block text-xs text-gray-300 mb-2">Volume</label>
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
            <div className="text-xs text-gray-400 mb-2">Audio Fade</div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fade In (s)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue="0"
                  className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fade Out (s)</label>
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
                    <div className="text-gray-500">Time: {kf.time.toFixed(2)}s | Value: {kf.value}</div>
                  </div>
                  <button className="text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 text-xs py-4">
              No keyframes. Double-click clip to add keyframes.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
