# 07 — Combat Simulation Architecture

Technical design for the combat sim. Everything from how the sim ticks to how a bullet hits a soldier. This doc is the engineering brief that makes the combat view playable.

Derived from: ADR 001 (autobattler purity), ADR 006 (pacing), ADR 009 (UI philosophy), ADR 010 (tech stack), Firefight reverse-engineering findings (round 6), Q24–Q27 clarify decisions, and spec/05 pillars (especially P4 DF sim fidelity).

## Scope

**In scope:**
- Sim tick model, determinism, and seeded RNG
- World representation (tile grid, terrain, cover, walls, elevation)
- Vision & LOS (multi-tier: focused cone + peripheral + alerted)
- Hit resolution pipeline (hit/miss → location → penetration → wound)
- Wound model (per-impact, bleed, stabilization, blood volume)
- Pathfinding approach (tile grid + cost-weighted search; algorithm TBD)
- AI model (BT + utility hybrid)
- Playback speed control (0.5x–8x renderer multiplier)
- Replay + auto-resolve

**Out of scope (lives elsewhere):**
- Loadout data schema — spec/06
- Contract/mission structure — spec/03
- Economy — future spec
- Specific unit-class definitions — future spec
- Faction AI personalities — future spec

---

## 1. Sim core

### Fixed-timestep tick
- Simulation runs at **fixed 30 Hz** (one sim tick every 33.33 ms of simulated time)
- Rendering is decoupled and may run at higher display refresh
- Playback speed is a **renderer multiplier** (how fast sim-ticks flow through to display) — **not** a sim-rate multiplier. Sim ticks always cost the same; we just consume them faster or slower.
- This preserves determinism: a fight at 1x and a fight at 8x produce identical state sequences.

### Determinism
- Single seeded RNG instance per match, seeded from match state (map + rosters + start time + run seed)
- All random draws go through this RNG — no `Math.random()` anywhere in sim code (lint rule enforces this)
- Every simulation artifact (hits, misses, wounds, AI choices, cover sample noise) is derived deterministically from seed + input sequence
- **Replay = seed + input-event-sequence.** Re-run produces bit-identical state; can be auto-resolved or visually replayed at any speed without divergence.

### Worker isolation
- Sim runs in a dedicated Web Worker (ADR 010)
- Main thread sends input events (start match, player orders pre-fight, speed changes); Worker sends back state-diff snapshots at a throttled rate (≈ render frame rate) for the renderer to interpolate
- Save state = full sim snapshot serialized to JSON. Loadable from any tick.

### Data structures
- World is a plain-old-object tree rooted at `SimState`
- All units, wounds, projectiles, effects are entries in typed arrays (structure-of-arrays where hot; easier to make cache-friendly for perf if we port to WASM later)
- Immutable updates via Immer (ADR 010)

---

## 2. World representation

### Tile grid (Firefight-derived)

- World is a **tile grid** — specific dimensions TBD per map but targeting ~1024×1024 tiles at ~4 world-units per tile for tactical maps (matches Firefight scale)
- Per-tile data:
  - `terrain_type` (u8) — grass / road / forest / swamp / urban-floor / water / rubble / building-interior / impassable
  - `height` (u16 fixed-point meters × 64) — elevation in meters with 1/64m precision
  - `cover_score[stance]` — per-stance cover value 0–80 (baked at load from placed objects)
  - `sprite_id[stance]` (u16) — which placed-object sprite occupies this tile for the stance
  - `walkable` (bit flag) — derived from terrain_type
  - `los_occlude_height` (fixed-point meters) — how tall the blocker is at this tile

### Placed objects (Firefight-style baking)

- Maps declare a list of placed objects (buildings, trees, walls, vegetation, barrels, vehicles-as-props) with type + position + rotation + variant
- At map-load time, the loader **bakes these into the tile grid** — marking occupancy, cover, LOS-height per tile
- Objects are NOT kept as separate geometry for LOS tests. They live in tile values. This scales.
- Destructible objects (breakable walls, blowable doors) update their tile entries at runtime when damaged

### Cover tables (per terrain type)

Two tables per map, indexed by terrain_type:
- `full_occlusion_height[terrain]` — at/above this height, LOS is fully blocked
- `concealment_height[terrain]` — at/above this height, LOS is partially blocked (target visible but accuracy reduced)

