// COA-3 #64 — thresholds registry exhaustiveness + resolver dispatch.

import { describe, expect, it } from 'vitest';
import {
  BARRIER_THRESHOLDS,
  BASE_THRESHOLDS,
  POINT_THRESHOLDS,
  thresholdsFor,
} from './thresholds';

describe('thresholds — registry exhaustiveness', () => {
  it('every base terrain kind has a threshold entry', () => {
    const keys = Object.keys(BASE_THRESHOLDS);
    expect(keys.length).toBe(8);
  });

  it('every point kind has a threshold entry', () => {
    expect(Object.keys(POINT_THRESHOLDS).length).toBe(27);
  });

  it('every barrier kind has a threshold entry', () => {
    expect(Object.keys(BARRIER_THRESHOLDS).length).toBe(11);
  });

  it('thresholdsFor dispatches by kind', () => {
    expect(thresholdsFor({ kind: 'base', value: 'open' })).toEqual(BASE_THRESHOLDS.open);
    expect(thresholdsFor({ kind: 'point', value: 'tree_forest' })).toEqual(
      POINT_THRESHOLDS.tree_forest,
    );
    expect(thresholdsFor({ kind: 'barrier', value: 'hedge' })).toEqual(BARRIER_THRESHOLDS.hedge);
  });
});
