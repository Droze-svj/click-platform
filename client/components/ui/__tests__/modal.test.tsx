import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { Modal, Sheet } from '../modal'

/**
 * These assert BEHAVIOUR, not markup. `aria-modal="true"` claims the rest of
 * the page is inert; before this hardening nothing enforced it, so a keyboard
 * user could Tab straight out of the dialog and the background still scrolled.
 * 65 hand-rolled overlays are migrating onto this component, so the guarantees
 * have to be real.
 */

const Dialog = ({ onClose = () => {}, ...rest }: any) => (
  <Modal open onClose={onClose} title="Confirm" {...rest}>
    <button type="button">First</button>
    <button type="button">Second</button>
  </Modal>
)

describe('Modal — dialog semantics', () => {
  it('renders as a labelled modal dialog', () => {
    render(<Dialog />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Confirm')
  })

  it('closes on Escape', () => {
    const onClose = jest.fn()
    render(<Dialog onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on backdrop click, unless closeOnBackdrop is false', () => {
    const onClose = jest.fn()
    const { rerender, container } = render(<Dialog onClose={onClose} />)
    fireEvent.click(container.querySelector('[aria-hidden]')!)
    expect(onClose).toHaveBeenCalledTimes(1)

    onClose.mockClear()
    rerender(
      <Modal open onClose={onClose} title="Confirm" closeOnBackdrop={false}>
        <button type="button">First</button>
      </Modal>
    )
    fireEvent.click(container.querySelector('[aria-hidden]')!)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Modal — focus management', () => {
  it('moves focus into the dialog on open', () => {
    render(<Dialog />)
    // The close (X) button is first in DOM order, so it takes initial focus —
    // the conventional behaviour, and it means Escape isn't the only way out
    // for someone who can't see the dialog.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('falls back to the panel when the dialog has no focusable controls', () => {
    render(
      <Modal open onClose={() => {}} title="Notice" hideClose>
        <p>Nothing to interact with.</p>
      </Modal>
    )
    // Focus must never be left outside the trap.
    expect(document.activeElement).not.toBe(document.body)
  })

  it('wraps Tab from the last control back to the first', () => {
    render(<Dialog />)
    const last = screen.getByRole('button', { name: 'Second' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    // Close (X) is the first focusable in the panel.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('wraps Shift+Tab from the first control back to the last', () => {
    render(<Dialog />)
    const first = screen.getByRole('button', { name: 'Close' })
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus()
  })

  it('pulls focus back in if it escapes the dialog', () => {
    render(
      <>
        <button type="button">Outside</button>
        <Dialog />
      </>
    )
    // Simulate focus having landed outside the trap.
    screen.getByRole('button', { name: 'Outside' }).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Outside' })).not.toHaveFocus()
  })

  it('restores focus to the element that opened it', () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Confirm">
            <button type="button">Inside</button>
          </Modal>
        </>
      )
    }
    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Open' })
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    // Without this, closing drops focus to <body> and a keyboard user restarts
    // from the top of the page.
    expect(opener).toHaveFocus()
  })
})

describe('Modal — background scroll lock', () => {
  it('locks body scroll while open and restores it on close', () => {
    document.body.style.overflow = 'auto'
    const { rerender } = render(
      <Modal open onClose={() => {}} title="Confirm"><button type="button">x</button></Modal>
    )
    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <Modal open={false} onClose={() => {}} title="Confirm"><button type="button">x</button></Modal>
    )
    // Restores the PREVIOUS value, not a hardcoded default.
    expect(document.body.style.overflow).toBe('auto')
  })
})

describe('Sheet', () => {
  it('gets the same dialog semantics and focus trap', () => {
    render(
      <Sheet open onClose={() => {}} title="Filters">
        <button type="button">Apply</button>
      </Sheet>
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('closes on Escape', () => {
    const onClose = jest.fn()
    render(<Sheet open onClose={onClose} title="Filters"><button type="button">Apply</button></Sheet>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
