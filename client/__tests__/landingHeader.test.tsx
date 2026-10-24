import { render, screen } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { Nav } from '../components/landing/Nav'
import { Hero } from '../components/landing/Hero'
import { LandingThemeProvider } from '../components/landing/LandingThemeContext'

jest.mock('../components/ClickLogo', () => () => <span>Click</span>)

describe('landing header + hero', () => {
  it('nav: readable labels, real targets, a sign-up CTA that fits a phone', () => {
    render(<Nav />)
    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features')
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#workflow')
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '#pricing')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
    const cta = screen.getByRole('link', { name: /Start free/ })
    expect(cta).toHaveAttribute('href', '/register')
    expect(cta.className).toMatch(/whitespace-nowrap/)
  })

  it('hero: headline, plain-language pitch and the free-plan CTA', () => {
    render(<LandingThemeProvider><Hero /></LandingThemeProvider>)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/CLICK EDITS\.\s*YOU SHOW UP\./)
    const pitch = screen.getByText(/Drop one raw video\./)
    expect(pitch.className).not.toMatch(/\buppercase\b|\bitalic\b/)
    expect(screen.getByRole('link', { name: /Start free/ })).toHaveAttribute('href', '/register?plan=free')
    expect(screen.getByText(/Free plan, no card needed/)).toBeInTheDocument()
  })

  it('the niche strip renders after the hero, not under the fixed nav', () => {
    const src = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8')
    const nav = src.indexOf('<Nav />'); const hero = src.indexOf('<Hero />'); const niche = src.indexOf('<NichePicker />')
    expect(nav).toBeGreaterThan(-1)
    expect(niche).toBeGreaterThan(hero)
  })
})
