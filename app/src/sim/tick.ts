import type { UnitId } from '@shared/ids';
import { Rng } from './rng';
import type { SimEvent, SimInput, SimState } from './state';
import { SIM_DT } from './state';
import type { Unit, Vec2 } from './unit';
import { isAlive, totalBleedRate } from './unit';
import { inBounds } from './world';

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

function advanceUnit(unit: Unit, state: SimState, events: SimEvent[]): Unit {
  if (!isAlive(unit)) return unit;

  const bleed = totalBleedRate(unit) * SIM_DT;
  const nextBlood = Math.max(0, unit.bloodVolume - bleed);

  let action = unit.action;
  let position = unit.position;
  let velocity = unit.velocity;
  let facing = unit.facing;

  if (nextBlood <= 0 && action.kind !== 'dead') {
    action = { kind: 'dead' };
    velocity = { x: 0, y: 0 };
    events.push({ kind: 'unit-died', unitId: unit.id, tick: state.tick });
  }

  if (action.kind === 'moving') {
    const dx = action.target.x - position.x;
    const dy = action.target.y - position.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) {
      action = { kind: 'idle' };
      velocity = { x: 0, y: 0 };
    } else {
      const speed = Math.min(MAX_SPEED_MPS, dist / SIM_DT);
      velocity = { x: (dx / dist) * speed, y: (dy / dist) * speed };
      facing = Math.atan2(dy, dx);
      const candidate: Vec2 = {
        x: position.x + velocity.x * SIM_DT,
        y: position.y + velocity.y * SIM_DT,
      };
      const tile = tileOf(state.world, candidate);
      if (inBounds(state.world, tile.x, tile.y)) {
        position = clampToWorld(candidate, state.world);
      } else {
        action = { kind: 'idle' };
        velocity = { x: 0, y: 0 };
      }
    }
  }

  if (
    position.x !== unit.position.x ||
    position.y !== unit.position.y ||
    facing !== unit.facing ||
    action !== unit.action ||
    nextBlood !== unit.bloodVolume
  ) {
    return { ...unit, position, velocity, facing, action, bloodVolume: nextBlood };
  }
  return unit;
}

export function tick(state: SimState, input: SimInput, rng: Rng): SimState {
  rng.restore(state.rngSnapshot);
  const events: SimEvent[] = [];
  const nextUnits = new Map<UnitId, Unit>();

  for (const unit of state.units.values()) {
    const next = advanceUnit(unit, state, events);
    nextUnits.set(next.id, next);
  }

  void input;

  return {
    tick: state.tick + 1,
    rngSnapshot: rng.snapshot(),
    world: state.world,
    units: nextUnits,
    events,
    nextWoundId: state.nextWoundId,
    ended: state.ended,
    endReason: state.endReason,
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
