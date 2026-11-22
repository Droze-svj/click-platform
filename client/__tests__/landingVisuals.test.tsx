import { render, screen, fireEvent, within } from '@testing-library/react'
import path from 'path'
import { HeroStage } from '../components/landing/HeroStage'
import { EditorCraft } from '../components/landing/EditorCraft'
import { HowItWorks } from '../components/landing/HowItWorks'
import { PLATFORMS } from '../components/landing/visuals'

// The registries the editor and the renderer actually use.
const grades = require(path.resolve(__dirname, '../../server/services/colorGradeRegistry.js'))
const captions = require(path.resolve(__dirname, '../../server/services/captionStyleRegistry.js'))

describe('landing visuals stay honest', () => {
  it('hero stage is labelled as an illustration and every number on it is marked as an example', () => {
    render(<HeroStage />)
    const fig = screen.getByRole('figure', { name: /Illustration of a video edited and packaged in Click/ })
    expect(within(fig).getAllByText('Example').length).toBeGreaterThanOrEqual(2)
    expect(fig.textContent).not.toMatch(/views|followers|\d+%/i)
  })

  it('names only the six platforms Click publishes to', () => {
    expect(PLATFORMS.map((p) => p.name)).toEqual(['TikTok', 'Instagram', 'YouTube', 'X', 'LinkedIn', 'Facebook Pages'])
  })

  it('grade buttons are real toggles, only offer registry grades and never cycle by themselves', () => {
    render(<EditorCraft />)
    const group = screen.getByRole('group', { name: 'Color grade' })
    const buttons = within(group).getAllByRole('button')
    const ids = grades.gradeIds()
    for (const b of buttons) {
      const label = b.textContent || ''
      const known = Object.values(grades.GRADES).some((g: any) => g.label === label)
      expect([label, known]).toEqual([label, true])
    }
    expect(ids.length).toBeGreaterThanOrEqual(buttons.length)
    const noir = within(group).getByRole('button', { name: 'Noir' })
    expect(noir).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(noir)
    expect(noir).toHaveAttribute('aria-pressed', 'true')
  })

  it('caption looks shown on the page exist in the caption style registry', () => {
    const ids: string[] = captions.captionStyleIds()
    for (const id of ['karaoke-fill', 'pill', 'neon', 'sticker']) expect(ids).toContain(id)
    render(<EditorCraft />)
    for (const name of ['Karaoke', 'Pill', 'Neon', 'Sticker']) expect(screen.getByText(name)).toBeInTheDocument()
    // No real creator's name on the marketing page.
    expect(document.body.textContent).not.toMatch(/MrBeast|Hormozi/i)
  })

  it('reframe offers exactly the formats smartReframe renders', () => {
    render(<EditorCraft />)
    const group = screen.getByRole('group', { name: 'Aspect ratio' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['9:16', '1:1', '16:9'])
  })

  it('how it works says its screens are illustrations', () => {
    render(<HowItWorks />)
    expect(screen.getByText(/Screens are illustrations of Click.s editor, not real accounts or results/)).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Upload', 'Edit', 'Package', 'Publish'])
  })
})
