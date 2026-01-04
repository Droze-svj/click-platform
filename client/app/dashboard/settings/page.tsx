'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import Navbar from '../../../components/Navbar'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
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

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'privacy' | 'security'>('general')

  useEffect(() => {
    loadSettings()
  }, [])

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

      // Show success toast
      const event = new CustomEvent('toast', {
        detail: { message: 'Settings saved successfully', type: 'success' }
      })
      window.dispatchEvent(event)
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      const event = new CustomEvent('toast', {
        detail: { message: 'Failed to save settings', type: 'error' }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <LoadingSkeleton type="card" count={3} />
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <ToastContainer />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Settings</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage your account preferences</p>
            </div>
            <Link
              href="/dashboard/settings/profile"
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              {[
                { id: 'general', label: 'General', icon: '⚙️' },
                { id: 'notifications', label: 'Notifications', icon: '🔔' },
                { id: 'privacy', label: 'Privacy', icon: '🔒' },
                { id: 'security', label: 'Security', icon: '🛡️' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <SettingSection title="Appearance">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Theme</label>
                      <select
                        value={settings.preferences.theme}
                        onChange={(e) => updateSetting('preferences.theme', e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto (System)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Language</label>
                      <select
                        value={settings.preferences.language}
                        onChange={(e) => updateSetting('preferences.language', e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Timezone</label>
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
            {saving ? 'Saving...' : 'Save Settings'}
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
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

