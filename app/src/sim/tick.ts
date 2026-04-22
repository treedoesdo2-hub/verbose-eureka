import type { UnitId } from '@shared/ids';
import { decide, pickStance } from './ai/bt';
import { coverAwareStepTarget } from './ai/movement';
import { perceive } from './ai/perception';
import { updateLastHeard } from './hearing';
import { resolveShot } from './hit';
import { FOOTSTEP_EMIT_EVERY_TICKS, type NoiseKind } from './noise';
import {
  evaluateObjectives,
  regenerateEnemyWaypoints,
  regeneratePlayerWaypoints,
} from './objectives';
import { Rng } from './rng';
import { type ObjectiveRuntimeState, SIM_DT, SIM_HZ, type SimEvent, type SimState } from './state';
import type { LastSeen, Stance, Unit, UnitAction, Vec2, Wound } from './unit';
import {
  BLOODOUT_THRESHOLD,
  bloodTier,
  bloodTierModifiers,
  canFight,
  isAlive,
  isDowned,
  MAX_MORALE,
  MAX_SUPPRESSION,
  MORALE_ALLY_DIED_LOSS,
  MORALE_ALLY_DOWN_LOSS,
  MORALE_ALLY_DOWN_RADIUS_M,
  MORALE_HEAVY_SUP_LOSS_PER_SEC,
  MORALE_PANIC_THRESHOLD,
  MORALE_RECOVER_THRESHOLD,
  MORALE_RECOVERY_PER_SEC,
  STANCE_MOVE_MULTIPLIER,
  SUPPRESSION_DECAY_PER_SEC,
  SUPPRESSION_HEAVY_THRESHOLD,
  SUPPRESSION_PER_SHOT,
  totalBleedRate,
} from './unit';
import { inBounds, terrainAt } from './world';

const MAX_SPEED_MPS = 4.5;

// Spec/07: last-seen enemy positions fade after ~60s real time so units
// stop firing at phantom ghosts. Alerted-flag decay lives in bt.ts where
// threat detection happens.
export const LAST_SEEN_TTL_TICKS = SIM_HZ * 60;

function updateLastSeen(
  prev: ReadonlyMap<UnitId, LastSeen>,
  spottedAt: ReadonlyMap<UnitId, Vec2>,
  tick: number,
): ReadonlyMap<UnitId, LastSeen> {
  const next = new Map<UnitId, LastSeen>();
  for (const [id, seen] of prev) {
    if (tick - seen.tick <= LAST_SEEN_TTL_TICKS) next.set(id, seen);
  }
  for (const [id, pos] of spottedAt) {
    next.set(id, { pos, tick });
  }
  return next;
}

function clampToWorld(pos: Vec2, world: SimState['world']): Vec2 {
  const maxX = (world.width - 1) * world.tileSizeMeters;
  const maxY = (world.height - 1) * world.tileSizeMeters;
  return {
    x: Math.max(0, Math.min(maxX, pos.x)),
    y: Math.max(0, Math.min(maxY, pos.y)),
  };
}

function tileOf(world: SimState['world'], pos: Vec2): { x: number; y: number } {
  return {
    x: Math.floor(pos.x / world.tileSizeMeters),
    y: Math.floor(pos.y / world.tileSizeMeters),
  };
}

