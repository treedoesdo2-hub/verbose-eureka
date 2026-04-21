import type { UnitId } from '@shared/ids';
import { decide } from './ai/bt';
import { perceive } from './ai/perception';
import { resolveShot } from './hit';
import { Rng } from './rng';
import { SIM_DT, SIM_HZ, type SimEvent, type SimInput, type SimState } from './state';
import type { Unit, UnitAction, Vec2, Wound } from './unit';
import { canFight, isAlive, isDowned, totalBleedRate } from './unit';
import { inBounds, terrainAt } from './world';

const MAX_SPEED_MPS = 4.5;

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
  const speed = Math.min(MAX_SPEED_MPS * mobilityMult, dist / SIM_DT);
  const velocity = { x: (dx / dist) * speed, y: (dy / dist) * speed };
  const facing = Math.atan2(dy, dx);
  const candidate: Vec2 = {
    x: unit.position.x + velocity.x * SIM_DT,
    y: unit.position.y + velocity.y * SIM_DT,
  };
  const tile = tileOf(world, candidate);
  if (!inBounds(world, tile.x, tile.y) || !terrainAt(world, tile.x, tile.y).passable) {
    return {
      position: unit.position,
      velocity: { x: 0, y: 0 },
      facing,
      arrived: true,
    };
  }
  return {
    position: clampToWorld(candidate, world),
    velocity,
    facing,
    arrived: false,
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
      woundId: outcome.wound.id,
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

function processReload(shooter: Unit, patches: Map<UnitId, UnitPatch>): void {
  if (shooter.action.kind !== 'reloading') return;
  if (shooter.action.ticksRemaining > 0) return;
  const mag = shooter.combat.primaryWeapon?.magazineSize ?? 0;
  mergePatch(patches, shooter.id, {
    action: { kind: 'idle' },
    ammo: mag,
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

function processMovement(unit: Unit, state: SimState, patches: Map<UnitId, UnitPatch>): void {
  if (unit.action.kind !== 'moving') return;
  const m = executeMovement(unit, unit.action.target, state.world, unit.combat.mobilityPenalty);
  if (m.arrived) {
    mergePatch(patches, unit.id, {
      position: m.position,
      velocity: m.velocity,
      facing: m.facing,
      action: { kind: 'idle' },
    });
  } else {
    mergePatch(patches, unit.id, {
      position: m.position,
      velocity: m.velocity,
      facing: m.facing,
    });
  }
}

export function tick(state: SimState, input: SimInput, rng: Rng): SimState {
  rng.restore(state.rngSnapshot);
  const events: SimEvent[] = [];
  const patches = new Map<UnitId, UnitPatch>();
  let nextWoundId = state.nextWoundId;

  for (const unit of state.units.values()) {
    if (!isAlive(unit)) continue;
    const perception = perceive(state.world, unit, state.units);
    const decision = decide(unit, perception, state);

    const waypointIndex = decision.advanceWaypoint ? unit.waypointIndex + 1 : unit.waypointIndex;
    mergePatch(patches, unit.id, {
      aiState: decision.aiState,
      action: decision.action,
      currentTarget: decision.currentTarget,
      alerted: decision.alerted,
      lastAlertedTick: decision.alerted ? state.tick : unit.lastAlertedTick,
      waypointIndex,
    });
  }

  const postDecision = applyPatches(state, patches);
  patches.clear();

  for (const unit of postDecision.values()) {
    if (!isAlive(unit)) continue;
    processMovement(unit, { ...state, units: postDecision }, patches);
    nextWoundId = processFiring(
      unit,
      { ...state, units: postDecision },
      rng,
      state.tick,
      nextWoundId,
      events,
      patches,
    );
    processReload(unit, patches);
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
      unit.bloodVolume <= 30 &&
      unit.action.kind !== 'downed'
    ) {
      if (isDowned({ ...unit, ...(patches.get(unit.id) ?? {}) })) {
        mergePatch(patches, unit.id, { action: { kind: 'downed' } });
        events.push({ kind: 'unit-downed', unitId: unit.id, tick: state.tick });
      }
    }
  }

  const finalUnits = applyPatches({ ...state, units: postAction }, patches);

  const team0Alive = [...finalUnits.values()].some((u) => u.teamId === 0 && canFight(u));
  const team1Alive = [...finalUnits.values()].some((u) => u.teamId === 1 && canFight(u));
  const ended = !team0Alive || !team1Alive;
  const endReason = !team0Alive ? 'team-0-defeated' : !team1Alive ? 'team-1-defeated' : undefined;

  void input;

  return {
    tick: state.tick + 1,
    rngSnapshot: rng.snapshot(),
    world: state.world,
    units: finalUnits,
    events,
    nextWoundId,
    ended,
    endReason,
  };
}

export function makeInitialState(
  world: SimState['world'],
  seed: number,
  units: Iterable<Unit>,
): SimState {
  const rng = new Rng(seed);
  const unitMap = new Map<UnitId, Unit>();
  for (const u of units) unitMap.set(u.id, u);
  return {
    tick: 0,
    rngSnapshot: rng.snapshot(),
    world,
    units: unitMap,
    events: [],
    nextWoundId: 1,
    ended: false,
  };
}
