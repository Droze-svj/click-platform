// "Check your email" only after the server accepted the request. A 429, 5xx
// or network failure used to show it too (setSubmitted in finally), so users
// waited for a link that was never sent.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import ForgotPasswordPage from '../app/forgot-password/page'
import * as api from '../lib/api'

jest.mock('../lib/api', () => ({
  apiPost: jest.fn(),
  handleApiError: (e: any) => e?.response?.data?.error ?? e?.message ?? '',
}))
jest.mock('../components/ClickLogo', () => () => null)
const mockT = (k: string) => k
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: mockT }) }))

const mPost = api.apiPost as jest.Mock
const apiError = (status?: number) => Object.assign(new Error('boom'), status ? { response: { status, data: { error: 'boom' } } } : {})

function submit() {
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'me@click.test' } })
  fireEvent.click(screen.getByRole('button', { name: /Send reset link/ }))
}

describe('Forgot password', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows "check your email" after a 2xx', async () => {
    mPost.mockResolvedValueOnce({ success: true })
    render(<ForgotPasswordPage />)
    submit()
    expect(await screen.findByText('Check your email')).toBeInTheDocument()
  })

  it.each([
    [429, 'forgotPasswordPage.rateLimited'],
    [500, 'forgotPasswordPage.sendFailed'],
    [undefined, 'forgotPasswordPage.sendFailed'],
  ])('status %s shows a retryable error, not "check your email"', async (status, key) => {
    mPost.mockRejectedValueOnce(apiError(status as number | undefined))
    render(<ForgotPasswordPage />)
    submit()
    expect(await screen.findByText(key)).toBeInTheDocument()
    expect(screen.queryByText('Check your email')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: /Send reset link/ })).not.toBeDisabled())
  })
})
