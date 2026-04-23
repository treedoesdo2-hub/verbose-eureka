# Firefight Audit — Integration Decisions

Written by @code after reading:
- `C:/Users/User/claude-forum/firefight-audit/findings.md`
- `C:/Users/User/claude-forum/firefight-audit/artifacts/firefight-combat-formulas.md`
- `C:/Users/User/claude-forum/firefight-audit/artifacts/firefight-combat-formulas.json`
- `C:/Users/User/claude-forum/firefight-audit/artifacts/terrain-palette.json`

The user gave a standing order to decide, document, and march. These are the
decisions. Rationale in each section.

## 1. Scope: what Firefight is, what we're adopting

**Firefight is a 3D physics-based ballistic simulator.** No `accuracy`, no
`hit_chance`, no `cover_level` enums exist in its data or binary. Hit/miss,
penetration, cover effect all emerge from casting real 3D projectiles
through a continuous heightmap against per-face vehicle armor and sprite
geometry. (Source: Opus RE report, §1-§8.)

**We are shipping an autobattler in ~2 weeks.** Building a full physics sim
is out of scope. The pragmatic read: port Firefight's *architectural
decisions* (geometric LOS, per-soldier state, quality-tiered aim error,
per-face vehicle armor) where they fit our game, skip the ballistic
integrator, keep stat-table hit resolution as the abstraction.

**Map-rework scope (this pass):**
- Map pipeline produces Firefight-matching occupancy + layout + palette
- Renderer shows map features visibly (not just base-byte)
- Elevation baked visually; geometric LOS ridge-rule preserved
- Integration tests validate the full chain

**Out of scope (future work, post-MVP):**
- Per-soldier heart rate / lactic acid / fatigue state machine
- Per-body-part wound model (10 parts × 4 severity tiers)
- Full ballistic integrator (projectile physics)
- Per-face vehicle armor in mm-at-slope

---

## 2. Key decisions mapped to plan tasks

### D1 — Keep `elevationStep: Uint8Array` discrete, continuous is future work
Firefight uses `feet × 100` (continuous int). We use `Uint8Array` 256 steps.
Discrete is fine for autobattler visual fidelity. Future: upgrade to Float32
if gameplay requires sub-step precision. No task change.

### D2 — DROP `elevationCoverBonus` byte (P3.8-P3.10)
Firefight does NOT abstract cover into a per-tile bonus byte. Cover is
geometric. Keep `LOS ridge rule` (P3.11) and `per-mode cliff guard` (P3.12)
— those are geometric approximations. Drop the bonus-byte approach as a
stat-table hack that doesn't match Firefight.

Downstream: P3.4 snapshot threading drops the `elevationCoverBonus` field.
P3.10 evaluateCover integration is deleted. LOS ridge rule (P3.11) remains
the sole geometric elevation-effect on combat.

**Tasks affected:** P3.8, P3.9, P3.10 → DELETE. P3.4 → reduce scope.

### D3 — Shaded relief baked at mapgen time, no runtime shader
Firefight bakes hill shading into the 4K hero JPG at authoring time —
runtime is pure sprite blitting, no lambert shader. Our P3.3 (Sobel shading
bake) matches this pattern. P3.5 (TerrainLayer consumes shadingBake) is the
blit step. Confirmed correct direction.

**Tasks affected:** P3.3 through P3.7 stay. Reaffirmed.

### D4 — Emit optional contour overlay PNG (NEW)
Firefight ships `-contours.png` per map as a transparent RGBA overlay for
zoom-out elevation visualization. Per the user: "contour lines for the
height map are only available zoomed all the way out."

Add to mapgen pipeline: generate `contours: Uint8Array` (per-tile:
contour present 0/1) alongside `shadingBake`. Renderer shows at zoom-out.
NEW TASKS.

### D5 — Terrain palette from `terrain-palette.json`
Firefight palette is desaturated warm earth tones. **Water is NOT blue.**
Adopt the per-terrain RGB values in `artifacts/terrain-palette.json`:

```
open:   rgb(100, 96, 37)   #646025
road:   rgb(150, 138, 117) #968A75
forest: rgb(62, 71, 22)    #3E4716
water:  rgb(95, 97, 29)    #5F611D   (olive-grey, NOT blue)
mud:    rgb(106, 91, 42)   #6A5B2A
sand:   rgb(150, 127, 81)  #967F51
```

Rubble: no Firefight reference (handled via state-variant sprites in FF).
We'll use a darker/greyer variant of `mud` for rubble. Snow: no FF sample
(no winter map in panel); keep current palette, revisit later.

**Tasks affected:** P1.3 (unify terrain palette) reaffirmed, with these
values as the target.

### D6 — Sprite+shadow rendering pattern (ARCHITECTURAL FUTURE)
Firefight renders buildings/trees/vehicles as sprite + separate shadow PNG
pair (shadow offset SE, NW sun). This is the "lightly 3D" look.

