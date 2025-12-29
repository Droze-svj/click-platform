'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Bell, Mail, Smartphone, CheckCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface NotificationPreferencesProps {
  onUpdate?: () => void
}

export default function NotificationPreferences({ onUpdate }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState({
    email: true,
    push: true,
    contentReady: true,
    weeklyDigest: false,
    achievements: true,
    mentions: true,
    comments: false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await axios.get(`${API_URL}/user/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.data?.notifications) {
        setPreferences(response.data.data.notifications)
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    }
  }

  const savePreferences = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      await axios.put(`${API_URL}/user/settings`, {
        notifications: preferences
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onUpdate?.()
    } catch (error) {
      console.error('Failed to save preferences:', error)
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = (key: string, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </h3>
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Receive notifications via email</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={preferences.email}
            onChange={(val) => updatePreference('email', val)}
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Receive browser push notifications</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={preferences.push}
            onChange={(val) => updatePreference('push', val)}
          />
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Content Ready</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">When your content is processed</p>
            </div>
            <ToggleSwitch
              enabled={preferences.contentReady}
              onChange={(val) => updatePreference('contentReady', val)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Weekly Digest</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Weekly summary of your activity</p>
            </div>
            <ToggleSwitch
              enabled={preferences.weeklyDigest}
              onChange={(val) => updatePreference('weeklyDigest', val)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Achievements</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">When you unlock achievements</p>
            </div>
            <ToggleSwitch
              enabled={preferences.achievements}
              onChange={(val) => updatePreference('achievements', val)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mentions</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">When you're mentioned</p>
            </div>
            <ToggleSwitch
              enabled={preferences.mentions}
              onChange={(val) => updatePreference('mentions', val)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Comments</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">When someone comments</p>
            </div>
            <ToggleSwitch
              enabled={preferences.comments}
              onChange={(val) => updatePreference('comments', val)}
            />
          </div>
        </div>
      </div>

      <button
        onClick={savePreferences}
        disabled={saving}
        className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  )
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
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



