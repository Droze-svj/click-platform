import { render, screen } from '@testing-library/react'
import ClickAmbientCanvas from '../components/click/ClickAmbientCanvas'
import ClickSignal from '../components/click/ClickSignal'
import ClickLoadingState from '../components/click/ClickLoadingState'
import ClickPresence from '../components/click/ClickPresence'
import ClickEmptyState from '../components/click/ClickEmptyState'

describe('Click Kinetic Aperture visual system', () => {
  it('ClickAmbientCanvas renders decorative multi-layer atmosphere hidden from assistive tech', () => {
    const { container } = render(<ClickAmbientCanvas variant="hero" />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root).toHaveAttribute('data-click-atmosphere', 'hero')
    expect(root.className).toContain('fixed')
    expect(root.querySelector('.click-atmosphere-beam-primary')).not.toBeNull()
    expect(root.querySelector('.click-atmosphere-reticle')).not.toBeNull()
    expect(root.querySelector('.click-atmosphere-aperture-svg')).not.toBeNull()
  })

  it('ClickAmbientCanvas supports absolute positioning for scoped shells like AuthShell', () => {
    const { container } = render(<ClickAmbientCanvas variant="auth" positioning="absolute" />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('data-click-atmosphere', 'auth')
    expect(root.className).toContain('absolute')
  })

  it('ClickAmbientCanvas generates unique SVG gradient IDs across multiple instances', () => {
    const { container } = render(
      <>
        <ClickAmbientCanvas variant="app" />
        <ClickAmbientCanvas variant="app" />
      </>
    )
    const grads = Array.from(container.querySelectorAll('linearGradient')).map((g) => g.getAttribute('id'))
    expect(grads).toHaveLength(2)
    expect(grads[0]).toBeTruthy()
    expect(grads[0]).not.toEqual(grads[1])
  })

  it('ClickSignal renders semantic states and ripples only while synthesizing', () => {
    const { container, rerender } = render(<ClickSignal state="thinking" size="md" label="Click thinking" />)
    const signal = screen.getByRole('img', { name: 'Click thinking' })
    expect(signal).toHaveAttribute('data-click-signal', 'thinking')
    expect(container.querySelector('.click-signal-ripple')).toBeNull()

    rerender(<ClickSignal state="synthesizing" size="lg" />)
    const decorative = container.querySelector('[data-click-signal="synthesizing"]') as HTMLElement
    expect(decorative).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('.click-signal-ripple')).toHaveLength(2)
  })

  it('ClickLoadingState uses ClickSignal with live status region', () => {
    const { container } = render(<ClickLoadingState intent="loading.rendering" message="Rendering clip…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Rendering clip…')
    expect(container.querySelector('[data-click-signal="synthesizing"]')).not.toBeNull()
  })

  it('ClickPresence maps active states onto ClickSignal inside a directional beam pill', () => {
    const { container } = render(<ClickPresence state="presence.learning" />)
    expect(container.firstElementChild?.className).toContain('click-beam-pill')
    expect(container.querySelector('[data-click-signal="thinking"]')).not.toBeNull()
  })

  it('ClickEmptyState frames icons inside Click aperture vessel', () => {
    const { container } = render(
      <ClickEmptyState title="No clips yet" message="Drop a clip to begin." icon={<span>★</span>} />
    )
    expect(container.querySelector('.click-aperture-icon')).not.toBeNull()
    expect(screen.getByText('No clips yet')).toBeInTheDocument()
  })
})
