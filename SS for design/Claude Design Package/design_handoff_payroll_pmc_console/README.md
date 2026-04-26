# Handoff: PAYROLL — PMC Ops Console

## Overview

**PAYROLL** is a management / autobattler sim about running a private military company in a near-future cyberpunk setting. The tagline is *"You run the company. The company runs the war."* This handoff covers the **NEON WIRE** art direction — the picked visual language — across nine screens that together form the entire game's UI surface.

The thesis: every screen is a tactical console a real PMC operations officer would use. The UI *is* the game. The nine screens span three scopes of play:

1. **Core loop** — the three screens a player sees most: Main Menu (HQ dashboard), Combat (live tactical map), Armory (operator loadout).
2. **Mission cycle** — Contract Board → Briefing → Debrief. The loop a player walks on every mission.
3. **Strategic layer** — Order of Battle (roster at battalion scale), Battalion Command (multiple concurrent ops, live), Theater Map (regional territorial control).

## About the Design Files

The files in `source/` are **design references created in HTML + React + inline styles**, rendered through a design-canvas shell for presentation. They are prototypes showing the intended look, layout, and behavior — **not production code to copy directly.**

Your task is to **recreate these designs in the target codebase's environment** (Unreal UMG, Unity UI Toolkit, a web client, native, whatever the game uses) using its established patterns, component system, and rendering approach. The style objects, hex-clip polygons, and animated SVG in the prototypes are the visual spec — translate them, don't port them.

If no UI framework is in place yet, pick one that suits the game's engine and implement the designs natively there. These mockups are opinionated enough that the visual target is unambiguous.

## Fidelity

**High-fidelity (hifi).** Every value in the mocks is intentional: hex codes, spacing, letter-spacing, line-height, stroke widths, opacity levels, font families. Recreate pixel-for-pixel.

The one thing to treat as illustrative rather than literal is **placeholder data** — operator names, unit designations, coordinates, currency figures. Those are fiction-consistent sample content for layout, not real content. Your data layer will feed in real values.

---

## Design System — NEON WIRE

A cold, corporate cyberpunk ops-console aesthetic. Hex-clipped panels, deep navy base, triple-accent color encoding, three type faces, tabular numerics.

### Color tokens

```
// backgrounds
bg0       #060914   // app background
bg1       #0a0f1e   // system-bar / footer / inlay
bg2       #0f1529   // panel secondary / building fills
bg3       #141b33   // badge backing / bar track
panel     #0c1226   // primary panel fill

// lines
line      #1c2648   // hairline dividers
line2     #2a3860   // emphasized dividers, panel borders

// text
fg0       #e6edff   // primary
fg1       #98a4c8   // secondary
fg2       #5e6a8c   // labels / muted
fgDim     #3a4260   // disabled / separators

// accents — each encodes a specific state
cyan      #18e0ff   // primary · our forces · info · navigable
amber     #ffa020   // warning · caution · priority · contested
magenta   #ff2d9a   // kill · hostile · in-contact · alert
green     #33ffa0   // positive · ready · federal
red       #ff4a5c   // exclusion · insurgent · nil-entry

// soft tints
cyanSoft     rgba(24,224,255,0.10)
amberSoft    rgba(255,160,32,0.12)
magentaSoft  rgba(255,45,154,0.14)

// glow
cyanGlow     0 0 12px rgba(24,224,255,0.45)
```

**Color is semantic, not decorative.** Never use cyan just because it looks good — it means "ours" or "navigable." Never use magenta for prettiness — it means hostile contact or kill. If a UI element does not carry state, it is fg0/fg1/fg2 monochrome.

### Typography

Three faces, no more:

```
display  'Chakra Petch', 'Rajdhani', ui-sans-serif   // headlines, stat values, CTAs
body     'IBM Plex Sans', ui-sans-serif              // prose, briefs, descriptions
mono     'IBM Plex Mono', ui-monospace               // labels, data, timestamps, codes
```

Google Fonts import (prototype uses these weights):
```
Chakra Petch : 400, 500, 600, 700
Rajdhani     : 500, 600, 700
IBM Plex Sans: 400, 500, 600, 700
IBM Plex Mono: 400, 500, 600, 700
```

**Type rules:**
- Mono always uses `font-variant-numeric: tabular-nums` so columns of numbers align perfectly
- Uppercase labels on mono, with letter-spacing `0.14em–0.24em` depending on size
- Display face is reserved for headlines and big stat values; never body copy
- No text smaller than 9px; avoid text smaller than 10px except for kbd glyphs and tertiary labels

