import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ResponderHistory from '../ResponderHistory'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mHistory = api.getResponderHistory as jest.MockedFunction<typeof api.getResponderHistory>

const reply = (id: string, status: string): any => ({
  _id: id, platform: 'twitter', author: 'fan', inboundText: 'love this!',
  draftReply: 'Thanks!', editedReply: null, status, externalCommentId: 't1',
})

describe('ResponderHistory', () => {
  beforeEach(() => jest.clearAllMocks())

  it('loads resolved replies and renders their status + final text', async () => {
    mHistory.mockResolvedValue({ replies: [reply('a', 'sent'), reply('b', 'rejected')] })
    render(<ResponderHistory />)
    await waitFor(() => expect(screen.getAllByTestId('history-item')).toHaveLength(2))
    expect(mHistory).toHaveBeenCalledWith(undefined)
    expect(screen.getAllByTestId('history-status')[0]).toHaveTextContent('sent')
  })

  it('prefers the edited reply over the draft in the shown text', async () => {
    mHistory.mockResolvedValue({ replies: [{ ...reply('a', 'sent'), editedReply: 'My edit' }] })
    render(<ResponderHistory />)
    await waitFor(() => expect(screen.getByTestId('history-item')).toHaveTextContent('My edit'))
  })

  it('refetches with the selected status filter', async () => {
    mHistory.mockResolvedValue({ replies: [] })
    render(<ResponderHistory />)
    await waitFor(() => expect(screen.getByTestId('history-empty')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('history-filter'), { target: { value: 'sent' } })
    await waitFor(() => expect(mHistory).toHaveBeenCalledWith('sent'))
  })

  it('surfaces a load error', async () => {
    mHistory.mockRejectedValue(new Error('nope'))
    render(<ResponderHistory />)
    await waitFor(() => expect(screen.getByTestId('history-error')).toHaveTextContent('nope'))
  })
})
