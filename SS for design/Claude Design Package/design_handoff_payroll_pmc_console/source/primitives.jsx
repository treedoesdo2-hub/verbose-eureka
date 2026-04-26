// dir-b-neonwire-primitives.jsx — Hex-clipped cyberpunk corporate console
// Triple-accent: cyan (primary/info) + amber (warning) + magenta (kill/alert).
// Hex-clip corners on panels, subtle grid underlay, Chakra Petch display, Plex Mono data.

const NW = {
  bg0: '#060914',
  bg1: '#0a0f1e',
  bg2: '#0f1529',
  bg3: '#141b33',
  panel: '#0c1226',
  line: '#1c2648',
  line2: '#2a3860',
  fg0: '#e6edff',
  fg1: '#98a4c8',
  fg2: '#5e6a8c',
  fgDim: '#3a4260',
  cyan: '#18e0ff',
  cyanSoft: 'rgba(24,224,255,0.10)',
  cyanGlow: '0 0 12px rgba(24,224,255,0.45)',
  amber: '#ffa020',
  amberSoft: 'rgba(255,160,32,0.12)',
  magenta: '#ff2d9a',
  magentaSoft: 'rgba(255,45,154,0.14)',
  green: '#33ffa0',
  red: '#ff4a5c',
  display: "'Chakra Petch', 'Rajdhani', ui-sans-serif, system-ui, sans-serif",
  body: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

// hex-clip paths — used as CSS clip-path for the iconic "angled corners" look.
// Corners are 10px on 2 opposite corners for each panel flavor.
const HEX_CLIP_TL_BR = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const HEX_CLIP_TR_BL = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))';

function NWFrame({ children }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: NW.bg0, color: NW.fg0,
      fontFamily: NW.body, fontSize: 13, lineHeight: 1.45, overflow: 'hidden',
      position: 'relative',
    }}>
      {/* background grid + vignette */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage:
          'linear-gradient(rgba(24,224,255,0.025) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(24,224,255,0.025) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 30%, rgba(24,224,255,0.04), transparent 60%)' }} />
      {children}
    </div>
  );
}

function NWSystemBar({ path, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, height: 32,
      padding: '0 20px', borderBottom: `1px solid ${NW.line}`,
      background: NW.bg1, fontFamily: NW.mono, fontSize: 11,
      color: NW.fg2, letterSpacing: '0.08em', textTransform: 'uppercase',
      position: 'relative', zIndex: 2,
    }}>
      <NWLogo />
      <span style={{ color: NW.fgDim }}>║</span>
      <span style={{ color: NW.fg1 }}>NET · SECURE · Q-ENCR</span>
      <span style={{ color: NW.fgDim }}>║</span>
      <span style={{ color: NW.cyan }}>▸ {path}</span>
      <span style={{ flex: 1 }} />
      {right}
      <span style={{ color: NW.fgDim, marginLeft: 14 }}>║</span>
      <span style={{ color: NW.fg1 }}>2041.03.14 · 14:32:08 JST</span>
    </div>
  );
}

function NWLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="20" height="20" viewBox="0 0 20 20">
        <path d="M 10 1 L 18 6 L 18 14 L 10 19 L 2 14 L 2 6 Z"
          fill="none" stroke={NW.cyan} strokeWidth="1.4" />
        <path d="M 10 5 L 14 8 L 14 12 L 10 15 L 6 12 L 6 8 Z" fill={NW.cyan} />
      </svg>
      <span style={{ fontFamily: NW.display, fontWeight: 700, color: NW.cyan,
        fontSize: 14, letterSpacing: '0.14em' }}>PAYROLL</span>
    </div>
  );
}

// Panel with cyan-etched borders and hex corners
function NWPanel({ title, right, children, style, accent = 'cyan', clip = HEX_CLIP_TL_BR, padding = 14 }) {
  const c = accent === 'amber' ? NW.amber : accent === 'magenta' ? NW.magenta : NW.cyan;
  return (
    <div style={{
      position: 'relative', background: NW.panel, clipPath: clip, ...style,
    }}>
      {/* border via outline trick: inner glow */}
      <div style={{ position: 'absolute', inset: 0, clipPath: clip, pointerEvents: 'none',
        boxShadow: `inset 0 0 0 1px ${c === NW.cyan ? NW.line2 : c + '55'}` }} />
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderBottom: `1px solid ${NW.line}`, fontFamily: NW.mono, fontSize: 10,
          letterSpacing: '0.16em', textTransform: 'uppercase', color: NW.fg1,
        }}>
          <span style={{ color: c, letterSpacing: '0.1em' }}>◢</span>
          <span style={{ color: NW.fg0 }}>{title}</span>
          <span style={{ flex: 1 }} />
          {right}
        </div>
      )}
      <div style={{ padding, position: 'relative' }}>{children}</div>
    </div>
  );
}

