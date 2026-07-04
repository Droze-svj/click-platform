import { render, screen, waitFor } from '@testing-library/react'
import DigestWidget from '../DigestWidget'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mGet = api.getLatestDigest as jest.MockedFunction<typeof api.getLatestDigest>

describe('DigestWidget', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the digest card when data is present', async () => {
    mGet.mockResolvedValue({
      digest: {
        summary: { trend: 'up', changePct: 10, totalEngagement: 1200, totalReach: 30000, avgEngagementRate: 4, postCount: 3 },
        wins: [], nextActions: [{ title: 'Keep going', detail: '…' }], hasData: true,
      },
    })
    render(<DigestWidget />)
    expect(screen.getByTestId('digest-loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('digest-card')).toBeInTheDocument())
    expect(screen.getByTestId('digest-trend')).toHaveTextContent('Up')
  })

  it('renders the empty state when there is no digest', async () => {
    mGet.mockResolvedValue({ digest: null })
    render(<DigestWidget />)
    await waitFor(() => expect(screen.getByTestId('digest-empty')).toBeInTheDocument())
  })

  it('surfaces an error', async () => {
    mGet.mockRejectedValue(new Error('down'))
    render(<DigestWidget />)
    await waitFor(() => expect(screen.getByTestId('digest-error')).toHaveTextContent('down'))
  })
})