function executeMovement(
  unit: Unit,
  target: Vec2,
  world: SimState['world'],
  mobilityPenalty: number,
): {
  position: Vec2;
  velocity: Vec2;
  facing: number;
  arrived: boolean;
} {
  const dx = target.x - unit.position.x;
  const dy = target.y - unit.position.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05) {
    return {
      position: unit.position,
      velocity: { x: 0, y: 0 },
      facing: unit.facing,
      arrived: true,
    };
  }
  const mobilityMult = Math.max(0.4, 1 - mobilityPenalty / 100);
  const bloodMoveMult = bloodTierModifiers(bloodTier(unit)).moveMultiplier;
  const stanceMoveMult = STANCE_MOVE_MULTIPLIER[unit.stance];
  const speed = Math.min(
    MAX_SPEED_MPS * mobilityMult * bloodMoveMult * stanceMoveMult,
    dist / SIM_DT,
  );
  const velocity = { x: (dx / dist) * speed, y: (dy / dist) * speed };
  const facing = Math.atan2(dy, dx);
  const candidate: Vec2 = {
    x: unit.position.x + velocity.x * SIM_DT,
    y: unit.position.y + velocity.y * SIM_DT,
  };
  const tile = tileOf(world, candidate);
  if (inBounds(world, tile.x, tile.y) && terrainAt(world, tile.x, tile.y).passable) {
    return {
      position: clampToWorld(candidate, world),
      velocity,
      facing,
      arrived: false,
    };
  }
  // Blocked by impassable tile. Without real pathfinding, try in order:
  //   1) axis projections (wall-slide along x or y),
  //   2) perpendicular probes (step sideways relative to velocity so the
  //      unit routes around buildings on procedurally-generated maps).
  // Only if every candidate is blocked do we give up and report arrived.
  const stepX = velocity.x * SIM_DT;
  const stepY = velocity.y * SIM_DT;
  const perpScale = 2; // lateral probe stronger than forward step
  // Perpendicular unit vector to velocity.
  const vmag = Math.hypot(velocity.x, velocity.y) || 1;
  const perpX = (-velocity.y / vmag) * SIM_DT * speed * perpScale;
  const perpY = (velocity.x / vmag) * SIM_DT * speed * perpScale;
  const candidates: Vec2[] = [
    { x: unit.position.x + stepX, y: unit.position.y },
    { x: unit.position.x, y: unit.position.y + stepY },
    { x: unit.position.x + perpX, y: unit.position.y + perpY },
    { x: unit.position.x - perpX, y: unit.position.y - perpY },
    // Diagonals combining forward + perpendicular so narrow gaps resolve.
    { x: unit.position.x + stepX + perpX, y: unit.position.y + stepY + perpY },
    { x: unit.position.x + stepX - perpX, y: unit.position.y + stepY - perpY },
  ];
  for (const c of candidates) {
    const t = tileOf(world, c);
    if (!inBounds(world, t.x, t.y)) continue;
    if (!terrainAt(world, t.x, t.y).passable) continue;
    return {
      position: clampToWorld(c, world),
      velocity: { x: c.x - unit.position.x, y: c.y - unit.position.y },
      facing,
      arrived: false,
    };
  }
  // Truly stuck — report arrival so the BT can try the next waypoint/goal
  // rather than looping forever against the same wall.
  return {
    position: unit.position,
    velocity: { x: 0, y: 0 },
    facing,
    arrived: true,
  };
}

type UnitPatch = Partial<Unit> & { id: UnitId };

function applyPatches(state: SimState, patches: Map<UnitId, UnitPatch>): Map<UnitId, Unit> {
  const next = new Map<UnitId, Unit>();
  for (const u of state.units.values()) {
    const p = patches.get(u.id);
    next.set(u.id, p ? { ...u, ...p } : u);
  }
  return next;
}

function mergePatch(patches: Map<UnitId, UnitPatch>, id: UnitId, patch: Partial<Unit>): void {
  const prev = patches.get(id);
  if (prev) patches.set(id, { ...prev, ...patch, id });
  else patches.set(id, { ...patch, id });
}

function resolveBleed(unit: Unit): Partial<Unit> | null {
  if (!isAlive(unit)) return null;
  const bleed = totalBleedRate(unit) * SIM_DT;
  if (bleed === 0) return null;
  const nextBlood = Math.max(0, unit.bloodVolume - bleed);
  if (nextBlood === unit.bloodVolume) return null;
  return { bloodVolume: nextBlood };
}

function transitionOnBleedout(
  unit: Unit,
  after: Partial<Unit> | null,
  tick: number,
): { patch: Partial<Unit>; event?: SimEvent } {
  const applied = { ...unit, ...(after ?? {}) };
  if (applied.bloodVolume <= 0 && applied.action.kind !== 'dead') {
    return {
      patch: { action: { kind: 'dead' }, velocity: { x: 0, y: 0 } },
      event: { kind: 'unit-died', unitId: unit.id, tick },
    };
  }
  return { patch: after ?? {} };
}

