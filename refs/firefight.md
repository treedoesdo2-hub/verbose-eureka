# Ref — Firefight (combat-view visual reference)

**What it is:** WW2 squad-level tactical game. SDL2 native (not Electron). Real-time with pause. Top-down painted aerial terrain. Tiny unit sprites. Steam app 500190. User has v9.0.2 at `C:\Users\User\Downloads\Firefight.v9.0.2\`.

## Why it's in this repo

User's declared **visual reference for the combat phase**. Specifically: what a top-down tactical view looks like when done well at indie scale. The combat in our game should look like Firefight's tactical view, sci-fi-reskinned. NOT Firefight's *gameplay model* (RTwP with orders) — our combat is autonomous autobattler resolution. Only the visual language transfers.

## What Firefight establishes as the combat visual language

1. **Top-down painted aerial terrain** — 1024² painted satellite-style maps. Looks like lightly-processed drone photography or watercolor aerial. Cheap to produce at scale. Firefight has 20+ theaters (named: ASTM, BFRM, BGHL, DGCC, FLAU, KRDG, …), each with a base JPG + contour overlay + scenario data.

2. **Tiny unit sprites (~20–30px tall)** — sprite sheets with multiple pose/direction frames. Firefight has **1,110 unit sprite files total** but per-sprite cost is low because sprites are small. Full WW2 armament roster including artillery (100mm BS-3, 105mm Howitzer, 122mm M-30, 152mm ML-20, 17 Pounder, etc.). Each heavy weapon split into **base + gun** sprites — BT/Menace-style turret/chassis separation.

3. **Tactical overlays as primary visual interest** — aim circles, see cones, crosshair reticles, mortar aim pointer, shadows, speech bubbles, formation indicators, objective flagpoles. These are layered on top of the terrain. Pure code-generated in our Electron context (CSS/SVG/Canvas).

4. **Utilitarian military UI chrome** — olive-drab worn-metal panels, mottled texture, toolbar grippers, button strips along bottom. Zero ornament. Looks like field kit. Background PNGs are ~400x140 painted panels with faded corners.

5. **Splash / title art** — gritty B&W photograph of WW2 soldiers with a single red wordmark. "Authentic photo + red text" is a solo-dev-friendly composition trick we can steal (sci-fi variant: altered drone photo + amber wordmark).

## What transfers to our game

- **Top-down painted terrain** at ~1024² resolution per map. Sci-fi biomes: industrial complexes, alien terrain, urban ruins, frontier stations. 20–40 maps total. Pipeline: AI-gen aerial + heavy processing filter (posterize/dither) for consistency.

- **Tiny unit sprite pipeline** — ~20 operator classes × 8 directions × ~6 states. Pixellab is the right tool (user's existing pipeline). ~1000 sprites. 2–4 weeks of focused generation + curation.

- **Base+gun split for any gun-toting heavy gear** — exo-suits, mobile turrets, drones. Chassis sprite + weapon sprite composited at runtime. Saves art because a chassis works with many weapons.

- **Tactical overlay system** — aim cones, threat arcs, LOS cones, cover markers, movement trails, order indicators. All CSS/SVG/Canvas. Free. THIS IS THE VISUAL INTEREST of the combat view.

- **Worn-mil chrome** — our UI kit material metaphor. Scuffed plasteel + tactical amber (pending Q5) + hairline borders. Adapted from Firefight's olive-drab-and-mottled-metal.

## What does NOT transfer

- **RTwP gameplay model.** We are autobattler. Combat is autonomous. No pause, no orders during combat. Firefight's player gives orders mid-fight; we do not.

- **WW2 setting.** We are sci-fi / cyberpunk-frontier (pending Q4).

- **Satellite-photo look for terrain.** Too realistic. We want painted/processed sci-fi biomes, not real aerial photography.

- **1,110 unit roster.** Autobattler scale is ~20 classes × variants. Not a historical armament encyclopedia.

## Compression: how fights feel

Firefight fights are long (minutes to hours). Ours are **60–90 seconds**. This means:
- Units move and fire at autobattler pace (faster than RTwP Firefight)
- The visual must read at 2×/3× playback speeds
- Fewer units on screen than Firefight (5–6 per side vs potentially dozens)
- Bigger sprites relative to map than Firefight (because fewer units / smaller maps / shorter engagement time)

## Asset paths for reference

- `Images/splash_landscape.png` — B&W soldier photo + red wordmark (steal composition)
- `Images/Game/Control Panel/background_control_panel.png` — worn olive panel (reskin pattern)
- `Images/Game/Toolbar/toolbar_bottom.png` — panel strip w/ texture (reskin pattern)
- `Images/Uniforms/uniform_game_american.png` — sprite sheet layout (pose rows × direction cols, multiple states)
- `Images/Game/Tiles/Buildings/` — top-down building sprites w/ shadow variants (2x per building)
- `Maps/ASTM/ASTM.jpg` — painted aerial terrain example (1024² JPG)
