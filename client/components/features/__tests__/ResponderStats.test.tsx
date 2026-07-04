import { render, screen, waitFor } from '@testing-library/react'
import ResponderStats from '../ResponderStats'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mStats = api.getResponderStats as jest.MockedFunction<typeof api.getResponderStats>

describe('ResponderStats', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the per-status counts and total for the last 30 days', async () => {
    mStats.mockResolvedValue({
      sinceDays: 30, total: 9,
      byStatus: { pending_approval: 2, approved: 1, sent: 5, rejected: 1, failed: 0 },
    })
    render(<ResponderStats />)
    await waitFor(() => expect(screen.getByTestId('stats-grid')).toBeInTheDocument())
    expect(mStats).toHaveBeenCalledWith(30)
    expect(screen.getByTestId('stats-total')).toHaveTextContent('9 total')
    expect(screen.getByTestId('stats-sent')).toHaveTextContent('5')
    expect(screen.getByTestId('stats-pending_approval')).toHaveTextContent('2')
    expect(screen.getByTestId('stats-failed')).toHaveTextContent('0')
  })

  it('zero-fills a status missing from the payload', async () => {
    mStats.mockResolvedValue({ sinceDays: 30, total: 0, byStatus: {} })
    render(<ResponderStats />)
    await waitFor(() => expect(screen.getByTestId('stats-grid')).toBeInTheDocument())
    expect(screen.getByTestId('stats-approved')).toHaveTextContent('0')
  })

  it('surfaces a load error', async () => {
    mStats.mockRejectedValue(new Error('down'))
    render(<ResponderStats />)
    await waitFor(() => expect(screen.getByTestId('stats-error')).toHaveTextContent('down'))
  })
})
