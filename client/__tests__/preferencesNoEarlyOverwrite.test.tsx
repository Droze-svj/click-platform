/**
 * On a full page load the preference sync PUT this device's language/theme
 * 500 ms in — before GET /user/settings answered on a slow connection — and
 * overwrote the account's saved language with the device default.
 */
import React from 'react'
import { render, act } from '@testing-library/react'

const mockGet = jest.fn()
const mockPut = jest.fn(async (..._a: any[]) => ({ success: true }))
jest.mock('../lib/api', () => ({
  apiGet: (...a: any[]) => mockGet(...a),
  apiPut: (...a: any[]) => mockPut(...a),
}))

import { PreferencesProvider, usePreferences } from '../hooks/usePreferences'

function Lang() {
  const { preferences } = usePreferences()
  return <span data-testid="lang">{preferences.language}</span>
}

describe('preference sync on page load', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    localStorage.setItem('token', 't')
    mockGet.mockReset()
    mockPut.mockClear()
  })
  afterEach(() => jest.useRealTimers())

  it('does not push device defaults while the saved settings are still loading', async () => {
    let answer: (v: any) => void = () => {}
    mockGet.mockReturnValue(new Promise((r) => { answer = r }))
    const { getByTestId } = render(<PreferencesProvider><Lang /></PreferencesProvider>)

    await act(async () => { jest.advanceTimersByTime(3000) })
    expect(mockPut).not.toHaveBeenCalled()

    await act(async () => { answer({ data: { preferences: { language: 'es', theme: 'auto' } } }) })
    await act(async () => { jest.advanceTimersByTime(3000) })
    expect(getByTestId('lang').textContent).toBe('es')
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('does not push stale local values when loading the saved settings fails', async () => {
    localStorage.setItem('click-user-preferences', JSON.stringify({ language: 'fr' }))
    mockGet.mockRejectedValue(new Error('offline'))
    render(<PreferencesProvider><Lang /></PreferencesProvider>)
    await act(async () => { jest.advanceTimersByTime(3000) })
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('still saves a change the creator makes after loading', async () => {
    mockGet.mockResolvedValue({ data: { preferences: { language: 'en', theme: 'auto' } } })
    let api: ReturnType<typeof usePreferences> | null = null
    function Grab() { api = usePreferences(); return null }
    render(<PreferencesProvider><Grab /></PreferencesProvider>)
    await act(async () => { jest.advanceTimersByTime(1000) })
    expect(mockPut).not.toHaveBeenCalled()
    await act(async () => { api!.updatePreference('language', 'de') })
    await act(async () => { jest.advanceTimersByTime(1000) })
    expect(mockPut).toHaveBeenCalledWith('/user/settings', { preferences: { language: 'de', theme: 'auto' } })
  })
})
