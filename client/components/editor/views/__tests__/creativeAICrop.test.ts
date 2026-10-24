import { centerCropInsets } from '../CreativeAIView'

// Auto-reframe applies the server's centre-crop plan as the editor crop
// (percent insets the preview and the export both use).
describe('centerCropInsets', () => {
  it('crops the sides of a 16:9 source for a 9:16 frame', () => {
    const c = centerCropInsets(16 / 9, 9 / 16)
    expect(c.top).toBe(0)
    expect(c.bottom).toBe(0)
    expect(c.left).toBeCloseTo(34.18, 1)
    expect(c.right).toBeCloseTo(34.18, 1)
    // what remains is 9:16
    const keptW = (100 - c.left - c.right) / 100 * 16
    expect(keptW / 9).toBeCloseTo(9 / 16, 2)
  })

  it('crops top and bottom of a 9:16 source for a 1:1 frame', () => {
    const c = centerCropInsets(9 / 16, 1)
    expect(c.left).toBe(0)
    expect(c.top).toBeCloseTo(21.88, 1)
  })

  it('leaves a source that already matches untouched', () => {
    expect(centerCropInsets(9 / 16, 9 / 16)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })
})
