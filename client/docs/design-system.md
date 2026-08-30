# Click UI — the design system, and how to build a page

Written during the 2026-08 UI/UX overhaul. This is the short version of what
exists, what rule each piece enforces, and what is still inconsistent.

---

## Colour: one brand hue, three representations

Click's brand is indigo `#6366f1`. It is expressed three ways and **all three
must agree**:

| | Where | Used by |
|---|---|---|
| `--primary: 243 75% 59%` | `app/globals.css` (semantic HSL) | `components/ui/*` via `bg-primary`, `ring` |
| `primary.50…950` | `tailwind.config.js` | `bg-primary-600` utilities (~32 files) |
| `--color-primary-50…900` | `app/globals.css` | the legacy `.btn-modern` / `.form-input-modern` / `.gradient-primary` classes |

These had drifted: the third was a **sky** ramp while the other two were indigo,
so a `.btn-modern-primary` and a `<Button variant="primary">` rendered as two
different brands on the same screen. If you add a colour, derive it from the
semantic tokens — do not start a fourth ramp.

Other things fixed in the same pass, so you don't reintroduce them:
- `--color-secondary-*` was a *neutral slate* ramp while Tailwind's `secondary`
  is fuchsia — one name, two colours. It is now `--color-neutral-*`.
- `--color-gray-*` and `--color-error-*` were defined and referenced nowhere.

## Density is real

`html[data-density]` is set from Settings → Appearance. `--density-scale`
(1 or 0.78) drives `.ds-density-pad` and `.ds-density-stack`, which `PageShell`
uses. Before this, the variable was declared and consumed by nothing, so the
Density control had no effect on screen at all. If you add page-level spacing,
scale it from that variable rather than hard-coding.

## Building a page

```tsx
<PageShell width="wide">              {/* frame: width, padding, density rhythm */}
  <PageHeader as="h2" title="…" description="…" actions={…} />
  <Toolbar left={<Search/>} right={<Filters/>} />
  <DataTable rows={…} columns={…} getRowId={…} />
</PageShell>
```

- **`PageShell`** — `narrow` (forms/settings), `default`, `wide` (dense
  dashboards), `full` + `flush` (canvas surfaces that own their bounds).
  It supplies `text-theme-primary`; you don't need to set it.
- **`PageHeader`** — `as="h2"` **on dashboard routes**, because
  `components/dashboard/DashboardHeader` still renders a route-derived `h1` in
  the app bar and two h1s on a page is invalid. Standalone routes (auth, legal)
  use the default `h1`. When every dashboard page owns a PageHeader, that app-bar
  title becomes a plain label and this goes back to `h1` everywhere.
- **`Toolbar`** — swaps itself for a bulk-action bar when `selectionCount > 0`,
  so list pages stop inventing their own selection UI.
- **`DataTable`** — owns loading, empty, error-with-retry and data. Sort
  numerically with `sortValue`; it copies before sorting rather than mutating
  your array.

**A header is not mandatory.** The dashboard home deliberately has no
`PageHeader` — its hero already carries the greeting and the primary CTAs, so a
header would repeat them. The archetype supplies the frame, not a fixed layout.

### The three states

Use `ClickLoadingState`, `ClickEmptyState` and `ClickErrorRecovery`. They carry
Click's voice from `lib/clickVoice.ts`. `ClickErrorRecovery` is already used by
all 47 dashboard `error.tsx` boundaries — the other two are still under-adopted
(162 files hand-roll `animate-spin`), so prefer them in anything you touch.

## Navigation

`components/SidebarNav.tsx` holds all 41 destinations, of which ~16 are
`primary: true` and visible; the rest sit behind "More (n)" and can be pinned by
the user. Pins and the default landing page persist to
`UserSettings.preferences` through `hooks/useWorkspacePrefs`, **not**
localStorage — this is the only UI customization in the app that follows a user
across devices, and new ones should follow it rather than the localStorage
pattern used elsewhere.

Adding a destination? Add it to a zone with `primary: false` unless it is a
daily job. `tests/server/routeMounts.test.js` will fail if a route file exists
but is neither mounted nor listed as intentionally dead.

## Where it still isn't consistent

**58 of 104 pages** use `PageShell`. The remaining 46:

| Kind | Count | Why they're still on their own frames |
|---|---|---|
| dashboard | 20 | Genuinely different layouts — the video editor and clips canvas manage their own bounds, `forge`/`marketing-ai` lead with a custom hero, `phase8`/`phase9`/`overlord` are experimental, and several are centred loading/empty states rather than framed pages. Each needs a judgement call, not a codemod. |
| public/marketing | 11 | The landing page and marketing surfaces have their own design language. The 7 legal/trust pages were made theme-aware in this pass but keep their own reading-width frame. |
| auth | 7 | Centred single-card layouts. |
| test/debug | 8 | Dev-only pages (`test-*`, `debug-dashboard`). Not worth styling. |

Other known gaps, measured rather than guessed:
- **1,371 raw `<button>` across 346 files** vs the shared `Button`. Concentrated
  in `components/editor/**`.
- **68 files** hand-roll `fixed inset-0` overlays instead of `Modal`/`Sheet`.
- **162 files** use a raw spinner instead of `ClickLoadingState`.
- **754 hardcoded hex colours** and **3,228 arbitrary `[NNpx]` values**, again
  worst in the editor.

Migrate opportunistically: when you touch a file for another reason, bring it
onto the primitives. The editor surface holds both the worst styling debt *and*
the most delicate interaction code (timeline, snapping, playback) — hand-migrate
it with real render checks, never with a bulk find-and-replace.

## Verifying UI work

```
cd client
npx tsc --noEmit                       # clean today
npm test -- --ci --watchAll=false      # 37 suites / 278 tests green today
npx next build                         # eslint runs here now and is a hard gate
```

Tests alone don't prove UI. Drive it: `npm run dev:test:server` (backend :5001,
in-memory DB, dev-user bypass) plus `pnpm dev -- --port 3010`, then walk the
route in **both themes**, at mobile/tablet/desktop widths, with
`data-density=compact` and `data-reduced-motion=true`, and once through on the
keyboard alone.
