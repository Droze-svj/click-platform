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
all 47 dashboard `error.tsx` boundaries. Prefer the other two in anything you
touch — but read "What the raw debt counts actually mean" below before doing a
sweep: most existing spinners are NOT wrong.

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

**77 of 104 pages** use a shared frame — 62 `PageShell`, 5 `AuthShell`,
10 `LegalPage`. The remaining 27:

| Kind | Count | Why |
|---|---|---|
| dashboard | 15 | Genuinely different layouts — the video editor and clips canvas own their bounds, `forge`/`marketing-ai` lead with a custom hero, `phase8`/`phase9`/`overlord` are experimental, and several are centred loading/empty states rather than framed pages. |
| public/marketing | 1 | The landing page has its own design language. |
| auth | 3 | `register` and two invite/portal flows with bespoke layouts. |
| test/debug | 8 | `middleware.ts` 404s these in production. Not worth styling. |

### What the raw debt counts actually mean

Three "obvious" cleanups were measured before being attempted, and the numbers
did not survive contact with what the code does. Recorded here so nobody spends
a week on them again:

**Spinners (236 occurrences).** Not a component-swap problem. ~61 are in-control
refresh spinners (an icon spinning inside a button) which are correct as-is. 53
loading blocks already carry copy, and on most pages that copy is TRANSLATED via
`useTranslation` — `clickVoice` is English-only, so converting them would have
lost i18n on the 60 pages using it. Only 11 were genuinely bare. The real defect
was that 23 of these blocks sat in no live region, so screen readers announced
nothing at all; those now carry `role="status" aria-live="polite"`.

**Hardcoded hex (727 occurrences).** Most are legitimate: default values for
`<input type="color">` (a CSS variable renders nothing there), SVG presentation
attributes, canvas fills, and OG-image generation. The genuine issue is a
different one — ~105 dark background hexes that render dark regardless of theme.
Some of those are deliberate (the video editor is a dark canvas by design); the
rest need a design decision about which surfaces are theme-following, not a
find-and-replace.

**Raw `<button>` (1,348, ~1,030 outside the editor).** Only ~117 are
unambiguously "a button" in the `<Button>` sense. The rest are icon triggers,
list rows, tabs, chips and toggles — converting them wholesale would change the
appearance of hundreds of controls. Checked for the real bug class instead: a
typeless `<button>` inside a `<form>` defaults to submit, and there are **none**.

The pattern: convert opportunistically when you are in a file for another
reason, and measure before believing a count.

### The editor

`components/editor/**` (105 files) holds ~34% of the raw buttons and ~half the
hex/px values. Its buttons are deliberately out of scope: timeline, snapping,
playback and drag handlers hang off those elements, and a `<Button>` swap can
break them silently. Tokens and loading states there are fair game, file by file
with a render check.

## Motion

Every `motion.*` is `m.*`, with one `LazyMotion features={domMax}` provider at
the root (`components/MotionProvider.tsx`). This took 28 kB off the first load
of the heaviest routes — framer-motion was being bundled per-route, and now
loads once on demand.

Two rules:
- **Never import `motion`.** `m` renders nothing without a LazyMotion ancestor,
  and mixing the two defeats the code-splitting.
- **`domMax`, not `domAnimation`.** `drag`, `layout` and `layoutId` are absent
  from `domAnimation` and fail SILENTLY — the animation simply doesn't run.
  `ClickDynamicIsland` drags and is always mounted; 34 components use `layout`.

If a file already binds `m` to something else, import as
`import { m as Motion } from 'framer-motion'`.

## Dialogs

`Modal` and `Sheet` own Escape, a focus trap, focus restore and background
scroll lock. Overlays that are already built as bespoke JSX can adopt the same
behaviour without being rewritten:

```tsx
const panelRef = useDialogBehavior(isOpen, close)
<div className="fixed inset-0 …">
  <div ref={panelRef} role="dialog" aria-modal="true"> … </div>
</div>
```

`aria-modal="true"` claims the rest of the page is inert. If nothing enforces
that, the claim is false — which is what it was across every hand-rolled overlay
until this was added.

## Talking to the API

Three rules, each of which has already cost real bugs.

**1. Never prefix a path with `/api`.** `apiGet`/`apiPost`/… are configured with
`baseURL: '/api'`, so `apiGet('/autopilot')` — not `apiGet('/api/autopilot')`.
Native `fetch` DOES need the prefix. Guarded by
`tests/server/clientApiPrefix.test.js`.

**2. The path must exist.** Guarded by `tests/server/clientApiContract.test.js`,
which boots the server and resolves every literal path against the real router
stack. It exists because 30 client calls pointed at nothing; because almost every
call site ends in `.catch(() => {})`, they 404'd in total silence.

**3. Know which envelope you are reading.** The server has two conventions:

```js
sendSuccess(res, 'Plan ready', 200, { directions })  // → { success, message, data: { directions } }
res.json({ success: true, directions })              // → { success, directions }
```

The client helpers return the raw body, so the first must be read as
`res.data.directions` and the second as `res.directions`. Getting it wrong fails
in the worst possible way: `res.success` is `true` either way — it is on the
envelope — while the payload field is `undefined`, so the usual
`if (res.success && res.thing)` guard silently does nothing. Five features were
in that state, including the AI Director, which rendered "no directions" for
every video ever generated.

If you are not certain which the route uses, read `(res?.data ?? res)` — the
idiom already used across the editor — and type the response to match what the
server sends rather than what is convenient.

**And: a 202 is not a result.** The `/video/advanced/*` operations return
`{ videoId, operation }` immediately and run in the background. The payload
appears on `GET /video/progress/:videoId?operation=…` once `status` is
`completed`. `awaitVideoJob()` in `components/editor/views/AutomateView.tsx` is
the reference implementation.

## Verifying UI work

```
cd client
npx tsc --noEmit                       # clean today
npm test -- --ci --watchAll=false      # 38 suites / 290 tests green today
npx next build                         # eslint is a hard gate here now
```

Tests alone don't prove UI. Drive it: `npm run dev:test:server` (backend :5001,
in-memory DB, dev-user bypass) plus `pnpm dev -- --port 3010`, then walk the
route in **both themes**, at mobile/tablet/desktop widths, with
`data-density=compact` and `data-reduced-motion=true`, and once through on the
keyboard alone.