These are authored per map or per tileset; they drive the LOS raycast.

---

## 3. Vision & LOS

### Three-tier vision model (Firefight-derived, HIGH confidence)

Every unit has:

**Tier 1 — Focused cone**
- ±20° (40° total FOV) by default; modifiable by equipment (optics narrow the cone but extend range; wide-angle reduce range for broader coverage)
- Hard-edged (no gradient falloff at the cone edge)
- Range: unit-specific, gear-dependent (naked eye ≈ 200m; with rifle optic ≈ 800m; NVG/thermal modifies under darkness/concealment)
- Forward from unit facing; rotates when unit rotates

**Tier 2 — Peripheral bubble**
- 80m default radial proximity check
- Triggers awareness regardless of facing — any enemy inside 80m with LOS is detected
- Affected by equipment (spatial awareness augments extend; cyberware numbs to reduce)
- This is why you can't completely flank a unit — they have peripheral awareness

**Tier 3 — Alerted override**
- Boolean flag at unit level; when set, cone check returns true for all directions (360°)
- Set by: taking fire, hearing suppressive fire nearby, confirmed squad contact report, reaction to teammate death
- Decays over time (1–2 minutes of no new input → flag clears)
- Veterans decay slower (retain alertness); green troops decay faster (lapse into peaceful posture)

### LOS raycast (Firefight-inspired)

Called when any tier-1/2 check succeeds to confirm line-of-sight through geometry:

```
eye_height = ground[observer_tile] + observer_eye_offset  // ~1.7m standing, ~1.0m crouch, ~0.3m prone
for step = STEP, 2*STEP, 3*STEP, ..., up to range:
    sample = observer + step × direction
    tile = sample tile
    if eye_height <= ground[tile] + full_occlusion_height[terrain[tile]]:
        return BLOCKED
    if eye_height <= ground[tile] + concealment_height[terrain[tile]]:
        result = CONCEALED  // keep stepping in case something fully blocks later
return result  // CLEAR, CONCEALED, or BLOCKED
```

- `STEP` = ~1 tile (or smaller for precision-critical long shots)
- Includes target height check at the endpoint (targets at different stances have different eye-height; crouched target behind a low wall may be hidden even if standing would expose them)
- Ignores segment-vs-geometry intersection (everything is tile-sampled; matches Firefight perf profile)

### Last-seen memory (per-unit)

Every unit keeps a map of `last_known_position[target_id]` with timestamp. When LOS drops, the last position is retained. Used for:
- AI targeting (AI fires at last-known position in absence of current LOS — suppression, hoping to hit target moving behind cover)
- Squad contact reports (sharing last-seen between squadmates within comm range)
- "Last seen" rendered on the tactical view (player can see what their AI knows)

Decay: last-known position becomes `stale` after N seconds (30–60s typical). Stale positions don't drive confident fire.

### Update frequency

- Vision checks run **once per sim tick per unit** (30 Hz)
- No caching across ticks; recomputation is cheap given tile lookups
- Tile grid lookups are O(1); main cost is iterating candidate targets (spatial hash by tile-region keeps this bounded)

---

## 4. Hit resolution pipeline

### Stage 1 — Hit / miss

