import { render, screen } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { Nav } from '../components/landing/Nav'
import { Hero } from '../components/landing/Hero'

jest.mock('../components/ClickLogo', () => function ClickLogoMock() { return <span>Click</span> })

describe('landing header + hero', () => {
  it('nav: readable labels, real targets, a sign-up CTA that fits a phone', () => {
    render(<Nav />)
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how-it-works')
    expect(screen.getByRole('link', { name: 'What Click learns' })).toHaveAttribute('href', '#learning-loop')
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '#pricing')
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
    const cta = screen.getByRole('link', { name: /Start free/ })
    expect(cta).toHaveAttribute('href', '/register')
    expect(cta.className).toMatch(/whitespace-nowrap/)
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('hero: one h1, the edit → learn loop, the free CTA and the real trial terms', () => {
    render(<Hero />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/CLICK EDITS\.\s*YOU SHOW UP\./)
    const pitch = screen.getByText(/Click edits your raw video/)
    expect(pitch.className).not.toMatch(/\buppercase\b|\bitalic\b/)
    expect(pitch).toHaveTextContent(/reads how the post did/)
    const loop = screen.getByRole('list', { name: /How Click works/ })
    for (const step of ['Edit', 'Package', 'Publish', 'Measure', 'Learn']) expect(loop).toHaveTextContent(step)
    expect(screen.getByRole('link', { name: /Start free/ })).toHaveAttribute('href', '/register?plan=free')
    expect(screen.getByRole('link', { name: 'See how it works' })).toHaveAttribute('href', '#how-it-works')
    // Trial ⇒ Free (server: User.subscription default trial + 14 d; resolveTier trial ⇒ pro).
    expect(screen.getByText(/14 days of Pro free, then the Free plan\. No card needed\./)).toBeInTheDocument()
  })

  it('the gradient line keeps its last italic glyph (no bg-clip-text clipping)', () => {
    render(<Hero />)
    const line = screen.getByText('YOU SHOW UP.')
    expect(line.className).toMatch(/pr-\[0\.15em\]/)
    expect(line.className).toMatch(/box-decoration-clone/)
  })

  it('page: one story, in order, with no fake-live or zero-proof sections', () => {
    const src = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8')
    const order = ['<Nav />', '<Hero />', '<LiveDemo />', '<HowItWorks />', '<LearningLoop />', '<Pricing />', '<FAQ />', '<FinalCTA />', '<Footer />']
    const idx = order.map((tag) => src.indexOf(tag))
    expect(idx.every((i) => i > -1)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    for (const gone of ['Stats', 'Testimonials', 'NichePicker', 'Fingerprint', 'PlatformMarquee', 'EnginePillars', 'Workflow', 'IntelligenceShowcase', 'PlanBuilder']) {
      expect(src).not.toMatch(new RegExp(`\\b${gone}\\b`))
    }
  })
})
