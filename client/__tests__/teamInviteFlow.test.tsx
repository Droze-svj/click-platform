// A signed-out invitee must come back to the invitation after signing in.
// /teams/accept used to send ?redirect=, which the login page ignores (it
// reads ?next=), so the invitee landed on the dashboard and the invite was lost.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Login from '../app/login/page'
import AcceptInvitationPage from '../app/teams/accept/page'
import * as api from '../lib/api'

const mockReplace = jest.fn()
const mockPush = jest.fn()
let mockSearch = new URLSearchParams()
let mockAuth: { user: any; loading: boolean } = { user: null, loading: false }

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => mockSearch,
}))
jest.mock('../lib/api', () => ({
  apiPost: jest.fn(),
  setTokens: jest.fn(),
  clearAuthToken: jest.fn(),
  handleApiError: (e: any) => e?.response?.data?.error ?? e?.message ?? '',
}))
jest.mock('../hooks/useAuth', () => ({ useAuth: () => mockAuth }))
jest.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }))
jest.mock('../components/LoadingSpinner', () => () => null)
jest.mock('../components/LanguagePicker', () => () => null)
jest.mock('../components/ClickLogo', () => () => null)

const mPost = api.apiPost as jest.Mock

describe('team invitation while signed out', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorage.clear()
    mockAuth = { user: null, loading: false }
    mockSearch = new URLSearchParams('token=abc123')
    window.history.pushState({}, '', '/login')
  })

  it('sends the invitee to /login with ?next= pointing back at the invite', () => {
    render(<AcceptInvitationPage />)
    expect(mockPush).toHaveBeenCalledWith(`/login?next=${encodeURIComponent('/teams/accept?token=abc123')}`)
    expect(sessionStorage.getItem('pendingInviteToken')).toBe('abc123')
  })

  it('login returns to the invite from ?next=', async () => {
    mPost.mockResolvedValue({ data: { token: 'A', refreshToken: 'R' } })
    window.history.pushState({}, '', `/login?next=${encodeURIComponent('/teams/accept?token=abc123')}`)
    render(<Login />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@click.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Correct-Horse-9' } })
    fireEvent.submit(screen.getByTestId('login-password-step'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/teams/accept?token=abc123'))
  })

  it('login returns to a stored invite when ?next= was lost (e.g. registered first)', async () => {
    sessionStorage.setItem('pendingInviteToken', 'abc123')
    mPost.mockResolvedValue({ data: { token: 'A', refreshToken: 'R' } })
    render(<Login />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@click.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Correct-Horse-9' } })
    fireEvent.submit(screen.getByTestId('login-password-step'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/teams/accept?token=abc123'))
  })

  it('once signed in, the invite is accepted once and the stored token cleared', async () => {
    sessionStorage.setItem('pendingInviteToken', 'abc123')
    mockAuth = { user: { id: 'u1' }, loading: false }
    mPost.mockResolvedValue({ success: true, data: { _id: 'team1' } })
    const { rerender } = render(<AcceptInvitationPage />)
    rerender(<AcceptInvitationPage />)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/teams/team1'))
    expect(mPost).toHaveBeenCalledTimes(1)
    expect(mPost).toHaveBeenCalledWith('/teams/accept-invitation', { token: 'abc123' })
    expect(sessionStorage.getItem('pendingInviteToken')).toBeNull()
  })
})
