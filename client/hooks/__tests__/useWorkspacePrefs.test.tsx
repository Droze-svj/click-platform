/**
 * useWorkspacePrefs — every mounted copy (sidebar, Settings, onboarding) must
 * share one state. With per-instance state, a change in one copy pushed that
 * copy's stale pinnedNav to the server and reverted pins made elsewhere.
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mockApiGet = jest.fn()
const mockApiPut = jest.fn()
jest.mock('../../lib/api', () => ({
  apiGet: (...a: any[]) => mockApiGet(...a),
  apiPut: (...a: any[]) => mockApiPut(...a),
}))

import { useWorkspacePrefs, __resetWorkspacePrefsStore } from '../useWorkspacePrefs'

function Sidebar() {
  const { prefs, togglePin } = useWorkspacePrefs()
  return (
    <div>
      <span data-testid="sidebar-pins">{prefs.pinnedNav.join(',')}</span>
      <button onClick={() => togglePin('/dashboard/scripts')}>pin scripts</button>
    </div>
  )
}

function SettingsWorkspace() {
  const { prefs, setDefaultLanding } = useWorkspacePrefs()
  return (
    <div>
      <span data-testid="settings-pins">{prefs.pinnedNav.join(',')}</span>
      <button onClick={() => setDefaultLanding('/dashboard/analytics')}>land analytics</button>
    </div>
  )
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

beforeEach(() => {
  jest.useFakeTimers()
  __resetWorkspacePrefsStore()
  window.localStorage.clear()
  window.localStorage.setItem('token', 't')
  mockApiGet.mockReset()
  mockApiPut.mockReset()
  mockApiPut.mockResolvedValue({ success: true })
  mockApiGet.mockResolvedValue({ success: true, data: { preferences: { pinnedNav: ['/dashboard/clips'], defaultLanding: '' } } })
})

afterEach(() => {
  jest.useRealTimers()
})

it('hydrates once from the server and shares it with every instance', async () => {
  render(<><Sidebar /><SettingsWorkspace /></>)
  await flush()
  expect(mockApiGet).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('sidebar-pins').textContent).toBe('/dashboard/clips')
  expect(screen.getByTestId('settings-pins').textContent).toBe('/dashboard/clips')
})

it('a pin in the sidebar is not reverted by a start-page change in Settings', async () => {
  render(<><Sidebar /><SettingsWorkspace /></>)
  await flush()

  fireEvent.click(screen.getByText('pin scripts'))
  expect(screen.getByTestId('settings-pins').textContent).toBe('/dashboard/clips,/dashboard/scripts')

  fireEvent.click(screen.getByText('land analytics'))
  await act(async () => { jest.advanceTimersByTime(700) })

  // One debounced push carrying BOTH changes.
  expect(mockApiPut).toHaveBeenCalledTimes(1)
  expect(mockApiPut).toHaveBeenCalledWith('/user/settings', {
    preferences: { pinnedNav: ['/dashboard/clips', '/dashboard/scripts'], defaultLanding: '/dashboard/analytics' },
  })
})

it('a change survives the component unmounting inside the debounce window', async () => {
  const { unmount } = render(<Sidebar />)
  await flush()
  fireEvent.click(screen.getByText('pin scripts'))
  unmount()
  await act(async () => { jest.advanceTimersByTime(700) })
  expect(mockApiPut).toHaveBeenCalledWith('/user/settings', {
    preferences: { pinnedNav: ['/dashboard/clips', '/dashboard/scripts'], defaultLanding: '' },
  })
})

it('a late server answer does not overwrite a change the user already made', async () => {
  let resolve: (v: any) => void = () => {}
  mockApiGet.mockReturnValue(new Promise((r) => { resolve = r }))
  render(<Sidebar />)
  fireEvent.click(screen.getByText('pin scripts'))
  resolve({ data: { preferences: { pinnedNav: [], defaultLanding: '' } } })
  await flush()
  expect(screen.getByTestId('sidebar-pins').textContent).toBe('/dashboard/scripts')
})
