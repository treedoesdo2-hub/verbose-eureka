import type { Armor } from '@schema/armor';
import type {
  BodyHardpoint,
  BodyZone,
  ConsumableCategory,
  SlotHardpointKind,
} from '@schema/common';
import {
  ALL_BODY_ZONES,
  CONSUMABLE_HARDPOINT_FALLBACK,
  DEFAULT_BODY_HARDPOINTS,
  ZONE_CAPACITY_KG,
  ZONE_SLOT_CAPACITY,
} from '@schema/common';
import type { Utility } from '@schema/utility';
import type { Weapon } from '@schema/weapon';
import {
  type ContentLookup,
  INFANTRY_WEIGHT_KG_BUDGET,
  type Loadout,
  type LoadoutItem,
} from './loadout';

export type BodyProfile = {
  slotCapacity: Record<BodyZone, number>;
  hardpoints: Record<BodyZone, readonly BodyHardpoint[]>;
};

export function defaultBodyProfile(): BodyProfile {
  return {
    slotCapacity: { ...ZONE_SLOT_CAPACITY },
    hardpoints: { ...DEFAULT_BODY_HARDPOINTS },
  };
}

export type FitError =
  | { kind: 'zone_slot_overflow'; zone: BodyZone; used: number; cap: number }
  | { kind: 'zone_kg_overflow'; zone: BodyZone; used: number; cap: number }
  | { kind: 'global_kg_overflow'; used: number; cap: number }
  | { kind: 'hardpoint_missing'; zone: BodyZone; hardpoint: SlotHardpointKind }
  | {
      kind: 'hardpoint_exhausted';
      zone: BodyZone;
      hardpoint: SlotHardpointKind;
      used: number;
      avail: number;
    }
  | { kind: 'consumable_no_host'; itemId: string; category: ConsumableCategory }
  | { kind: 'internal_slot_overflow'; hostItemId: string; category: ConsumableCategory };

export type InternalUsageEntry = {
  hostItemId: string;
  hostZone: BodyZone;
  category: ConsumableCategory;
  used: number;
  cap: number;
};

export type ZoneBreakdown = {
  slotsUsed: number;
  slotsCap: number;
  kgUsed: number;
  kgCap: number;
  hardpointsUsed: Partial<Record<SlotHardpointKind, number>>;
  hardpointsAvail: Partial<Record<SlotHardpointKind, number>>;
};

export type FitBreakdown = {
  valid: boolean;
  errors: FitError[];
  perZone: Record<BodyZone, ZoneBreakdown>;
  totalKg: number;
  kgBudget: number;
  internalUsage: InternalUsageEntry[];
  unhostedBins: { itemId: string; reason: string }[];
};

type ResolvedItem = {
  item: LoadoutItem;
  weightKg: number;
  slotFootprint: Record<BodyZone, number>;
  hardpointNeeds: { zone: BodyZone; kind: SlotHardpointKind }[];
  internalSlots: Partial<Record<ConsumableCategory, number>>;
  consumableCategory: ConsumableCategory | null;
  displayName: string;
};

function emptyFootprint(): Record<BodyZone, number> {
  const m = {} as Record<BodyZone, number>;
  for (const z of ALL_BODY_ZONES) m[z] = 0;
  return m;
}

function weaponDefaultHardpointKind(w: Weapon): SlotHardpointKind {
  if (w.hardpoint === 'sidearm') return 'holster_mount';
  return 'grip';
}

function resolveWeapon(item: LoadoutItem, w: Weapon): ResolvedItem {
  const footprint = emptyFootprint();
  const hasExplicit = Object.keys(w.slotFootprint).length > 0;
  if (hasExplicit) {
    for (const [z, n] of Object.entries(w.slotFootprint)) footprint[z as BodyZone] = n as number;
  } else {
    footprint[item.zone] = w.hands >= 2 ? 2 : 1;
  }
  return {
    item,
    weightKg: w.weightKg,
    slotFootprint: footprint,
    hardpointNeeds:
      w.hardpointNeeds.length > 0
        ? [...w.hardpointNeeds]
        : [{ zone: item.zone, kind: weaponDefaultHardpointKind(w) }],
    internalSlots: { ...w.internalSlots },
    consumableCategory: null,
    displayName: w.name,
  };
}