Representative scale used across the nine screens:
```
Display     32 · 26 · 22 · 16 · 14 · 12       (weight 700, letter-spacing 0.02–0.08em)
Body        13 · 12.5 · 12                    (line-height 1.45–1.5)
Mono        11.5 · 11 · 10.5 · 10 · 9.5 · 9 · 8.5   (letter-spacing 0.08–0.28em)
```

### Geometry — the hex-clip system

The iconic shape of NEON WIRE. Every panel has two opposite corners clipped to a 12px chamfer. Two variants alternate based on composition balance:

```
HEX_CLIP_TL_BR
  polygon(12px 0, 100% 0, 100% calc(100% - 12px),
          calc(100% - 12px) 100%, 0 100%, 0 12px)

HEX_CLIP_TR_BL
  polygon(0 0, calc(100% - 12px) 0, 100% 12px,
          100% 100%, 12px 100%, 0 calc(100% - 12px))
```

Buttons (`NWChip`) use a short parallelogram clip:
```
polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)
```

When recreating in a non-CSS environment (e.g. UMG), use 8-vertex polygons or 9-slice with chamfered corners — the *shape* is the signal, not the CSS technique.

### Core primitives

See `source/primitives.jsx` for the exact implementations. The vocabulary:

| Component   | Purpose                                                              |
| ----------- | -------------------------------------------------------------------- |
| `NWFrame`   | Root container. Deep navy, background grid, radial vignette at top.  |
| `NWSystemBar` | 32px top strip: logo, path breadcrumb, secure status, right cluster, timestamp. |
| `NWPanel`   | Hex-clipped container. Optional title row with `◢` accent glyph + right slot. Accent color is a prop (cyan / amber / magenta). |
| `NWChip`    | Parallelogram button. `primary` (cyan), `danger` (magenta), `small` variants. Supports inline `kbd` hint. |
| `NWCTA`     | Large hex-clipped call-to-action. `primary` variant glows cyan.      |
| `NWStat`    | Label + big tabular number + optional sub-label. Tone-colored.       |
| `NWBar`     | Thin horizontal meter. Hex-clipped ends, glows in its tone.          |
| `NWHexIcon` | Small filled/outline hexagon for list markers.                       |
| `NWDiamond` | Inline diamond glyph decoration.                                     |

### Background grid

Every screen draws a subtle cyan grid under the content:
```
backgroundImage:
  linear-gradient(rgba(24,224,255,0.025) 1px, transparent 1px),
  linear-gradient(90deg, rgba(24,224,255,0.025) 1px, transparent 1px);
backgroundSize: 48px 48px;
```
Plus a radial vignette `radial-gradient(ellipse at 50% 30%, rgba(24,224,255,0.04), transparent 60%)`.

### Iconography

**Monochrome line-SVG only.** No emoji. No Unicode decoration glyphs except a small set used as semantic markers:

```
◆  notice / priority / section marker
◢  panel title accent
▸  inline pointer / breadcrumb separator
●  live status dot (with tone color)
▪▫ filter on/off
║  vertical separator in system bar
━┅╳ legend strokes
```

These are typographic glyphs, not images. They can be replaced with SVG in the real build if your font stack doesn't render them consistently — but keep them to this small vocabulary.

### Animation

Almost none. NEON WIRE is a static tool — it is not a game HUD, it is the company's internal software. The exceptions:

- **Combat view** `s2` — animated tracers, muzzle flashes, rotating scan arc on drone overlay. Only live inside the combat frame.
- **Live status dots** — gentle `opacity 1 → 0.3 → 1` pulse on anything marked IN-CONTACT, BLACKLINE, SB-04 active. ~1.1–1.2s.
- **Theater map pings** `s9` — concentric ring sonar pulse (`r: 6 → 22 → 6`, `opacity: 0.7 → 0 → 0.7`, 2.8s, staggered by index).
- **Main menu map drone track** `s1` — amber dot pulse on a dashed path, 2.4s.

No hover glows. No "sci-fi chrome" transitions. Panels do not slide or fade in.

---

## Screens

Nine screens. Each is a fixed 1920×1080 layout (the prototypes are rendered in a design canvas that scales them to fit). The real product will need to be resolution-aware — these are the reference resolution.

### S1 · Main Menu / Ops Console (`source/s1-menu.jsx` → `NeonwireMainMenu`)

**Purpose.** Player's home screen. HQ dashboard. Answers: *what's going on right now, what's on offer, and what's our money situation.*

**Layout** — 3 columns, 280px · 1fr · 440px, 14px gutters, full-height.

