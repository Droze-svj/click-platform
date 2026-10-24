import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AccountSecurityPanel from '../AccountSecurityPanel'
import * as api from '@/lib/api'

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  setTokens: jest.fn(),
  handleApiError: (e: any) => e?.message ?? '',
}))
const mGet = api.apiGet as jest.Mock
const mPost = api.apiPost as jest.Mock
const mSetTokens = api.setTokens as jest.Mock

const OFF = { data: { enabled: false, setupPending: false, backupCodesRemaining: 0, available: true } }
const ON = { data: { enabled: true, setupPending: false, backupCodesRemaining: 10, available: true } }
const CODES = Array.from({ length: 10 }, (_, i) => `aaaa${i}-bbbb${i}`)

describe('AccountSecurityPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('turns on two-step sign-in: QR + manual key → code → one-time backup codes', async () => {
    mGet.mockResolvedValueOnce(OFF).mockResolvedValueOnce(ON)
    mPost
      .mockResolvedValueOnce({ data: { qrCodeDataUrl: 'data:image/png;base64,AAA', secret: 'JBSWY3DPEHPK3PXPJBSW' } })
      .mockResolvedValueOnce({ data: { backupCodes: CODES } })
    render(<AccountSecurityPanel />)
    await waitFor(() => expect(screen.getByTestId('twofa-state')).toHaveTextContent('Off'))

    fireEvent.click(screen.getByTestId('twofa-start'))
    await waitFor(() => expect(screen.getByTestId('twofa-setup')).toBeInTheDocument())
    expect(screen.getByAltText(/QR code/)).toHaveAttribute('src', 'data:image/png;base64,AAA')
    expect(screen.getByTestId('twofa-secret')).toHaveTextContent('JBSW Y3DP EHPK 3PXP JBSW')

    fireEvent.change(screen.getByTestId('twofa-code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByTestId('twofa-confirm'))
    await waitFor(() => expect(screen.getByTestId('twofa-backup-codes')).toBeInTheDocument())
    expect(mPost).toHaveBeenLastCalledWith('/auth/2fa/enable', { token: '123456' })
    expect(screen.getAllByText(/aaaa\d-bbbb\d/)).toHaveLength(10)
    expect(screen.getByTestId('twofa-state')).toHaveTextContent('On · 10 backup codes left')

    fireEvent.click(screen.getByTestId('twofa-codes-done'))
    expect(screen.queryByTestId('twofa-backup-codes')).not.toBeInTheDocument()
    expect(screen.getByTestId('twofa-off')).toBeInTheDocument()
  })

  it('a wrong setup code shows the error and keeps the form', async () => {
    mGet.mockResolvedValue(OFF)
    mPost
      .mockResolvedValueOnce({ data: { qrCodeDataUrl: 'data:,', secret: 'ABCD' } })
      .mockRejectedValueOnce(new Error('That code didn\'t match.'))
    render(<AccountSecurityPanel />)
    fireEvent.click(await screen.findByTestId('twofa-start'))
    fireEvent.change(await screen.findByTestId('twofa-code'), { target: { value: '000000' } })
    fireEvent.click(screen.getByTestId('twofa-confirm'))
    await waitFor(() => expect(screen.getByTestId('security-error')).toHaveTextContent(/didn't match/))
    expect(screen.getByTestId('twofa-setup')).toBeInTheDocument()
  })

  it('turning it off needs the password and a code', async () => {
    mGet.mockResolvedValueOnce(ON).mockResolvedValueOnce(OFF)
    mPost.mockResolvedValueOnce({ success: true })
    render(<AccountSecurityPanel />)
    fireEvent.click(await screen.findByTestId('twofa-off'))
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'Correct-Horse-9' } })
    fireEvent.change(screen.getByLabelText(/Code from your app/), { target: { value: 'aaaa0-bbbb0' } })
    fireEvent.submit(screen.getByTestId('twofa-disable'))
    await waitFor(() => expect(mPost).toHaveBeenCalledWith('/auth/2fa/disable', { password: 'Correct-Horse-9', token: 'aaaa0-bbbb0' }))
    await waitFor(() => expect(screen.getByTestId('twofa-state')).toHaveTextContent('Off'))
    expect(screen.getByTestId('security-message')).toHaveTextContent('Two-step sign-in is off.')
  })

  it('signing out other devices keeps this one signed in with the fresh tokens', async () => {
    mGet.mockResolvedValue(OFF)
    mPost.mockResolvedValueOnce({ data: { token: 'NEW', refreshToken: 'NEWR' } })
    render(<AccountSecurityPanel />)
    fireEvent.click(await screen.findByTestId('sign-out-others'))
    await waitFor(() => expect(mSetTokens).toHaveBeenCalledWith('NEW', 'NEWR'))
    expect(mPost).toHaveBeenCalledWith('/auth/revoke-sessions', {})
    expect(screen.getByTestId('security-message')).toHaveTextContent('Signed out of all other devices.')
  })

  it('says plainly when the server can\'t offer two-step sign-in yet', async () => {
    mGet.mockResolvedValue({ data: { enabled: false, setupPending: false, backupCodesRemaining: 0, available: false } })
    render(<AccountSecurityPanel />)
    expect(await screen.findByTestId('twofa-unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('twofa-start')).not.toBeInTheDocument()
  })
})
