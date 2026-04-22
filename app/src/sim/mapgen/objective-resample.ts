// COA-5 task #109 — resampleObjectiveAroundBisector.
//
// After the spawn placer fixes team0/team1 zones, objective anchors
// should sit near the perpendicular bisector between the two zones so
// both teams have similar travel distance. This improves the quality
// of meeting-engagement scenarios — without it, one team often ends up
// right next to the objective and the match collapses into a rout.
//
// For non-meeting regimes (assault/defence) we deliberately bias the
// objective toward the defender's side by ~20% of the axis length,
// matching Firefight's authored maps where defenders start closer to
// the objective than attackers.

import type { DeployZone, ObjectiveAnchor, SpawnRegime } from './types';

export type ResampleInput = {
  readonly anchors: readonly ObjectiveAnchor[];
  readonly team0: DeployZone;
  readonly team1: DeployZone;
  readonly regime: SpawnRegime;
  readonly walkability: Uint16Array;
  readonly W: number;
  readonly H: number;
};

// Bias expressed as an offset from the midpoint t=0.5 along the
// team0→team1 segment. Positive t shifts toward team1, negative toward
// team0. By convention team0 is the player side; for defence the player
// is entrenched near the objective so the objective biases toward team0.
const DEFENDER_BIAS_FRACTION: Record<SpawnRegime, number> = {
  meeting: 0,
  assault: 0.2, // player (team0) attacks → objective sits nearer defender (team1)
  defence: -0.2, // player (team0) defends → objective sits nearer defender (team0)
  storming: 0.15,
  custom: 0,
};

function centroid(z: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
}

// Given the two deploy zones + regime, recompute each objective anchor's
// rect to sit near the bisector (offset by the regime's defender bias).
// We preserve anchor.kindHint and qualityScore; only the rect moves.
export function resampleObjectiveAroundBisector(
  input: ResampleInput,
): ObjectiveAnchor[] {
  const c0 = centroid(input.team0);
  const c1 = centroid(input.team1);
  const bias = DEFENDER_BIAS_FRACTION[input.regime];
  // t=0.5 is exact midpoint; t=0.5+bias biases toward one team.
  const t = 0.5 + bias;
  const targetX = c0.x + (c1.x - c0.x) * t;
  const targetY = c0.y + (c1.y - c0.y) * t;
  const out: ObjectiveAnchor[] = [];
  for (let i = 0; i < input.anchors.length; i++) {
    const a = input.anchors[i];
    // Shift the anchor's rect by (targetX - currentCentroid).
    const curCx = a.rect.x + a.rect.w / 2;
    const curCy = a.rect.y + a.rect.h / 2;
    // Stagger anchors slightly perpendicular to the axis so multi-
    // objective contracts don't overlap.
    const perpStagger = (i - (input.anchors.length - 1) / 2) * 4;
    // Perpendicular direction in tile space.
    const axisDx = c1.x - c0.x;
    const axisDy = c1.y - c0.y;
    const mag = Math.hypot(axisDx, axisDy) || 1;
    const perpX = -axisDy / mag;
    const perpY = axisDx / mag;
    const shiftedCx = targetX + perpX * perpStagger;
    const shiftedCy = targetY + perpY * perpStagger;
    const dx = Math.round(shiftedCx - curCx);
    const dy = Math.round(shiftedCy - curCy);
    const newRect = {
      x: Math.max(0, Math.min(input.W - a.rect.w, a.rect.x + dx)),
      y: Math.max(0, Math.min(input.H - a.rect.h, a.rect.y + dy)),
      w: a.rect.w,
      h: a.rect.h,
    };
    out.push({ kindHint: a.kindHint, rect: newRect, qualityScore: a.qualityScore });
  }
  return out;
}
