import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from '../../contexts/ToastContext'
import ToastContainer from '../ToastContainer'

function Fire() {
  const { showToast } = useToast() as any
  return <button onClick={() => showToast('Saved', 'success')}>fire</button>
}

// The root layout and ~50 pages each render a ToastContainer; a toast must
// still appear exactly once.
it('renders each toast once even with several containers mounted', () => {
  render(
    <ToastProvider>
      <ToastContainer />
      <ToastContainer />
      <Fire />
    </ToastProvider>
  )
  act(() => { screen.getByText('fire').click() })
  expect(screen.getAllByText('Saved')).toHaveLength(1)
})
