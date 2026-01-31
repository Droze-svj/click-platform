'use client'

import {
    Settings,
    Moon,
    Sun,
    Languages,
    Layout,
    Zap,
    Globe,
    Clock,
    Trash2,
    Undo2,
    Monitor
} from 'lucide-react'
import { usePreferences } from '../hooks/usePreferences'
import { useTranslation } from '../hooks/useTranslation'
import { supportedLanguages } from '../i18n/config'

export default function SettingsPanel() {
    const { preferences, updatePreference, resetPreferences } = usePreferences()
    const { language, setLanguage } = useTranslation()

    return (
        <div className="h-full flex flex-col bg-white dark:bg-black p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto w-full space-y-12">

                {/* Header */}
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <Settings className="w-8 h-8 text-blue-500" />
                        Global Settings
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Configure Click to match your professional workflow</p>
                </div>

                {/* Visual Experience */}
                <section className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <Layout className="w-4 h-4" />
                        Visual Experience
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* OLED Mode */}
                        <div className="p-5 bg-slate-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between group hover:border-blue-500/30 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-black rounded-xl">
                                    <Zap className="w-5 h-5 text-yellow-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">OLED Mode</p>
                                    <p className="text-[10px] text-gray-500">True blacks for high-end displays</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updatePreference('isOledTheme', !preferences.isOledTheme)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${preferences.isOledTheme ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${preferences.isOledTheme ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        {/* Sidebar State */}
                        <div className="p-5 bg-slate-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between group hover:border-blue-500/30 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                    <Monitor className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">Compact Sidebar</p>
                                    <p className="text-[10px] text-gray-500">Maximize drawing workspace</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updatePreference('sidebarCollapsed', !preferences.sidebarCollapsed)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${preferences.sidebarCollapsed ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${preferences.sidebarCollapsed ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Localization */}
                <section className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Region & Language
                    </h3>

                    <div className="p-6 bg-slate-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
                                <Languages className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Display Language</label>
                                <select
                                    value={preferences.language}
                                    onChange={(e) => updatePreference('language', e.target.value)}
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {supportedLanguages.map(lang => (
                                        <option key={lang} value={lang}>
                                            {lang === 'en' ? 'English (US)' : lang === 'es' ? 'Español' : lang === 'fr' ? 'Français' : lang}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Automation Defaults */}
                <section className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        AI & Automation
                    </h3>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 rounded-xl transition-colors">
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">Persistent AI Hints</p>
                                <p className="text-[10px] text-gray-500">Show suggested edits as you work</p>
                            </div>
                            <button
                                onClick={() => updatePreference('showAiPreviews', !preferences.showAiPreviews)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${preferences.showAiPreviews ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${preferences.showAiPreviews ? 'left-5.5' : 'left-0.5'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 rounded-xl transition-colors">
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">Cloud Autosave</p>
                                <p className="text-[10px] text-gray-500">Sync all changes to project cloud</p>
                            </div>
                            <button
                                onClick={() => updatePreference('autoSaveEnabled', !preferences.autoSaveEnabled)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${preferences.autoSaveEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${preferences.autoSaveEnabled ? 'left-5.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* System & Danger Zone */}
                <section className="pt-8 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={resetPreferences}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <Undo2 className="w-4 h-4" />
                            Reset to Defaults
                        </button>
                        <button
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear All Local Data
                        </button>
                    </div>
                </section>

            </div>
        </div>
    )
}