function processFiring(
  shooter: Unit,
  state: SimState,
  rng: Rng,
  tick: number,
  nextWoundId: number,
  events: SimEvent[],
  patches: Map<UnitId, UnitPatch>,
): number {
  if (shooter.action.kind !== 'firing') return nextWoundId;
  const target = state.units.get(shooter.action.targetId);
  if (!target || !canFight(target)) {
    mergePatch(patches, shooter.id, { action: { kind: 'idle' }, currentTarget: null });
    return nextWoundId;
  }
  const weapon = shooter.combat.primaryWeapon;
  if (!weapon) {
    mergePatch(patches, shooter.id, { action: { kind: 'idle' } });
    return nextWoundId;
  }
  if (shooter.action.cooldown > 0) {
    mergePatch(patches, shooter.id, {
      action: { ...shooter.action, cooldown: shooter.action.cooldown - 1 },
    });
    return nextWoundId;
  }
  if (shooter.ammo <= 0) {
    const reloadTicks = Math.round(weapon.reloadSeconds * SIM_HZ);
    mergePatch(patches, shooter.id, {
      action: { kind: 'reloading', ticksRemaining: reloadTicks },
    });
    return nextWoundId;
  }

  events.push({ kind: 'unit-fired', shooter: shooter.id, target: target.id, tick });
  events.push({
    kind: 'noise-emitted',
    sourceUnitId: shooter.id,
    pos: shooter.position,
    noiseKind: 'weapon-fire',
    tick,
  });

  const targetFirePatch = patches.get(target.id) ?? { id: target.id };
  const curSup = (targetFirePatch.suppression as number | undefined) ?? target.suppression;
  mergePatch(patches, target.id, {
    suppression: Math.min(MAX_SUPPRESSION, curSup + SUPPRESSION_PER_SHOT),
  });

  const outcome = resolveShot({
    world: state.world,
    shooter,
    target,
    weapon,
    shooterAim: shooter.stats.aim,
    targetZoneDr: target.combat.zoneDr,
    rng,
    tick,
    nextWoundId,
  });

  const nextAmmo = shooter.ammo - 1;
  let nextWid = nextWoundId;

  if (outcome.kind === 'wound') {
    nextWid += 1;
    const targetPatch = patches.get(target.id) ?? { id: target.id };
    const currentWounds = (targetPatch.wounds as readonly Wound[]) ?? target.wounds;
    const nextWounds = [...currentWounds, outcome.wound];
    mergePatch(patches, target.id, { wounds: nextWounds });
    events.push({
      kind: 'unit-hit',
      shooter: shooter.id,
      target: target.id,
      outcome: 'wound',
      zone: outcome.zone,
      woundId: outcome.wound.id,
      reason: null,
      woundType: outcome.wound.type,
      tick,
    });
  } else if (outcome.kind === 'block') {
    events.push({
      kind: 'unit-hit',
      shooter: shooter.id,
      target: target.id,
      outcome: 'block',
      zone: outcome.zone,
      woundId: null,
      reason: null,
      woundType: null,
      tick,
    });
  } else {
    events.push({
      kind: 'unit-hit',
      shooter: shooter.id,
      target: target.id,
      outcome: 'miss',
      zone: null,
      woundId: null,
      reason: outcome.reason,
      woundType: null,
      tick,
    });
  }

  const roundsLeft = shooter.action.roundsRemaining - 1;
  let nextAction: UnitAction;
  if (roundsLeft <= 0 || nextAmmo <= 0) {
    nextAction = { kind: 'aiming', targetId: target.id, ticksRemaining: Math.round(SIM_HZ * 0.3) };
  } else {
    nextAction = {
      kind: 'firing',
      targetId: target.id,
      roundsRemaining: roundsLeft,
      tickPer: shooter.action.tickPer,
      cooldown: shooter.action.tickPer,
    };
  }

  mergePatch(patches, shooter.id, { action: nextAction, ammo: nextAmmo });
  return nextWid;
}

function processReload(
  shooter: Unit,
  tick: number,
  events: SimEvent[],
  patches: Map<UnitId, UnitPatch>,
): void {
  if (shooter.action.kind !== 'reloading') return;
  if (shooter.action.ticksRemaining > 0) return;
  const mag = shooter.combat.primaryWeapon?.magazineSize ?? 0;
  mergePatch(patches, shooter.id, {
    action: { kind: 'idle' },
    ammo: mag,
  });
  events.push({
    kind: 'noise-emitted',
    sourceUnitId: shooter.id,
    pos: shooter.position,
    noiseKind: 'reload',
    tick,
  });
}

