/**
 * Every modal overlay must go through useDialogBehavior (or Modal / Sheet).
 *
 * `aria-modal="true"` is a claim, not a mechanism. It tells a screen reader the
 * rest of the page is inert; nothing enforces that. Before this sweep, ~40
 * overlays hand-rolled `fixed inset-0` with at most an Escape listener, so a
 * keyboard user could Tab straight out of an open dialog into the page behind
 * while the screen reader insisted they could not — and the page scrolled under
 * the overlay. useDialogBehavior is what actually enforces it: focus trap,
 * focus restore, scroll lock, Escape.
 *
 * This test finds overlays by their markup (`fixed inset-0` plus a close path)
 * rather than by a list, so a NEW hand-rolled dialog fails here on the day it is
 * written instead of being found by the next audit.
 *
 * If this fails: call useDialogBehavior in that component and put the returned
 * ref on the element that contains the dialog's controls. If it is not really a
 * dialog, add it to NOT_A_DIALOG with the reason.
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.join(__dirname, '..')
const DIRS = ['app', 'components']

// Overlays that are not dialogs. Each needs a reason — "it has fixed inset-0"
// is a shape, not a role, and the difference is what this list records.
const NOT_A_DIALOG = new Map<string, string>([
  [
    'app/dashboard/video/edit/[videoId]/page.tsx',
    'a full-screen editor MODE that replaces the page, not a dialog over it — there is no page behind to trap focus away from',
  ],
  [
    'app/dashboard/video/page.tsx',
    'the drag-and-drop file target (border-dashed), shown while a file is over the window; it has no controls',
  ],
  [
    'app/dashboard/content/[id]/page.tsx',
    'a decorative fingerprint watermark (pointer-events-none, opacity-[0.03]) behind the page content',
  ],
  [
    'components/AIContentOperationsDashboard.tsx',
    'a scan progress overlay with zero focusable controls and no close path — a busy indicator, not a dialog',
  ],
  [
    'components/ModernVideoEditor.tsx',
    'the drawer BACKDROP only (aria-hidden="true"); the editor surface is deliberately out of scope for behavioural changes',
  ],
  [
    'components/OnboardingTour.tsx',
    'a spotlight scrim for the product tour — the user is meant to see and reach the page underneath, which is the opposite of a trap',
  ],
  [
    'components/PWAManager.tsx',
    'the install prompt, pointer-events-none, anchored to the bottom edge; it never takes focus',
  ],
])

// Markup that means "an overlay covering the viewport".
const OVERLAY = /fixed inset-0/
// A close path — what separates a dialog from a decorative full-bleed layer.
const CLOSES = /\bonClose\b|\bonCancel\b|set(Show|Is|Open|Selected)[A-Za-z]*\(/
// Already correct, by any of the three routes.
const HANDLED = /useDialogBehavior|<Modal\b|<Sheet\b/

function tsx(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (/node_modules|\.next|__tests__/.test(p)) continue
      tsx(p, acc)
    } else if (e.name.endsWith('.tsx')) acc.push(path.relative(ROOT, p))
  }
  return acc
}

const files = DIRS.flatMap((d) => tsx(path.join(ROOT, d)))

// components/editor/** is excluded by an explicit scope decision: those files
// hang timeline, playback and drag handlers off their own markup, and are not
// to be changed behaviourally in this pass.
const inScope = files.filter((f) => !f.startsWith(path.join('components', 'editor')))

describe('dialog behaviour coverage', () => {
  it('walks a plausible number of files', () => {
    expect(inScope.length).toBeGreaterThan(200)
  })

  it('every modal overlay uses the shared dialog behaviour', () => {
    const offenders = inScope.filter((rel) => {
      if (NOT_A_DIALOG.has(rel)) return false
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
      return OVERLAY.test(src) && CLOSES.test(src) && !HANDLED.test(src)
    })

    expect(offenders.sort()).toEqual([])
  })

  it('the not-a-dialog list has no stale entries', () => {
    // An entry whose file no longer has an overlay — or which has since adopted
    // the hook — is an exemption nobody is checking any more.
    const stale = [...NOT_A_DIALOG.keys()].filter((rel) => {
      const abs = path.join(ROOT, rel)
      if (!fs.existsSync(abs)) return true
      const src = fs.readFileSync(abs, 'utf8')
      return !OVERLAY.test(src) || HANDLED.test(src)
    })

    expect(stale).toEqual([])
  })
})
