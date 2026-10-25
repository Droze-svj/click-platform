// Settings, profile, projects, templates and clips report results with
// window.dispatchEvent(new CustomEvent('toast', …)). Nothing listened, so
// "Profile saved." and every "Couldn't save…" were silently dropped.
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { ToastProvider } from '../contexts/ToastContext'
import ToastContainer from '../components/ToastContainer'

function fire(detail: any) {
  act(() => { window.dispatchEvent(new CustomEvent('toast', { detail })) })
}

describe('window "toast" events', () => {
  it('show up in the toast stack', () => {
    render(<ToastProvider><ToastContainer /></ToastProvider>)
    fire({ message: 'Profile saved.', type: 'success' })
    expect(screen.getByText('Profile saved.')).toBeInTheDocument()
  })

  it('ignore events without a message and stop listening after unmount', () => {
    const { unmount } = render(<ToastProvider><ToastContainer /></ToastProvider>)
    fire({ type: 'error' })
    expect(screen.queryByRole('alert')).toBeNull()
    unmount()
    expect(() => fire({ message: 'late', type: 'info' })).not.toThrow()
    expect(screen.queryByText('late')).toBeNull()
  })
})
