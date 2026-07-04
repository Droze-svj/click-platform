import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CommentTriageInbox from '../CommentTriageInbox'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mockedTriage = api.triageComments as jest.MockedFunction<typeof api.triageComments>
const mockedDraft = api.draftReply as jest.MockedFunction<typeof api.draftReply>

describe('CommentTriageInbox', () => {
  beforeEach(() => jest.clearAllMocks())

  it('validates empty input without calling the API', () => {
    render(<CommentTriageInbox />)
    fireEvent.click(screen.getByTestId('triage-run'))
    expect(screen.getByTestId('triage-error')).toHaveTextContent(/paste some comments/i)
    expect(mockedTriage).not.toHaveBeenCalled()
  })

  it('triages pasted comments and renders them grouped by priority', async () => {
    mockedTriage.mockResolvedValue({
      total: 3,
      counts: { high: 2, low: 1 },
      ranked: [
        { text: 'refund??', intent: 'complaint', priority: 'high', score: 95 },
        { text: 'how much?', intent: 'lead', priority: 'high', score: 85 },
        { text: 'love it', intent: 'praise', priority: 'low', score: 20 },
      ],
    } as any)

    render(<CommentTriageInbox />)
    fireEvent.change(screen.getByTestId('triage-input'), {
      target: { value: 'refund??\nhow much?\nlove it' },
    })
    fireEvent.click(screen.getByTestId('triage-run'))

    await waitFor(() => expect(screen.getByTestId('triage-results')).toBeInTheDocument())
    // Called with parsed, non-empty lines.
    expect(mockedTriage).toHaveBeenCalledWith([
      { text: 'refund??' }, { text: 'how much?' }, { text: 'love it' },
    ])
    // High-priority group present with both items; low group present.
    expect(screen.getByTestId('group-high')).toBeInTheDocument()
    expect(screen.getByTestId('group-low')).toBeInTheDocument()
    expect(screen.getAllByTestId('triage-item')).toHaveLength(3)
  })

  it('surfaces an API error', async () => {
    mockedTriage.mockRejectedValue(new Error('rate limited'))
    render(<CommentTriageInbox />)
    fireEvent.change(screen.getByTestId('triage-input'), { target: { value: 'hi' } })
    fireEvent.click(screen.getByTestId('triage-run'))
    await waitFor(() => expect(screen.getByTestId('triage-error')).toHaveTextContent('rate limited'))
  })

  it('drafts an AI reply for a triaged comment on the selected platform', async () => {
    mockedTriage.mockResolvedValue({
      total: 1, counts: { high: 1 },
      ranked: [{ text: 'what mic?', author: 'fan', intent: 'question', priority: 'high', score: 80 }],
    } as any)
    mockedDraft.mockResolvedValue({ reply: { _id: 'r1' } } as any)

    render(<CommentTriageInbox />)
    fireEvent.change(screen.getByTestId('triage-platform'), { target: { value: 'youtube' } })
    fireEvent.change(screen.getByTestId('triage-input'), { target: { value: 'what mic?' } })
    fireEvent.click(screen.getByTestId('triage-run'))

    await waitFor(() => expect(screen.getByTestId('triage-draft')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('triage-draft'))

    await waitFor(() => expect(screen.getByTestId('triage-drafted')).toBeInTheDocument())
    expect(mockedDraft).toHaveBeenCalledWith({ platform: 'youtube', inboundText: 'what mic?', author: 'fan' })
  })
})
