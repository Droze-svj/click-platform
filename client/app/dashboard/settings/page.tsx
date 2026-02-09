'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { supportedLanguages, languageNames, type SupportedLanguage } from '../../../i18n/config'
import ChangePasswordForm from '../../../components/ChangePasswordForm'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface UserSettings {
  notifications: {
    email: boolean
    push: boolean
    contentReady: boolean
    weeklyDigest: boolean
  }
  privacy: {
    dataConsent: boolean
    marketingConsent: boolean
    analyticsConsent: boolean
  }
  preferences: {
    theme: 'light' | 'dark' | 'auto'
    language: string
    timezone: string
  }
}

export interface BrandKit {
  primaryColor?: string
  accentColor?: string
  titleFont?: string
  bodyFont?: string
  lowerThirdStyle?: string
  lowerThirdPosition?: string
  logoPlacement?: string
  logoOpacity?: number | null
  captionStyle?: string
  captionPosition?: string
}

const DEFAULT_BRAND_KIT: BrandKit = {
  primaryColor: '',
  accentColor: '',
  titleFont: '',
  bodyFont: '',
  lowerThirdStyle: '',
  lowerThirdPosition: '',
  logoPlacement: '',
  logoOpacity: null,
  captionStyle: '',
  captionPosition: '',
}

const FONT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
]

