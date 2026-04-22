import { describe, expect, it } from 'vitest';
import {
  coverProfileDirty,
  COVER_PROFILE_DIRTY_BIT,
  flushDirtyTiles,
  makeWorld,
  markTileDirty,
  setPoint,
  terrainAxesAt,
} from './world';

describe('coverProfile dirty-bit cache invalidation', () => {
  it('setPoint eagerly rebakes — dirty bit stays clear after mutation', () => {
    const w = makeWorld(8, 8, 1);
    setPoint(w, 3, 3, 'storage_tank');
    const idx = 3 * 8 + 3;
    expect(coverProfileDirty(w.coverProfile[idx])).toBe(false);
    // Profile byte reflects storage_tank (los=full=2, cover=full=3, height=full=4).
    const expectedLos = 2;
    const expectedCover = 3;
    const expectedHeight = 4;
    const byte = w.coverProfile[idx];
    expect(byte & 0x03).toBe(expectedLos);
    expect((byte >> 2) & 0x03).toBe(expectedCover);
    expect((byte >> 4) & 0x07).toBe(expectedHeight);
  });

  it('markTileDirty flips the dirty bit without rebaking', () => {
    const w = makeWorld(8, 8, 1);
    markTileDirty(w, 2, 2);
    expect(coverProfileDirty(w.coverProfile[2 * 8 + 2])).toBe(true);
  });

  it('flushDirtyTiles recomputes marked tiles and clears the bit', () => {
    const w = makeWorld(8, 8, 1);
    // Bulk scenario: stamp many points with raw writes, then mark dirty,
    // then flush in one pass.
    for (let x = 0; x < 8; x++) {
      w.point[4 * 8 + x] = 22; // tree_forest byte index (POINT_KINDS[21])
      markTileDirty(w, x, 4);
    }
    const flushed = flushDirtyTiles(w);
    expect(flushed).toBe(8);
    for (let x = 0; x < 8; x++) {
      expect(coverProfileDirty(w.coverProfile[4 * 8 + x])).toBe(false);
    }
    // The flushed row now reads as tree_forest (thin LOS).
    const axes = terrainAxesAt(w, 3, 4);
    expect(axes.los).toBe('thin');
  });

  it('flushDirtyTiles is a no-op when no tiles are marked', () => {
    const w = makeWorld(8, 8, 1);
    expect(flushDirtyTiles(w)).toBe(0);
  });

  it('COVER_PROFILE_DIRTY_BIT does not overlap axis fields', () => {
    // Bit layout: los 0-1, cover 2-3, height 4-6, dirty 7. Dirty must be
    // bit 7 and not collide with height's highest bit (bit 6).
    expect(COVER_PROFILE_DIRTY_BIT).toBe(0x80);
  });
});
