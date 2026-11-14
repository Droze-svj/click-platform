import { render, screen, fireEvent, within } from '@testing-library/react'
import path from 'path'
import { LiveDemo } from '../components/landing/LiveDemo'
import { HowItWorks } from '../components/landing/HowItWorks'
import { LearningLoop } from '../components/landing/LearningLoop'
import { PricingCard } from '../components/landing/PricingCard'
import { FAQ } from '../components/landing/FAQ'
import { FinalCTA } from '../components/landing/FinalCTA'
import { PLAN_LIMITS, FEATURE_MIN_PLAN, COMPARE_ROWS } from '../components/landing/planCompare'
import { PLANS } from '../lib/plans'

// The server's canonical entitlements: the landing must never promise more.
const entitlements = require(path.resolve(__dirname, '../../server/config/entitlements.js'))

describe('hook checker demo', () => {
  it('scores a typed hook in the browser and labels the rewrite as an example', () => {
    render(<LiveDemo />)
    expect(screen.getByRole('heading', { level: 2, name: /Check a hook/ })).toBeInTheDocument()
    const input = screen.getByLabelText('Your opening line')
    fireEvent.change(input, { target: { value: 'Money tips that are really amazing' } })
    expect(screen.getByRole('img', { name: /Hook score \d+ out of 100/ })).toBeInTheDocument()
    expect(screen.getByText(/Example rewrite \(the numbers are placeholders\)/)).toBeInTheDocument()
  })

  it('niche buttons are toggle buttons and no niche cycles on its own', () => {
    render(<LiveDemo />)
    const fitness = screen.getByRole('button', { name: 'Fitness' })
    expect(fitness).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(fitness)
    expect(fitness).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /Pause|Resume/ })).toBeNull()
  })
})

describe('how it works + learning loop', () => {
  it('names only platforms Click can publish to', () => {
    const { container } = render(<HowItWorks />)
    expect(container).toHaveTextContent('TikTok, Instagram, YouTube, X, LinkedIn and Facebook Pages')
    expect(container.textContent).not.toMatch(/Threads|Pinterest|90 seconds/)
  })

  it('explains the loop and what is learned, without invented cadences', () => {
    const { container } = render(<LearningLoop />)
    const loop = screen.getByRole('list', { name: 'The learning loop' })
    for (const step of ['Edit', 'Publish', 'Measure', 'Learn']) expect(within(loop).getByText(step)).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    expect(container.textContent).not.toMatch(/every 6 hours|forecast/i)
  })
})

describe('pricing', () => {
  it('cards use human labels, never internal ids', () => {
    const { container } = render(
      <div>
        {PLANS.map((p) => <PricingCard key={p.id} plan={p} period="monthly" onSelect={() => {}} />)}
      </div>,
    )
    expect(screen.getByText('Most popular')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/NODE_|MOST_POPULAR/)
  })

  it('comparison numbers match the limits the server enforces', () => {
    for (const plan of ['free', 'creator', 'pro', 'agency'] as const) {
      for (const [key, value] of Object.entries(PLAN_LIMITS[plan])) {
        expect([plan, key, entitlements.limitFor(plan, key)]).toEqual([plan, key, value])
      }
    }
    for (const [feature, plan] of Object.entries(FEATURE_MIN_PLAN)) {
      expect([feature, entitlements.FEATURES[feature].minTier]).toEqual([feature, plan])
    }
    expect(COMPARE_ROWS.length).toBeGreaterThan(5)
  })
})

describe('faq + final cta', () => {
  it('describes the trial the way the server runs it', () => {
    const { container } = render(<FAQ />)
    expect(container).toHaveTextContent('Every new account starts with 14 days of Pro, no card needed. After that you move to the Free plan')
    expect(container.textContent).not.toMatch(/free forever|90 seconds/i)
  })

  it('final CTA keeps the same terms', () => {
    render(<FinalCTA />)
    expect(screen.getByRole('link', { name: /Start free/ })).toHaveAttribute('href', '/register?plan=free')
    expect(screen.getByText(/14 days of Pro free · No card needed/)).toBeInTheDocument()
  })
})