- **Left column** (vertical stack, 12px gap)
  - `NWCompanyCard` — company logo (hex crest), license class, company name (`KESSLER & SONS`), HQ location.
  - `NWNavStack` — 7-item vertical nav: OPERATIONS (active), CONTRACTS (badge 12), ROSTER (badge 34), ARMORY, FACILITIES, LEDGER, INTEL (NEW). Each row: hex icon, label, optional badge, F-key hint. Active row gets cyan bar on left, cyan-soft fill.
  - `NWFundsCard` — `¥ 2,418,040` headline (display 34, cyan), escrow subline, 30-day burn bar, 4-stat grid (READY / DEPLOYED / WOUNDED / TRAINING).

- **Center** — single panel `NWHoloMap` titled "OPS / LIVE GRID · OSAKA-MC14". Chips in header: SECTOR · CONTRACTS · RIVALS with kbd 1/2/3. City-scale SVG map: 9 hex-tiled districts, river band, active AOI hex-ring (OP-CLEARWATER, cyan pulse), rival ring (DAIGO COMBINE, magenta pulse), 5 contract pins, amber drone track with pulse, compass, 2KM scale bar, atmo/wind/civ-density HUD strip at bottom-left.

- **Right column** (vertical stack)
  - `NWPriorityContract` — amber-accented panel with a priority inquiry (`ASSET RECOVERY · DAIGO COMBINE · ¥1.8M · 48H`), body brief, `ACCEPT` (primary) / `DECLINE` chips.
  - `NWContractBoard` — title "CONTRACT BOARD · 12 OPEN", 5 rows: code · client · type · pay · risk dot. Row 2 (OP-BLACKLINE) has magenta bar treatment (flagged).
  - `NWTicker` — magenta-accent panel titled "DARKNET · TICKER", 3 event lines with time + tone dot + text.

**System bar right cluster:** `● UPLINK` (green) · `║` · `OP/HOLST·K`.

---

### S2 · Combat View (`source/s2-combat.jsx` → `NeonwireCombat`)

**Purpose.** Live tactical picture during a mission. Top-down painterly — *not* a schematic grid. This is the only screen that carries moving visual effects.

**Layout** — full-bleed tactical map with HUD overlays. No grid/columns.

- **`NWCombatMap`** fills the frame. Painterly top-down view: buildings as filled polygons, streets as negative space, LOS fog at map edges, friendly operator silhouettes with facing ticks and numbered callsigns, enemy contacts in magenta, tracers as short bright arcs with faint trails, muzzle-flash radial gradients, smoke plumes as soft dark radial gradients, objective markers as small hex rings with numbers.

- **Objective bar** — centered along the top edge, flush to chrome. 560px min width, translucent bg0 at 72% + 6px blur. Reads `◆ OBJ 1/3 | SECURE MANIFEST · WAREHOUSE 07 | T+08:14 / 25:00 | [bar 33%]`.

- **Kill feed** — top-left, 24/56, 400px wide. No panel chrome. Monochrome mono text rows with tone-colored shooter name. Each row fades by opacity (newer at top: `opacity: 1 - i * 0.11`). Text has black text-shadow so it's legible over any map color.

- **Drone / time control** — top-right, 24/56, 220px. Translucent panel with hairline border. Shows `DRONE·01 · OVERWATCH`, altitude, heading, fuel, time-to-extract; playback controls (pause / 1x / 2x).

- **Squad roster inlay** — bottom of screen, dark-inlay strip. Per-operator cards: callsign, HP bar, ammo, status chip, armor-integrity hex. Selected operator gets cyan border.

- **Comms callouts** — contextual, floating near the operator who spoke. Small bg0-translucent bubbles with callsign + line.

**Nameplates policy.** Operator nameplates float *only* over selected or firing operators — never on everyone simultaneously. This is a core readability rule.

**System bar right cluster:** `● CONTACT` (magenta) · `DRONE·01 · 340M AGL` (cyan) · `T+08:14`.

---

### S3 · Armory / Mechlab (`source/s3-armory.jsx` → `NeonwireArmory`)

**Purpose.** Equip an individual operator. 11-zone paperdoll. Drag-to-zone. Live weight and delta previews.

**Layout** — 3 columns, 320px · 1fr · 360px. Top bar (88px) and bottom bar (70px) both present.

- **Top bar** (`NWArmoryTop`) — left: operator identity card with hex portrait, rank glyph, callsign `"HOLST"`, ID, squad/position. Center: combat-load meter — weight `28.4 / 32.0 KG · 88%`, segmented into ARMOR/WEAPON/ORDNC/MED·CMM with fill percentages; attribute readout below (`AR 9.8  WP 7.1  OR 6.8  MC 2.1  MS 2.6`). Right: weight warning / over-capacity indicator, load preset dropdown.

