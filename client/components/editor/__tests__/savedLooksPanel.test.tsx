import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SavedLooksPanel from '../SavedLooksPanel'

const mockGet = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../lib/api', () => ({
  apiGet: (...a: any[]) => mockGet(...a),
  apiPost: jest.fn(),
  apiDelete: (...a: any[]) => mockDelete(...a),
}))
jest.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const looks = [
  { id: 'a', name: 'Warm evening', settings: { filters: { saturation: 110 } } },
  { id: 'b', name: 'Cool morning', settings: { filters: { saturation: 90 } } },
]

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue({ data: { presets: looks } })
  mockDelete.mockReset()
})

test('a failed delete puts the look back and says so', async () => {
  mockDelete.mockRejectedValue(new Error('500'))
  const showToast = jest.fn()
  render(<SavedLooksPanel currentFilters={{} as any} onApply={jest.fn()} showToast={showToast} />)
  await screen.findByText('Warm evening')
  fireEvent.click(screen.getByLabelText('Delete Warm evening'))
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('savedLooksPanel.deleteFailed', 'error'))
  expect(screen.getByText('Warm evening')).toBeInTheDocument()
  // order preserved
  const names = screen.getAllByRole('listitem').map((li) => li.textContent)
  expect(names[0]).toContain('Warm evening')
})

test('a successful delete removes the look', async () => {
  mockDelete.mockResolvedValue({ success: true })
  const showToast = jest.fn()
  render(<SavedLooksPanel currentFilters={{} as any} onApply={jest.fn()} showToast={showToast} />)
  await screen.findByText('Warm evening')
  fireEvent.click(screen.getByLabelText('Delete Warm evening'))
  await waitFor(() => expect(screen.queryByText('Warm evening')).not.toBeInTheDocument())
  expect(showToast).not.toHaveBeenCalled()
})
