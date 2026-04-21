export type Brand<T, B extends string> = T & { readonly __brand: B };

export type OperatorId = string;
export type WeaponId = string;
export type ArmorId = string;
export type UtilityId = string;
export type ContractId = string;
export type FactionId = string;
export type MapId = string;
export type TemplateId = string;

export type UnitId = Brand<number, 'UnitId'>;
export type WoundId = Brand<number, 'WoundId'>;

export const asOperatorId = (s: string): OperatorId => s;
export const asWeaponId = (s: string): WeaponId => s;
export const asArmorId = (s: string): ArmorId => s;
export const asUtilityId = (s: string): UtilityId => s;
export const asContractId = (s: string): ContractId => s;
export const asFactionId = (s: string): FactionId => s;
export const asMapId = (s: string): MapId => s;
export const asTemplateId = (s: string): TemplateId => s;
export const asUnitId = (n: number): UnitId => n as UnitId;
export const asWoundId = (n: number): WoundId => n as WoundId;