function resolveArmor(item: LoadoutItem, a: Armor): ResolvedItem {
  const footprint = emptyFootprint();
  const hasExplicit = Object.keys(a.slotFootprint).length > 0;
  if (hasExplicit) {
    for (const [z, n] of Object.entries(a.slotFootprint)) footprint[z as BodyZone] = n;
  } else {
    // Default: 1 slot in each placement zone.
    for (const p of a.placements) footprint[p.zone] = Math.max(1, footprint[p.zone]);
  }
  let weightKg = 0;
  for (const p of a.placements) weightKg += p.weightKg;
  const needs =
    a.hardpointNeeds.length > 0
      ? [...a.hardpointNeeds]
      : a.placements.map((p) => ({ zone: p.zone, kind: 'plate_mount' as const }));
  return {
    item,
    weightKg,
    slotFootprint: footprint,
    hardpointNeeds: needs,
    internalSlots: { ...a.internalSlots },
    consumableCategory: null,
    displayName: a.name,
  };
}

function resolveUtility(item: LoadoutItem, u: Utility): ResolvedItem {
  const footprint = emptyFootprint();
  const hasExplicit = Object.keys(u.slotFootprint).length > 0;
  const isBin = u.consumableCategory !== undefined;
  if (hasExplicit) {
    for (const [z, n] of Object.entries(u.slotFootprint)) footprint[z as BodyZone] = n;
  } else if (!isBin) {
    footprint[item.zone] = 1;
  }
  return {
    item,
    weightKg: u.weightKg,
    slotFootprint: footprint,
    hardpointNeeds: [...u.hardpointNeeds],
    internalSlots: { ...u.internalSlots },
    consumableCategory: u.consumableCategory ?? null,
    displayName: u.name,
  };
}

function resolveItem(item: LoadoutItem, content: ContentLookup): ResolvedItem | null {
  if (item.type === 'weapon') {
    const w = content.weapon(item.id);
    return w ? resolveWeapon(item, w) : null;
  }
  if (item.type === 'armor') {
    const a = content.armor(item.id);
    return a ? resolveArmor(item, a) : null;
  }
  const u = content.utility(item.id);
  return u ? resolveUtility(item, u) : null;
}

function buildZoneBreakdowns(body: BodyProfile): Record<BodyZone, ZoneBreakdown> {
  const out = {} as Record<BodyZone, ZoneBreakdown>;
  for (const zone of ALL_BODY_ZONES) {
    const hpsAvail: Partial<Record<SlotHardpointKind, number>> = {};
    for (const hp of body.hardpoints[zone]) hpsAvail[hp.kind] = (hpsAvail[hp.kind] ?? 0) + hp.count;
    out[zone] = {
      slotsUsed: 0,
      slotsCap: body.slotCapacity[zone],
      kgUsed: 0,
      kgCap: ZONE_CAPACITY_KG[zone],
      hardpointsUsed: {},
      hardpointsAvail: hpsAvail,
    };
  }
  return out;
}

function applyFootprintAndKg(
  resolved: ResolvedItem,
  perZone: Record<BodyZone, ZoneBreakdown>,
): void {
  for (const zone of ALL_BODY_ZONES) {
    const n = resolved.slotFootprint[zone];
    if (n > 0) perZone[zone].slotsUsed += n;
  }
  // KG lands in the item's primary zone.
  perZone[resolved.item.zone].kgUsed += resolved.weightKg;
}

function applyHardpoints(
  resolved: ResolvedItem,
  perZone: Record<BodyZone, ZoneBreakdown>,
  errors: FitError[],
): void {
  for (const need of resolved.hardpointNeeds) {
    const zb = perZone[need.zone];
    const avail = zb.hardpointsAvail[need.kind] ?? 0;
    if (avail === 0) {
      errors.push({ kind: 'hardpoint_missing', zone: need.zone, hardpoint: need.kind });
      continue;
    }
    zb.hardpointsUsed[need.kind] = (zb.hardpointsUsed[need.kind] ?? 0) + 1;
  }
}