function processStabilize(
  medic: Unit,
  state: SimState,
  tick: number,
  events: SimEvent[],
  patches: Map<UnitId, UnitPatch>,
): void {
  if (medic.action.kind !== 'stabilizing') return;
  if (medic.action.ticksRemaining > 0) return;
  const patient = state.units.get(medic.action.targetId);
  if (!patient) {
    mergePatch(patches, medic.id, { action: { kind: 'idle' } });
    return;
  }
  const patch = patches.get(patient.id) ?? { id: patient.id };
  const currentWounds = (patch.wounds as readonly Wound[]) ?? patient.wounds;
  const nextWounds = currentWounds.map((w) =>
    w.treatment === 'untreated' ? { ...w, treatment: 'stabilized' as const } : w,
  );
  mergePatch(patches, patient.id, { wounds: nextWounds });
  mergePatch(patches, medic.id, { action: { kind: 'idle' } });
  events.push({ kind: 'unit-stabilized', medicId: medic.id, targetId: patient.id, tick });
}

/**
 * Suppression decay, morale shifts, pin/break/rally transitions.
 * Runs after action + bleed so this tick's unit-downed/unit-died events
 * are already in the event list and can drive ally morale hits.
 */
function processStress(
  prev: ReadonlyMap<UnitId, Unit>,
  postAction: ReadonlyMap<UnitId, Unit>,
  events: SimEvent[],
  tick: number,
  patches: Map<UnitId, UnitPatch>,
): void {
  const allyDrops: { pos: Vec2; teamId: number; loss: number }[] = [];
  for (const e of events) {
    if (e.kind !== 'unit-downed' && e.kind !== 'unit-died') continue;
    const victim = postAction.get(e.unitId);
    if (!victim) continue;
    allyDrops.push({
      pos: victim.position,
      teamId: victim.teamId,
      loss: e.kind === 'unit-died' ? MORALE_ALLY_DIED_LOSS : MORALE_ALLY_DOWN_LOSS,
    });
  }

  for (const unit of postAction.values()) {
    if (!isAlive(unit) || isDowned(unit)) continue;

    // "Was" values come from the tick-start state so threshold-crossing
    // events fire exactly once when incoming fire or a morale hit lands.
    const prevUnit = prev.get(unit.id);
    const prevSup = prevUnit?.suppression ?? unit.suppression;
    const prevMorale = prevUnit?.morale ?? unit.morale;

    // The firing pass already folded SUPPRESSION_PER_SHOT into unit.suppression;
    // now apply decay on top.
    const nextSup = Math.max(0, unit.suppression - SUPPRESSION_DECAY_PER_SEC * SIM_DT);

    let moraleDelta = 0;
    for (const d of allyDrops) {
      if (d.teamId !== unit.teamId) continue;
      const dx = d.pos.x - unit.position.x;
      const dy = d.pos.y - unit.position.y;
      if (Math.hypot(dx, dy) <= MORALE_ALLY_DOWN_RADIUS_M) moraleDelta -= d.loss;
    }
    if (nextSup >= SUPPRESSION_HEAVY_THRESHOLD) {
      moraleDelta -= MORALE_HEAVY_SUP_LOSS_PER_SEC * SIM_DT;
    } else if (nextSup < 20 && !unit.alerted) {
      moraleDelta += MORALE_RECOVERY_PER_SEC * SIM_DT;
    }
    const nextMorale = Math.max(0, Math.min(MAX_MORALE, unit.morale + moraleDelta));

    if (prevSup < SUPPRESSION_HEAVY_THRESHOLD && nextSup >= SUPPRESSION_HEAVY_THRESHOLD) {
      events.push({ kind: 'unit-pinned', unitId: unit.id, tick });
    }
    if (prevMorale > MORALE_PANIC_THRESHOLD && nextMorale <= MORALE_PANIC_THRESHOLD) {
      events.push({ kind: 'unit-broke', unitId: unit.id, tick });
    }
    if (prevMorale < MORALE_RECOVER_THRESHOLD && nextMorale >= MORALE_RECOVER_THRESHOLD) {
      events.push({ kind: 'unit-rallied', unitId: unit.id, tick });
    }

    mergePatch(patches, unit.id, { suppression: nextSup, morale: nextMorale });
  }
}

function footstepKind(stance: Stance): NoiseKind {
  if (stance === 'prone') return 'footstep-prone';
  if (stance === 'crouched') return 'footstep-crouched';
  return 'footstep-standing';
}

