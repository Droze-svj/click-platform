// A failed load must not let the defaults on screen be saved over the real
// preferences, and a failed save must say so.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import NotificationPreferences from '../components/NotificationPreferences'
import * as api from '../lib/api'

jest.mock('../lib/api', () => ({ apiGet: jest.fn(), apiPut: jest.fn() }))
const mockT = (k: string) => k
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: mockT }) }))

const mGet = api.apiGet as jest.Mock
const mPut = api.apiPut as jest.Mock

describe('NotificationPreferences', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows the load error and keeps Save disabled until preferences load', async () => {
    mGet.mockRejectedValueOnce(new Error('network'))
    render(<NotificationPreferences />)
    expect(await screen.findByText('notificationPreferences.loadFailed')).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'notificationPreferences.savePreferences' })
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(mPut).not.toHaveBeenCalled()

    mGet.mockResolvedValueOnce({ success: true, data: { notifications: { email: false } } })
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))
    await waitFor(() => expect(save).not.toBeDisabled())
    expect(screen.queryByText('notificationPreferences.loadFailed')).toBeNull()
  })

  it('shows an error when saving fails', async () => {
    mGet.mockResolvedValueOnce({ success: true, data: { notifications: { email: true } } })
    mPut.mockRejectedValueOnce(new Error('500'))
    render(<NotificationPreferences />)
    const save = screen.getByRole('button', { name: 'notificationPreferences.savePreferences' })
    await waitFor(() => expect(save).not.toBeDisabled())
    fireEvent.click(save)
    expect(await screen.findByText('notificationPreferences.saveFailed')).toBeInTheDocument()
  })
})
