/**
 * The 7-day calendar read topic/hook/bestTime/estimatedReach — fields the
 * server never sends — so it showed bare day names. It now renders the date,
 * slot time, idea and target the server returns, or an honest empty state.
 * "Track handle" no longer claims to track (the server answers 501).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import GrowthInsightsView, { nextWeekDate } from '../GrowthInsightsView'
import * as api from '../../../../lib/api'

jest.mock('../../../../lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  handleApiError: (e: any) => String(e?.message ?? e),
}))
jest.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k),
    language: 'en', setLanguage: jest.fn(), isLoading: false,
  }),
}))
jest.mock('recharts', () => {
  const Pass = ({ children }: any) => <div>{children}</div>
  return { ResponsiveContainer: Pass, BarChart: Pass, Bar: Pass, XAxis: () => null, Tooltip: () => null, Cell: () => null }
})

const mGet = api.apiGet as jest.Mock
const mPost = api.apiPost as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('nextWeekDate', () => {
  it('maps day names onto the coming Monday–Sunday week', () => {
    const wed = new Date(2026, 9, 21) // Wednesday 21 Oct 2026
    expect(nextWeekDate('Monday', wed)?.getDate()).toBe(26)
    expect(nextWeekDate('Sunday', wed)?.getDate()).toBe(1)
    const mon = new Date(2026, 9, 26)
    expect(nextWeekDate('Monday', mon)?.getDate()).toBe(2) // next week, not today
    expect(nextWeekDate('Someday', wed)).toBeNull()
  })
})

describe('GrowthInsightsView next-week calendar', () => {
  function serve(weeklyPlan: any[]) {
    mGet.mockImplementation(async (url: string) => (url.startsWith('/competitive/next-week')
      ? { success: true, data: { weeklyPlan } }
      : Promise.reject(new Error('no benchmark'))))
  }

  it('renders each day’s idea, time and target', async () => {
    serve([{ day: 'Monday', time: '18:00', targetEngagement: 1200, content: { title: 'Open on the result', idea: 'Show the after shot first', platforms: ['tiktok'] } }])
    render(<GrowthInsightsView isOledTheme={false} />)
    fireEvent.click(screen.getByRole('button', { name: /next ?week/i }))
    await waitFor(() => expect(screen.getByText('Open on the result')).toBeInTheDocument())
    expect(screen.getByText('Show the after shot first')).toBeInTheDocument()
    expect(screen.getByText('18:00')).toBeInTheDocument()
    expect(screen.getByText(/editorPanels\.growthInsights\.targetEngagement/)).toBeInTheDocument()
    expect(screen.getByText(/Monday ·/)).toBeInTheDocument()
  })

  it('shows an honest empty state when no ideas came back, without refetching forever', async () => {
    serve([])
    render(<GrowthInsightsView isOledTheme={false} />)
    fireEvent.click(screen.getByRole('button', { name: /next ?week/i }))
    await waitFor(() => expect(screen.getByText('editorPanels.growthInsights.emptyPlan')).toBeInTheDocument())
    const nextWeekCalls = mGet.mock.calls.filter(([u]) => String(u).startsWith('/competitive/next-week'))
    expect(nextWeekCalls).toHaveLength(1)
  })

  it('shows the server’s reason when tracking is unavailable', async () => {
    serve([])
    mPost.mockRejectedValue(new Error('Competitor tracking is not available yet'))
    render(<GrowthInsightsView isOledTheme={false} />)
    fireEvent.change(screen.getByPlaceholderText('@competitor'), { target: { value: '@rival' } })
    fireEvent.click(screen.getByRole('button', { name: /Track handle/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('not available yet'))
    expect(screen.queryByText(/Now tracking/)).not.toBeInTheDocument()
  })
})
