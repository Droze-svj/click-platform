import { render, screen, waitFor } from '@testing-library/react'
import StreakWidget from '../StreakWidget'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mGet = api.getStreak as jest.MockedFunction<typeof api.getStreak>

const streak: any = { unit: 'week', currentStreak: 3, longestStreak: 5, thisPeriodCount: 2, lastPostedAt: null, status: 'active' }

describe('StreakWidget', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows loading, then the streak card', async () => {
    mGet.mockResolvedValue(streak)
    render(<StreakWidget />)
    expect(screen.getByTestId('streak-loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('streak-card')).toBeInTheDocument())
    expect(screen.getByTestId('streak-current')).toHaveTextContent('3')
  })

  it('surfaces an error', async () => {
    mGet.mockRejectedValue(new Error('nope'))
    render(<StreakWidget />)
    await waitFor(() => expect(screen.getByTestId('streak-error')).toHaveTextContent('nope'))
  })
})