// Angled button — small trapezoid chip
function NWChip({ children, primary, danger, small, style, kbd }) {
  const c = primary ? NW.cyan : danger ? NW.magenta : NW.fg1;
  const bg = primary ? NW.cyanSoft : danger ? NW.magentaSoft : 'transparent';
  return (
    <div style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: small ? '4px 12px' : '7px 16px', cursor: 'pointer',
      clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
      background: bg,
      fontFamily: NW.mono, fontSize: small ? 10 : 11.5, fontWeight: 600,
      letterSpacing: '0.14em', textTransform: 'uppercase', color: c,
      boxShadow: `inset 0 0 0 1px ${c}`, ...style,
    }}>
      {kbd && <span style={{ fontSize: 9, color: NW.fg2, border: `1px solid ${NW.line2}`,
        padding: '0 4px', clipPath: 'none' }}>{kbd}</span>}
      {children}
    </div>
  );
}

// Hex-clipped big CTA
function NWCTA({ children, primary, style, right }) {
  const c = primary ? NW.cyan : NW.fg0;
  const bg = primary ? NW.cyanSoft : NW.bg2;
  return (
    <div style={{
      position: 'relative', clipPath: HEX_CLIP_TL_BR, cursor: 'pointer',
      background: bg, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
      ...style,
    }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: HEX_CLIP_TL_BR,
        boxShadow: `inset 0 0 0 1.5px ${c}, ${primary ? NW.cyanGlow : 'none'}`, pointerEvents: 'none' }} />
      <span style={{ fontFamily: NW.display, fontWeight: 700, color: c, fontSize: 16,
        letterSpacing: '0.14em', flex: 1, textTransform: 'uppercase' }}>{children}</span>
      {right}
    </div>
  );
}

function NWStat({ label, value, sub, tone, style }) {
  const c = tone === 'cyan' ? NW.cyan : tone === 'amber' ? NW.amber :
            tone === 'magenta' ? NW.magenta : tone === 'green' ? NW.green :
            tone === 'red' ? NW.red : NW.fg0;
  return (
    <div style={style}>
      <div style={{ fontFamily: NW.mono, fontSize: 9, letterSpacing: '0.18em',
        color: NW.fg2, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: NW.display, fontSize: 26, color: c, fontWeight: 700,
        letterSpacing: '0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function NWBar({ value, tone = 'cyan', height = 3 }) {
  const c = tone === 'cyan' ? NW.cyan : tone === 'amber' ? NW.amber :
            tone === 'magenta' ? NW.magenta : tone === 'green' ? NW.green :
            tone === 'red' ? NW.red : NW.fg1;
  return (
    <div style={{ height, background: NW.bg3, clipPath: 'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)' }}>
      <div style={{ width: `${value * 100}%`, height: '100%', background: c,
        boxShadow: `0 0 8px ${c}80` }} />
    </div>
  );
}

function NWHexIcon({ color = NW.cyan, size = 20, filled }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 20 22">
      <path d="M 10 1 L 18 6 L 18 16 L 10 21 L 2 16 L 2 6 Z"
        fill={filled ? color : 'none'} stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

// Diamond tick decoration
function NWDiamond({ color = NW.cyan, size = 6 }) {
  return (
    <svg width={size * 2} height={size * 2} style={{ display: 'inline-block' }}>
      <path d={`M ${size} 0 L ${size * 2} ${size} L ${size} ${size * 2} L 0 ${size} Z`} fill={color} />
    </svg>
  );
}

Object.assign(window, {
  NW, NWFrame, NWSystemBar, NWPanel, NWChip, NWCTA, NWStat, NWBar, NWHexIcon, NWDiamond, NWLogo,
  HEX_CLIP_TL_BR, HEX_CLIP_TR_BL,
});
