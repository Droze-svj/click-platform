import { renderHook, act } from '@testing-library/react'
import { useVideoEditorAutosave } from '../useVideoEditorAutosave'

const mockPost = jest.fn()
jest.mock('../../lib/api', () => ({ apiPost: (...a: any[]) => mockPost(...a) }))

const baseState = {
  videoFilters: {},
  textOverlays: [],
  timelineSegments: [],
  colorGradeSettings: {},
  projectName: 'Untitled project',
}

// Lets the save's awaited promises and retry back-off timers run.
async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
    for (let i = 0; i < 10; i++) await Promise.resolve()
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  mockPost.mockReset()
  localStorage.clear()
})
afterEach(() => {
  jest.useRealTimers()
})

test('does not send the placeholder project name when the user never renamed', async () => {
  mockPost.mockResolvedValue({ success: true })
  renderHook(() => useVideoEditorAutosave({ state: baseState, videoId: 'v1', debounceMs: 10 }))
  await flush(20)
  expect(mockPost).toHaveBeenCalledTimes(1)
  expect(mockPost.mock.calls[0][1]).not.toHaveProperty('name')
})

test('sends the name after an explicit rename', async () => {
  mockPost.mockResolvedValue({ success: true })
  renderHook(() => useVideoEditorAutosave({ state: { ...baseState, projectName: 'Trip' }, videoId: 'v1', name: 'Trip', debounceMs: 10 }))
  await flush(20)
  expect(mockPost.mock.calls[0][1].name).toBe('Trip')
})

test('a failed server save is reported as an error, not "saved", and is retried', async () => {
  mockPost.mockRejectedValue(new Error('500'))
  const { result } = renderHook(() => useVideoEditorAutosave({ state: baseState, videoId: 'v1', debounceMs: 10 }))
  await flush(20)
  // in-hook retries with back-off
  await flush(700)
  await flush(1300)
  expect(mockPost).toHaveBeenCalledTimes(3)
  expect(result.current.autosaveStatus.status).toBe('error')

  // the error does not quietly flip back to a "saved"-looking idle state
  await flush(4000)
  expect(result.current.autosaveStatus.status).toBe('error')

  // background retry: once the server accepts, the badge reports saved
  mockPost.mockResolvedValue({ success: true })
  await flush(6000)
  expect(mockPost.mock.calls.length).toBeGreaterThan(3)
  expect(result.current.autosaveStatus.status).toBe('saved')
})

test('local-only editing (no saved video) never calls the server', async () => {
  const { result } = renderHook(() => useVideoEditorAutosave({ state: baseState, videoId: 'temp-id', serverSave: false, debounceMs: 10 }))
  await flush(20)
  expect(mockPost).not.toHaveBeenCalled()
  expect(result.current.autosaveStatus.status).toBe('saved')
})