- **Left column** — `NWStockpile`: inventory filter chips, then a scrollable list of items grouped by category (WEAPONS · ARMOR · ORDNANCE · MED/COMMS). Each row: icon, name, weight, KG·DR cost, availability count, drag handle.

- **Center** — `NWPaperdollEditor`: the 11-zone front-view paperdoll. Zones are SVG polygons (HEAD · FACE · NECK · CHEST · L-ARM · R-ARM · ABDOMEN · L-LEG · R-LEG · L-HAND · R-HAND). Currently-equipped item shown inside each zone with plate/pad treatment. Empty zones render dashed outline. Hovering a stockpile item shows a green/red delta overlay on affected zones. Click a zone to inspect; drag an item on to equip.

- **Right column** — `NWZoneInspector`: detail of selected zone. Zone name, current item (or EMPTY), stats (weight, coverage, DR, ablation, tags), mount rules, "REMOVE" / "SWAP" actions. Amber preview card when hovering a swap candidate. SCAR-H / similar weapon-specific callout below if relevant.

- **Bottom bar** (`NWArmoryBottom`) — presets row: SAVE PRESET, LOAD PRESET, share with squad, lock loadout. Right: `DEPLOY ▸` primary CTA.

**Paperdoll reuse.** The same 14-polygon silhouette is reused in **s2 Combat** for the hit-zone schematic overlay — identical geometry, different palette (combat uses damage taken; armory uses coverage).

---

### S4 · Contract Board (`source/s4-contracts.jsx` → `NeonwireContracts`)

**Purpose.** Full-screen contract browser. Dedicated view (distinct from the main-menu teaser board).

**Layout** — 2 columns, 560px · 1fr, 14px gutters.

- **Left column** — vertical stack
  - `NWContractFilters`: 5 tab strip (ALL · 12 / PRIORITY · 3 / BOUNTY · 2 / STANDING · 4 / BLACKLINE · 1), then filter row (TYPE / RISK / PAY / DIST pills).
  - `NWContractList`: scrollable list of contract cards. Each card: code (display), client, type tag, pay (display, cyan), risk dot, distance, deadline. Priority cards have amber left-bar; blackline cards have magenta.
  - `NWContractSummary`: aggregate footer — sum of potential pay, committed squads required, projected burn.

- **Right column** — detail pane, 3 rows (300px / 1fr / 120px)
  - `NWContractMap`: zoomed map preview of the selected contract's target area. Reuses the hex-tile aesthetic from the main menu holo-map but framed for one site.
  - `NWContractDetail`: client brief (body copy), objectives list (primary / secondary / optional), risk factors, payment structure (base / completion bonus / escrow / penalty), opposing forces intel (confidence bars), window of operation.
  - `NWContractActions`: `ACCEPT ▸` primary CTA, `COUNTER-OFFER`, `DECLINE`, `ARCHIVE`.

**System bar right cluster:** `12 OPEN` (cyan) · `03 PRIORITY` (amber) · `REFRESH · T+00:48`.

---

### S5 · Briefing / Deployment Order (`source/s5-briefing.jsx` → `NeonwireBriefing`)

**Purpose.** Final review before launch. Objectives, map walk-through, squad confirmation, loadout lock, deploy.

**Layout** — 3 columns, 400px · 1fr · 420px.

- **Left column**
  - `NWBriefHeader`: blackline-tagged (magenta) panel, op code (`OP-BLACKLINE`), target location (`TOHO FLATS · SB-04 · UNIT 3-C`), 2-sentence intent brief.
  - `NWBriefObjectives`: 5-row table — priority tag (PRI / SEC / OPT / FAIL / BONUS), action verb, detail, tone color, payout.
  - `NWBriefComms`: 4 comms channel entries (CMD / SQUAD / DRONE / MEDEVAC) with frequency codes.

- **Center**
  - `NWBriefMap`: the mission map. Insertion point, route, objective markers, extract LZ, enemy patrol paths (dashed magenta), patrol timing band.
  - `NWBriefTimeline`: horizontal phased timeline (INFIL → CONTACT → EXFIL) with timing tick marks, pivot points, patrol rotation windows overlaid.

- **Right column**
  - `NWBriefSquad`: 6 operator slots. Callsign, role badge, loadout summary (primary / secondary / armor), status. Click to adjust. Slot order represents stack order.
  - `NWBriefDeploy`: final confirmation panel. Insert timing, LZ coords, aborts, `LOCK LOADOUT`, then `DEPLOY · T−00:42 ▸` primary CTA.

