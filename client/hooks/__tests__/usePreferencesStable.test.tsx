// updatePreference (and so useTranslation's setLanguage) must keep its
// identity across renders. The settings page loads /user/settings in an effect
// that depends on setLanguage and calls setLanguage with the loaded value; a
// fresh function each render turned that into an endless load loop (~150
// requests a second) that also wiped every toggle before it could be saved.
// Found by the settings journey in tests/e2e/journeys.
import { render, act } from '@testing-library/react'
import React, { useEffect } from 'react'
import { PreferencesProvider, usePreferences } from '../usePreferences'

jest.mock('../../lib/api', () => ({
  apiGet: jest.fn().mockResolvedValue({ data: { preferences: { language: 'en' } } }),
  apiPut: jest.fn().mockResolvedValue({}),
}))

describe('usePreferences', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem('token', 't') })

  it('an effect that depends on updatePreference and calls it runs once, not forever', async () => {
    let runs = 0
    function SettingsLike() {
      const { updatePreference } = usePreferences()
      useEffect(() => {
        runs += 1
        if (runs < 50) updatePreference('language', 'en')
      }, [updatePreference])
      return null
    }
    render(<PreferencesProvider><SettingsLike /></PreferencesProvider>)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(runs).toBe(1)
  })

  it('keeps updatePreference / resetPreferences identities across preference changes', async () => {
    const seen: any[] = []
    function Probe() {
      const ctx = usePreferences()
      seen.push(ctx)
      return <button onClick={() => ctx.updatePreference('sidebarCollapsed', true)}>go</button>
    }
    const { getByText } = render(<PreferencesProvider><Probe /></PreferencesProvider>)
    await act(async () => { getByText('go').click() })
    const last = seen[seen.length - 1]
    expect(last.preferences.sidebarCollapsed).toBe(true)
    expect(last.updatePreference).toBe(seen[0].updatePreference)
    expect(last.resetPreferences).toBe(seen[0].resetPreferences)
  })
})
