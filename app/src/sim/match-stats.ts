import type { UnitId } from '@shared/ids';
import type { MatchHighlight, MatchStats, PerUnitStats } from '@shared/snapshot';
import type { SimEvent } from './state';
import type { Unit } from './unit';

/**
 * Per-unit match-scoped tallies. Mutated tick-by-tick as events arrive.
 * Lives outside SimState so it doesn't affect determinism hashing.
 */
export type MutableUnitStats = {
  unitId: UnitId;
  teamId: number;
  operatorId: string | null;
  shotsFired: number;
  hitsLanded: number;
  shotsBlocked: number;
  shotsMissed: number;
  // Maps shooter id → the wound id whose owner became 'downed' or 'dead'
  lastShotByTarget: Map<UnitId, UnitId>;
  woundsReceived: number;
  kills: number;
  downs: number;
  alliesStabilized: number;
  survived: boolean;
};

export class MatchStatsAccumulator {
  private readonly stats = new Map<UnitId, MutableUnitStats>();
  // Last shooter that wounded each target — used to attribute kills/downs.
  private readonly lastShooterFor = new Map<UnitId, UnitId>();

  seed(units: ReadonlyMap<UnitId, Unit>): void {
    for (const u of units.values()) {
      if (!this.stats.has(u.id)) {
        this.stats.set(u.id, {
          unitId: u.id,
          teamId: u.teamId,
          operatorId: u.operatorId,
          shotsFired: 0,
          hitsLanded: 0,
          shotsBlocked: 0,
          shotsMissed: 0,
          lastShotByTarget: new Map(),
          woundsReceived: 0,
          kills: 0,
          downs: 0,
          alliesStabilized: 0,
          survived: true,
        });
      }
    }
  }

  ingest(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.kind === 'unit-fired') {
        const s = this.stats.get(e.shooter);
        if (s) s.shotsFired++;
      } else if (e.kind === 'unit-hit') {
        const shooter = this.stats.get(e.shooter);
        const target = this.stats.get(e.target);
        if (e.outcome === 'wound') {
          if (shooter) shooter.hitsLanded++;
          if (target) target.woundsReceived++;
          this.lastShooterFor.set(e.target, e.shooter);
        } else if (e.outcome === 'block') {
          if (shooter) shooter.shotsBlocked++;
        } else {
          if (shooter) shooter.shotsMissed++;
        }
      } else if (e.kind === 'unit-downed') {
        const victimStats = this.stats.get(e.unitId);
        if (victimStats) victimStats.survived = false;
        const shooterId = this.lastShooterFor.get(e.unitId);
        if (shooterId !== undefined) {
          const shooter = this.stats.get(shooterId);
          if (shooter) shooter.downs++;
        }
      } else if (e.kind === 'unit-died') {
        const victimStats = this.stats.get(e.unitId);
        if (victimStats) victimStats.survived = false;
        const shooterId = this.lastShooterFor.get(e.unitId);
        if (shooterId !== undefined) {
          const shooter = this.stats.get(shooterId);
          if (shooter) shooter.kills++;
        }
      } else if (e.kind === 'unit-stabilized') {
        const m = this.stats.get(e.medicId);
        if (m) m.alliesStabilized++;
      }
    }
  }

  finalize(totalTicks: number): MatchStats {
    const perUnit: PerUnitStats[] = [];
    for (const s of this.stats.values()) {
      perUnit.push({
        unitId: s.unitId,
        teamId: s.teamId,
        operatorId: s.operatorId,
        shotsFired: s.shotsFired,
        hitsLanded: s.hitsLanded,
        shotsBlocked: s.shotsBlocked,
        shotsMissed: s.shotsMissed,
        woundsReceived: s.woundsReceived,
        kills: s.kills,
        downs: s.downs,
        alliesStabilized: s.alliesStabilized,
        survived: s.survived,
      });
    }
    perUnit.sort((a, b) => a.unitId - b.unitId);
    return {
      totalTicks,
      perUnit,
      highlights: computeHighlights(perUnit),
    };
  }
}

function computeHighlights(perUnit: readonly PerUnitStats[]): MatchHighlight[] {
  const out: MatchHighlight[] = [];
  for (const u of perUnit) {
    if (u.teamId !== 0) continue; // only player-side highlights
    if (u.kills >= 2) {
      out.push({
        kind: 'ace',
        unitId: u.unitId,
        operatorId: u.operatorId,
        text: `${u.kills} kills — decisive on the firing line`,
      });
    }
    if (u.alliesStabilized >= 1) {
      out.push({
        kind: 'medic',
        unitId: u.unitId,
        operatorId: u.operatorId,
        text: `stabilized ${u.alliesStabilized} ${u.alliesStabilized === 1 ? 'ally' : 'allies'} under fire`,
      });
    }
    // "Held under fire" is for survivors; "heavy casualty" is for those
    // who went down. Same op can't be both in the same match — before
    // this split a 5+-wound survivor rolled both highlights.
    if (u.woundsReceived >= 3 && u.survived) {
      out.push({
        kind: 'held-under-fire',
        unitId: u.unitId,
        operatorId: u.operatorId,
        text: `took ${u.woundsReceived} wounds and held`,
      });
    }
    if (u.woundsReceived >= 5 && !u.survived) {
      out.push({
        kind: 'heavy-casualty',
        unitId: u.unitId,
        operatorId: u.operatorId,
        text: `heavy casualty — ${u.woundsReceived} wounds sustained`,
      });
    }
  }
  return out;
}
