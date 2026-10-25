'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPut } from '../lib/api'
import { Bell, Mail, Smartphone, CheckCircle, Inbox, Filter } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

const API_USER_SETTINGS = '/user/settings'

const CHANNEL_KEYS = ['inApp', 'email'] as const
const CATEGORY_KEYS = ['task', 'project', 'content', 'approval', 'mention', 'system', 'workflow'] as const
const PRIORITY_OPTIONS = [
  { value: 'all', labelKey: 'all' },
  { value: 'high_medium', labelKey: 'highMedium' },
  { value: 'high_only', labelKey: 'highOnly' }
] as const

interface NotificationPreferencesProps {
  onUpdate?: () => void
}

interface NotificationsShape {
  email?: boolean
  push?: boolean
  contentReady?: boolean
  weeklyDigest?: boolean
  achievements?: boolean
  mentions?: boolean
  comments?: boolean
  priorityTiers?: string
  digestMode?: string
  digestTime?: string
  channels?: { inApp?: boolean; email?: boolean }
  categories?: Record<string, boolean>
}

const defaultChannels = { inApp: true, email: true }
const defaultCategories: Record<string, boolean> = {
  task: true,
  project: true,
  content: true,
  approval: true,
  mention: true,
  system: true,
  workflow: true
}

export default function NotificationPreferences({ onUpdate }: NotificationPreferencesProps) {
  const { t } = useTranslation()
  const [preferences, setPreferences] = useState<NotificationsShape>({
    email: true,
    push: true,
    contentReady: true,
    weeklyDigest: false,
    achievements: true,
    mentions: true,
    comments: false,
    priorityTiers: 'all',
    channels: defaultChannels,
    categories: defaultCategories
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Saving is only allowed once the stored preferences have loaded: before,
  // a failed load left the defaults on screen and the next save sent them,
  // overwriting the user's real choices.
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    setLoadError(false)
    try {
      const res: any = await apiGet(API_USER_SETTINGS)
      const data = res?.data ?? res
      const notif = data?.notifications
      if (notif && typeof notif === 'object') {
        setPreferences(prev => ({
          ...prev,
          ...notif,
          channels: { ...defaultChannels, ...notif.channels },
          categories: { ...defaultCategories, ...notif.categories },
          priorityTiers: notif.priorityTiers ?? 'all'
        }))
      }
      setLoaded(true)
    } catch (error) {
      console.error('Failed to load preferences:', error)
      setLoadError(true)
    }
  }

  const savePreferences = async () => {
    if (!loaded) return
    setSaving(true)
    setSaveError(false)
    try {
      await apiPut(API_USER_SETTINGS, { notifications: preferences })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onUpdate?.()
    } catch (error) {
      console.error('Failed to save preferences:', error)
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = (key: string, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  const updateChannel = (key: typeof CHANNEL_KEYS[number], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      channels: { ...defaultChannels, ...prev.channels, [key]: value }
    }))
  }

  const updateCategory = (key: string, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      categories: { ...prev.categories, [key]: value }
    }))
  }

  const channels = { ...defaultChannels, ...preferences.channels }
  const categories = { ...defaultCategories, ...preferences.categories }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          {t('notificationPreferences.title')}
        </h3>
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            {t('notificationPreferences.saved')}
          </span>
        )}
      </div>

      <div className="space-y-6">
        <section>
          <h4 className="font-medium text-gray-900 dark:text-[var(--text-main)] mb-2 flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            {t('notificationPreferences.channels')}
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm">{t('notificationPreferences.inApp')}</span>
              <ToggleSwitch
                enabled={channels.inApp !== false}
                onChange={(val) => updateChannel('inApp', val)}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-sm">{t('notificationPreferences.email')}</span>
              </div>
              <ToggleSwitch
                enabled={channels.email !== false}
                onChange={(val) => updateChannel('email', val)}
              />
            </div>
          </div>
        </section>

        <section>
          <h4 className="font-medium text-gray-900 dark:text-[var(--text-main)] mb-2 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            {t('notificationPreferences.priorityHeading')}
          </h4>
          <select
            value={preferences.priorityTiers || 'all'}
            onChange={(e) => setPreferences(prev => ({ ...prev, priorityTiers: e.target.value }))}
            aria-label={t('notificationPreferences.priorityHeading')}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          >
            {PRIORITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{t(`notificationPreferences.priority.${o.labelKey}`)}</option>
            ))}
          </select>
        </section>

        <section>
          <h4 className="font-medium text-gray-900 dark:text-[var(--text-main)] mb-2">{t('notificationPreferences.categories')}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('notificationPreferences.categoriesDescription')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CATEGORY_KEYS.map(cat => (
              <div key={cat} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-sm capitalize">{t(`notificationPreferences.category.${cat}`)}</span>
                <ToggleSwitch
                  enabled={categories[cat] !== false}
                  onChange={(val) => updateCategory(cat, val)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('notificationPreferences.contentReady')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('notificationPreferences.contentReadyDescription')}</p>
            </div>
            <ToggleSwitch
              enabled={preferences.contentReady !== false}
              onChange={(val) => updatePreference('contentReady', val)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('notificationPreferences.weeklyDigest')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('notificationPreferences.weeklyDigestDescription')}</p>
            </div>
            <ToggleSwitch
              enabled={!!preferences.weeklyDigest}
              onChange={(val) => updatePreference('weeklyDigest', val)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('notificationPreferences.achievements')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('notificationPreferences.achievementsDescription')}</p>
            </div>
            <ToggleSwitch
              enabled={preferences.achievements !== false}
              onChange={(val) => updatePreference('achievements', val)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('notificationPreferences.mentions')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('notificationPreferences.mentionsDescription')}</p>
            </div>
            <ToggleSwitch
              enabled={preferences.mentions !== false}
              onChange={(val) => updatePreference('mentions', val)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('notificationPreferences.push')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('notificationPreferences.pushDescription')}</p>
            </div>
            <ToggleSwitch
              enabled={preferences.push !== false}
              onChange={(val) => updatePreference('push', val)}
            />
          </div>
        </section>
      </div>

      {loadError && (
        <div role="alert" className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <span>{t('notificationPreferences.loadFailed')}</span>
          <button type="button" onClick={loadPreferences} className="font-medium underline">
            {t('common.retry')}
          </button>
        </div>
      )}
      {saveError && (
        <p role="alert" className="mt-6 text-sm text-red-600 dark:text-red-400">
          {t('notificationPreferences.saveFailed')}
        </p>
      )}

      <button
        type="button"
        onClick={savePreferences}
        disabled={saving || !loaded}
        className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        {saving ? t('notificationPreferences.saving') : t('notificationPreferences.savePreferences')}
      </button>
    </div>
  )
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
     type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
