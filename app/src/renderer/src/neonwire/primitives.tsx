// NEON WIRE primitives.
// Source of truth: SS for design/Claude Design Package/.../source/primitives.jsx
// + ADR 016. Components are React equivalents — same vocabulary, same visual
// spec, idiomatic to the renderer's stack.

import type { CSSProperties, ReactNode } from 'react';
import {
  HEX_CLIP_CHIP,
  HEX_CLIP_TL_BR,
  NW,
  type NWAccent,
  accentColor,
} from './tokens';

// ── NWFrame ──────────────────────────────────────────────────────────────
// Root container for any NEON WIRE screen. Renders the cyan grid +
// radial vignette beneath children.

export function NWFrame({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}): React.JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: NW.bg0,
        color: NW.fg0,
        fontFamily: NW.body,
        fontSize: 13,
        lineHeight: 1.45,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(rgba(24,224,255,0.025) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(24,224,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(24,224,255,0.04), transparent 60%)',
        }}
      />
      {children}
    </div>
  );
}

// ── NWLogo (PAYROLL hex crest) ───────────────────────────────────────────

export function NWLogo({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
        <path
          d="M 10 1 L 18 6 L 18 14 L 10 19 L 2 14 L 2 6 Z"
          fill="none"
          stroke={NW.cyan}
          strokeWidth="1.4"
        />
        <path
          d="M 10 5 L 14 8 L 14 12 L 10 15 L 6 12 L 6 8 Z"
          fill={NW.cyan}
        />
      </svg>
      <span
        style={{
          fontFamily: NW.display,
          fontWeight: 700,
          color: NW.cyan,
          fontSize: 14,
          letterSpacing: '0.14em',
        }}
      >
        PAYROLL
      </span>
    </div>
  );
}

// ── NWSystemBar (32px top strip) ─────────────────────────────────────────

export function NWSystemBar({
  path,
  right,
  timestamp,
}: {
  path: string;
  right?: ReactNode;
  timestamp?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        height: 32,
        padding: '0 20px',
        borderBottom: `1px solid ${NW.line}`,
        background: NW.bg1,
        fontFamily: NW.mono,
        fontSize: 11,
        color: NW.fg2,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <NWLogo />
      <span style={{ color: NW.fgDim }}>║</span>
      <span style={{ color: NW.fg1 }}>NET · SECURE · Q-ENCR</span>
      <span style={{ color: NW.fgDim }}>║</span>
      <span style={{ color: NW.cyan }}>▸ {path}</span>
      <span style={{ flex: 1 }} />
      {right}
      {timestamp && (
        <>
          <span style={{ color: NW.fgDim, marginLeft: 14 }}>║</span>
          <span style={{ color: NW.fg1 }}>{timestamp}</span>
        </>
      )}
    </div>
  );
}

// ── NWPanel ──────────────────────────────────────────────────────────────
// Hex-clipped container with optional title row.

export function NWPanel({
  title,
  right,
  children,
  style,
  accent = 'cyan',
  clip = HEX_CLIP_TL_BR,
  padding = 14,
}: {
  title?: string;
  right?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  accent?: NWAccent;
  clip?: string;
  padding?: number | string;
}): React.JSX.Element {
  const c = accentColor(accent);
  const borderColor = accent === 'cyan' ? NW.line2 : `${c}55`;
  return (
    <div
      style={{
        position: 'relative',
        background: NW.panel,
        clipPath: clip,
        WebkitClipPath: clip,
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: clip,
          WebkitClipPath: clip,
          pointerEvents: 'none',
          boxShadow: `inset 0 0 0 1px ${borderColor}`,
        }}
      />
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderBottom: `1px solid ${NW.line}`,
            fontFamily: NW.mono,
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: NW.fg1,
            position: 'relative',
          }}
        >
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

// ── NWChip ───────────────────────────────────────────────────────────────
// Parallelogram-clipped button.

export function NWChip({
  children,
  primary,
  danger,
  small,
  style,
  kbd,
  active,
  onClick,
  title,
  type = 'button',
}: {
  children: ReactNode;
  primary?: boolean;
  danger?: boolean;
  small?: boolean;
  style?: CSSProperties;
  kbd?: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
  type?: 'button' | 'submit';
}): React.JSX.Element {
  const c = primary || active ? NW.cyan : danger ? NW.magenta : NW.fg1;
  const bg =
    primary || active
      ? NW.cyanSoft
      : danger
        ? NW.magentaSoft
        : 'transparent';
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: small ? '4px 12px' : '7px 16px',
        cursor: onClick ? 'pointer' : 'default',
        clipPath: HEX_CLIP_CHIP,
        WebkitClipPath: HEX_CLIP_CHIP,
        background: bg,
        fontFamily: NW.mono,
        fontSize: small ? 10 : 11.5,
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: c,
        boxShadow: `inset 0 0 0 1px ${c}`,
        border: 'none',
        ...style,
      }}
    >
      {kbd && (
        <span
          style={{
            fontSize: 9,
            color: NW.fg2,
            border: `1px solid ${NW.line2}`,
            padding: '0 4px',
            clipPath: 'none',
            WebkitClipPath: 'none',
          }}
        >
          {kbd}
        </span>
      )}
      {children}
    </button>
  );
}