function processMovement(
  unit: Unit,
  state: SimState,
  tick: number,
  events: SimEvent[],
  patches: Map<UnitId, UnitPatch>,
): void {
  if (unit.action.kind !== 'moving') return;
  const m = executeMovement(unit, unit.action.target, state.world, unit.combat.mobilityPenalty);
  if (m.arrived) {
    mergePatch(patches, unit.id, {
      position: m.position,
      velocity: m.velocity,
      facing: m.facing,
      action: { kind: 'idle' },
    });
    return;
  }
  mergePatch(patches, unit.id, {
    position: m.position,
    velocity: m.velocity,
    facing: m.facing,
  });
  if (tick % FOOTSTEP_EMIT_EVERY_TICKS === 0) {
    events.push({
      kind: 'noise-emitted',
      sourceUnitId: unit.id,
      pos: m.position,
      noiseKind: footstepKind(unit.stance),
      tick,
    });
  }
}

export function tick(state: SimState, rng: Rng): SimState {
  rng.restore(state.rngSnapshot);
  const events: SimEvent[] = [];
  const patches = new Map<UnitId, UnitPatch>();
  let nextWoundId = state.nextWoundId;

  for (const unit of state.units.values()) {
    if (!isAlive(unit)) continue;
    const perception = perceive(state.world, unit, state.units);
    const decision = decide(unit, perception, state);

    const waypointIndex = decision.advanceWaypoint ? unit.waypointIndex + 1 : unit.waypointIndex;
    const lastSeen = updateLastSeen(unit.lastSeen, perception.spottedAt, state.tick);
    const threatenedNow = perception.bestTarget !== null;
    // Cover-aware step: if the unit is moving AND has visible threats,
    // bias the next footstep toward cover against those threats instead
    // of beelining to the goal.
    let action = decision.action;
    if (action.kind === 'moving' && perception.spottedAt.size > 0) {
      const threats: Vec2[] = [...perception.spottedAt.values()];
      const stepTarget = coverAwareStepTarget(state.world, unit.position, action.target, threats);
      action = { kind: 'moving', target: stepTarget };
    }
    const stance = pickStance(unit, action, decision.aiState);
    mergePatch(patches, unit.id, {
      aiState: decision.aiState,
      action,
      stance,
      currentTarget: decision.currentTarget,
      alerted: decision.alerted,
      // Only refresh the alert timer when there's a *fresh* contact; sticky
      // alertedness must age off or decay never triggers.
      lastAlertedTick: threatenedNow ? state.tick : unit.lastAlertedTick,
      lastSeen,
      waypointIndex,
      ...(decision.extraFacing !== undefined ? { facing: decision.extraFacing } : {}),
    });
  }

  const postDecision = applyPatches(state, patches);
  patches.clear();

  for (const unit of postDecision.values()) {
    if (!isAlive(unit)) continue;
    processMovement(unit, { ...state, units: postDecision }, state.tick, events, patches);
    nextWoundId = processFiring(
      unit,
      { ...state, units: postDecision },
      rng,
      state.tick,
      nextWoundId,
      events,
      patches,
    );
    processReload(unit, state.tick, events, patches);
    processStabilize(unit, { ...state, units: postDecision }, state.tick, events, patches);
  }

  const postAction = applyPatches({ ...state, units: postDecision }, patches);
  patches.clear();

  for (const unit of postAction.values()) {
    const bleedPatch = resolveBleed(unit);
    if (bleedPatch) {
      const { patch, event } = transitionOnBleedout(unit, bleedPatch, state.tick);
      mergePatch(patches, unit.id, patch);
      if (event) events.push(event);
    }
    if (
      isAlive(unit) &&
      !isDowned(unit) &&
      unit.bloodVolume <= BLOODOUT_THRESHOLD &&
      unit.action.kind !== 'downed'
    ) {
      if (isDowned({ ...unit, ...(patches.get(unit.id) ?? {}) })) {
        mergePatch(patches, unit.id, { action: { kind: 'downed' } });
        events.push({ kind: 'unit-downed', unitId: unit.id, cause: 'bleedout', tick: state.tick });
        events.push({
          kind: 'noise-emitted',
          sourceUnitId: unit.id,
          pos: unit.position,
          noiseKind: 'downed-cry',
          tick: state.tick,
        });
      }
    }
  }

  processStress(state.units, postAction, events, state.tick, patches);

  // Propagate this tick's noise-emitted events into each listener's lastHeard.
  // Runs after all emission passes so hearing reflects everything heard this tick.
  for (const unit of postAction.values()) {
    if (!isAlive(unit)) continue;
    const nextHeard = updateLastHeard(unit, events, state.world, state.tick);
    mergePatch(patches, unit.id, { lastHeard: nextHeard });
  }

  const unitsAfterStress = applyPatches({ ...state, units: postAction }, patches);

  // Evaluate objectives against the tick's final unit state.
  const { objectives: nextObjectives, events: objEvents } = evaluateObjectives(
    state.objectives,
    unitsAfterStress,
    state.world.tileSizeMeters,
    state.tick,
  );
  events.push(...objEvents);

  // Regenerate both teams' waypoints when they exhaust their queue. Before
  // this existed, procedurally-generated maps handed both teams empty
  // waypoint lists at spawn and they just stood there; the BT terminal
  // idle branch fires when no target is spotted and no waypoints remain.
  const playerWpRegens = regeneratePlayerWaypoints(
    unitsAfterStress,
    nextObjectives,
    state.world.tileSizeMeters,
  );
  const enemyWpRegens = regenerateEnemyWaypoints(
    unitsAfterStress,
    nextObjectives,
    state.world.tileSizeMeters,
    state.team0HomePos,
  );
  let finalUnits = unitsAfterStress;
  if (playerWpRegens.size > 0 || enemyWpRegens.size > 0) {
    const nextMap = new Map(unitsAfterStress);
    for (const [id, wps] of playerWpRegens) {
      const u = nextMap.get(id);
      if (!u) continue;
      nextMap.set(id, { ...u, waypoints: wps, waypointIndex: 0 });
    }
    for (const [id, wps] of enemyWpRegens) {
      const u = nextMap.get(id);
      if (!u) continue;
      nextMap.set(id, { ...u, waypoints: wps, waypointIndex: 0 });
    }
    finalUnits = nextMap;
  }

  const team0Alive = [...finalUnits.values()].some((u) => u.teamId === 0 && canFight(u));
  const team1Alive = [...finalUnits.values()].some((u) => u.teamId === 1 && canFight(u));
  const primary = nextObjectives[0];
  let ended = false;
  let endReason: string | undefined;
  if (primary && primary.status === 'complete') {
    ended = true;
    endReason = 'primary-complete';
  } else if (primary && primary.status === 'failed') {
    ended = true;
    endReason = 'primary-failed';
  } else if (!team0Alive) {
    ended = true;
    endReason = 'team-0-defeated';
  } else if (!team1Alive) {
    ended = true;
    endReason = 'team-1-defeated';
  }

  return {
    tick: state.tick + 1,
    rngSnapshot: rng.snapshot(),
    world: state.world,
    units: finalUnits,
    events,
    nextWoundId,
    objectives: nextObjectives,
    ended,
    endReason,
    team0HomePos: state.team0HomePos,
    team1HomePos: state.team1HomePos,
  };
}