**System bar right cluster:** `● BRIEF · T−00:42` (amber) · `SQUAD 6/6` (cyan) · `LOADOUT LOCKED`.

---

### S6 · After Action Report / Debrief (`source/s6-debrief.jsx` → `NeonwireDebrief`)

**Purpose.** Battalion-scale AAR. The engagement (`OP-FALLINGBIRD`) is framed as a regional operation with the player's earlier squad infil (`OP-BLACKLINE`) embedded as one event inside it. The screen is *map-centric at regional scale*, with companies as counters (not individual operator pawns).

**Layout** — 3 columns, 280px · 1fr · 360px, plus a bottom footer spanning all columns.

- **Left rail (`NWDBLeftRail`)** — restricted/classified banner (amber diagonal hatch strip), doc header (`AFTER ACTION REPORT`, op name, date, author, distribution list), executive summary paragraph, outcome tag (`◈ PARTIAL SUCCESS` amber), contract performance numbers (pay earned vs. max, penalties, escrow returned), key loss ledger.

- **Center (`NWDBMap`)** — regional theater snapshot at the end of the engagement. Phase lines as labeled horizontal dashed strokes, axes of advance as broad cyan arrows, contested outposts, company counters as APP-6-styled plaques, timeline scrubber below the map so the player can step through phases.

- **Right rail (`NWDBRightRail`)** — decisions made during the op with their outcomes, comms extracts (notable transmissions), kill/loss itemized ledger, commendations and reprimands, intel gained (unlocks / new contacts).

- **Footer (`NWDBFooter`)** — archival bar. Doc ID, archive timestamp, signatures, `ARCHIVE & CLOSE` / `PRINT ORDER` / `REOPEN FOR REVIEW` actions.

**System bar right cluster:** `◈ PARTIAL SUCCESS` (amber) · `DOC · FB-0314-07` (cyan) · `ARCHIVED · 23:41 JST`.

---

### S7 · Order of Battle / Roster Manager (`source/s7-orbat.jsx` → `NeonwireOrbat`)

**Purpose.** The full battalion at a glance. "Wall of the ops room" — companies as vertical columns of APP-6-inspired unit plaques. Click any plaque to drill into that formation's subunits and attached assets.

**Data shape** — the file is worth reading for the data model alone. Battalion `BN` with totals, readiness breakdown (ready / limited / refit / casualty), treasury, current retainer, theatre. Then 4 companies (`HQ & SPT` · `ALPHA` · `BRAVO` · `CHARLIE`) each with a role, souls count, readiness tone, deployment status, units (each with echelon code sqd/sec/plt/coy, branch code INF/REC/CMD/MEC/ARM/ART/SPT/MED/ENG/SIG, designation, callsign, souls-present / souls-authorized, readiness tone, note) and attached assets.

**Layout** — 4+ column grid. Each company is a column; each row within a column is a unit plaque. Plaques are hex-clipped mini-panels with:

- Top row: echelon code (3 horizontal bars / 2 bars / dot combinations per APP-6), branch 2-letter code, designation (`1 PLT`), callsign (`"ANVIL"`)
- Middle: souls `28/32` as a fraction, readiness dot, role note
- Bottom: readiness bar (green/amber/magenta fill)
- Click: right-side drill-in panel showing full unit tree

One unit is highlighted as the "currently deployed" squad (`"BRAVO·06"`) — magenta plaque.

**Top strip** — battalion crest, designation, nickname, totals line, theatre.

**Right drill-in panel** — when a plaque is selected, shows: subunits (if a company/platoon), attached assets, full personnel list for a squad, equipment loadout summary, recent engagement log, morale/experience tags.

**System bar right cluster:** `4TH IRR BN "CORDON"` · `237 SOULS` · `KANTŌ FRINGE · SECTOR 7`.

---

### S8 · Battalion Command · Live Combat (`source/s8-command.jsx` → `NeonwireCommand`)

**Purpose.** Commander POV during multi-front operations. Multiple concurrent ops, one in contact, live comms, decisions pending. Counterpart to S6 (after-action → during-action) and the operational layer above S2 (single squad → whole battalion).

**Layout** — top banner (68px), 3 columns (340px · 1fr · 360px), bottom footer.

- **Banner (`BCBanner`)** — magenta+cyan gradient strip with pulsing magenta hex glyph (battalion insignia), battalion name, 5 mini-stats (COMMITTED / IN CONTACT / WIA·24h / KIA·24h / BURN·OP), and 2 chips: `RULES OF ENGAGEMENT` and `DECLARE WITHDRAW` (danger).

