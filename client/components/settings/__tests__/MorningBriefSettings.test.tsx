import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MorningBriefSettings from '../MorningBriefSettings'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
jest.mock('@/lib/api', () => ({
  handleApiError: (e: any) => e?.message ?? '',
}))
const mGet = api.getBriefSubscription as jest.MockedFunction<typeof api.getBriefSubscription>
const mSet = api.setBriefSubscription as jest.MockedFunction<typeof api.setBriefSubscription>

const SUB = { enabled: true, timezone: 'Europe/Rome', hour: 7, channels: { inApp: true, email: false }, lastSentLocalDate: '2026-10-17' }

describe('MorningBriefSettings', () => {
  beforeEach(() => jest.clearAllMocks())

  it('loads the saved schedule into the form', async () => {
    mGet.mockResolvedValue({ subscription: SUB, deliveryActive: true, emailAvailable: true })
    render(<MorningBriefSettings />)
    await waitFor(() => expect(screen.getByTestId('brief-settings-hour')).toHaveValue('7'))
    expect(screen.getByTestId('brief-settings-timezone')).toHaveValue('Europe/Rome')
    expect(screen.getByTestId('brief-settings-inapp')).toBeChecked()
    expect(screen.getByTestId('brief-settings-email')).not.toBeChecked()
    expect(screen.getByTestId('brief-settings-last')).toHaveTextContent('Last sent 2026-10-17.')
    expect(screen.queryByTestId('brief-settings-inactive')).not.toBeInTheDocument()
  })

  it('saves a new time, time zone and email channel', async () => {
    mGet.mockResolvedValue({ subscription: SUB, deliveryActive: true, emailAvailable: true })
    mSet.mockResolvedValue({
      subscription: { ...SUB, hour: 6, timezone: 'America/New_York', channels: { inApp: true, email: true } },
      deliveryActive: true, emailAvailable: true,
    })
    render(<MorningBriefSettings />)
    await waitFor(() => expect(screen.getByTestId('brief-settings-hour')).toHaveValue('7'))

    fireEvent.change(screen.getByTestId('brief-settings-hour'), { target: { value: '6' } })
    fireEvent.change(screen.getByTestId('brief-settings-timezone'), { target: { value: 'America/New_York' } })
    fireEvent.click(screen.getByTestId('brief-settings-email'))
    fireEvent.click(screen.getByTestId('brief-settings-save'))

    await waitFor(() => expect(mSet).toHaveBeenCalledWith({
      enabled: true, hour: 6, timezone: 'America/New_York', channels: { inApp: true, email: true },
    }))
    expect(await screen.findByTestId('brief-settings-saved')).toHaveTextContent('06:00 America/New_York')
  })

  it('first-time users start at 07:00 in their browser time zone, turned off', async () => {
    mGet.mockResolvedValue({ subscription: null, deliveryActive: true, emailAvailable: false })
    mSet.mockResolvedValue({ subscription: { ...SUB, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, deliveryActive: true, emailAvailable: false })
    render(<MorningBriefSettings />)
    const toggle = await screen.findByTestId('brief-settings-enabled')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByTestId('brief-settings-hour')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.getByTestId('brief-settings-hour')).toHaveValue('7')
    expect(screen.getByTestId('brief-settings-timezone')).toHaveValue(Intl.DateTimeFormat().resolvedOptions().timeZone)
    fireEvent.click(screen.getByTestId('brief-settings-save'))
    await waitFor(() => expect(mSet).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, hour: 7 })))
  })

  it('disables email when the server has no email provider', async () => {
    mGet.mockResolvedValue({ subscription: SUB, deliveryActive: true, emailAvailable: false })
    render(<MorningBriefSettings />)
    await waitFor(() => expect(screen.getByTestId('brief-settings-email')).toBeDisabled())
    expect(screen.getByText(/email isn.t set up on this server yet/)).toBeInTheDocument()
  })

  it('blocks saving with no channel selected', async () => {
    mGet.mockResolvedValue({ subscription: SUB, deliveryActive: true, emailAvailable: true })
    render(<MorningBriefSettings />)
    await waitFor(() => expect(screen.getByTestId('brief-settings-inapp')).toBeChecked())
    fireEvent.click(screen.getByTestId('brief-settings-inapp'))
    fireEvent.click(screen.getByTestId('brief-settings-save'))
    expect(screen.getByTestId('brief-settings-error')).toHaveTextContent(/at least one way/)
    expect(mSet).not.toHaveBeenCalled()
  })

  it('turns the brief off', async () => {
    mGet.mockResolvedValue({ subscription: SUB, deliveryActive: true, emailAvailable: true })
    mSet.mockResolvedValue({ subscription: { ...SUB, enabled: false }, deliveryActive: true, emailAvailable: true })
    render(<MorningBriefSettings />)
    const toggle = await screen.findByTestId('brief-settings-enabled')
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(toggle)
    fireEvent.click(screen.getByTestId('brief-settings-save'))
    await waitFor(() => expect(mSet).toHaveBeenCalledWith(expect.objectContaining({ enabled: false })))
    expect(await screen.findByTestId('brief-settings-saved')).toHaveTextContent('The morning brief is off.')
  })

  it('warns when this server is not delivering yet, and surfaces save errors', async () => {
    mGet.mockResolvedValue({ subscription: SUB, deliveryActive: false, emailAvailable: true })
    mSet.mockRejectedValue(new Error('A valid IANA timezone is required'))
    render(<MorningBriefSettings />)
    expect(await screen.findByTestId('brief-settings-inactive')).toHaveTextContent(/isn.t switched on for this server/)
    fireEvent.click(screen.getByTestId('brief-settings-save'))
    expect(await screen.findByTestId('brief-settings-error')).toHaveTextContent('A valid IANA timezone is required')
  })
})
