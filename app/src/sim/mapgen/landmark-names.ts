// COA-4 tasks #83/#84 — landmark name generator.
//
// Each LandmarkKind picks from a pool of base names, then appends a
// suffix token. Suffix kinds: NATO phonetic, Greek letter, Roman
// numeral, compass, numeric. Generation is deterministic given the
// RNG seed, so the same map re-generates to the same names.

import type { LandmarkKind } from './hero-landmark';
import type { Rng } from './noise';

const NATO_PHONETIC = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot',
  'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima',
  'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo',
  'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
  'Yankee', 'Zulu',
];

const GREEK = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const COMPASS = ['North', 'South', 'East', 'West', 'Northeast', 'Southeast', 'Northwest', 'Southwest'];

type SuffixKind = 'nato' | 'greek' | 'roman' | 'compass' | 'numeric';

type BasePool = { readonly bases: readonly string[]; readonly suffix: SuffixKind };

const POOLS: Record<LandmarkKind, BasePool> = {
  refinery: { bases: ['Refinery', 'Cracking Plant', 'Fuel Depot', 'Processing Works'], suffix: 'nato' },
  grain_silo: { bases: ['Silo', 'Grain Elevator', 'Storage Tower'], suffix: 'numeric' },
  clock_tower: { bases: ['Clock Tower', 'Belfry', 'Time Tower'], suffix: 'greek' },
  water_tower: { bases: ['Water Tower', 'Reservoir Tower', 'Standpipe'], suffix: 'nato' },
  lighthouse: { bases: ['Lighthouse', 'Watchtower', 'Signal Light'], suffix: 'compass' },
  chapel: { bases: ['Chapel', 'Parish Church', 'Shrine of Saint'], suffix: 'greek' },
  windmill: { bases: ['Windmill', 'Milling Works', 'Wind Pump'], suffix: 'nato' },
  train_depot: { bases: ['Train Depot', 'Rail Yard', 'Marshalling Yards', 'Junction Depot'], suffix: 'numeric' },
  market_square: { bases: ['Market Square', 'Plaza', 'Commons'], suffix: 'compass' },
  tank_bunker: { bases: ['Bunker', 'Emplacement', 'Hardpoint', 'Redoubt'], suffix: 'greek' },
  radio_mast: { bases: ['Radio Mast', 'Relay Tower', 'Antenna Array'], suffix: 'nato' },
  ruined_keep: { bases: ['Ruined Keep', 'Old Fort', 'Derelict Castle'], suffix: 'roman' },
  old_mill: { bases: ['Old Mill', 'Ancient Mill', 'Abandoned Mill'], suffix: 'greek' },
  pumping_station: { bases: ['Pumping Station', 'Pump House', 'Hydraulic Works'], suffix: 'numeric' },
  orchard_cluster: { bases: ['Orchard', 'Fruit Grove', 'Vineyard'], suffix: 'compass' },
  quarry_pit: { bases: ['Quarry', 'Strip Pit', 'Excavation Site'], suffix: 'numeric' },
  graveyard: { bases: ['Graveyard', 'Necropolis', 'War Cemetery', 'Memorial Yard'], suffix: 'compass' },
  checkpoint: { bases: ['Checkpoint', 'Border Post', 'Customs Post', 'Guard Post'], suffix: 'nato' },
  barn_complex: { bases: ['Barn Complex', 'Livestock Sheds', 'Cattle Yard'], suffix: 'compass' },
  bridge_head: { bases: ['Bridgehead', 'River Crossing', 'Ford Crossing'], suffix: 'nato' },
  observation_post: { bases: ['OP', 'Observation Post', 'Watch Point'], suffix: 'greek' },
  shrine: { bases: ['Shrine', 'Wayside Cross', 'Roadside Altar'], suffix: 'roman' },
  monument: { bases: ['Monument', 'Memorial', 'Obelisk', 'Statue'], suffix: 'greek' },
};

function pickSuffix(kind: SuffixKind, rng: Rng): string {
  switch (kind) {
    case 'nato':
      return NATO_PHONETIC[Math.floor(rng() * NATO_PHONETIC.length)];
    case 'greek':
      return GREEK[Math.floor(rng() * GREEK.length)];
    case 'roman':
      return ROMAN[Math.floor(rng() * ROMAN.length)];
    case 'compass':
      return COMPASS[Math.floor(rng() * COMPASS.length)];
    case 'numeric':
      return String(1 + Math.floor(rng() * 20));
  }
}

export function generateLandmarkName(
  kind: LandmarkKind,
  rng: Rng,
): { name: string; shortName: string } {
  const pool = POOLS[kind];
  const base = pool.bases[Math.floor(rng() * pool.bases.length)];
  const suffix = pickSuffix(pool.suffix, rng);
  // Sometimes append a dash-number for extra specificity.
  const tacticalNumber = Math.floor(rng() * 10);
  const useNumber = pool.suffix !== 'numeric' && rng() < 0.3;
  const name = useNumber ? `${base} ${suffix}-${tacticalNumber}` : `${base} ${suffix}`;
  const shortName = useNumber ? `${suffix}-${tacticalNumber}` : suffix;
  return { name, shortName };
}
