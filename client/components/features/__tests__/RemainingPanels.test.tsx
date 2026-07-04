import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RepurposeStudioPanel from '../RepurposeStudioPanel'
import FirstCommentPanel from '../FirstCommentPanel'
import SeriesPlannerPanel from '../SeriesPlannerPanel'
import { paths } from '@/lib/featuresApi'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi', () => {
  const actual = jest.requireActual('@/lib/featuresApi')
  return { ...actual, repurposeStudio: jest.fn(), generateFirstComments: jest.fn(), planSeries: jest.fn() }
})

describe('featuresApi.paths.series', () => {
  it('is /series and never /api-prefixed', () => {
    expect(paths.series()).toBe('/series')
  })
})

describe('RepurposeStudioPanel', () => {
  beforeEach(() => jest.clearAllMocks())
  it('validates empty input', () => {
    render(<RepurposeStudioPanel />)
    fireEvent.click(screen.getByTestId('repurpose-run'))
    expect(screen.getByTestId('repurpose-error')).toBeInTheDocument()
    expect(api.repurposeStudio).not.toHaveBeenCalled()
  })
  it('renders variants from the API', async () => {
    ;(api.repurposeStudio as jest.Mock).mockResolvedValue({
      count: 1,
      variants: [{ platform: 'tiktok', content: 'yo', hashtags: [], score: 90, suggestions: [], aspectRatio: '9:16', format: 'vertical' }],
    })
    render(<RepurposeStudioPanel />)
    fireEvent.change(screen.getByTestId('repurpose-input'), { target: { value: 'source' } })
    fireEvent.click(screen.getByTestId('repurpose-run'))
    await waitFor(() => expect(screen.getByTestId('repurpose-variants')).toBeInTheDocument())
    expect(screen.getByTestId('repurpose-variant')).toHaveTextContent('9:16')
  })
})

describe('FirstCommentPanel', () => {
  beforeEach(() => jest.clearAllMocks())
  it('renders generated options', async () => {
    ;(api.generateFirstComments as jest.Mock).mockResolvedValue({
      platform: 'instagram', goal: 'engagement', options: [{ text: 'Which one?', goal: 'engagement' }],
    })
    render(<FirstCommentPanel />)
    fireEvent.change(screen.getByTestId('firstcomment-input'), { target: { value: 'my post' } })
    fireEvent.click(screen.getByTestId('firstcomment-run'))
    await waitFor(() => expect(screen.getByTestId('firstcomment-options')).toBeInTheDocument())
    expect(screen.getByTestId('firstcomment-option')).toHaveTextContent('Which one?')
  })
})

describe('SeriesPlannerPanel', () => {
  beforeEach(() => jest.clearAllMocks())
  it('renders ordered parts', async () => {
    ;(api.planSeries as jest.Mock).mockResolvedValue({
      theme: 't', niche: 'n', platform: 'tiktok',
      parts: [{ part: 1, title: 'Setup', hook: 'h1', description: '' }, { part: 2, title: 'Payoff', hook: 'h2', description: '' }],
    })
    render(<SeriesPlannerPanel />)
    fireEvent.change(screen.getByTestId('series-theme'), { target: { value: 'startup' } })
    fireEvent.click(screen.getByTestId('series-run'))
    await waitFor(() => expect(screen.getByTestId('series-parts-list')).toBeInTheDocument())
    expect(screen.getAllByTestId('series-part')).toHaveLength(2)
    expect(api.planSeries).toHaveBeenCalledWith(expect.objectContaining({ theme: 'startup', parts: 5, platform: 'tiktok' }))
  })
})
