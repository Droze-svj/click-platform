import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ComposerPanel from '../ComposerPanel'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mHooks = api.generateHooks as jest.MockedFunction<typeof api.generateHooks>
const mCaptions = api.generateCaptions as jest.MockedFunction<typeof api.generateCaptions>
const mTags = api.generateHashtags as jest.MockedFunction<typeof api.generateHashtags>

function stub() {
  mHooks.mockResolvedValue({ platform: 'instagram', style: 'mix', hooks: [
    { text: 'Hook A', style: 'mix' }, { text: 'Hook B', style: 'mix' },
  ] })
  mCaptions.mockResolvedValue({ platform: 'instagram', captions: [
    { angle: 'hook', text: 'Caption one' }, { angle: 'story', text: 'Caption two' },
  ] })
  mTags.mockResolvedValue({ platform: 'instagram', count: 2, tags: [
    { tag: '#a', tier: 'broad' }, { tag: '#b', tier: 'niche' },
  ], groups: {} })
}

describe('ComposerPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('validates empty input without calling any API', () => {
    render(<ComposerPanel />)
    fireEvent.click(screen.getByTestId('composer-run'))
    expect(screen.getByTestId('composer-error')).toHaveTextContent(/enter a topic/i)
    expect(mHooks).not.toHaveBeenCalled()
  })

  it('fans out to all three tools and assembles a draft from the first picks', async () => {
    stub()
    render(<ComposerPanel />)
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'my topic' } })
    fireEvent.click(screen.getByTestId('composer-run'))

    await waitFor(() => expect(screen.getByTestId('composer-results')).toBeInTheDocument())
    for (const m of [mHooks, mCaptions, mTags]) {
      expect(m).toHaveBeenCalledWith({ topic: 'my topic', platform: 'instagram' })
    }
    // Default draft = first hook + first caption + all tags.
    expect(screen.getByTestId('composer-draft')).toHaveTextContent('Hook A')
    expect(screen.getByTestId('composer-draft')).toHaveTextContent('Caption one')
    expect(screen.getByTestId('composer-draft')).toHaveTextContent('#a #b')
  })

  it('re-assembles the draft when a different hook/caption is picked', async () => {
    stub()
    render(<ComposerPanel />)
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 't' } })
    fireEvent.click(screen.getByTestId('composer-run'))
    await waitFor(() => expect(screen.getByTestId('composer-results')).toBeInTheDocument())

    fireEvent.click(screen.getAllByTestId('composer-hook')[1])
    fireEvent.click(screen.getAllByTestId('composer-caption')[1])
    expect(screen.getByTestId('composer-draft')).toHaveTextContent('Hook B')
    expect(screen.getByTestId('composer-draft')).toHaveTextContent('Caption two')
  })

  it('copies the assembled draft', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    stub()
    render(<ComposerPanel />)
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 't' } })
    fireEvent.click(screen.getByTestId('composer-run'))
    await waitFor(() => expect(screen.getByTestId('composer-results')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('composer-copy'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Hook A\n\nCaption one\n\n#a #b'))
    expect(screen.getByTestId('composer-copy')).toHaveTextContent('Copied ✓')
  })

  it('surfaces an API error if any tool fails', async () => {
    stub()
    mCaptions.mockRejectedValue(new Error('rate limited'))
    render(<ComposerPanel />)
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 't' } })
    fireEvent.click(screen.getByTestId('composer-run'))
    await waitFor(() => expect(screen.getByTestId('composer-error')).toHaveTextContent('rate limited'))
  })
})