export function makeInitialState(
  world: SimState['world'],
  seed: number,
  units: Iterable<Unit>,
  objectives: readonly ObjectiveRuntimeState[] = [],
  homePos?: { team0: Vec2; team1: Vec2 },
): SimState {
  const rng = new Rng(seed);
  const unitMap = new Map<UnitId, Unit>();
  for (const u of units) unitMap.set(u.id, u);
  // Fallback to unit centroids if the caller didn't supply anchors —
  // keeps older callers (training fixtures) compiling without edits.
  const computed = homePos ?? computeTeamCentroids(unitMap);
  return {
    tick: 0,
    rngSnapshot: rng.snapshot(),
    world,
    units: unitMap,
    events: [],
    nextWoundId: 1,
    objectives,
    ended: false,
    team0HomePos: computed.team0,
    team1HomePos: computed.team1,
  };
}

function computeTeamCentroids(unitMap: ReadonlyMap<UnitId, Unit>): { team0: Vec2; team1: Vec2 } {
  let t0x = 0;
  let t0y = 0;
  let t0n = 0;
  let t1x = 0;
  let t1y = 0;
  let t1n = 0;
  for (const u of unitMap.values()) {
    if (u.teamId === 0) {
      t0x += u.position.x;
      t0y += u.position.y;
      t0n++;
    } else if (u.teamId === 1) {
      t1x += u.position.x;
      t1y += u.position.y;
      t1n++;
    }
  }
  return {
    team0: t0n > 0 ? { x: t0x / t0n, y: t0y / t0n } : { x: 0, y: 0 },
    team1: t1n > 0 ? { x: t1x / t1n, y: t1y / t1n } : { x: 0, y: 0 },
  };
}
