import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CaptionCritiquePanel from '../CaptionCritiquePanel'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mCritique = api.critiquePost as jest.MockedFunction<typeof api.critiquePost>

describe('CaptionCritiquePanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('validates empty input without calling the API', () => {
    render(<CaptionCritiquePanel />)
    fireEvent.click(screen.getByTestId('critique-run'))
    expect(screen.getByTestId('critique-error')).toHaveTextContent(/paste your caption/i)
    expect(mCritique).not.toHaveBeenCalled()
  })

  it('scores the copy and renders overall, per-dimension scores, and fixes', async () => {
    mCritique.mockResolvedValue({
      platform: 'tiktok',
      scores: { hook: 8, clarity: 6, cta: 3, value: 7 },
      overall: 6, summary: 'Strong hook, weak CTA.',
      suggestions: ['End with one clear ask.', 'Cut the second sentence.'],
    })

    render(<CaptionCritiquePanel />)
    fireEvent.change(screen.getByTestId('critique-platform'), { target: { value: 'tiktok' } })
    fireEvent.change(screen.getByTestId('critique-input'), { target: { value: 'my caption' } })
    fireEvent.click(screen.getByTestId('critique-run'))

    await waitFor(() => expect(screen.getByTestId('critique-results')).toBeInTheDocument())
    expect(mCritique).toHaveBeenCalledWith({ text: 'my caption', platform: 'tiktok' })
    expect(screen.getByTestId('critique-overall')).toHaveTextContent('6')
    expect(screen.getByTestId('critique-score-hook')).toHaveTextContent('8')
    expect(screen.getByTestId('critique-score-cta')).toHaveTextContent('3')
    expect(screen.getAllByTestId('critique-suggestion')).toHaveLength(2)
    expect(screen.getByText('Strong hook, weak CTA.')).toBeInTheDocument()
  })

  it('surfaces an API error', async () => {
    mCritique.mockRejectedValue(new Error('rate limited'))
    render(<CaptionCritiquePanel />)
    fireEvent.change(screen.getByTestId('critique-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('critique-run'))
    await waitFor(() => expect(screen.getByTestId('critique-error')).toHaveTextContent('rate limited'))
  })
})