function isValidLang(l: string): l is SupportedLanguage {
  return supportedLanguages.includes(l as SupportedLanguage)
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { language, setLanguage, t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const tabFromUrl = searchParams.get('tab')
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email: true,
      push: true,
      contentReady: true,
      weeklyDigest: false,
    },
    privacy: {
      dataConsent: true,
      marketingConsent: false,
      analyticsConsent: true,
    },
    preferences: {
      theme: 'auto',
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  })
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'privacy' | 'security' | 'brand'>(tabFromUrl === 'brand' ? 'brand' : 'general')
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT)
  const [brandKitLoading, setBrandKitLoading] = useState(false)
  const [brandKitSaving, setBrandKitSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (tabFromUrl === 'brand') setActiveTab('brand')
  }, [tabFromUrl])

  useEffect(() => {
    if (activeTab === 'brand') loadBrandKit()
  }, [activeTab])

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await axios.get(`${API_URL}/user/settings`, {
      })

      const settingsData = extractApiData<UserSettings>(response)
      if (settingsData) {
        setSettings(settingsData)
        if (settingsData.preferences?.language && isValidLang(settingsData.preferences.language)) {
          setLanguage(settingsData.preferences.language)
        }
      }
    } catch (error: any) {
      console.error('Failed to load settings:', error)
      if (error.response?.status === 401) {
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      await axios.put(`${API_URL}/user/settings`, settings, {
      })

      const event = new CustomEvent('toast', {
        detail: { message: t('settings.saved'), type: 'success' }
      })
      window.dispatchEvent(event)
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      const event = new CustomEvent('toast', {
        detail: { message: t('settings.saveFailed'), type: 'error' }
      })
      window.dispatchEvent(event)
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (path: string, value: any) => {
    const keys = path.split('.')
    setSettings(prev => {
      const newSettings = { ...prev }
      let current: any = newSettings
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return newSettings
    })
  }

  const loadBrandKit = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    setBrandKitLoading(true)
    try {
      const response = await axios.get(`${API_URL}/pro-mode/brand-kit`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = extractApiData<BrandKit>(response)
      if (data && typeof data === 'object') {
        setBrandKit({ ...DEFAULT_BRAND_KIT, ...data })
      }
    } catch (e) {
      console.error('Failed to load brand kit', e)
      if ((e as any)?.response?.status === 401) router.push('/login')
    } finally {
      setBrandKitLoading(false)
    }
  }

  const saveBrandKit = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    setBrandKitSaving(true)
    try {
      await axios.put(`${API_URL}/pro-mode/brand-kit`, brandKit, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const event = new CustomEvent('toast', {
        detail: { message: 'Brand kit saved.', type: 'success' },
      })
      window.dispatchEvent(event)
    } catch (e) {
      console.error('Failed to save brand kit', e)
      const event = new CustomEvent('toast', {
        detail: { message: 'Failed to save brand kit.', type: 'error' },
      })
      window.dispatchEvent(event)
    } finally {
      setBrandKitSaving(false)
    }
  }

  const updateBrandKitField = <K extends keyof BrandKit>(key: K, value: BrandKit[K]) => {
    setBrandKit(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <LoadingSkeleton type="card" count={3} />
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <ToastContainer />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{t('settings.title')}</h1>
                <p className="text-gray-600 dark:text-gray-400">{t('settings.subtitle')}</p>
              </div>
              <Link
                href="/dashboard/settings/profile"
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                {t('settings.editProfile')}
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex -mb-px">
                {[
                  { id: 'general', labelKey: 'settings.general', icon: '⚙️' },
                  { id: 'brand', labelKey: 'Brand kit', icon: '🎨', isLiteral: true },
                  { id: 'notifications', labelKey: 'settings.notifications', icon: '🔔' },
                  { id: 'privacy', labelKey: 'settings.privacy', icon: '🔒' },
                  { id: 'security', labelKey: 'settings.security', icon: '🛡️' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {(tab as any).isLiteral ? (tab as any).labelKey : t(tab.labelKey)}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <SettingSection title={t('settings.appearance')}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('settings.theme')}</label>
                        <select
                          value={settings.preferences.theme}
                          onChange={(e) => updateSetting('preferences.theme', e.target.value)}
                          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        >
                          <option value="light">{t('settings.themeLight')}</option>
                          <option value="dark">{t('settings.themeDark')}</option>
                          <option value="auto">{t('settings.themeAuto')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('settings.language')}</label>
                        <select
                          value={language}
                          onChange={(e) => {
                            const v = e.target.value as SupportedLanguage
                            if (isValidLang(v)) {
                              setLanguage(v)
                              updateSetting('preferences.language', v)
                            }
                          }}
                          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        >
                          {supportedLanguages.map((lang) => (
                            <option key={lang} value={lang}>{languageNames[lang]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('settings.timezone')}</label>
                        <select
                          value={settings.preferences.timezone}
                          onChange={(e) => updateSetting('preferences.timezone', e.target.value)}
                          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        >
                          {Intl.supportedValuesOf('timeZone').map(tz => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </SettingSection>
                </div>
              )}

              {/* Notifications */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <SettingSection title="Email Notifications">
                    <div className="space-y-4">
                      <ToggleSetting
                        label="Email notifications"
                        value={settings.notifications.email}
                        onChange={(val) => updateSetting('notifications.email', val)}
                      />
                      <ToggleSetting
                        label="Content ready notifications"
                        value={settings.notifications.contentReady}
                        onChange={(val) => updateSetting('notifications.contentReady', val)}
                      />
                      <ToggleSetting
                        label="Weekly digest"
                        value={settings.notifications.weeklyDigest}
                        onChange={(val) => updateSetting('notifications.weeklyDigest', val)}
                      />
                    </div>
                  </SettingSection>
                  <SettingSection title="Push Notifications">
                    <ToggleSetting
                      label="Push notifications"
                      value={settings.notifications.push}
                      onChange={(val) => updateSetting('notifications.push', val)}
                    />
                  </SettingSection>
                </div>
              )}

              {/* Privacy */}
              {activeTab === 'privacy' && (
                <div className="space-y-6">
                  <SettingSection title="Data Consent">
                    <div className="space-y-4">
                      <ToggleSetting
                        label="Data processing consent"
                        value={settings.privacy.dataConsent}
                        onChange={(val) => updateSetting('privacy.dataConsent', val)}
                      />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Allow us to process your data to provide our services
                      </p>
                    </div>
                  </SettingSection>
                  <SettingSection title="Marketing">
                    <div className="space-y-4">
                      <ToggleSetting
                        label="Marketing communications"
                        value={settings.privacy.marketingConsent}
                        onChange={(val) => updateSetting('privacy.marketingConsent', val)}
                      />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Receive marketing emails and updates
                      </p>
                    </div>
                  </SettingSection>
                  <SettingSection title="Analytics">
                    <div className="space-y-4">
                      <ToggleSetting
                        label="Analytics consent"
                        value={settings.privacy.analyticsConsent}
                        onChange={(val) => updateSetting('privacy.analyticsConsent', val)}
                      />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Help us improve by sharing anonymous usage data
                      </p>
                    </div>
                  </SettingSection>
                </div>
              )}

              {/* Brand kit */}
              {activeTab === 'brand' && (
                <div className="space-y-6">
                  <SettingSection title="Brand kit">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Lock in colors, fonts, lower-third style, logo placement, and caption style so your videos stay consistent.
                    </p>
                    {brandKitLoading ? (
                      <LoadingSkeleton type="card" count={2} />
                    ) : (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary color</label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={brandKit.primaryColor || '#6366f1'}
                                onChange={(e) => updateBrandKitField('primaryColor', e.target.value)}
                                className="h-10 w-14 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={brandKit.primaryColor || ''}
                                onChange={(e) => updateBrandKitField('primaryColor', e.target.value)}
                                placeholder="#6366f1"
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Accent color</label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={brandKit.accentColor || '#8b5cf6'}
                                onChange={(e) => updateBrandKitField('accentColor', e.target.value)}
                                className="h-10 w-14 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={brandKit.accentColor || ''}
                                onChange={(e) => updateBrandKitField('accentColor', e.target.value)}
                                placeholder="#8b5cf6"
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title font</label>
                            <select
                              value={brandKit.titleFont || ''}
                              onChange={(e) => updateBrandKitField('titleFont', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                            >
                              {FONT_OPTIONS.map((o) => (
                                <option key={o.value || 'default'} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body / caption font</label>
                            <select
                              value={brandKit.bodyFont || ''}
                              onChange={(e) => updateBrandKitField('bodyFont', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                            >
                              {FONT_OPTIONS.map((o) => (
                                <option key={o.value || 'default'} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lower-third style</label>
                            <select
                              value={brandKit.lowerThirdStyle || ''}
                              onChange={(e) => updateBrandKitField('lowerThirdStyle', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                            >
                              <option value="">None / default</option>
                              <option value="bar">Bar</option>
                              <option value="pill">Pill</option>
                              <option value="minimal">Minimal</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lower-third position</label>
                            <select
                              value={brandKit.lowerThirdPosition || ''}
                              onChange={(e) => updateBrandKitField('lowerThirdPosition', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                            >
                              <option value="">Default</option>
                              <option value="left">Left</option>
                              <option value="right">Right</option>
                              <option value="center">Center</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo placement</label>
                            <select
                              value={brandKit.logoPlacement || ''}
                              onChange={(e) => updateBrandKitField('logoPlacement', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                            >
                              <option value="">None</option>
                              <option value="top-left">Top left</option>
                              <option value="top-right">Top right</option>
                              <option value="bottom-left">Bottom left</option>
                              <option value="bottom-right">Bottom right</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo opacity (%)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={brandKit.logoOpacity ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                updateBrandKitField('logoOpacity', v === '' ? null : Math.max(0, Math.min(100, Number(v))))
                              }}
                              placeholder="e.g. 80"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Caption style</label>
                            <input
                              type="text"
                              value={brandKit.captionStyle || ''}
                              onChange={(e) => updateBrandKitField('captionStyle', e.target.value)}
                              placeholder="e.g. modern, bold, minimal"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Caption position</label>
                            <select
                              value={brandKit.captionPosition || ''}
                              onChange={(e) => updateBrandKitField('captionPosition', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                            >
                              <option value="">Default</option>
                              <option value="bottom-center">Bottom center</option>
                              <option value="lower-third">Lower third</option>
                              <option value="top-center">Top center</option>
                              <option value="full-width-bottom">Full width bottom</option>
                            </select>
                          </div>
                        </div>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={saveBrandKit}
                            disabled={brandKitSaving}
                            className="px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          >
                            {brandKitSaving ? 'Saving…' : 'Save brand kit'}
                          </button>
                        </div>
                      </div>
                    )}
                  </SettingSection>
                </div>
              )}

              {/* Security */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <SettingSection title="Password">
                    <ChangePasswordForm />
                  </SettingSection>
                  <SettingSection title="Two-Factor Authentication">
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Add an extra layer of security to your account
                      </p>
                      <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
                        Enable 2FA
                      </button>
                    </div>
                  </SettingSection>
                  <SettingSection title="Active Sessions">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Manage your active sessions
                    </p>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                      View Active Sessions
                    </button>
                  </SettingSection>
                  <SettingSection title="Account Deletion">
                    <div className="space-y-4">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Once you delete your account, there is no going back. Please be certain.
                      </p>
                      <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                        Delete Account
                      </button>
                    </div>
                  </SettingSection>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('settings.saving') : t('settings.saveSettings')}
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  )
}

function ToggleSetting({ label, value, onChange }: { label: string; value: boolean; onChange: (val: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">{label}</label>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${value ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
      </button>
    </div>
  )
}