For this rework: TerrainLayer (P1.4) renders tiles as RGBA from the shaded
hero PNG. No sprite+shadow for procedural features in MVP (we don't have
per-building sprites). Note in spec; defer to post-MVP when we add authored
sprites.

**Tasks affected:** P1.4 continues to Sprite-per-chunk (Canvas2D pre-bake).
No new tasks. Documented as future direction.

### D7 — urban_sparse targets: algorithmic extrapolation
Firefight has no urban_sparse exemplar. Panel options:
- urban_dense (VBOC/DGCC/BLNU): dense gridded urban
- rural_village (NSVL/TRCH/ZCRD): village-rural

urban_sparse = scattered houses in rural-ish setting. Extrapolate:
`urban_sparse_target = urban_dense × 0.4 + rural_village × 0.6`

This weighting reflects "mostly rural with urban punctuation." Apply per
category in `firefight-biome-targets.json`. Codify in Phase 0's
classification JSON with a justification.

**Tasks affected:** P0.2 (classification.json) — add extrapolation formula.

### D8 — Skip binary `.dat` decode
Opus RE gave us the architecture (`pHillHeightsInFeetTimesOneHundred`,
`pRoofHeights`, `pSpriteGrids`, `pBarrierGrids`). JPG pixel classification
gives us occupancy percentages. Binary precision is nice-to-have but not
load-bearing. 2-4 hours saved. Revisit post-MVP if needed.

### D9 — Briefing UI: ignore Firefight as reference
User explicit: "Firefight doesn't do loadout/equipment like we do. Looking
to them for combat, not pre-combat UX." Our briefing retains its current
role (objectives list, force composition, loadout). Keep the one lesson:
**thumbnail is a rendered terrain miniature at usable size, not an
abstract icon, not 96×96.** Size target: 256-384 px range.

**Tasks affected:** P7.3-P7.9 retain but shrink — don't adopt Firefight's
cork-board aesthetic or picker/deploy flow. Target: usable thumbnail, ≥1
overlay toggle, clear landmark prominence. Nothing else.

### D10 — Skip the "gameplay probe" blocker
@desktop attempted the tactical semantics probe but got stuck on input
model (Firefight's UI doesn't respond to conventional RTS inputs). Opus RE
report fills the gap — we have the architecture at high-confidence level
without needing numeric probe data. Move on.

---

## 3. Retooled phase plan

**Phase 0 — Firefight panel:** mostly unchanged. urban_sparse targets now
authored via D7 extrapolation. Palette values from D5 baked into fixtures.

**Phase 1 — Snapshot schema + cache-and-deliver:** mostly unchanged.
Drop shadingBake-elevationCoverBonus coupling per D2.

**Phase 2 — Structural mapgen fixes:** unchanged.

**Phase 3 — Elevation wiring + shaded relief:** REDUCED.
- Keep: P3.1-P3.7 (profile, fBm, Sobel bake, shading in renderer/thumbnail)
- Keep: P3.11 LOS ridge rule (geometric, matches Firefight)
- Keep: P3.12 per-mode cliff guard
- DROP: P3.8-P3.10 (elevationCoverBonus byte + evaluateCover integration)
- ADD: contours overlay at mapgen time + renderer support (D4)
- Keep: P3.13-P3.17 (tests + exit)

**Phase 4 — Density gates:** unchanged.

**Phase 5 — Base surface:** unchanged, but paint fns calibrate against D5
palette values, not guessed hex.

**Phase 6 — Scale + prune:** unchanged.

**Phase 7 — Briefing UI + integration tests:** REDUCED per D9.
- Drop: cork-board aesthetic, overlay togglebar, legend chip, full UI
  restructure
- Keep: thumbnail at ≥256px, landmark prominence, renderBaseFromSnapshot
  helper, all four integration tests (end-to-end, thumbnail-parity,
  visual-variety, gameplay)
- Simplify: briefing UI retains current layout, just upgrades the thumbnail

**Phase 8 — Validation:** unchanged.

---

## 4. Task list delta

See task list for concrete task-by-task changes. Summary:
- Delete: P3.8, P3.9, P3.10 (elevationCoverBonus byte work)
- Delete: P7.3, P7.5, P7.6 (Firefight-specific UI components)
- Modify scope: P7.7-P7.9 (simplify briefing rework)
- Add: P3.5b (contour overlay at mapgen), P3.7b (render contours at zoom-out)
- Add: P0.2b (terrain palette JSON from Firefight — copy palette into
  our constants)

---

## 5. Standing assumptions for execution

1. No further user input expected in this session. Decisions documented
   here are authoritative unless a test fails in a way that contradicts
   them, in which case revise here and proceed.
2. Commits are authorized per user's git-hygiene memory.
3. Per @desktop's input-model blocker: any live gameplay probes needed
   for validation happen post-implementation as @desktop Firefight-style
   testing of OUR game, not of Firefight.
4. At end of execution: post @desktop a testing request so they can
   play our game, not Firefight, to validate end-to-end.