Inputs: shooter accuracy, target stance, target cover score (5-point sample around target's footprint; per-stance lookup per tile), range-to-accuracy falloff, suppression penalty, shooter movement penalty, wound penalty on shooter.

Output: `hit_probability` ∈ [0, 1]; stochastic roll (seeded RNG) decides hit or miss.

**Visible probabilities** in UI at LOD0/LOD1 (where the player is actively watching). No hidden to-hit modifiers — the player sees the math on hover.

### Stage 2 — Hit location (body zone)

If hit:
- Determine which body zone takes the shot
- Weights come from:
  - **Shooter aim preference** (AI behavior tag or player pre-fight setting: center-mass default / headshot for precision roles / legs for suppression)
  - **Accuracy-drift spread** — low skill, long range, or suppression drifts the shot into adjacent zones
  - **Stance silhouette** — prone target exposes head + upper torso; crouched exposes torso + arms + head; standing exposes everything
  - **Cover exposure** — the 5-point cover sample determines which zones are protected (low wall hides legs; high wall hides everything; corner exposes one side only)

Roll within the remaining zone-visibility distribution to pick actual hit zone.

### Stage 3 — Armor / penetration

Each zone has an armor state from loadout (plate / soft vest / fatigue only / cyberware-plated):

- Compute bullet kinetic energy at range: `KE = 0.5 × bullet_mass × velocity_at_range²` where velocity degrades with range via drag
- Compare against armor penetration threshold for that zone + armor type
- Three outcomes:
  - **Penetrated** — KE exceeds threshold; bullet reaches flesh. Damage = KE × caliber-factor, reduced by any soft-armor behind the plate.
  - **Stopped** — KE below threshold; bullet stopped by armor. Blunt trauma applied (minor damage + possible rib fracture on torso or concussion on head). Armor takes condition damage (tracked).
  - **Deflected/ricochet** — shallow-angle hits may deflect. Bullet may re-enter sim as a stray projectile. Rare but real (matches Firefight armor-angle math).

### Stage 4 — Wound registration

If flesh damage reaches the zone, create a new **wound instance** attached to the zone. **Per-impact, not a linear tier upgrade** — multiple hits on the same zone create multiple wound objects.

See §5 for wound model details.

---

## 5. Wound model

### Per-impact wounds

Every body zone maintains an array of `wounds: Wound[]`. Each wound is its own object:

```ts
type Wound = {
  id: string;             // unique per wound
  type: WoundType;        // penetrating | blunt | fragmentation | slash | burn | crush | blast
  severity: number;       // 0..100 — raw wound weight
  bleed_rate: number;     // units/sec of blood loss while open
  treatment: 'open' | 'pressure_bandage' | 'tourniquet' | 'stabilized' | 'healing';
  treatment_applied_tick: number | null;
  cause: { source_unit: string; weapon_id: string };
  struck_armor: boolean;  // was this through armor or unprotected?
  tick: number;           // when received
};
```

### Zone impairment

Each zone computes live impairment from its wound list:
- **Aggregate severity** = sum of all open/unhealed wound severities, capped at 100
- **Impairment level** derived from severity thresholds:
  - 0–10: Healthy (no effect)
  - 11–35: Light (minor perf hit — accuracy −5% per affected arm, speed −5% per affected leg, etc.)
  - 36–65: Serious (major perf hit — can't shoulder-fire with this arm, can't sprint on this leg)
  - 66–89: Critical (zone non-functional — unit goes down, bleed clock starts if not stabilized)
  - 90+: Destroyed (permanent; cybernetic replacement required post-fight or zone is lost for campaign)

Multiple light wounds on same zone stack into severe impairment naturally — two arm wounds of severity 30 each = aggregate 60 = serious impairment. **Stacking is per-impact, not tier-jump.**

### Bleed-out system

- **Blood volume:** unit-level stat, 100% at healthy, depleted by sum of open wound bleed rates over time
- **Per-wound bleed rate** depends on wound type, severity, and location (torso wounds bleed faster than extremities)
- **Blood volume thresholds:**
  - 100–70: Normal
  - 70–40: Weakening (reduced accuracy, reduced speed)
  - 40–20: Combat-ineffective (unit goes down, can't fight)
  - 20–10: Unconscious
  - <10: Dying (death imminent in seconds unless stabilized via field treatment + transfusion)
  - 0: Dead (KIA)
- Blood replenishes post-fight only during downtime (days of recovery). A merc bled heavily in one fight and dumped into the next is still weakened.

### Treatment states

- **Open** — wound bleeds at full rate
- **Pressure bandage** — bleed reduced 60%; applied quickly by anyone with a medkit; degrades over time (may become open again)
- **Tourniquet** — bleed stopped on a limb (arms/legs only); limb becomes non-functional while tourniquet is applied; time-limited (tissue damage from prolonged tourniquet → zone destruction if left too long)
- **Stabilized** — bleed stopped permanently (until healed); requires medic skill + supplies; applied in-field for 3–10 seconds (stationary, vulnerable while applying)
- **Healing** — post-fight state during downtime; wound severity reduces over in-game days

### Recovery AI

Per ADR 004 + spec/05 P3, units can attempt to recover fallen comrades:
- **Dismounted drag** — squadmate pulls downed infantry to cover (slow, exposes both)
- **PA frame tow** — squadmate drags a downed PA unit with its pilot inside (slower, needs specialized equipment or stronger unit)
- **Stabilize in place** — medic approaches and stabilizes without moving the body (fastest if under cover already)

These are behaviors the AI considers via utility scoring (§7).

### Part-specific severity rules

- **Head:** wounds have high severity multiplier; tier-2+ = probable KO; helmet armor dramatically shifts thresholds
- **Torso front (heart/lung zone):** penetrating severity ≥ 50 = critical internal bleed (~20s to death without stabilization)
- **Torso back:** similar to front + spine hit risk at severity ≥ 40 (lower-body paralysis, no self-recovery)
- **Arms:** severity 36+ = can't use weapon; severity 90+ = severed, requires cybernetic replacement
- **Hands:** severity 36+ = fumble/drop weapon; severity 90+ = lost hand
- **Legs:** severity 36+ = can't run, walk only; severity 66+ = prone only, crawl; severity 90+ = immobile
- **Waist:** pelvic hits have high bleed rates; severity 50+ = can't stand
- **Internal cavity (cyberware):** hits may damage specific implants; cardiac/nervous-system augments hit = unit may collapse mid-fight

### Cyberware interaction

- Hits that penetrate to zones containing cyberware may damage the implant
- Damaged implants apply negative modifiers until repaired (a damaged accuracy cyber gives −10% accuracy instead of +10%)
- Full destruction of an implant = costs campaign time + credits to replace
- Physiology-altering cyberware shifts armor calculations for its zone (subdermal plating adds effective armor against light calibers)

---

## 6. Pathfinding

Approach is committed; specific algorithm is a prototype decision.

### Committed
- **Tile-grid representation** (not waypoint graph, not navmesh)
- Graph derived at map-load from tile walkability
- **Cost function factors:**
  - Base distance (tiles crossed)
  - Terrain-type cost (road cheap, mud slow, swamp slow, water only for amphibious units)
  - Elevation delta (climbing slopes is slower; extreme slopes are impassable)
  - Cover proximity bonus (tiles adjacent to cover are cheaper — encourages cover-hugging routes, matches Firefight review praise)
  - Threat weight (tiles within known enemy LOS cost more — routes prefer covered or hidden approaches)
- Dynamic cost overlay: threat map updates as enemy positions are known/lost
- Repath triggers: current path blocked (destroyed cover, moved unit), significant threat-map change, new order

### Deferred to prototype
- Specific algorithm: A* vs HPA* vs flow-field-based vs custom hybrid. Choose during prototype based on perf profiling at target scale (40+ units simultaneously pathing).
- Repath frequency tuning
- Squad-cohesion path-biasing (squadmates prefer paths near their squad leader)
- Pathing cache across units (shared regions of paths computed once)

### Risk flag

At battalion scale (per ADR 003), pathfinding is a known risk. Worst case: we build the game expecting pathing to work at scale, discover perf ceiling at ~50 simultaneous pathing units, and either (a) use LOD gating where only LOD0 units get full paths and LOD1+ use coarser guidance, or (b) port the pathfinder to Rust/WASM. Both mitigations are known.

---

## 7. AI model

Hybrid: **Behavior Trees (high-level state) + Utility AI (in-state decisions).**

### Behavior tree (state machine)

Top-level states per unit, ordered roughly by priority:

```
Root
 ├── Panic?         (broken morale — flee blindly)
 ├── Incapacitated? (downed — can only crawl/stabilize-self)
 ├── Suppressed?    (pinned by fire — stay in cover, return some fire)
 ├── Alerted?       (contact confirmed — engage)
 ├── Reacting?      (taking fire — Battle Drill 1A sequence)
 ├── Patrolling?    (ordered movement with peaceful posture)
 └── Idle           (standing/holding position)
```

Each state has its own sub-tree. **Battle Drill 1A** (per spec/05 P4) is literally the Reacting sub-tree for trained infantry:
1. Return fire (suppressive, in the general direction)
2. Take cover (utility scores all adjacent cover options)
3. Locate the enemy (shift from blind suppression to aimed)
4. Suppress with fires (sustained suppression once located)
5. Assault or break contact (utility decides: engage closer or withdraw)

Training level modulates BT execution:
- **Veterans** execute every step cleanly in order
- **Regulars** may skip or compress steps under stress
- **Green** troops may fixate on one step (find cover, never advance), fail to locate, panic under sustained fire

### Utility AI (within state)

For decisions with many options (which cover to move to, which target to prioritize, when to throw a grenade, when to reload, when to call for medic), each option gets a utility score:

```
utility = sum of weighted considerations:
  - closer_to_threat × weight_aggression
  - closer_to_medic × weight_self_preservation (if wounded)
  - further_from_friendly_LOS_corridor × weight_clearance
  - cover_score_of_destination × weight_cover
  - path_cost × weight_efficiency
  - bond_with_squadmate × weight_cohesion
  - (etc.)
```

Weights are per-unit (veteran aggression > green; IGL cohesion > entry fragger). Some weights are gear-modified (heavy weapons weight toward defensive utility, carbines toward aggressive).

### Recovery behaviors

Utility AI considers "go recover fallen teammate" as an option when:
- Teammate is downed in reachable distance
- Current engagement risk is tolerable
- Team cohesion weight is high enough
- Path exists

Different AI personalities have different recovery weights — medics prioritize it, suppressors de-prioritize it.

---

## 8. Playback & pacing (from ADR 006)

### Speed control
- 0.5x / 1x / 2x / 4x / 8x — discrete steps, hotkey-cycled
- 4x is default; player can persist preference across fights within a campaign
- Pause allowed; pause is **view-only** (no orders, no interaction, preserves autobattler purity per ADR 001)

### Auto-resolve
- Available from 5s into the fight (prevents skip-before-commit abuse)
- Runs the sim at max speed to completion, shows a condensed debrief screen
- Full replay available from debrief if the player wants to watch what they skipped

### Replay
- Every match stores: seed + input event sequence + unit-state snapshots at N-tick intervals for scrub
- Player can replay any fight from the debrief screen, at any speed, with full scrub controls
- Replay is re-simulated from seed + inputs (deterministic) — no separate recording stream

---

## 9. Open questions / deferred to prototype

- **Specific pathfinding algorithm** (A* vs HPA* vs flow-field vs hybrid)
- **Tile-grid dimensions** per map-type (tactical fights vs larger deployments may want different scales)
- **Exact vision-cone ranges** per equipment (needs balance pass)
- **LOD gating thresholds** if we need them for scale (when does a unit drop from full sim to cheap sim?)
- **Sound propagation** as a sim concern — does the sim model sound? If yes, how far do gunshots carry, and does that trigger Alerted state in distant units? (Probably yes, deferred to prototype)
- **Destructible cover** detail — which objects are destructible? How does damaged cover degrade? (Probably: walls break after N damage; vegetation ignites under fire; deferred to prototype)
- **Weather / environmental effects** (rain reducing vision, wind affecting smoke, night with/without NVG) — deferred to content-design pass
- **Smoke & grenades** — how smokes block LOS (presumably add temporary tile-occlusion until dissipated); how frags / HE apply area damage across multiple zones — deferred to weapon-system spec

---

## Status

**Accepted.** Authoritative for combat-engineering decisions. Overrides any conflicting assumption in earlier ADRs.

## Related

- ADR 001 — autobattler purity (determinism + no in-fight input)
- ADR 002 — progressive disclosure (advanced-mode exposes raw wound list, bleed math, etc.)
- ADR 003 — scale (battalion pushes the sim hard; risk register in planning/risks.md)
- ADR 004 — unit typology (this spec covers infantry + vehicles/mechs/PA/drones via shared mechanics)
- ADR 006 — combat pacing (speed control, auto-resolve integrated here)
- ADR 009 — UI philosophy (visible probabilities, flat UI for combat HUD)
- ADR 010 — tech stack (TypeScript Worker sim, Pixi.js renderer)
- spec/05 — core pillars (P1 loadout agency, P3 casualty spectrum, P4 sim fidelity, P5 mgmt sim first, P6 respect time — all active constraints)
- spec/06 — loadout system (body zones, armor placement, crit slots — inputs to hit resolution)