- **Left column** — 3 op cards (`BCOpCard`) for the active operations: `OP-BLACKLINE` (magenta, IN CONTACT), `OP-KITE-7` (cyan, RECON), `OP-TAILBACK` (amber, CONVOY). Each card: op code, unit, squad fraction, location, heat bar, time elapsed, quick stats (friendly / contact / wounded). Live op has pulsing magenta dot. Below the stack: `BCAttrTicker` showing 24h battalion attrition (WIA / MUNS / PROJ P&L).

- **Center (`BCTacticalFeed`)** — focused tactical picture of whichever op is selected. Big zoomed-out top-down battle map (~300 combatants, vehicles, mechs, tracers, explosions, smoke plumes) procedurally generated, seeded for stability. Named callouts tether to key units. Axis-of-advance arrow on bridgehead. Scale bar + coord header. Below the map: recent-events feed strip (3 latest comms lines for the focused op).

- **Right column** — `BCCommsLog` (top, flex 1): battalion-wide comms, time + callsign + text rows, tone-colored. Tab selector: ALL / BRAVO / ALPHA. Input row at bottom (`▸ TX · type to transmit · [TAB] to switch chan`). `BCDecisionQueue` (bottom): 3 pending decisions with op code, requestor, ask (`REQ SMOKE + QRF · ¥42K munitions · T−30s`), action chips (APPROVE / DENY / DEFER). Hot decisions get magenta bar + soft magenta fill.

- **Footer (`BCFooter`)** — commander identity, then chips: ORBAT (O) · THEATER (T) · COMMS (C) · HOLD ALL (H) · `ISSUE BN ORDER ▸` primary.

**The tactical map is the centerpiece.** It's seeded-procedural: buildings in an irregular urban grid with a river band and named bridge, ~300 units (infantry dots, power-armor squares, vehicle rectangles, mech hexes with arm lines, artillery), short streaking tracers (bright 28% head, faint trail, jittered), muzzle-flash radial gradients, radial explosion streaks, smoke plumes (under combat so it reads as atmosphere), FLOT dashed line, and axis-of-advance arrow. This is **not** animated in the prototype (performance) — but in production, tracers should animate and explosions should bloom.

**System bar right cluster:** `● IN CONTACT · 1` (magenta) · `◆ HOT · 2` (amber) · `KANTŌ FRINGE · SECTOR 7 · T 14:32:08`.

---

### S9 · Theater Map / Kantō Fringe (`source/s9-theater.jsx` → `NeonwireTheater`)

**Purpose.** The strategic layer. Regional territorial picture — who holds what, where the fringe (lawless) zones are, supply corridors, concurrent ops plotted. Counterpart to S1's city-scale holo-map; this is the whole theater.

**Layout** — top banner (68px), 3 columns (300px · 1fr · 360px), bottom footer.

