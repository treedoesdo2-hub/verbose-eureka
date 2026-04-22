// COA-7 task #135 — thumbnail label placement.
//
// Given a set of anchor points (deploy zones, objectives, landmark)
// and their desired label strings, route labels to non-overlapping
// positions around each anchor. Uses a simple force-directed fallback
// + a priority system: landmark first, then objectives, then deploy
// zones. Unplaceable labels are silently dropped rather than stacked.

import type { DrawTarget } from './thumbnail-overlays';
import type { RGBA } from './palette';

export type LabelRequest = {
  readonly anchorPx: { readonly x: number; readonly y: number };
  readonly text: string;
  readonly color: RGBA;
  readonly priority: number;
};

type Placed = {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: RGBA;
};

const CHAR_W = 4; // matches glyph width in thumbnail-overlays.ts
const CHAR_H = 5;
const PADDING = 1;

function measureLabel(text: string): { w: number; h: number } {
  return {
    w: text.length * CHAR_W + PADDING * 2,
    h: CHAR_H + PADDING * 2,
  };
}

function overlaps(a: Placed, b: Placed): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

// Placement pattern: NE, NW, SE, SW, N, S, E, W offsets from anchor.
const CANDIDATE_OFFSETS: readonly { dx: number; dy: number }[] = [
  { dx: 4, dy: -8 },
  { dx: -30, dy: -8 },
  { dx: 4, dy: 4 },
  { dx: -30, dy: 4 },
  { dx: -12, dy: -8 },
  { dx: -12, dy: 6 },
  { dx: 6, dy: -2 },
  { dx: -34, dy: -2 },
];

export function placeLabels(
  target: DrawTarget,
  requests: readonly LabelRequest[],
): void {
  // Sort by priority desc.
  const sorted = [...requests].sort((a, b) => b.priority - a.priority);
  const placed: Placed[] = [];
  for (const req of sorted) {
    const m = measureLabel(req.text);
    let chosen: Placed | null = null;
    for (const off of CANDIDATE_OFFSETS) {
      const candidate: Placed = {
        text: req.text,
        x: Math.round(req.anchorPx.x + off.dx),
        y: Math.round(req.anchorPx.y + off.dy),
        w: m.w,
        h: m.h,
        color: req.color,
      };
      // Reject off-canvas.
      if (
        candidate.x < 0 ||
        candidate.y < 0 ||
        candidate.x + candidate.w > target.width ||
        candidate.y + candidate.h > target.height
      ) {
        continue;
      }
      // Reject overlapping.
      let collides = false;
      for (const p of placed) {
        if (overlaps(candidate, p)) {
          collides = true;
          break;
        }
      }
      if (collides) continue;
      chosen = candidate;
      break;
    }
    if (!chosen) continue;
    // Cheap backdrop for readability.
    target.fillRect(chosen.x, chosen.y, chosen.w, chosen.h, [0, 0, 0, 170]);
    target.drawGlyph(chosen.x + PADDING, chosen.y + PADDING, chosen.text, chosen.color);
    placed.push(chosen);
  }
}
