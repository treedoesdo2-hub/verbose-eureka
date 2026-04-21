export type Brand<T, B extends string> = T & { readonly __brand: B };

export type OperatorId = Brand<string, 'OperatorId'>;
export type WeaponId = Brand<string, 'WeaponId'>;
export type ArmorId = Brand<string, 'ArmorId'>;
export type UtilityId = Brand<string, 'UtilityId'>;
export type ContractId = Brand<string, 'ContractId'>;
export type FactionId = Brand<string, 'FactionId'>;
export type MapId = Brand<string, 'MapId'>;
export type UnitId = Brand<number, 'UnitId'>;
export type WoundId = Brand<number, 'WoundId'>;

export const asOperatorId = (s: string): OperatorId => s as OperatorId;
export const asWeaponId = (s: string): WeaponId => s as WeaponId;
export const asArmorId = (s: string): ArmorId => s as ArmorId;
export const asUtilityId = (s: string): UtilityId => s as UtilityId;
export const asContractId = (s: string): ContractId => s as ContractId;
export const asFactionId = (s: string): FactionId => s as FactionId;
export const asMapId = (s: string): MapId => s as MapId;
export const asUnitId = (n: number): UnitId => n as UnitId;
export const asWoundId = (n: number): WoundId => n as WoundId;
