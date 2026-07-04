import { render, screen } from '@testing-library/react'
import WeeklyDigestCard, { type Digest } from '../WeeklyDigestCard'

const digest: Digest = {
  summary: { trend: 'up', changePct: 40, totalEngagement: 12500, totalReach: 2_400_000, avgEngagementRate: 5.2, postCount: 4 },
  wins: [{ platform: 'tiktok', engagement: 9000 }],
  nextActions: [{ title: 'Do more duets', detail: 'they over-index for you' }],
  hasData: true,
}

describe('WeeklyDigestCard', () => {
  it('renders the empty state when there is no data', () => {
    render(<WeeklyDigestCard digest={null} />)
    expect(screen.getByTestId('digest-empty')).toBeInTheDocument()
    render(<WeeklyDigestCard digest={{ ...digest, hasData: false }} />)
    expect(screen.getAllByTestId('digest-empty').length).toBeGreaterThan(0)
  })

  it('renders trend, compacted numbers, and the first next action', () => {
    render(<WeeklyDigestCard digest={digest} />)
    expect(screen.getByTestId('digest-trend')).toHaveTextContent('▲ Up +40%')
    expect(screen.getByTestId('digest-engagement')).toHaveTextContent('12.5k')
    expect(screen.getByTestId('digest-action')).toHaveTextContent('Do more duets')
  })
})
