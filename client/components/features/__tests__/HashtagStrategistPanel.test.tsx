import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HashtagStrategistPanel from '../HashtagStrategistPanel'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mTags = api.generateHashtags as jest.MockedFunction<typeof api.generateHashtags>

const result = (): any => ({
  platform: 'instagram', count: 3,
  tags: [
    { tag: '#reach', tier: 'broad' },
    { tag: '#targeted', tier: 'niche' },
    { tag: '#micro', tier: 'community' },
  ],
  groups: { broad: ['#reach'], niche: ['#targeted'], community: ['#micro'], branded: [] },
})

describe('HashtagStrategistPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('validates empty topic without calling the API', () => {
    render(<HashtagStrategistPanel />)
    fireEvent.click(screen.getByTestId('hashtags-run'))
    expect(screen.getByTestId('hashtags-error')).toHaveTextContent(/describe your topic/i)
    expect(mTags).not.toHaveBeenCalled()
  })

  it('builds a tiered set and renders non-empty tiers only', async () => {
    mTags.mockResolvedValue(result())
    render(<HashtagStrategistPanel />)
    fireEvent.change(screen.getByTestId('hashtags-platform'), { target: { value: 'tiktok' } })
    fireEvent.change(screen.getByTestId('hashtags-input'), { target: { value: 'meal prep' } })
    fireEvent.click(screen.getByTestId('hashtags-run'))

    await waitFor(() => expect(screen.getByTestId('hashtags-results')).toBeInTheDocument())
    expect(mTags).toHaveBeenCalledWith({ topic: 'meal prep', platform: 'tiktok' })
    expect(screen.getAllByTestId('hashtags-tag')).toHaveLength(3)
    expect(screen.getByTestId('hashtags-tier-broad')).toBeInTheDocument()
    // Empty branded tier is not rendered.
    expect(screen.queryByTestId('hashtags-tier-branded')).not.toBeInTheDocument()
  })

  it('copies all tags space-joined', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    mTags.mockResolvedValue(result())

    render(<HashtagStrategistPanel />)
    fireEvent.change(screen.getByTestId('hashtags-input'), { target: { value: 't' } })
    fireEvent.click(screen.getByTestId('hashtags-run'))
    await waitFor(() => expect(screen.getByTestId('hashtags-results')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('hashtags-copy-all'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('#reach #targeted #micro'))
    expect(screen.getByTestId('hashtags-copy-all')).toHaveTextContent('Copied ✓')
  })

  it('surfaces an API error', async () => {
    mTags.mockRejectedValue(new Error('rate limited'))
    render(<HashtagStrategistPanel />)
    fireEvent.change(screen.getByTestId('hashtags-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('hashtags-run'))
    await waitFor(() => expect(screen.getByTestId('hashtags-error')).toHaveTextContent('rate limited'))
  })
})