export function computeFit(
  loadout: Loadout,
  body: BodyProfile,
  content: ContentLookup,
): FitBreakdown {
  const errors: FitError[] = [];
  const perZone = buildZoneBreakdowns(body);
  const internalUsage: InternalUsageEntry[] = [];
  const unhostedBins: { itemId: string; reason: string }[] = [];

  const resolved: ResolvedItem[] = [];
  for (const it of loadout.items) {
    const r = resolveItem(it, content);
    if (r) resolved.push(r);
  }

  const hosts = resolved.filter((r) => Object.keys(r.internalSlots).length > 0);
  const bins = resolved.filter((r) => r.consumableCategory !== null);
  const bareGear = resolved.filter(
    (r) => Object.keys(r.internalSlots).length === 0 && r.consumableCategory === null,
  );

  // Host internal-slot counters (mutable copy).
  const hostCaps = hosts.map((h) => ({
    host: h,
    remaining: { ...h.internalSlots } as Record<string, number>,
  }));

  // Phase 1: bare gear + hosts place their own footprint/kg/hardpoints.
  for (const r of [...hosts, ...bareGear]) {
    applyFootprintAndKg(r, perZone);
    applyHardpoints(r, perZone, errors);
  }

  // Phase 2: bins. Place into host internal slots first, else bare hardpoint fallback.
  for (const bin of bins) {
    const cat = bin.consumableCategory;
    if (cat === null) continue;
    let placed = false;
    for (const hc of hostCaps) {
      const remaining = hc.remaining[cat] ?? 0;
      if (remaining > 0) {
        hc.remaining[cat] = remaining - 1;
        perZone[bin.item.zone].kgUsed += bin.weightKg;
        const existing = internalUsage.find(
          (e) => e.hostItemId === hc.host.item.id && e.category === cat,
        );
        if (existing) existing.used += 1;
        else {
          internalUsage.push({
            hostItemId: hc.host.item.id,
            hostZone: hc.host.item.zone,
            category: cat,
            used: 1,
            cap: hc.host.internalSlots[cat] ?? 0,
          });
        }
        placed = true;
        break;
      }
    }
    if (placed) continue;
    // Fallback: bare hardpoint in the bin's declared zone.
    const fallback = CONSUMABLE_HARDPOINT_FALLBACK[cat];
    const zb = perZone[bin.item.zone];
    const avail = zb.hardpointsAvail[fallback] ?? 0;
    const used = zb.hardpointsUsed[fallback] ?? 0;
    if (avail > used) {
      zb.slotsUsed += 1;
      zb.kgUsed += bin.weightKg;
      zb.hardpointsUsed[fallback] = used + 1;
    } else {
      errors.push({ kind: 'consumable_no_host', itemId: bin.item.id, category: cat });
      unhostedBins.push({
        itemId: bin.item.id,
        reason: `no host with ${cat} internal slot; zone ${bin.item.zone} has no free ${fallback}`,
      });
    }
  }

  // Phase 3: per-zone check for overflow.
  let totalKg = 0;
  for (const zone of ALL_BODY_ZONES) {
    const zb = perZone[zone];
    totalKg += zb.kgUsed;
    if (zb.slotsUsed > zb.slotsCap) {
      errors.push({ kind: 'zone_slot_overflow', zone, used: zb.slotsUsed, cap: zb.slotsCap });
    }
    if (zb.kgUsed > zb.kgCap) {
      errors.push({ kind: 'zone_kg_overflow', zone, used: zb.kgUsed, cap: zb.kgCap });
    }
    for (const [kind, used] of Object.entries(zb.hardpointsUsed)) {
      const avail = zb.hardpointsAvail[kind as SlotHardpointKind] ?? 0;
      if ((used ?? 0) > avail) {
        errors.push({
          kind: 'hardpoint_exhausted',
          zone,
          hardpoint: kind as SlotHardpointKind,
          used: used ?? 0,
          avail,
        });
      }
    }
  }

  if (totalKg > INFANTRY_WEIGHT_KG_BUDGET) {
    errors.push({ kind: 'global_kg_overflow', used: totalKg, cap: INFANTRY_WEIGHT_KG_BUDGET });
  }

  return {
    valid: errors.length === 0,
    errors,
    perZone,
    totalKg,
    kgBudget: INFANTRY_WEIGHT_KG_BUDGET,
    internalUsage,
    unhostedBins,
  };
}
