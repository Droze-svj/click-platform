import { render, screen, waitFor } from '@testing-library/react'
import HeatmapWidget from '../HeatmapWidget'
import { paths } from '@/lib/featuresApi'
import * as api from '@/lib/featuresApi'
import { heatmapMax, cellIntensity, cellLabel } from '@/lib/featureViewModels'

jest.mock('@/lib/featuresApi', () => {
  const actual = jest.requireActual('@/lib/featuresApi')
  return { ...actual, getHeatmap: jest.fn() }
})

describe('featureViewModels heatmap helpers', () => {
  it('heatmapMax finds the largest avg', () => {
    expect(heatmapMax([{ avgEngagement: 3 }, { avgEngagement: 9 }, { avgEngagement: 1 }])).toBe(9)
    expect(heatmapMax([])).toBe(0)
  })
  it('cellIntensity normalizes 0..1 and guards max=0', () => {
    expect(cellIntensity(5, 10)).toBe(0.5)
    expect(cellIntensity(20, 10)).toBe(1)
    expect(cellIntensity(5, 0)).toBe(0)
  })
  it('cellLabel is human-friendly 12h', () => {
    expect(cellLabel(0, 9, ['Sun'])).toBe('Sun 9am')
    expect(cellLabel(1, 0, ['Sun', 'Mon'])).toBe('Mon 12am')
    expect(cellLabel(1, 13, ['Sun', 'Mon'])).toBe('Mon 1pm')
  })
})

describe('featuresApi.paths.heatmap', () => {
  it('builds /schedule/heatmap with optional platform, never /api-prefixed', () => {
    expect(paths.heatmap()).toBe('/schedule/heatmap')
    expect(paths.heatmap('tiktok')).toBe('/schedule/heatmap?platform=tiktok')
  })
})

describe('HeatmapWidget', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the grid + peak once loaded', async () => {
    ;(api.getHeatmap as jest.Mock).mockResolvedValue({
      grid: [{ day: 0, hour: 9, count: 2, avgEngagement: 100 }, { day: 1, hour: 20, count: 1, avgEngagement: 500 }],
      peak: { day: 1, hour: 20, avgEngagement: 500 },
      totalPosts: 3,
      dayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    })
    render(<HeatmapWidget />)
    expect(screen.getByTestId('heatmap-loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('heatmap-card')).toBeInTheDocument())
    expect(screen.getByTestId('heatmap-peak')).toHaveTextContent('Mon 8pm')
    // full 7×24 grid rendered
    expect(screen.getAllByTestId('heatmap-cell')).toHaveLength(7 * 24)
  })

  it('renders the empty state when there is no data', async () => {
    ;(api.getHeatmap as jest.Mock).mockResolvedValue({ grid: [], peak: null, totalPosts: 0, dayLabels: [] })
    render(<HeatmapWidget />)
    await waitFor(() => expect(screen.getByTestId('heatmap-empty')).toBeInTheDocument())
  })

  it('surfaces an error', async () => {
    ;(api.getHeatmap as jest.Mock).mockRejectedValue(new Error('nope'))
    render(<HeatmapWidget />)
    await waitFor(() => expect(screen.getByTestId('heatmap-error')).toHaveTextContent('nope'))
  })
})
