import { render, screen, waitFor } from '@testing-library/react'
import FeaturesDashboard from '../FeaturesDashboard'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')

describe('FeaturesDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(api.getStreak as jest.Mock).mockResolvedValue({
      unit: 'week', currentStreak: 1, longestStreak: 1, thisPeriodCount: 1, lastPostedAt: null, status: 'active',
    })
    ;(api.getLatestDigest as jest.Mock).mockResolvedValue({ digest: null })
    ;(api.getPendingReplies as jest.Mock).mockResolvedValue({ replies: [] })
    ;(api.getHeatmap as jest.Mock).mockResolvedValue({ grid: [], peak: null, totalPosts: 0, dayLabels: [] })
    ;(api.getResponderPlatforms as jest.Mock).mockResolvedValue({ platforms: [{ name: 'instagram', canSend: true }], sendEnabled: false })
    ;(api.getResponderHistory as jest.Mock).mockResolvedValue({ replies: [] })
  })

  it('renders all feature sections and settles its async children', async () => {
    render(<FeaturesDashboard />)
    expect(screen.getByTestId('features-dashboard')).toBeInTheDocument()
    // Composed surfaces present.
    expect(screen.getByLabelText('Fill my calendar')).toBeInTheDocument()
    expect(screen.getByLabelText('Comment triage')).toBeInTheDocument()
    // Async widgets resolve (streak card + digest empty-state + responder inbox).
    await waitFor(() => expect(screen.getByTestId('streak-card')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('digest-empty')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('responder-empty')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('heatmap-empty')).toBeInTheDocument())
  })
})
