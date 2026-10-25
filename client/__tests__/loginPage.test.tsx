import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Login from '../app/login/page'
import * as api from '../lib/api'

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }))
jest.mock('../lib/api', () => ({
  apiPost: jest.fn(),
  setTokens: jest.fn(),
  clearAuthToken: jest.fn(),
  handleApiError: (e: any) => e?.response?.data?.error ?? e?.message ?? '',
}))
jest.mock('../components/LanguagePicker', () => () => null)
jest.mock('../components/ClickLogo', () => () => null)
// Page copy now comes from t(); resolve keys against the real en.json.
jest.mock('@/hooks/useTranslation', () => require('@/mocks/useTranslationEn'))

const mPost = api.apiPost as jest.Mock
const mSetTokens = api.setTokens as jest.Mock
const apiError = (status: number, data: any) => Object.assign(new Error(data.error), { response: { status, data } })

function fillAndSubmit(email = 'me@click.test', password = 'Correct-Horse-9') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.submit(screen.getByTestId('login-password-step'))
}

describe('Login page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.history.pushState({}, '', '/login')
  })

  it('signs in and goes to the dashboard', async () => {
    mPost.mockResolvedValue({ data: { token: 'A', refreshToken: 'R' } })
    render(<Login />)
    fillAndSubmit()
    await waitFor(() => expect(mSetTokens).toHaveBeenCalledWith('A', 'R'))
    expect(mPost).toHaveBeenCalledWith('/auth/login', { email: 'me@click.test', password: 'Correct-Horse-9' })
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('returns to a safe ?next= page, but never to another site', async () => {
    mPost.mockResolvedValue({ data: { token: 'A', refreshToken: 'R' } })
    window.history.pushState({}, '', '/login?next=%2Fdashboard%2Fsettings%3Ftab%3Dsecurity')
    const { unmount } = render(<Login />)
    fillAndSubmit()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard/settings?tab=security'))
    unmount()

    mockReplace.mockClear()
    window.history.pushState({}, '', '/login?next=%2F%2Fevil.example')
    render(<Login />)
    fillAndSubmit()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'))
  })

  it('asks for the authenticator code when the account has two-step sign-in', async () => {
    mPost
      .mockResolvedValueOnce({ data: { requiresTwoFactor: true, tempToken: 'T' } })
      .mockResolvedValueOnce({ data: { token: 'A', refreshToken: 'R' } })
    render(<Login />)
    fillAndSubmit()
    await waitFor(() => expect(screen.getByTestId('login-code-step')).toBeInTheDocument())
    expect(mSetTokens).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Authentication code'), { target: { value: '123 456' } })
    fireEvent.submit(screen.getByTestId('login-code-step'))
    await waitFor(() => expect(mSetTokens).toHaveBeenCalledWith('A', 'R'))
    expect(mPost).toHaveBeenLastCalledWith('/auth/2fa/verify', { tempToken: 'T', token: '123 456' })
  })

  it('a wrong code keeps you on the code step; an expired sign-in sends you back', async () => {
    mPost
      .mockResolvedValueOnce({ data: { requiresTwoFactor: true, tempToken: 'T' } })
      .mockRejectedValueOnce(apiError(401, { error: 'That code didn\'t match. Try again, or use a backup code.' }))
      .mockRejectedValueOnce(apiError(401, { error: 'Your sign-in expired. Please sign in again.', code: 'TWO_FACTOR_EXPIRED' }))
    render(<Login />)
    fillAndSubmit()
    await waitFor(() => expect(screen.getByTestId('login-code-step')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Authentication code'), { target: { value: '000000' } })
    fireEvent.submit(screen.getByTestId('login-code-step'))
    await waitFor(() => expect(screen.getByTestId('login-error')).toHaveTextContent(/didn't match/))
    expect(screen.getByTestId('login-code-step')).toBeInTheDocument()

    fireEvent.submit(screen.getByTestId('login-code-step'))
    await waitFor(() => expect(screen.getByTestId('login-password-step')).toBeInTheDocument())
    expect(screen.getByTestId('login-error')).toHaveTextContent(/expired/)
  })

  it('shows the lockout message from the server', async () => {
    mPost.mockRejectedValue(apiError(423, { error: 'Too many failed sign-in attempts. Try again in 15 minutes, or reset your password.' }))
    render(<Login />)
    fillAndSubmit()
    await waitFor(() => expect(screen.getByTestId('login-error')).toHaveTextContent(/Try again in 15 minutes/))
  })

  it('validates empty fields without calling the API', () => {
    render(<Login />)
    fireEvent.submit(screen.getByTestId('login-password-step'))
    expect(screen.getByTestId('login-error')).toHaveTextContent(/Enter your email and password/)
    expect(mPost).not.toHaveBeenCalled()
  })

  it('show/hide password toggles the field type', () => {
    render(<Login />)
    const field = screen.getByLabelText('Password') as HTMLInputElement
    expect(field.type).toBe('password')
    fireEvent.click(screen.getByTestId('toggle-password'))
    expect(field.type).toBe('text')
    expect(screen.getByTestId('toggle-password')).toHaveAttribute('aria-label', 'Hide password')
  })

  it('makes no claims the server can\'t back up', () => {
    render(<Login />)
    expect(screen.queryByText(/never stored/i)).not.toBeInTheDocument()
    expect(screen.getByText(/salted hashes/)).toBeInTheDocument()
  })
})
