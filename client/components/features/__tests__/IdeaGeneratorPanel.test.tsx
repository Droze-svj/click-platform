import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import IdeaGeneratorPanel from '../IdeaGeneratorPanel'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mIdeas = api.generateIdeas as jest.MockedFunction<typeof api.generateIdeas>

describe('IdeaGeneratorPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('validates empty input without calling the API', () => {
    render(<IdeaGeneratorPanel />)
    fireEvent.click(screen.getByTestId('ideas-run'))
    expect(screen.getByTestId('ideas-error')).toHaveTextContent(/niche or topic/i)
    expect(mIdeas).not.toHaveBeenCalled()
  })

  it('lists generated ideas with title, description, and format', async () => {
    mIdeas.mockResolvedValue([
      { title: '5 pantry dinners', description: 'Cheap + fast', format: 'carousel' },
      { title: 'Grocery haul', description: 'Under $30', format: 'video' },
    ])

    render(<IdeaGeneratorPanel />)
    fireEvent.change(screen.getByTestId('ideas-platform'), { target: { value: 'tiktok' } })
    fireEvent.change(screen.getByTestId('ideas-input'), { target: { value: 'budget cooking' } })
    fireEvent.click(screen.getByTestId('ideas-run'))

    await waitFor(() => expect(screen.getAllByTestId('ideas-item')).toHaveLength(2))
    expect(mIdeas).toHaveBeenCalledWith({ topic: 'budget cooking', platform: 'tiktok', count: 8 })
    expect(screen.getByText('5 pantry dinners')).toBeInTheDocument()
    expect(screen.getAllByTestId('ideas-format')[0]).toHaveTextContent('carousel')
  })

  it('shows an empty state when no ideas return', async () => {
    mIdeas.mockResolvedValue([])
    render(<IdeaGeneratorPanel />)
    fireEvent.change(screen.getByTestId('ideas-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('ideas-run'))
    await waitFor(() => expect(screen.getByTestId('ideas-empty')).toBeInTheDocument())
  })

  it('surfaces an API error', async () => {
    mIdeas.mockRejectedValue(new Error('rate limited'))
    render(<IdeaGeneratorPanel />)
    fireEvent.change(screen.getByTestId('ideas-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('ideas-run'))
    await waitFor(() => expect(screen.getByTestId('ideas-error')).toHaveTextContent('rate limited'))
  })
})
