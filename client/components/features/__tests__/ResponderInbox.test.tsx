import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ResponderInbox from '../ResponderInbox'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mGet = api.getPendingReplies as jest.MockedFunction<typeof api.getPendingReplies>
const mApprove = api.approveReply as jest.MockedFunction<typeof api.approveReply>
const mReject = api.rejectReply as jest.MockedFunction<typeof api.rejectReply>
const mSend = api.sendReply as jest.MockedFunction<typeof api.sendReply>
const mPlatforms = api.getResponderPlatforms as jest.MockedFunction<typeof api.getResponderPlatforms>

const reply = (id: string): any => ({
  _id: id, platform: 'twitter', author: 'fan', inboundText: 'love this!',
  draftReply: 'Thanks so much!', editedReply: null, status: 'pending_approval', externalCommentId: 't1',
})

describe('ResponderInbox', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Sending off by default → approve/reject just drop the item.
    mPlatforms.mockResolvedValue({ platforms: [], sendEnabled: false } as any)
  })

  it('loads and lists pending replies, prefilled with the draft', async () => {
    mGet.mockResolvedValue({ replies: [reply('a'), reply('b')] })
    render(<ResponderInbox />)
    await waitFor(() => expect(screen.getByTestId('responder-inbox')).toBeInTheDocument())
    expect(screen.getAllByTestId('responder-item')).toHaveLength(2)
    expect((screen.getAllByTestId('responder-draft')[0] as HTMLTextAreaElement).value).toBe('Thanks so much!')
  })

  it('approves with the edited text and removes the item', async () => {
    mGet.mockResolvedValue({ replies: [reply('a')] })
    mApprove.mockResolvedValue({ reply: reply('a') })
    render(<ResponderInbox />)
    await waitFor(() => expect(screen.getByTestId('responder-item')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('responder-draft'), { target: { value: 'Edited reply!' } })
    fireEvent.click(screen.getByTestId('responder-approve'))

    await waitFor(() => expect(screen.queryByTestId('responder-item')).not.toBeInTheDocument())
    expect(mApprove).toHaveBeenCalledWith('a', 'Edited reply!')
    expect(screen.getByTestId('responder-empty')).toBeInTheDocument()
  })

  it('rejects an item and removes it', async () => {
    mGet.mockResolvedValue({ replies: [reply('a')] })
    mReject.mockResolvedValue({ reply: reply('a') })
    render(<ResponderInbox />)
    await waitFor(() => expect(screen.getByTestId('responder-item')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('responder-reject'))
    await waitFor(() => expect(screen.queryByTestId('responder-item')).not.toBeInTheDocument())
    expect(mReject).toHaveBeenCalledWith('a')
  })

  it('when sending is enabled, approve reveals Send now, which sends and clears the item', async () => {
    mGet.mockResolvedValue({ replies: [reply('a')] })
    mApprove.mockResolvedValue({ reply: reply('a') })
    mSend.mockResolvedValue({ reply: { ...reply('a'), status: 'sent' } })
    mPlatforms.mockResolvedValue({ platforms: [{ name: 'twitter', canSend: true }], sendEnabled: true } as any)

    render(<ResponderInbox />)
    await waitFor(() => expect(screen.getByTestId('responder-item')).toBeInTheDocument())

    // Approve keeps the item and swaps in the Send affordance.
    fireEvent.click(screen.getByTestId('responder-approve'))
    await waitFor(() => expect(screen.getByTestId('responder-send')).toBeInTheDocument())
    expect(mApprove).toHaveBeenCalledWith('a', undefined)
    expect(screen.getByTestId('responder-item')).toBeInTheDocument()

    // Send clears it.
    fireEvent.click(screen.getByTestId('responder-send'))
    await waitFor(() => expect(screen.queryByTestId('responder-item')).not.toBeInTheDocument())
    expect(mSend).toHaveBeenCalledWith('a')
  })

  it('surfaces a load error', async () => {
    mGet.mockRejectedValue(new Error('boom'))
    render(<ResponderInbox />)
    await waitFor(() => expect(screen.getByTestId('responder-error')).toHaveTextContent('boom'))
  })
})
