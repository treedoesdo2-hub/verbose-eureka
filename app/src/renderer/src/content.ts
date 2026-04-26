import { type ContentBundle, loadContent } from './loader';

let cache: ContentBundle | null = null;

export function getContent(): ContentBundle {
  if (!cache) cache = loadContent();
  return cache;
}

export function contentLookup() {
  const bundle = getContent();
  return {
    weapon: (id: string) => bundle.weapons.get(id),
    armor: (id: string) => bundle.armor.get(id),
    utility: (id: string) => bundle.utility.get(id),
    ammo: (id: string) => bundle.ammo.get(id),
  };
}
