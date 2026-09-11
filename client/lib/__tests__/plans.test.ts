import fs from 'fs'
import path from 'path'
import { PLANS, buildCheckoutTarget } from '../plans'

// Next.js inlines NEXT_PUBLIC_* only where the code spells out the literal
// `process.env.NEXT_PUBLIC_X` expression. plans.ts used a dynamic lookup
// (process.env[key]); jest's real process.env hid the bug, but in the browser
// every paid plan's Whop checkout URL was empty. These tests read the source so
// that regression cannot come back unnoticed.
const source = fs.readFileSync(path.join(__dirname, '..', 'plans.ts'), 'utf8')

const CHECKOUT_VARS = [
  'NEXT_PUBLIC_WHOP_URL_CREATOR_MONTHLY',
  'NEXT_PUBLIC_WHOP_URL_CREATOR_YEARLY',
  'NEXT_PUBLIC_WHOP_URL_PRO_MONTHLY',
  'NEXT_PUBLIC_WHOP_URL_PRO_YEARLY',
  'NEXT_PUBLIC_WHOP_URL_AGENCY_MONTHLY',
  'NEXT_PUBLIC_WHOP_URL_AGENCY_YEARLY',
]

describe('plans checkout URLs', () => {
  it('reads every Whop checkout URL as a literal process.env expression Next.js can inline', () => {
    for (const name of CHECKOUT_VARS) {
      expect(source).toContain(`process.env.${name}`)
    }
  })

  it('never looks up process.env dynamically', () => {
    // Code only — the explanatory comment in plans.ts names the bad pattern.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/process\.env\??\.?\[/)
  })

  it('sends a signed-in user on a paid plan to Whop when its URL is set', () => {
    const pro = { ...PLANS.find((p) => p.id === 'pro')!, checkoutUrl: { monthly: 'https://whop.com/checkout/plan_pro', yearly: '' } }

    const target = buildCheckoutTarget(pro, 'monthly', { _id: 'u1', email: 'a@b.co' })

    expect(target.kind).toBe('whop')
    expect(target.href).toBe('https://whop.com/checkout/plan_pro?passthrough=u1&email=a%40b.co&plan=pro&billingCycle=monthly')
  })

  it('falls back to registration when the URL for that period is not configured', () => {
    const pro = { ...PLANS.find((p) => p.id === 'pro')!, checkoutUrl: { monthly: '', yearly: '' } }

    expect(buildCheckoutTarget(pro, 'yearly', { _id: 'u1' })).toEqual({
      kind: 'register',
      href: '/register?plan=pro&period=yearly',
    })
  })
})
