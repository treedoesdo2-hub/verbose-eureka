// NEON WIRE design tokens — TypeScript mirror of tokens.css.
// Used by SVG fills / strokes that need literal hex strings rather than CSS
// custom properties.

export const NW = {
  // backgrounds
  bg0: '#060914',
  bg1: '#0a0f1e',
  bg2: '#0f1529',
  bg3: '#141b33',
  panel: '#0c1226',

  // lines
  line: '#1c2648',
  line2: '#2a3860',

  // text
  fg0: '#e6edff',
  fg1: '#98a4c8',
  fg2: '#5e6a8c',
  fgDim: '#3a4260',

  // semantic accents
  cyan: '#18e0ff',
  amber: '#ffa020',
  magenta: '#ff2d9a',
  green: '#33ffa0',
  red: '#ff4a5c',

  // soft tints
  cyanSoft: 'rgba(24,224,255,0.10)',
  amberSoft: 'rgba(255,160,32,0.12)',
  magentaSoft: 'rgba(255,45,154,0.14)',

  // glow
  cyanGlow: '0 0 12px rgba(24,224,255,0.45)',

  // type
  display: "'Chakra Petch', 'Rajdhani', ui-sans-serif, system-ui, sans-serif",
  body: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

export const HEX_CLIP_TL_BR =
  'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';

export const HEX_CLIP_TR_BL =
  'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))';

export const HEX_CLIP_CHIP =
  'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)';

export const HEX_CLIP_CHIP_SM =
  'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)';

export type NWAccent = 'cyan' | 'amber' | 'magenta' | 'green' | 'red';
export type NWTone = NWAccent | 'fg0' | 'fg1' | 'fg2';

export function accentColor(accent: NWAccent): string {
  switch (accent) {
    case 'cyan':
      return NW.cyan;
    case 'amber':
      return NW.amber;
    case 'magenta':
      return NW.magenta;
    case 'green':
      return NW.green;
    case 'red':
      return NW.red;
  }
}

export function accentSoftColor(accent: NWAccent): string {
  switch (accent) {
    case 'cyan':
      return NW.cyanSoft;
    case 'amber':
      return NW.amberSoft;
    case 'magenta':
      return NW.magentaSoft;
    case 'green':
      return 'rgba(51,255,160,0.10)';
    case 'red':
      return 'rgba(255,74,92,0.12)';
  }
}
