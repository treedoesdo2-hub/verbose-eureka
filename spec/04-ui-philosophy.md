# 04 — UI Philosophy

Elaboration of ADR 009. This is the design brief for every screen the player sees.

## The one sentence

> **Clutch Legend's web-dashboard approach, executed at the quality of a Linear / Vercel / Notion product.**

## The three principles

### 1. Approachability beats density beats aesthetics

When these conflict, approachability wins. Density wins over aesthetics. Aesthetics come last.

- "Approachability" = a first-time player understands what they're looking at within 5 seconds of landing on a screen
- "Density" = expert players can see enough information to make decisions without clicking through sub-screens
- "Aesthetics" = it looks good

CL fails on approachability (cryptic abbreviations everywhere) AND on density (half the screens are 1/3 empty). Those two failures compound.

### 2. One visual language, enforced across every screen

The most visible problem with CL (and most indie mgmt games) is that every screen looks like a different product. Prevention:

- Component library built first, before any screens
- Every screen composed of library primitives
- Bespoke per-screen rendering only for combat view (which has unique requirements)
- Design tokens in code (colors, spacing, typography, motion curves) — not per-screen CSS

### 3. Keyboard-first

Power users navigate keyboard-first in the games they respect. BT, Rimworld, Dwarf Fortress, Cataclysm. Making every action keyboard-accessible is low cost and high differentiation.

## Component library

### Primitives (build these first)

| Component | Purpose | Notes |
|---|---|---|
| `Button` | Action trigger | Primary / secondary / tertiary / danger variants; size variants; icon optional; hotkey-label support |
| `Table` | Tabular data | Sortable columns, sticky header, row hover, row selection, compact/normal density |
| `Panel` | Bounded container | Visible border (1px), title bar optional, collapsible optional |
| `Modal` | Blocking overlay | One style only; escape closes; tab-trap inside; backdrop click closes |
| `Tooltip` | Hover info | Every abbreviation, icon, stat. Shift-hover for extended version. |
| `Tabs` | In-panel navigation | Horizontal strip; keyboard arrow nav |
| `SelectList` | Choice from options | Combobox with search; keyboard navigable |
| `Form controls` | Text input, number input, slider, toggle | Consistent focus states; validation built in |
| `StatBar` | Numeric with visual | HP bars, morale bars, resource bars — one atomic component with variants |
| `Badge` | Tag / status indicator | Faction badges, role tags, status flags — small, consistent |
| `Tag` | Removable filter chip | For loadout filters, unit tags, search refinements |
| `Breadcrumb` | Context location | For drilled-down screens (Roster → Bravo Lance → Sgt. Kowalski → Cyberware) |
| `Toast` | Non-blocking notification | "Contract saved" / "Kowalski promoted" — dismissable, auto-expires |
| `EmptyState` | When data is missing | Explains *why* empty, not just "no data" — tells the player what to do |

### Composite patterns

- `DetailView` — left nav + right panel pattern; used for roster, armory, contracts
- `StagingScreen` — pre-deployment view combining roster card list + mission brief
- `CombatHUD` — overlay atop combat view; speed controls, unit status strip, event log
- `Dashboard` — home/hub screen composition of cards

## Typography rules

Two typefaces, enforced.

- **UI / prose:** humanist sans-serif. Inter / Geist / Radio Canada — pick one, stick with it. Scale: 12 / 14 / 16 / 20 / 24 / 32. Weights: regular, medium, semibold. No bold in body text.
- **Data / code / numbers-in-columns:** monospace with tabular figures. JetBrains Mono / Berkeley Mono / IBM Plex Mono — pick one. Same scale. Tabular figures always when aligning numbers.

No display fonts. No "futuristic" fonts (no Orbitron, no Exo, no Eurostile). No hand-drawn fonts.

Rule of thumb: **if I'd be embarrassed to ship this typography on a B2B SaaS landing page, I'd be embarrassed to ship it here.**

## Color system

### Neutrals (backbone)

10-step grayscale for backgrounds, borders, and text. Dark-first; light theme inverts.

