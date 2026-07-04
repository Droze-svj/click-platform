import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CarouselComposerPanel from '../CarouselComposerPanel'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mCompose = api.composeSlides as jest.MockedFunction<typeof api.composeSlides>

describe('CarouselComposerPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('validates empty input without calling the API', () => {
    render(<CarouselComposerPanel />)
    fireEvent.click(screen.getByTestId('carousel-run'))
    expect(screen.getByTestId('carousel-error')).toHaveTextContent(/describe your idea/i)
    expect(mCompose).not.toHaveBeenCalled()
  })

  it('composes ordered slides for the chosen format', async () => {
    mCompose.mockResolvedValue({
      format: 'thread',
      slides: [{ n: 1, text: 'Hook' }, { n: 2, text: 'Point' }, { n: 3, text: 'CTA' }],
    })

    render(<CarouselComposerPanel />)
    fireEvent.change(screen.getByTestId('carousel-format'), { target: { value: 'thread' } })
    fireEvent.change(screen.getByTestId('carousel-input'), { target: { value: 'ship faster' } })
    fireEvent.click(screen.getByTestId('carousel-run'))

    await waitFor(() => expect(screen.getAllByTestId('carousel-slide')).toHaveLength(3))
    expect(mCompose).toHaveBeenCalledWith({ topic: 'ship faster', format: 'thread' })
    expect(screen.getByText('Hook')).toBeInTheDocument()
  })

  it('copies all slides numbered', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    mCompose.mockResolvedValue({ format: 'carousel', slides: [{ n: 1, text: 'A' }, { n: 2, text: 'B' }] })

    render(<CarouselComposerPanel />)
    fireEvent.change(screen.getByTestId('carousel-input'), { target: { value: 't' } })
    fireEvent.click(screen.getByTestId('carousel-run'))
    await waitFor(() => expect(screen.getByTestId('carousel-results')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('carousel-copy-all'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('1. A\n\n2. B'))
    expect(screen.getByTestId('carousel-copy-all')).toHaveTextContent('Copied ✓')
  })

  it('surfaces an API error', async () => {
    mCompose.mockRejectedValue(new Error('rate limited'))
    render(<CarouselComposerPanel />)
    fireEvent.change(screen.getByTestId('carousel-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('carousel-run'))
    await waitFor(() => expect(screen.getByTestId('carousel-error')).toHaveTextContent('rate limited'))
  })
})