- **Banner (`THBanner`)** — cyan+amber gradient strip. Left: theater glyph (concentric rings in a hex), "THEATER · STRATEGIC LAYER" kicker, big title `KANTŌ FRINGE`, subtitle + bbox. Center: **influence bar** — stacked horizontal bar with 6 segments (KESSLER 18% · DAIGO 31% · MERIDIAN 12% · RED·CELL 9% · FEDERAL 14% · NO-MAN'S 16%), legend below. KESSLER segment gets an inset cyan glow. Right: `EXPORT PLAN` / `ISSUE THEATER DIRECTIVE` chips.

- **Left column**
  - `THControlBar` — layer filter chips (CONTROL / OPS / SUPPLY / INTEL on; CIVIL / TERRAIN / WEATHER off).
  - `THZoneList` — 13 named zones sorted threat-first. Each row: kind glyph (city / base / hot / airport / wilds / water / exclusion), zone name + sub, holder tag + civ density. Selected row gets cyan border + cyan-soft fill.
  - `THLegend` — color legend for factions, plus line-style legend for SUPPLY OPEN / HARASSED / EXCLUSION / ACTIVE CONTACT.

- **Center (`THMap`)** — 1000×900 SVG regional map. Layers from back to front:
  1. Background grid (fine dot pattern + 40px grid lines)
  2. Sea mask (south + east edges)
  3. River spine (Tama/Arakawa composite, dashed cyan)
  4. Highways (amber long-dashed)
  5. Wilds patch (hatched pattern)
  6. 2 exclusion zones hatched in red (EXCLUSION · A fault core; EXCLUSION · B sealed)
  7. Territory control blobs (soft tinted polygons per faction)
  8. Supply corridor polylines (with flow chevrons; HARASSED is amber dashed)
  9. Scanner-pulse pings (animated concentric rings on fringe events)
  10. Clickable zone markers (kind-specific glyphs: hex for cities/bases, diamond for hot zones, circle+compass for airports, etc.)
  11. Tethered op badges (rectangles linked to zones with dotted lines, showing `OP-CODE / STATE · callsign`)
  12. Scale bar, compass, longitude ticks

- **Right column**
  - `THZoneFocus` — the selected zone's dossier. Label, holder badge, sub-line, 3-stat row (KIND / CIV·DEN / THREAT), linked-operation card if applicable (magenta-bordered for hot zones), action chips: `JUMP TO OP` / `BRIEF` / `INTEL DOSSIER` / `PLAN OP ▸`.
  - `THIntelFeed` — darknet ticker with time · tag (HOT / MOV / INT / ECON / RISK / KIA) · text rows.

- **Footer (`THFooter`)** — context strip + chips: MEASURE (M) · LAYERS (L) · ORBAT (O) · BATTLE (B) · `ASSIGN CONTRACT ▸` primary.

**System bar right cluster:** `◆ 4 OPS ACTIVE` (amber) · `2041.03.14 · 14:32 JST`.

---

## Interactions & Behavior

Most of the prototype is static presentation. The interactions that exist and should be preserved:

### Global

- Every panel title can have a right-side action cluster (chips, status, controls). Keep them aligned to the right of the title row, `gap: 8px`.
- Keyboard hints on chips (`kbd` prop) are displayed as a small inset pill. They are hints for the eventual shortcut; no real keybinding wired yet.
- Clicking a navigable item applies the cyan-border + cyan-soft-fill selected state. Always visible — no "selected" spinner or pending affordance.

### Screen-specific

| Screen | Interaction |
| ------ | ----------- |
| S1 Main Menu | Nav stack routes to other screens. Priority contract `ACCEPT` → S4 with that contract pre-selected. Contract list row click → S4 detail. Map markers clickable (future). |
| S2 Combat | Click operator in roster strip → select operator (nameplate appears). Click map → select whatever's under the cursor. Drone controls: pause / play / 2x. Objective bar updates with phase. |
| S3 Armory | Drag item from stockpile onto a paperdoll zone → equip. Click zone → inspect in right panel. Hover item → delta preview on affected zones. `REMOVE` / `SWAP` from inspector. `DEPLOY` → S5. |
| S4 Contracts | Filter tabs swap list scope. Row click → detail pane populates, map zooms to site. `ACCEPT` → S5. |
| S5 Briefing | Squad slot click → member swap (opens roster picker). `LOCK LOADOUT` disables armory changes. `DEPLOY` → S2. |
| S6 Debrief | Timeline scrubber below map re-plays the engagement phase-by-phase (map counters move to their position at that phase). `ARCHIVE & CLOSE` → S1. |
| S7 ORBAT | Click any unit plaque → right-side drill-in populates. Echelon collapse/expand. Filter by branch / readiness / deployment. |
| S8 Command | Left op card click → center feed switches focus. Comms input transmits on selected channel. Decision chips actually enact (APPROVE dismisses the card; APPROVE with cost deducts from banner burn). `ISSUE BN ORDER` opens an order builder (not designed yet). |
| S9 Theater | Zone list row click **and** map marker click both update the right-rail focus panel. Filter chips in left-rail toggle map layers. `PLAN OP` opens contract creation targeting this zone. |

### Animation specifics

- **Pulse** (status dot): `opacity 1 → 0.3 → 1` linear, 1.1–1.2s, `repeatCount=indefinite`.
- **Sonar ping** (S9 pings): on a `<circle>` — `r: 6 → 22 → 6`, `opacity: 0.7 → 0 → 0.7`, 2.8s, staggered start `i * 0.35s`.
- **Drone path bead** (S1): `opacity 0.4 → 1 → 0.4`, 2.4s.
- **Combat tracers** (S2): **real** tracers should animate — bright head moving along the arc and fading. In the prototype they're drawn static.

---

## State Management

For each screen, the minimum state model:

- **S1**: active nav item; priority contract status; map layer filters.
- **S2**: time (T+...), selected operator id, objective progress vector, kill feed ring buffer, drone state, camera pan/zoom, live units array (pos, facing, hp, ammo), tracer ring buffer (decays).
- **S3**: selected operator, selected zone, hover item, combat load derived state, stockpile filter.
- **S4**: filter tab, filter pills, selected contract.
- **S5**: op id in context, squad roster with loadouts, timeline cursor, loadout-locked flag, deploy countdown.
- **S6**: op id in context, timeline phase cursor, selected counter.
- **S7**: selected formation id, echelon filter, branch filter.
- **S8**: selected op id, comms channel filter, comms ring buffer, decision queue, banner tallies derived.
- **S9**: selected zone id, active map layers set, intel filter.

Data flow is top-down — the prototypes use React `useState` at the root of each screen and pass setters down. In production that maps 1:1 to whatever your client uses (Redux / MobX / reactive stores / game-engine model).

---

## Design Tokens — at a glance

Copy-paste into your theme file:

```
// colors
--pr-bg-0: #060914;
--pr-bg-1: #0a0f1e;
--pr-bg-2: #0f1529;
--pr-bg-3: #141b33;
--pr-panel: #0c1226;
--pr-line: #1c2648;
--pr-line-2: #2a3860;
--pr-fg-0: #e6edff;
--pr-fg-1: #98a4c8;
--pr-fg-2: #5e6a8c;
--pr-fg-dim: #3a4260;
--pr-cyan: #18e0ff;
--pr-amber: #ffa020;
--pr-magenta: #ff2d9a;
--pr-green: #33ffa0;
--pr-red: #ff4a5c;
--pr-cyan-soft: rgba(24,224,255,0.10);
--pr-amber-soft: rgba(255,160,32,0.12);
--pr-magenta-soft: rgba(255,45,154,0.14);
--pr-cyan-glow: 0 0 12px rgba(24,224,255,0.45);

// spacing — common gaps and paddings
--pr-pad-panel: 14px;
--pr-pad-compact: 10px;
--pr-pad-title-row: 10px 14px;
--pr-gap-columns: 14px;        // major 3-column layouts
--pr-gap-stack: 12px;           // vertical panel stacks
--pr-gap-inline: 8px;           // chip rows

// radii / clips — NEON WIRE uses clip-path polygons, not border-radius
// see HEX_CLIP_TL_BR / HEX_CLIP_TR_BL in primitives.jsx

// type
--pr-font-display: 'Chakra Petch', 'Rajdhani', ui-sans-serif;
--pr-font-body:    'IBM Plex Sans', ui-sans-serif;
--pr-font-mono:    'IBM Plex Mono', ui-monospace;

// line-height
--pr-lh-tight: 1;
--pr-lh-prose: 1.45;
```

---

## Assets

The prototypes generate **all imagery with SVG at runtime** — no raster textures, no external assets. This is intentional: hex crests, map geography, paperdoll silhouettes, unit counters, combat battlefields are all drawn from code.

In production you will likely replace:
- **Paperdoll silhouette** — currently 14 SVG polygons. Swap for your character silhouette at the same zone topology.
- **Hex crests** — currently procedural polygons. Can be replaced with per-company / per-faction crest art.
- **Map geography** — the prototypes use stylized invented shapes for Osaka (S1) and Kantō (S9). Swap for your actual game-world cartography, same visual vocabulary (cyan strokes, hex-tiled districts, dashed waterlines).
- **Operator portraits** — prototypes use a hex glyph only. Portrait assets will drop into the same hex frame.

No license-required assets. No third-party imagery.

---

## Source Files

Everything is under `source/`:

```
source/
├── index.html           entry point, loads React + Babel + all scripts
├── design-canvas.jsx    the DCSection / DCArtboard presentation shell (NOT part of the UI)
├── canvas.jsx           arranges all 9 artboards into 3 sections (NOT part of the UI)
├── primitives.jsx       NEON WIRE design system — tokens + NWPanel/NWChip/NWCTA/NWStat/NWBar/...
├── s1-menu.jsx          Main Menu / Ops Console
├── s2-combat.jsx        Combat View
├── s3-armory.jsx        Armory / Mechlab
├── s4-contracts.jsx     Contract Board
├── s5-briefing.jsx      Briefing / Deployment Order
├── s6-debrief.jsx       After Action Report
├── s7-orbat.jsx         Order of Battle / Roster Manager
├── s8-command.jsx       Battalion Command · Live Combat
├── s9-theater.jsx       Theater Map · Kantō Fringe
└── BRAND.md             brand note — tone, voice, vocabulary, non-negotiables
```

**To view the prototypes.** Open `source/index.html` in a browser with internet access (it loads React, Babel, and Google Fonts over CDN). You'll see all nine artboards in a pan/zoom canvas. Double-click any artboard to focus it full-screen. The canvas chrome (`design-canvas.jsx`, `canvas.jsx`) is presentation scaffolding only — **do not port it.** Each `s*.jsx` file exports the single React component you need (`NeonwireMainMenu`, `NeonwireCombat`, etc.).

**The authoritative spec** is this README + the pixel values in the `s*.jsx` files. When they conflict, the files win.

**BRAND.md** is the voice / tone / non-negotiables document — read it first, then come back here.
