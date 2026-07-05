import { render, screen, waitFor } from '@testing-library/react'
import NextBestTile from '../NextBestTile'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mNext = api.getNextBest as jest.MockedFunction<typeof api.getNextBest>

describe('NextBestTile', () => {
  beforeEach(() => jest.clearAllMocks())

  it('lists grounded ideas when the loop has real data', async () => {
    mNext.mockResolvedValue({
      hasRealData: true, sampleSize: 42,
      ideas: [
        { title: 'Repeat your best hook', why: 'Your top 3 posts opened this way' },
        { title: 'Post Tue 7pm', why: 'Your peak window' },
      ],
    })
    render(<NextBestTile />)
    await waitFor(() => expect(screen.getAllByTestId('nextbest-item')).toHaveLength(2))
    expect(mNext).toHaveBeenCalledWith(4)
    expect(screen.getByText('Repeat your best hook')).toBeInTheDocument()
  })

  it('shows an honest prompt when there is not enough data', async () => {
    mNext.mockResolvedValue({ hasRealData: false, reason: 'need-more-data', ideas: [] })
    render(<NextBestTile />)
    await waitFor(() => expect(screen.getByTestId('nextbest-empty')).toHaveTextContent(/keep posting/i))
  })

  it('treats hasRealData:false with ideas as still empty (no fabricated ideas)', async () => {
    mNext.mockResolvedValue({ hasRealData: false, reason: 'need-more-data', ideas: [{ title: 'ghost' }] })
    render(<NextBestTile />)
    await waitFor(() => expect(screen.getByTestId('nextbest-empty')).toBeInTheDocument())
    expect(screen.queryByTestId('nextbest-item')).not.toBeInTheDocument()
  })

  it('surfaces a load error', async () => {
    mNext.mockRejectedValue(new Error('down'))
    render(<NextBestTile />)
    await waitFor(() => expect(screen.getByTestId('nextbest-error')).toHaveTextContent('down'))
  })
})
