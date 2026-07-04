import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CaptionAnglesPanel from '../CaptionAnglesPanel'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mCaptions = api.generateCaptions as jest.MockedFunction<typeof api.generateCaptions>

describe('CaptionAnglesPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('validates empty topic without calling the API', () => {
    render(<CaptionAnglesPanel />)
    fireEvent.click(screen.getByTestId('captions-run'))
    expect(screen.getByTestId('captions-error')).toHaveTextContent(/describe your topic/i)
    expect(mCaptions).not.toHaveBeenCalled()
  })

  it('drafts captions and renders each with its angle label', async () => {
    mCaptions.mockResolvedValue({
      platform: 'linkedin',
      captions: [
        { angle: 'hook', text: 'Bold opener.' },
        { angle: 'story', text: 'Once, I…' },
      ],
    })

    render(<CaptionAnglesPanel />)
    fireEvent.change(screen.getByTestId('captions-platform'), { target: { value: 'linkedin' } })
    fireEvent.change(screen.getByTestId('captions-input'), { target: { value: 'remote work' } })
    fireEvent.click(screen.getByTestId('captions-run'))

    await waitFor(() => expect(screen.getAllByTestId('captions-item')).toHaveLength(2))
    expect(mCaptions).toHaveBeenCalledWith({ topic: 'remote work', platform: 'linkedin' })
    expect(screen.getAllByTestId('captions-angle')[0]).toHaveTextContent('Hook-led')
    expect(screen.getByText('Bold opener.')).toBeInTheDocument()
  })

  it('copies a caption to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    mCaptions.mockResolvedValue({ platform: 'instagram', captions: [{ angle: 'cta', text: 'Save this.' }] })

    render(<CaptionAnglesPanel />)
    fireEvent.change(screen.getByTestId('captions-input'), { target: { value: 't' } })
    fireEvent.click(screen.getByTestId('captions-run'))
    await waitFor(() => expect(screen.getByTestId('captions-item')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('captions-copy'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Save this.'))
    expect(screen.getByTestId('captions-copy')).toHaveTextContent('Copied ✓')
  })

  it('surfaces an API error', async () => {
    mCaptions.mockRejectedValue(new Error('rate limited'))
    render(<CaptionAnglesPanel />)
    fireEvent.change(screen.getByTestId('captions-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('captions-run'))
    await waitFor(() => expect(screen.getByTestId('captions-error')).toHaveTextContent('rate limited'))
  })
})
