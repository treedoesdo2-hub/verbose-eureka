// NEON WIRE primitives playground.
// Dev-only screen rendering every primitive variant for visual regression
// + iteration. Wire it into a route or import directly when iterating.

import {
  NW,
  NWBar,
  NWChip,
  NWCTA,
  NWDiamond,
  NWFrame,
  NWHexIcon,
  NWLogo,
  NWPanel,
  NWStat,
  NWStatusDot,
  NWSystemBar,
} from './primitives';

export function NeonwirePlayground(): React.JSX.Element {
  return (
    <NWFrame>
      <NWSystemBar
        path="/PLAYGROUND/PRIMITIVES"
        right={
          <>
            <NWStatusDot tone="green" />
            <span style={{ color: NW.fg1 }}>OK</span>
          </>
        }
        timestamp="2041.03.14 · 14:32:08 JST"
      />

      <div
        style={{
          padding: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 14,
          height: 'calc(100% - 32px)',
          overflowY: 'auto',
        }}
      >
        {/* Panels with each accent */}
        <NWPanel title="Panel · Cyan" accent="cyan">
          <p style={{ color: NW.fg1, fontSize: 13 }}>
            Cyan-accented panel with title row. Body-text sample for rhythm.
          </p>
        </NWPanel>
        <NWPanel title="Panel · Amber" accent="amber">
          <p style={{ color: NW.fg1, fontSize: 13 }}>
            Amber accent — used for warnings, priority, contested state.
          </p>
        </NWPanel>
        <NWPanel title="Panel · Magenta" accent="magenta">
          <p style={{ color: NW.fg1, fontSize: 13 }}>
            Magenta accent — used for hostile, in-contact, blackline.
          </p>
        </NWPanel>

        {/* Chips */}
        <NWPanel title="Chips">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <NWChip>DEFAULT</NWChip>
            <NWChip primary>PRIMARY</NWChip>
            <NWChip danger>DANGER</NWChip>
            <NWChip small>SMALL</NWChip>
            <NWChip small primary>
              SMALL · PRIMARY
            </NWChip>
            <NWChip kbd="F" small>
              KBD HINT
            </NWChip>
          </div>
        </NWPanel>

        {/* CTAs */}
        <NWPanel title="CTAs">
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <NWCTA right={<span>▸</span>}>DEFAULT CTA</NWCTA>
            <NWCTA primary right={<span>▸</span>}>
              PRIMARY CTA
            </NWCTA>
          </div>
        </NWPanel>

        {/* Stats */}
        <NWPanel title="Stats">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
            }}
          >
            <NWStat label="TREASURY" value="¥ 2,418,040" sub="ESCROW ¥240K" tone="cyan" />
            <NWStat label="WIA · 24H" value={3} tone="amber" />
            <NWStat label="KIA · 24H" value={1} tone="magenta" />
            <NWStat label="READY" value={28} tone="green" />
          </div>
        </NWPanel>

        {/* Bars */}
        <NWPanel title="Bars">
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div>
              <div
                style={{
                  fontFamily: NW.mono,
                  fontSize: 9,
                  color: NW.fg2,
                  letterSpacing: '0.18em',
                }}
              >
                HP
              </div>
              <NWBar value={0.82} tone="green" />
            </div>
            <div>
              <div
                style={{
                  fontFamily: NW.mono,
                  fontSize: 9,
                  color: NW.fg2,
                  letterSpacing: '0.18em',
                }}
              >
                STAM
              </div>
              <NWBar value={0.45} tone="amber" />
            </div>
            <div>
              <div
                style={{
                  fontFamily: NW.mono,
                  fontSize: 9,
                  color: NW.fg2,
                  letterSpacing: '0.18em',
                }}
              >
                INTEGRITY
              </div>
              <NWBar value={0.18} tone="magenta" />
            </div>
          </div>
        </NWPanel>

        {/* Glyphs */}
        <NWPanel title="Glyphs">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <NWHexIcon />
            <NWHexIcon filled />
            <NWHexIcon color={NW.amber} />
            <NWHexIcon color={NW.magenta} filled />
            <NWDiamond />
            <NWDiamond color={NW.amber} size={8} />
            <NWStatusDot tone="green" />
            <NWStatusDot tone="amber" pulse />
            <NWStatusDot tone="magenta" pulse />
          </div>
        </NWPanel>

        {/* Logo + typography */}
        <NWPanel title="Brand">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <NWLogo size={28} />
            <div style={{ fontFamily: NW.display, fontSize: 28, fontWeight: 700, color: NW.fg0 }}>
              "HOLST"
            </div>
            <div style={{ fontFamily: NW.body, fontSize: 13, color: NW.fg1 }}>
              IBM Plex Sans body text — flowing prose at 13px / 1.45.
            </div>
            <div
              style={{
                fontFamily: NW.mono,
                fontSize: 11,
                color: NW.fg2,
                letterSpacing: '0.18em',
              }}
            >
              IBM PLEX MONO · TABULAR · 0123456789
            </div>
          </div>
        </NWPanel>
      </div>
    </NWFrame>
  );
}
