'use client'

import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Monitor,
  Tablet,
  Smartphone,
  X,
  Menu
} from 'lucide-react'
import { EditorCategory } from '../../types/editor'
import { CATEGORIES } from '../../utils/editorConstants'
import { formatTime } from '../../utils/editorUtils'

interface EditorSidebarProps {
  deviceView: 'desktop' | 'tablet' | 'mobile'
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  activeCategory: EditorCategory
  setActiveCategory: (category: EditorCategory) => void
  videoDuration: number
  isOledTheme?: boolean
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  deviceView,
  mobileMenuOpen,
  setMobileMenuOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  activeCategory,
  setActiveCategory,
  videoDuration,
  isOledTheme
}) => {
  return (
    <div className={`${deviceView === 'mobile'
      ? `fixed inset-y-0 left-0 z-50 w-72 transform transition-all duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`
      : sidebarCollapsed ? 'w-16' : 'w-64'
      } ${isOledTheme ? 'bg-black border-slate-800 shadow-[10px_0_40px_rgba(0,0,0,0.9)]' : 'bg-surface-card border-subtle shadow-theme-card'} backdrop-blur-2xl border-r flex flex-col transition-all duration-500 ease-in-out flex-shrink-0 overflow-hidden`}>
      {/* Sidebar Header */}
      <div className="p-3 border-b border-subtle flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className={`font-semibold text-sm text-theme-primary ${sidebarCollapsed && deviceView !== 'mobile' ? 'hidden' : ''}`}>
            Tools
          </h2>
          {deviceView !== 'mobile' && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 hover:bg-surface-card-hover rounded-lg transition-colors text-theme-secondary"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Category Navigation */}
      <div className="editor-auto flex-1 p-2 space-y-2 overflow-y-auto min-h-0 min-w-0">
        {CATEGORIES.map(category => {
          const Icon = category.icon
          return (
            <button
              key={category.id}
              onClick={() => {
                setActiveCategory(category.id as any)
                if (deviceView === 'mobile') setMobileMenuOpen(false)
              }}
              className={`w-full group relative overflow-hidden rounded-xl transition-all duration-200 ${activeCategory === category.id
                ? `bg-gradient-to-r ${category.color} text-white shadow-md`
                : isOledTheme
                  ? 'bg-slate-950/40 text-slate-400 border border-white/5 hover:border-emerald-500/30 hover:bg-black hover:text-emerald-400'
                  : `${category.bgColor} ${category.textColor} hover:bg-slate-100 dark:hover:bg-slate-800/80`
                }`}
            >
              <div className="p-3 flex items-center gap-3">
                <div className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${activeCategory === category.id
                  ? 'bg-white/20'
                  : 'bg-surface-elevated group-hover:bg-surface-card-hover'
                  }`}>
                  <Icon className="w-4 h-4" />
                </div>
                {(!sidebarCollapsed || deviceView === 'mobile') && (
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-semibold text-xs">{category.label}</div>
                    <div className={`text-[10px] mt-0.5 ${activeCategory === category.id ? 'text-white/80' : 'text-theme-muted'}`}>
                      {category.description}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {category.features?.slice(0, 2).map(feature => (
                        <span
                          key={feature}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${activeCategory === category.id
                            ? 'bg-white/20 text-white'
                            : 'bg-surface-elevated text-theme-secondary border border-subtle'
                            }`}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Active indicator */}
              {activeCategory === category.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent animate-pulse"></div>
              )}
            </button>
          )
        })}
      </div>

      {/* Device & Status */}
      <div className="p-3 border-t border-subtle space-y-2 flex-shrink-0">
        <div className="flex items-center justify-center gap-1.5 text-xs text-theme-secondary">
          {deviceView === 'desktop' && <Monitor className="w-3 h-3" />}
          {deviceView === 'tablet' && <Tablet className="w-3 h-3" />}
          {deviceView === 'mobile' && <Smartphone className="w-3 h-3" />}
          <span className="capitalize font-medium">{deviceView} Mode</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-theme-muted">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span>Ready • {formatTime(videoDuration)}</span>
        </div>
      </div>
    </div>
  )
}