- `neutral.0` — deepest bg (dark) / pure white (light)
- `neutral.1–2` — panel backgrounds
- `neutral.3–4` — dividers, borders, muted bg
- `neutral.5–6` — disabled text, tertiary text
- `neutral.7–8` — secondary text, label text
- `neutral.9` — primary body text
- `neutral.10` — highest-emphasis text / pure foreground

### Accent

**One accent color.** Pick and commit. My suggestion: a deep desaturated blue or purple — not a saturated "gamer" color. Used for:
- Primary action buttons
- Selected-state highlights
- Focus rings
- Link-like actions

Not used for state indication. Not used for decorative borders. Not used for stat bars unless that stat is semantically linked to the accent.

### Semantic

Four semantic colors, reserved for state only:

- `green` — success, healthy, gain, positive delta
- `yellow` — warning, caution, moderate damage
- `red` — danger, damaged, loss, casualty, negative delta
- `blue-info` (distinct from accent) — neutral information, rarely used

Rule: if you're reaching for semantic color for decoration, use neutral instead.

### Faction colors

Exist for faction badges and team-identity UI only. Never hijacked for chrome.

## Spacing, motion, elevation

- **Spacing scale:** 0, 4, 8, 12, 16, 24, 32, 48, 64, 96 — use these, not arbitrary values
- **Borders:** 1px solid neutral.3 or neutral.4 — never 2px, never dashed, never double
- **Border radius:** 0, 4, 8 — that's it
- **Shadows:** one elevation level for modals/popovers; everything else is flat
- **Motion:** 120ms for UI feedback, 200ms for transitions, 400ms max for storytelling beats. Ease-out default.

## Anti-patterns (things we do not do)

Each of these is a concrete CL failure or generic indie-UI failure that we commit to avoiding:

- **Tutorial-modal full-page takeovers.** Tutorial lives inline as "?" pins next to unfamiliar UI. Dismissed individually.
- **Fake-locked feature placeholders.** If a feature isn't shipped, it's not in the UI. No "coming soon" buttons.
- **Trademarked feature names™.** No. Don't.
- **Emoji as icons.** Icons are monochrome line-SVG, sized consistently, with text backup.
- **Cryptic abbreviation top bars.** Every abbreviation has a tooltip. Better: write out the word if space permits.
- **Empty column right-side upsells.** If a column is empty, either fill it with real content or collapse the grid.
- **Five typefaces on one screen.** Two. Ever.
- **Inconsistent color semantics** (green meaning three different things across the app).
- **Modal chains** (5 sequential "click to continue" screens).
- **Decorative borders, gradients, glows** that convey no information.
- **Diegetic chrome** of any kind (see ADR 009).

## Accessibility as first-class

- Keyboard nav works for 100% of actions
- Tab order is sensible across every screen (designers verify)
- Focus states are visible and high-contrast
- WCAG AA color contrast minimum on all text-on-background
- Colorblind encoding via shape/icon as well as color (status uses both a color and an icon; stat bars use both a color and a shape)
- Font size respects user browser setting; zoom works
- Tooltip content also available via keyboard (focus triggers tooltip)

## Marketing screenshots

Acknowledge upfront: most of our screens will look like admin panels, not like games. This is the cost of the decision. The combat view (per Firefight-derived visual ref, `refs/firefight.md`) carries the "looks like a game" marketing weight.

The compensating message: our Steam page sells on *depth* and *respect for the player's time*, not on evocative chrome. The UI screens are proof of depth. The combat view is proof of game. Together they pitch the hardcore-mgmt buyer.

## Open questions

- Which specific accent color — desaturated indigo, teal, warm gold, other?
- Which specific typefaces — Inter vs Geist vs alternative
- Compact / normal / spacious density modes — do all three ship at launch, or just two?
- Dark / light theme — dark by default, light as equal citizen, or dark-only?
- Icon library source — commission custom, use Lucide/Phosphor as base, mix?

None of these block initial spec work. All should be decided before the component library is built.