// ── NWCTA ────────────────────────────────────────────────────────────────
// Large hex-clipped call-to-action.

export function NWCTA({
  children,
  primary,
  style,
  right,
  onClick,
  title,
}: {
  children: ReactNode;
  primary?: boolean;
  style?: CSSProperties;
  right?: ReactNode;
  onClick?: () => void;
  title?: string;
}): React.JSX.Element {
  const c = primary ? NW.cyan : NW.fg0;
  const bg = primary ? NW.cyanSoft : NW.bg2;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        position: 'relative',
        clipPath: HEX_CLIP_TL_BR,
        WebkitClipPath: HEX_CLIP_TL_BR,
        cursor: onClick ? 'pointer' : 'default',
        background: bg,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: 'none',
        textAlign: 'left',
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: HEX_CLIP_TL_BR,
          WebkitClipPath: HEX_CLIP_TL_BR,
          boxShadow: `inset 0 0 0 1.5px ${c}, ${primary ? NW.cyanGlow : 'none'}`,
          pointerEvents: 'none',
        }}
      />
      <span
        style={{
          fontFamily: NW.display,
          fontWeight: 700,
          color: c,
          fontSize: 16,
          letterSpacing: '0.14em',
          flex: 1,
          textTransform: 'uppercase',
          position: 'relative',
        }}
      >
        {children}
      </span>
      {right && <span style={{ position: 'relative' }}>{right}</span>}
    </button>
  );
}

// ── NWStat ───────────────────────────────────────────────────────────────
// Label + tabular number + optional sub.

export function NWStat({
  label,
  value,
  sub,
  tone,
  style,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: NWAccent;
  style?: CSSProperties;
}): React.JSX.Element {
  const c = tone ? accentColor(tone) : NW.fg0;
  return (
    <div style={style}>
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 9,
          letterSpacing: '0.18em',
          color: NW.fg2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: NW.display,
          fontSize: 26,
          color: c,
          fontWeight: 700,
          letterSpacing: '0.02em',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: NW.mono,
            fontSize: 10,
            color: NW.fg2,
            marginTop: 3,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ── NWBar ────────────────────────────────────────────────────────────────
// Thin meter, hex-clipped ends, glows in its tone.

export function NWBar({
  value,
  tone = 'cyan',
  height = 3,
}: {
  value: number;
  tone?: NWAccent;
  height?: number;
}): React.JSX.Element {
  const c = accentColor(tone);
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      style={{
        height,
        background: NW.bg3,
        clipPath: 'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)',
        WebkitClipPath:
          'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)',
      }}
    >
      <div
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          background: c,
          boxShadow: `0 0 8px ${c}80`,
        }}
      />
    </div>
  );
}

// ── NWHexIcon ────────────────────────────────────────────────────────────

export function NWHexIcon({
  color = NW.cyan,
  size = 20,
  filled,
}: {
  color?: string;
  size?: number;
  filled?: boolean;
}): React.JSX.Element {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 20 22" aria-hidden>
      <path
        d="M 10 1 L 18 6 L 18 16 L 10 21 L 2 16 L 2 6 Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth="1.2"
      />
    </svg>
  );
}

// ── NWDiamond ────────────────────────────────────────────────────────────

export function NWDiamond({
  color = NW.cyan,
  size = 6,
}: {
  color?: string;
  size?: number;
}): React.JSX.Element {
  return (
    <svg
      width={size * 2}
      height={size * 2}
      style={{ display: 'inline-block' }}
      aria-hidden
    >
      <path
        d={`M ${size} 0 L ${size * 2} ${size} L ${size} ${size * 2} L 0 ${size} Z`}
        fill={color}
      />
    </svg>
  );
}

// ── NWStatusDot ──────────────────────────────────────────────────────────
// Small tone-colored dot, optionally pulsing. Used in system bars + op cards.

export function NWStatusDot({
  tone = 'cyan',
  pulse = false,
  size = 8,
}: {
  tone?: NWAccent;
  pulse?: boolean;
  size?: number;
}): React.JSX.Element {
  const c = accentColor(tone);
  return (
    <span
      className={pulse ? 'nw-pulse' : undefined}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: c,
        boxShadow: `0 0 6px ${c}aa`,
      }}
    />
  );
}

// Re-export tokens for convenience.
export { NW, HEX_CLIP_TL_BR, HEX_CLIP_TR_BL, HEX_CLIP_CHIP } from './tokens';
