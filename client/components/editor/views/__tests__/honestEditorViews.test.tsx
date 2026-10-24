/**
 * Editor views that used to show fabricated data now show real data or an
 * honest empty state:
 *  - VariantFactoryView calls the real hook generator and shows no invented
 *    retention / viral scores.
 *  - IntelligenceEngineView shows "—" until real telemetry exists (it used to
 *    hard-code 88% / 8.2% / 4.5% / 92 and "Identity Lock: 99.8%").
 *  - MonetizationHub has no hard-coded revenue figures.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import VariantFactoryView from '../VariantFactoryView'
import IntelligenceEngineView from '../IntelligenceEngineView'
import MonetizationHub from '../MonetizationHub'
import * as featuresApi from '../../../../lib/featuresApi'

jest.mock('../../../../lib/featuresApi')
jest.mock('../../../../lib/api', () => ({
  apiGet: jest.fn().mockResolvedValue({ success: true, data: { products: [], provider: 'whop' } }),
  apiPost: jest.fn().mockResolvedValue({ success: true, data: {} }),
  apiPatch: jest.fn().mockResolvedValue({ success: true, data: {} }),
  handleApiError: (e: any) => String(e?.message ?? e),
}))
jest.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'en', setLanguage: jest.fn(), isLoading: false }),
}))

const mHooks = featuresApi.generateHooks as jest.MockedFunction<typeof featuresApi.generateHooks>

describe('VariantFactoryView', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does not call the generator without a transcript', () => {
    render(<VariantFactoryView topic="" onApplyVariant={jest.fn()} onBack={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'variantFactory.generate' })).toBeDisabled()
    expect(mHooks).not.toHaveBeenCalled()
  })

  it('shows the hooks the real generator returns, with no made-up scores', async () => {
    mHooks.mockResolvedValue({
      platform: 'tiktok', style: 'mix',
      hooks: [{ text: 'You are editing this wrong.', style: 'bold' }, { text: 'Why do your videos stall?', style: 'question' }],
    })
    const onApply = jest.fn()
    render(<VariantFactoryView topic="how I edit my videos faster" onApplyVariant={onApply} onBack={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'variantFactory.generate' }))

    await waitFor(() => expect(screen.getByText(/You are editing this wrong\./)).toBeInTheDocument())
    expect(mHooks).toHaveBeenCalledWith(expect.objectContaining({ topic: 'how I edit my videos faster' }))
    expect(screen.queryByText(/94%|98|Retention/)).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'variantFactory.apply' })[0])
    expect(onApply).toHaveBeenCalledWith({ text: 'You are editing this wrong.', style: 'bold' })
  })

  it('surfaces a real error instead of fake hooks', async () => {
    mHooks.mockRejectedValue(new Error('AI budget exceeded'))
    render(<VariantFactoryView topic="topic" onApplyVariant={jest.fn()} onBack={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'variantFactory.generate' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('AI budget exceeded'))
  })
})

describe('IntelligenceEngineView', () => {
  const dna = {
    cpm: 6, visualDensity: 2, assetAffinity: {}, audioDuckingPreference: -10, foleyFrequency: 0,
    preferredTransitions: [], preferredFonts: [], theme: 'vlog' as const, sentimentDrift: 0.1,
  }

  it('shows "—" and a not-enough-data note without telemetry', () => {
    render(<IntelligenceEngineView dna={dna} history={[]} />)
    expect(screen.getAllByText('—')).toHaveLength(3)
    expect(screen.getByText('intelligenceView.notEnoughData')).toBeInTheDocument()
    expect(screen.queryByText(/88%|99\.8%|92\/100/)).not.toBeInTheDocument()
  })

  it('shows the measured values from the latest telemetry entry', () => {
    const history = [{ kpis: { agenticAcceptanceRate: 60, manualOverrideDelta: 12.5, reversionRate: 25, sessionUtilityScore: 74 } }]
    render(<IntelligenceEngineView dna={dna} history={history} />)
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('12.5%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })
})

describe('MonetizationHub', () => {
  it('shows no hard-coded revenue numbers and an honest empty catalog', async () => {
    render(<MonetizationHub contentId="c1" initialProducts={[]} transcript="hello" onClose={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('monetizationHub.noProductsTitle')).toBeInTheDocument())
    expect(screen.queryByText(/42,892|4\.2%|\+12%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Get QR/)).not.toBeInTheDocument()
  })
})
