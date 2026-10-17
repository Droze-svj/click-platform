'use client'

import { useEffect, useMemo, useState } from 'react'
import { handleApiError } from '@/lib/api'
import {
  getBriefSubscription, setBriefSubscription,
  type BriefSubscriptionState, type BriefChannels,
} from '@/lib/featuresApi'
import { Switch } from '@/components/ui/switch'
import { FormField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`

const browserTimeZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

/** Every IANA zone the browser knows, always including the current choice. */
function timeZoneOptions(current: string): string[] {
  let zones: string[] = []
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    zones = supported ? supported('timeZone') : []
  } catch { zones = [] }
  if (!zones.length) zones = ['UTC', browserTimeZone()]
  return Array.from(new Set([current, ...zones])).filter(Boolean)
}

const selectClass =
  'w-full rounded-lg border border-input bg-background px-3 h-10 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Settings → Notifications → Morning brief: turn the daily brief on/off and
 * choose the hour, timezone and channels. Saves to /api/brief/subscription
 * (separate from the rest of the notification settings, which save together).
 */
export default function MorningBriefSettings() {
  const [state, setState] = useState<BriefSubscriptionState | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [hour, setHour] = useState(7)
  const [timezone, setTimezone] = useState(browserTimeZone())
  const [channels, setChannels] = useState<BriefChannels>({ inApp: true, email: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  function load(s: BriefSubscriptionState) {
    setState(s)
    const sub = s.subscription
    if (sub) {
      setEnabled(sub.enabled)
      setHour(sub.hour)
      setTimezone(sub.timezone)
      setChannels(sub.channels || { inApp: true, email: false })
    }
  }

  useEffect(() => {
    let alive = true
    getBriefSubscription()
      .then((s) => { if (alive) load(s) })
      .catch((e) => { if (alive) setError(handleApiError(e) || 'Could not load your morning brief settings') })
    return () => { alive = false }
  }, [])

  const zones = useMemo(() => timeZoneOptions(timezone), [timezone])

  async function save() {
    if (enabled && !channels.inApp && !channels.email) {
      setError('Pick at least one way to receive the brief.'); return
    }
    setSaving(true); setError(null); setSavedNote(null)
    try {
      const next = await setBriefSubscription({ enabled, hour, timezone, channels })
      load(next)
      setSavedNote(enabled ? `Saved. Your brief is set for ${fmtHour(hour)} ${timezone} time.` : 'Saved. The morning brief is off.')
    } catch (e) {
      setError(handleApiError(e) || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (!state && !error) return <p data-testid="brief-settings-loading" className="ds-text-caption py-3">Loading…</p>

  return (
    <div data-testid="brief-settings" className="space-y-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-theme-primary">Morning brief</p>
          <p className="ds-text-caption mt-0.5">
            One summary a day: what to make next, your week&apos;s numbers, and what needs you.
          </p>
        </div>
        <Switch
          data-testid="brief-settings-enabled" checked={enabled} onCheckedChange={setEnabled}
          aria-label="Morning brief"
        />
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Time" hint="Arrives within 15 minutes of this time">
              <select
                data-testid="brief-settings-hour" aria-label="Brief time" value={hour}
                onChange={(e) => setHour(Number(e.target.value))} className={selectClass}
              >
                {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
            </FormField>
            <FormField label="Time zone">
              <select
                data-testid="brief-settings-timezone" aria-label="Brief time zone" value={timezone}
                onChange={(e) => setTimezone(e.target.value)} className={selectClass}
              >
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </select>
            </FormField>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-theme-primary">Send it as</p>
            <label className="flex items-center gap-2 text-sm text-theme-primary">
              <input
                data-testid="brief-settings-inapp" type="checkbox" checked={channels.inApp}
                onChange={(e) => setChannels({ ...channels, inApp: e.target.checked })}
              />
              In-app notification
            </label>
            <label className="flex items-center gap-2 text-sm text-theme-primary">
              <input
                data-testid="brief-settings-email" type="checkbox" checked={channels.email}
                disabled={!state?.emailAvailable && !channels.email}
                onChange={(e) => setChannels({ ...channels, email: e.target.checked })}
              />
              Email
              {!state?.emailAvailable && (
                <span className="ds-text-caption">(email isn&apos;t set up on this server yet)</span>
              )}
            </label>
          </div>
        </>
      )}

      {state && !state.deliveryActive && enabled && (
        <p data-testid="brief-settings-inactive" className="ds-text-caption text-amber-600 dark:text-amber-400">
          Your choice is saved, but daily delivery isn&apos;t switched on for this server yet. You can always read
          the brief on the dashboard.
        </p>
      )}
      {state?.subscription?.lastSentLocalDate && (
        <p data-testid="brief-settings-last" className="ds-text-caption">Last sent {state.subscription.lastSentLocalDate}.</p>
      )}
      {error && <p data-testid="brief-settings-error" className="text-sm text-red-500">{error}</p>}
      {savedNote && <p data-testid="brief-settings-saved" className="text-sm text-green-600 dark:text-green-400">{savedNote}</p>}

      <div className="flex justify-end">
        <Button data-testid="brief-settings-save" variant="primary" onClick={save} loading={saving}>
          {saving ? 'Saving…' : 'Save morning brief'}
        </Button>
      </div>
    </div>
  )
}
