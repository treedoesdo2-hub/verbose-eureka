# Threshold tuning notes — COA-3 #66

Per-kind cluster thresholds in `thresholds.ts` were originally sensible
starting values. This note calibrates them against **Firefight** — the
authoritative visual design reference per `reference_ui_never_second_rome.md`
and user feedback — by direct inspection of a representative sample of
Firefight `*-map.jpg` images bundled with v9.0.2.

## Sample maps inspected

Location: `C:\Users\User\Downloads\Firefight.v9.0.2\Firefight.v9.0.2\Maps\`

| Map  | Type                          | Driving features                                   |
|------|-------------------------------|----------------------------------------------------|
| BFRM | bocage farmland               | 25-60 tile fields, long hedgerow rows (25-40)      |
| KMPV | jungle-dominant               | 300-600+ tile forest carpets, 20-50 tile clearings |
| LAUN | rural + river village         | diagonal river (water_shallow, 150+ tile thread)   |
| MLKS | forest + pond patchwork       | 40-150 tile forest pockets, 5-15 tile ponds        |
| ASTM | rural villages + orchards     | 30-100 tile fields, 20-40 tile orchard rectangles  |
| STPA | patchwork farmland            | 40-80 tile plots, tree-lined borders               |
| TFAC | urban industrial yard         | large rectangular warehouses, big sand/dirt lots   |
| VBOC | urban residential             | row houses, tree-lined streets, major road spine   |
| JWVG | semi-urban village            | forest carpet with inserted housing blocks         |

## Key observations vs previous defaults

1. **`tree_forest` minSize was too low (4)**. Firefight forest patches are
   never "4 tiles" — they're either ≥20 tile carpets or not forest at all.
   Raised to 10.

2. **`tree_jungle` minSize was too low (6)**. Jungle is the "hero terrain"
   of KMPV — massive unbroken blobs with meaningful clearings. Raised
   minSize to 20 and maxHoleSize to 6 so clearings stay readable.

3. **`tree_fruit` maxElongation was OK but minSize (4) produced specks**.
   Orchards in ASTM are ~20-40 tile rectangles, grid-shaped. Raised minSize
   to 8, kept maxElongation at 6.

4. **`tree_poplar` maxElongation 12 was correct** — poplars line roads and
   field boundaries as windrows in rural France/Normandy. Kept.

5. **`hedge` barrier minSize (4) was too low for bocage**. Bocage hedges
   are structural — field borders 20-40 tiles long. A 4-tile hedge stub
   reads as "player dropped a one-off hedge" not "this is bocage country".
   Raised to 8.

6. **`sand` cluster elongation (10) was too permissive**. Urban dirt lots
   in TFAC are rectangular plots (elongation ~5-7), not linear strips.
   Lowered to 7.

7. **`rubble_ground` minSize (4) was right**. Post-battle rubble patches
   in Firefight's urban maps are often exactly 4-8 tiles.

8. **Water thresholds (elongation Infinity) are correct** — confirmed by
   LAUN's diagonal river (150+ tile unbroken thread).

9. **Road threshold (elongation Infinity, minSize 4)** is correct — road
   spines in every Firefight map are unbroken long threads.

10. **`snow` was not represented in the Firefight sample** (no winter
    maps in v9.0.2). Kept defaults; will re-calibrate if a winter-biome
    reference is added later.

## Hole-size calibration

Forest clearings in Firefight are a primary tactical feature — units
use them as staging areas and fields of fire. Previous defaults had
`maxHoleSize: 2` for forest kinds, which filled in small clearings.
Raised to 4 for `tree_forest` and 6 for `tree_jungle` so meaningful
clearings survive the bake.

## Why this matters

Before tuning, the generator produced forest "chickenpox" (single-tile
trees scattered in open) which the pruner happily merged into random
neighbors — producing the empty-feeling maps the user saw when playing
yard-assault. Calibrating minSize to the actual Firefight floor makes
forest clusters either commit to being a proper stand of trees or
dissolve entirely into background, matching Firefight's visual rhythm.

## Follow-ups not addressed here

- Biome-specific overrides (per `density-field.ts` profile) should layer
  on top of these defaults — e.g. bocage biome should push `hedge`
  minSize even higher (12+) to ensure every field has a full border.
- Regime-specific tuning: urban-dense vs rural-sparse may want different
  `tree_forest` minSize; currently both use the global default.
- Winter biome calibration needs a reference dataset Firefight does not
  provide.
