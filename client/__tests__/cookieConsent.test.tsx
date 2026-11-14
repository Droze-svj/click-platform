import { render, screen, fireEvent } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { CookieConsent } from '../components/CookieConsent'

const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/i18n/locales/en.json'), 'utf8')).cookieConsent
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => en[k.replace('cookieConsent.', '')] ?? k }),
}))

describe('cookie banner', () => {
  beforeEach(() => localStorage.clear())

  it('offers refusing exactly as prominently as accepting', () => {
    render(<CookieConsent />)
    const reject = screen.getByRole('button', { name: 'Strictly necessary only' })
    const accept = screen.getByRole('button', { name: 'Accept all' })
    expect(reject.className).toBe(accept.className)
    // Side by side on every screen size (no stacked column on phones).
    expect(reject.parentElement?.className).toMatch(/\bflex-row\b/)
    expect(reject.parentElement?.className).not.toMatch(/\bflex-col\b/)
  })

  it('stays a compact strip on phones: short text, capped height', () => {
    render(<CookieConsent />)
    const dialog = screen.getByRole('dialog', { name: 'Cookie consent' })
    expect(dialog.className).toMatch(/max-h-\[35vh\]/)
    expect(screen.getByText(/We use necessary cookies to keep you signed in/).className).toMatch(/\bsm:hidden\b/)
    expect(screen.getAllByRole('link', { name: 'Cookie Policy' }).length).toBeGreaterThan(0)
  })

  it('remembers the choice', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: 'Strictly necessary only' }))
    expect(localStorage.getItem('click.cookieConsent.v1')).toBe('rejected')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
