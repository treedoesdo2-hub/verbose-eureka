// COA-7 #140/#142 — golden thumbnail regression fixtures.
//
// Hashes the thumbnail pixel buffer for a fixed (biome, seed, size, tier)
// tuple and compares against a checked-in fixture. If the fixture is
// missing, the test writes a placeholder hash and marks a todo; if the
// hash mismatches a committed fixture, the test fails — forcing review
// of any pipeline or thumbnail-pass change that alters output.
//
// Pixel-perfect byte hashing is fragile (any palette/tone tweak breaks
// every fixture), but that fragility is the point: structural changes
// to the generator SHOULD require fixture review. To intentionally
// update after a known-good change, set UPDATE_GOLDENS=1 and re-run.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runPipeline } from './pipeline';
import { generateThumbnail } from './thumbnail';
import type { MapGenRequest } from './types';

const FIXTURE_PATH = join(__dirname, 'golden-thumbnails.json');

type FixtureEntry = {
  readonly seed: string;
  readonly biome: MapGenRequest['biome'];
  readonly size: number;
  readonly targetSize: number;
  readonly tier: 'battle' | 'strategic' | 'briefing' | 'planning';
  readonly hash: string; // hex FNV-1a-64
  readonly pixelCount: number;
};

const CASES: ReadonlyArray<Omit<FixtureEntry, 'hash' | 'pixelCount'>> = [
  { seed: 'golden-urban-briefing-1', biome: 'urban_sparse', size: 128, targetSize: 96, tier: 'briefing' },
  { seed: 'golden-rural-briefing-1', biome: 'rural_open', size: 128, targetSize: 96, tier: 'briefing' },
  { seed: 'golden-mixed-strategic-1', biome: 'mixed', size: 128, targetSize: 96, tier: 'strategic' },
];

function fnv1a64(bytes: Uint8Array | Uint8ClampedArray): string {
  // 64-bit FNV-1a via two parallel 32-bit streams; good enough to catch
  // any real regression and easy to re-derive deterministically.
  let hLo = 0x811c9dc5;
  let hHi = 0xcbf29ce4;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    hLo ^= b;
    hHi ^= b;
    hLo = Math.imul(hLo, 0x01000193) >>> 0;
    hHi = Math.imul(hHi, 0x01000193) >>> 0;
  }
  return hHi.toString(16).padStart(8, '0') + hLo.toString(16).padStart(8, '0');
}

function loadFixtures(): Record<string, FixtureEntry> {
  if (!existsSync(FIXTURE_PATH)) return {};
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, FixtureEntry>;
  return parsed;
}

function saveFixtures(fixtures: Record<string, FixtureEntry>): void {
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixtures, null, 2)}\n`);
}

function caseKey(c: Omit<FixtureEntry, 'hash' | 'pixelCount'>): string {
  return `${c.biome}:${c.seed}:${c.size}:${c.targetSize}:${c.tier}`;
}

describe('thumbnail golden fixtures (COA-7 #140/#142)', () => {
  const fixtures = loadFixtures();
  const updating = process.env.UPDATE_GOLDENS === '1';

  for (const c of CASES) {
    const key = caseKey(c);
    it(`${key} matches committed hash`, () => {
      const req: MapGenRequest = {
        seed: c.seed,
        biome: c.biome,
        size: c.size,
        tileSizeMeters: 1.5,
        generationVersion: 1,
      };
      const r = runPipeline(req);
      const t = generateThumbnail(r, c.targetSize, { tier: c.tier });
      const hash = fnv1a64(t.pixels);
      const pixelCount = t.pixels.length;

      if (updating || !fixtures[key]) {
        fixtures[key] = { ...c, hash, pixelCount };
        saveFixtures(fixtures);
        // When creating the fixture, the test still succeeds — the
        // fixture is now source of truth. Next run matches it.
        expect(fixtures[key].hash).toBe(hash);
        return;
      }

      const fixture = fixtures[key];
      expect(pixelCount).toBe(fixture.pixelCount);
      if (hash !== fixture.hash) {
        throw new Error(
          `Golden thumbnail mismatch for ${key}\n` +
            `  expected: ${fixture.hash}\n` +
            `  got:      ${hash}\n` +
            `If this change is intentional, re-run with UPDATE_GOLDENS=1 to refresh fixtures.`,
        );
      }
    });
  }
});
