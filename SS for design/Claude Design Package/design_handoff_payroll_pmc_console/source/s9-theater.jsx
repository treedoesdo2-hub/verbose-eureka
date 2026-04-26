// s9-theater.jsx — NEON WIRE · Theater Map / Kantō Fringe
// Region-scale strategic picture. The layer above Command:
// territorial control, rival factions, fringe (lawless) zones, supply corridors,
// concurrent ops plotted, intel pings. Counterpart to s1's city map — this is
// the whole theater.

/* ========== DATA ========== */

const TH = {
  theater: 'KANTŌ FRINGE',
  subtitle: 'POST-QUAKE EXCLUSION · PMC CONTESTED',
  bbox: 'N 35°12 – 36°04 · E 139°08 – 140°22',
  date: '2041.03.14 · 14:32 JST',

  // control summary
  share: [
    { k: 'KESSLER',  v: 0.18, c: 'cyan' },
    { k: 'DAIGO',    v: 0.31, c: 'magenta' },
    { k: 'MERIDIAN', v: 0.12, c: 'amber' },
    { k: 'RED·CELL', v: 0.09, c: 'red' },
    { k: 'FEDERAL',  v: 0.14, c: 'green' },
    { k: 'NO-MANS',  v: 0.16, c: 'dim' },
  ],

  // zones plotted on map — mix of cities, exclusion zones, bases
  zones: [
    { id: 'z01', name: 'TOKYO·OLD',      x: 520, y: 560, r: 60, kind: 'exclusion', holder: null,      label: 'EXCLUSION A', sub: 'quake core · nil entry', civ: 'EVAC' },
    { id: 'z02', name: 'KAWASAKI',       x: 560, y: 640, r: 38, kind: 'city',      holder: 'daigo',   label: 'DAIGO CBD',  sub: 'HQ · heavy garrison', civ: 'HIGH' },
    { id: 'z03', name: 'YOKOHAMA',       x: 500, y: 720, r: 44, kind: 'city',      holder: 'meridian',label: 'MERIDIAN',   sub: 'port · escort contracts', civ: 'HIGH' },
    { id: 'z04', name: 'CHIBA',          x: 740, y: 640, r: 36, kind: 'city',      holder: 'daigo',   label: 'DAIGO·CHIBA', sub: 'industrial · rival AA', civ: 'MED' },
    { id: 'z05', name: 'NAKANO',         x: 440, y: 520, r: 28, kind: 'base',      holder: 'kessler', label: 'FOB NAKANO',  sub: 'BN HQ · 4TH IRR',    civ: 'LOW' },
    { id: 'z06', name: 'TOHO FLATS',     x: 480, y: 600, r: 22, kind: 'hot',       holder: 'contested',label: 'TOHO FLATS',  sub: 'SB-04 IN CONTACT',  civ: 'AMB' },
    { id: 'z07', name: 'TSUKUBA',        x: 760, y: 380, r: 32, kind: 'city',      holder: 'federal', label: 'FEDERAL LINE', sub: 'JSDF cordon',       civ: 'MED' },
    { id: 'z08', name: 'KANTŌ·W RIDGE',  x: 300, y: 430, r: 70, kind: 'wilds',     holder: 'redcell', label: 'RED·CELL',     sub: 'insurgent holdout',  civ: 'NIL' },
    { id: 'z09', name: 'SAGAMI BAY',     x: 380, y: 780, r: 46, kind: 'water',     holder: null,      label: 'SAGAMI BAY',   sub: 'open · pirates',     civ: 'NIL' },
    { id: 'z10', name: 'NARITA',         x: 820, y: 540, r: 30, kind: 'airport',   holder: 'federal', label: 'NARITA ACF',   sub: 'airlift · federal',  civ: 'MED' },
    { id: 'z11', name: 'YOKOSUKA',       x: 440, y: 820, r: 22, kind: 'base',      holder: 'kessler', label: 'FOB LAUREL',   sub: 'naval staging',      civ: 'LOW' },
    { id: 'z12', name: 'HACHIŌJI',       x: 260, y: 580, r: 26, kind: 'city',      holder: 'contested',label: 'HACHIŌJI',    sub: 'border · mixed',     civ: 'HIGH' },
    { id: 'z13', name: 'FRINGE·N',       x: 600, y: 220, r: 90, kind: 'exclusion', holder: null,      label: 'EXCLUSION B',  sub: 'FAULT ZONE · sealed', civ: 'NIL' },
  ],

  // active ops — cross-ref with s8 command
  ops: [
    { code: 'OP-BLACKLINE', zone: 'z06', tone: 'magenta', state: 'IN CONTACT', meta: 'SB-04 · 6/6 · T+00:41' },
    { code: 'OP-KITE-7',    zone: 'z08', tone: 'cyan',    state: 'RECON',      meta: 'KITE · 18/20 · T+04:17' },
    { code: 'OP-TAILBACK',  zone: 'z02', tone: 'amber',   state: 'CONVOY',     meta: 'TAIL · 10/12 · T+01:55' },
    { code: 'OP-CLEARWATER',zone: 'z11', tone: 'cyan',    state: 'STAGING',    meta: 'BRAVO · 12/12 · T−04:22' },
  ],

  // supply corridors — polylines on map
  supply: [
    { pts: [[440,520],[480,600],[560,640]], tone: 'cyan',  status: 'OPEN'  },  // Nakano→Toho→Kawasaki
    { pts: [[440,520],[300,430]],            tone: 'amber', status: 'HARASSED' }, // Nakano→W Ridge
    { pts: [[440,820],[500,720],[560,640]],  tone: 'cyan',  status: 'OPEN'  },  // Yokosuka→Yokohama→Kawasaki
    { pts: [[820,540],[760,380]],            tone: 'green', status: 'FEDERAL' }, // Narita→Tsukuba
  ],

  // intel events — right-rail darknet/int feed
  intel: [
    { t: '14:32', c: 'magenta', tag: 'HOT',  x: 'SB-04 in contact · Toho · danger close' },
    { t: '14:28', c: 'amber',   tag: 'MOV',  x: 'DAIGO 3rd Sec mobilizes · Kawasaki → Toho' },
    { t: '14:17', c: 'cyan',    tag: 'INT',  x: 'rival drone · bearing 095 · W RIDGE · KITE tracking' },
    { t: '14:02', c: 'amber',   tag: 'ECON', x: 'MERIDIAN opens ¥420K bounty · Yokohama port' },
    { t: '13:45', c: 'red',     tag: 'RISK', x: 'RED·CELL raid · Hachiōji border · 2 JSDF KIA' },
    { t: '13:30', c: 'cyan',    tag: 'INT',  x: 'FEDERAL convoy · Narita → Tsukuba · cleared' },
    { t: '13:12', c: 'dim',     tag: 'ECON', x: 'DAIGO filed permit · Chiba expansion' },
    { t: '12:58', c: 'magenta', tag: 'KIA',  x: 'unknown PMC ambushed · EXCLUSION·A fringe · 4 KIA' },
  ],

  // fringe incidents — pings
  pings: [
    { x: 520, y: 240, c: 'amber',  t: 'SEISMIC' },
    { x: 320, y: 470, c: 'cyan',   t: 'KITE·OVERWATCH' },
    { x: 480, y: 600, c: 'magenta',t: 'SB-04·CONTACT' },
    { x: 700, y: 600, c: 'amber',  t: 'DAIGO·MOV' },
    { x: 560, y: 820, c: 'red',    t: 'PIRATE' },
    { x: 280, y: 610, c: 'red',    t: 'RAID' },
  ],
};

/* ========== COLOR HELPERS ========== */

const toneC = {
  cyan: NW.cyan, magenta: NW.magenta, amber: NW.amber,
  red: NW.red, green: NW.green, dim: NW.fg2,
};
const holderC = {
  kessler: NW.cyan, daigo: NW.magenta, meridian: NW.amber,
  redcell: NW.red, federal: NW.green, contested: NW.amber, null: NW.fg2,
};

/* ========== FRAME ========== */

function NeonwireTheater() {
  const [sel, setSel] = React.useState('z06');
  const zone = TH.zones.find(z => z.id === sel);
  return (
    <NWFrame>
      <NWSystemBar
        path="/CMD/THEATER/KANTO"
        right={<>
          <span style={{ color: NW.amber }}>◆ 4 OPS ACTIVE</span>
          <span style={{ color: NW.fgDim, margin: '0 8px' }}>║</span>
          <span style={{ color: NW.fg1 }}>{TH.date}</span>
        </>}
      />

      <THBanner />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr 360px',
        gridTemplateRows: '1fr auto',
        gap: 12, padding: 12,
        height: 'calc(100% - 32px - 68px)',
        position: 'relative', zIndex: 1,
      }}>
        {/* LEFT — zone list + legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <THControlBar />
          <THZoneList sel={sel} onSel={setSel} />
          <THLegend />
        </div>

        {/* CENTER — strategic map */}
        <THMap sel={sel} onSel={setSel} />

        {/* RIGHT — zone focus + intel ticker */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12, minHeight: 0 }}>
          <THZoneFocus zone={zone} />
          <THIntelFeed />
        </div>
      </div>

      <THFooter />
    </NWFrame>
  );
}

/* ========== BANNER ========== */

function THBanner() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto',
      gap: 24, alignItems: 'center', padding: '12px 20px',
      background: 'linear-gradient(90deg, rgba(24,224,255,0.08), transparent 50%, rgba(255,160,32,0.06))',
      borderBottom: `1px solid ${NW.line2}`, height: 68, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <svg width="44" height="48" viewBox="0 0 44 48">
          <path d="M 22 2 L 40 12 L 40 36 L 22 46 L 4 36 L 4 12 Z"
            fill="rgba(24,224,255,0.06)" stroke={NW.cyan} strokeWidth="1.3" />
          {/* concentric rings — theater glyph */}
          <circle cx="22" cy="24" r="12" fill="none" stroke={NW.cyan} strokeWidth="0.8" opacity="0.6" />
          <circle cx="22" cy="24" r="7"  fill="none" stroke={NW.cyan} strokeWidth="0.8" opacity="0.8" />
          <circle cx="22" cy="24" r="2.5" fill={NW.cyan} />
          <line x1="22" y1="6"  x2="22" y2="42" stroke={NW.cyan} strokeWidth="0.5" opacity="0.4" />
          <line x1="4"  y1="24" x2="40" y2="24" stroke={NW.cyan} strokeWidth="0.5" opacity="0.4" />
        </svg>
        <div>
          <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.28em' }}>
            THEATER · STRATEGIC LAYER
          </div>
          <div style={{ fontFamily: NW.display, fontSize: 26, fontWeight: 700,
            color: NW.fg0, letterSpacing: '0.06em', lineHeight: 1 }}>{TH.theater}</div>
          <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2, letterSpacing: '0.12em', marginTop: 2 }}>
            {TH.subtitle} · {TH.bbox}
          </div>
        </div>
      </div>

      {/* influence stacked bar */}
      <THInfluence />

      <div style={{ display: 'flex', gap: 8 }}>
        <NWChip small>EXPORT PLAN</NWChip>
        <NWChip small primary>ISSUE THEATER DIRECTIVE</NWChip>
      </div>
    </div>
  );
}

function THInfluence() {
  return (
    <div style={{ paddingLeft: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2, letterSpacing: '0.22em' }}>
          TERRITORIAL SHARE · 48 NAMED ZONES
        </span>
        <span style={{ fontFamily: NW.mono, fontSize: 9, color: NW.cyan, letterSpacing: '0.18em' }}>
          KESSLER 18% · Δ +2.1%/wk
        </span>
      </div>
      <div style={{ display: 'flex', height: 10, marginTop: 4, border: `1px solid ${NW.line}` }}>
        {TH.share.map((s, i) => (
          <div key={i} style={{
            flex: s.v, background: toneC[s.c], opacity: s.c === 'dim' ? 0.35 : 0.85,
            borderRight: i < TH.share.length - 1 ? `1px solid ${NW.bg0}` : 'none',
            position: 'relative',
          }}>
            {s.c === 'cyan' && (
              <div style={{ position: 'absolute', inset: 0,
                background: `linear-gradient(90deg, transparent, ${NW.cyan}aa)`,
                boxShadow: `inset 0 0 6px ${NW.cyan}` }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, fontFamily: NW.mono,
        fontSize: 9.5, letterSpacing: '0.12em', flexWrap: 'wrap' }}>
        {TH.share.map((s, i) => (
          <span key={i} style={{ color: NW.fg1, display: 'flex', gap: 5, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, background: toneC[s.c],
              opacity: s.c === 'dim' ? 0.4 : 1, display: 'inline-block' }} />
            <span style={{ color: toneC[s.c] === NW.fg2 ? NW.fg2 : toneC[s.c] }}>{s.k}</span>
            <span style={{ color: NW.fg2 }}>{Math.round(s.v * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ========== LEFT RAIL ========== */

function THControlBar() {
  return (
    <NWPanel padding={10} accent="cyan">
      <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2,
        letterSpacing: '0.22em', marginBottom: 6 }}>◆ FILTER · LAYERS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {[
          ['CONTROL', true, 'cyan'],
          ['OPS', true, 'cyan'],
          ['SUPPLY', true, 'cyan'],
          ['INTEL', true, 'amber'],
          ['CIVIL', false, null],
          ['TERRAIN', false, null],
          ['WEATHER', false, null],
        ].map(([l, on, t], i) => (
          <span key={i} style={{
            fontFamily: NW.mono, fontSize: 9.5, letterSpacing: '0.14em',
            padding: '3px 7px',
            border: `1px solid ${on ? (t === 'amber' ? NW.amber : NW.cyan) : NW.line2}`,
            color: on ? (t === 'amber' ? NW.amber : NW.cyan) : NW.fg2,
            background: on ? (t === 'amber' ? NW.amberSoft : NW.cyanSoft) : 'transparent',
          }}>{on ? '▪' : '▫'} {l}</span>
        ))}
      </div>
    </NWPanel>
  );
}

function THZoneList({ sel, onSel }) {
  // sorted so hot/contested zones surface first
  const sorted = [...TH.zones].sort((a, b) => {
    const rank = z => z.kind === 'hot' ? 0 : z.holder === 'contested' ? 1 :
                     z.holder === 'kessler' ? 2 : z.holder === null ? 4 : 3;
    return rank(a) - rank(b);
  });
  return (
    <NWPanel title="NAMED ZONES · 13 SHOWN" padding={0}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      right={<span style={{ color: NW.fg2, fontFamily: NW.mono, fontSize: 10 }}>SORT · THREAT ▾</span>}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sorted.map((z, i) => {
          const c = holderC[z.holder] || NW.fg2;
          const hot = z.kind === 'hot';
          return (
            <div key={z.id} onClick={() => onSel(z.id)} style={{
              display: 'grid', gridTemplateColumns: '18px 1fr auto',
              gap: 8, alignItems: 'center',
              padding: '7px 12px', cursor: 'pointer',
              borderTop: i > 0 ? `1px solid ${NW.line}` : 'none',
              background: sel === z.id ? NW.cyanSoft : (hot ? 'rgba(255,45,154,0.06)' : 'transparent'),
              borderLeft: `2px solid ${sel === z.id ? NW.cyan : (hot ? NW.magenta : 'transparent')}`,
            }}>
              <THZoneGlyph kind={z.kind} color={c} />
              <div>
                <div style={{ fontFamily: NW.display, fontSize: 12, fontWeight: 700,
                  color: sel === z.id ? NW.cyan : NW.fg0, letterSpacing: '0.06em' }}>{z.name}</div>
                <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2,
                  letterSpacing: '0.08em', marginTop: 1 }}>{z.sub}</div>
              </div>
              <div style={{ fontFamily: NW.mono, fontSize: 9, color: c,
                letterSpacing: '0.14em', textAlign: 'right' }}>
                {z.holder === 'kessler' ? 'OURS' :
                 z.holder === 'contested' ? 'CNTST' :
                 z.holder === null ? '—' :
                 (z.holder || '').toUpperCase().slice(0, 5)}
                <div style={{ color: NW.fg2, fontSize: 8.5, marginTop: 1 }}>CIV·{z.civ}</div>
              </div>
            </div>
          );
        })}
      </div>
    </NWPanel>
  );
}

function THZoneGlyph({ kind, color }) {
  const s = 14;
  switch (kind) {
    case 'exclusion':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M 2 2 L 12 12 M 2 12 L 12 2" stroke={NW.red} strokeWidth="1.1" />
          <circle cx="7" cy="7" r="5.5" fill="none" stroke={NW.red} strokeWidth="0.8" strokeDasharray="2 1.5" />
        </svg>
      );
    case 'city':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <rect x="2" y="5" width="3" height="7" fill={color} />
          <rect x="6" y="2" width="3" height="10" fill={color} />
          <rect x="10" y="6" width="2" height="6" fill={color} />
        </svg>
      );
    case 'base':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M 7 1 L 12 4 L 12 10 L 7 13 L 2 10 L 2 4 Z"
            fill="none" stroke={color} strokeWidth="1.2" />
          <circle cx="7" cy="7" r="2" fill={color} />
        </svg>
      );
    case 'hot':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill={NW.magenta} />
          <circle cx="7" cy="7" r="2" fill={NW.bg0} />
        </svg>
      );
    case 'wilds':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M 1 11 L 4 6 L 6 9 L 9 3 L 13 11 Z" fill="none" stroke={color} strokeWidth="1.1" />
        </svg>
      );
    case 'water':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M 1 5 Q 4 3 7 5 T 13 5 M 1 9 Q 4 7 7 9 T 13 9"
            fill="none" stroke={color} strokeWidth="1.1" />
        </svg>
      );
    case 'airport':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14">
          <path d="M 7 1 L 8 6 L 13 8 L 8 9 L 7 13 L 6 9 L 1 8 L 6 6 Z" fill={color} />
        </svg>
      );
    default:
      return <div style={{ width: s, height: s, background: color }} />;
  }
}

function THLegend() {
  return (
    <NWPanel padding={10} accent="amber" title="MAP · LEGEND">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px',
        fontFamily: NW.mono, fontSize: 9.5, color: NW.fg1, letterSpacing: '0.08em' }}>
        <span><span style={{ color: NW.cyan }}>■</span> KESSLER (us)</span>
        <span><span style={{ color: NW.magenta }}>■</span> DAIGO</span>
        <span><span style={{ color: NW.amber }}>■</span> MERIDIAN</span>
        <span><span style={{ color: NW.red }}>■</span> RED·CELL</span>
        <span><span style={{ color: NW.green }}>■</span> FEDERAL</span>
        <span><span style={{ color: NW.fg2 }}>■</span> NO-MAN'S</span>
      </div>
      <div style={{ borderTop: `1px solid ${NW.line}`, margin: '8px 0' }} />
      <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2, letterSpacing: '0.08em',
        display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span>━━  SUPPLY · OPEN</span>
        <span style={{ color: NW.amber }}>┅┅ SUPPLY · HARASSED</span>
        <span style={{ color: NW.red }}>╳   EXCLUSION · NIL ENTRY</span>
        <span style={{ color: NW.magenta }}>◆   ACTIVE CONTACT</span>
      </div>
    </NWPanel>
  );
}

/* ========== CENTER MAP ========== */

function THMap({ sel, onSel }) {
  return (
    <NWPanel padding={0} accent="cyan"
      title={`THEATER MAP · ${TH.theater}`}
      right={<>
        <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>1:200K · MERCATOR</span>
        <NWChip small kbd="+">ZOOM</NWChip>
        <NWChip small kbd="R">RESET</NWChip>
      </>}
      style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: NW.bg0 }}>
        <svg viewBox="0 0 1000 900" preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
            <pattern id="th-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 H 0 V 40" stroke={NW.line} strokeWidth="0.4" fill="none" opacity="0.5" />
            </pattern>
            <pattern id="th-grid-fine" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="0" cy="0" r="0.5" fill={NW.line} opacity="0.35" />
            </pattern>
            <radialGradient id="th-pulse-c">
              <stop offset="0%" stopColor={NW.cyan} stopOpacity="0.5" />
              <stop offset="100%" stopColor={NW.cyan} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="th-pulse-m">
              <stop offset="0%" stopColor={NW.magenta} stopOpacity="0.45" />
              <stop offset="100%" stopColor={NW.magenta} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="th-pulse-a">
              <stop offset="0%" stopColor={NW.amber} stopOpacity="0.4" />
              <stop offset="100%" stopColor={NW.amber} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="th-pulse-r">
              <stop offset="0%" stopColor={NW.red} stopOpacity="0.45" />
              <stop offset="100%" stopColor={NW.red} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="th-pulse-g">
              <stop offset="0%" stopColor={NW.green} stopOpacity="0.3" />
              <stop offset="100%" stopColor={NW.green} stopOpacity="0" />
            </radialGradient>
            <pattern id="th-exclusion" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="10" stroke={NW.red} strokeWidth="1" opacity="0.45" />
            </pattern>
            <pattern id="th-wilds" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
              <line x1="0" y1="0" x2="0" y2="8" stroke={NW.fg2} strokeWidth="0.4" opacity="0.5" />
            </pattern>
            <filter id="th-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width="1000" height="900" fill={NW.bg0} />
          <rect width="1000" height="900" fill="url(#th-grid-fine)" />
          <rect width="1000" height="900" fill="url(#th-grid)" />

          {/* coastline / sea mask — south & east are water */}
          <path d="M 0 900 L 0 780 Q 120 760 240 790 Q 360 830 500 830 Q 620 820 720 840 Q 820 860 1000 830 L 1000 900 Z"
            fill="#05101f" stroke={NW.cyan} strokeOpacity="0.3" strokeWidth="0.6" />
          <path d="M 920 0 L 1000 0 L 1000 830 Q 940 800 920 720 Q 900 500 920 0 Z"
            fill="#05101f" stroke={NW.cyan} strokeOpacity="0.3" strokeWidth="0.6" />

          {/* faint coast line text */}
          <text x="60" y="870" fontSize="8.5" fontFamily={NW.mono} fill={NW.cyan} opacity="0.55"
            letterSpacing="2.5">SAGAMI BAY</text>
          <text x="940" y="450" fontSize="8.5" fontFamily={NW.mono} fill={NW.cyan} opacity="0.55"
            letterSpacing="2.5" transform="rotate(90 940 450)">PACIFIC</text>

          {/* river spine — Tama/Arakawa composite */}
          <path d="M 180 120 Q 320 260 420 380 Q 500 520 580 620 Q 660 740 720 830"
            fill="none" stroke={NW.cyan} strokeWidth="2" strokeOpacity="0.45" />
          <path d="M 180 120 Q 320 260 420 380 Q 500 520 580 620 Q 660 740 720 830"
            fill="none" stroke={NW.cyan} strokeWidth="0.6" strokeOpacity="0.9" strokeDasharray="1 6" />

          {/* highways — long dashed amber */}
          <g stroke={NW.amber} fill="none" opacity="0.55" strokeDasharray="10 6">
            <path d="M 60 600 L 560 640 L 820 540" strokeWidth="1.1" />
            <path d="M 500 720 L 560 640 L 760 380" strokeWidth="1.1" />
            <path d="M 440 820 L 500 720" strokeWidth="1" />
          </g>

          {/* no-mans wilds patch */}
          <path d="M 220 360 Q 300 330 380 380 Q 420 430 370 500 Q 300 540 230 510 Q 180 450 220 360 Z"
            fill="url(#th-wilds)" stroke={NW.fg2} strokeWidth="0.6" strokeOpacity="0.5" />

          {/* exclusion zones — large hatched polygons */}
          <g>
            <circle cx="520" cy="560" r="90" fill="url(#th-exclusion)" stroke={NW.red}
              strokeWidth="1.1" strokeDasharray="6 4" opacity="0.9" />
            <text x="520" y="480" fontSize="10" fontFamily={NW.mono} fill={NW.red}
              textAnchor="middle" letterSpacing="3.5" fontWeight="700">EXCLUSION · A</text>
            <text x="520" y="492" fontSize="8" fontFamily={NW.mono} fill={NW.red}
              textAnchor="middle" letterSpacing="2" opacity="0.75">FAULT CORE</text>

            <ellipse cx="600" cy="220" rx="170" ry="80" fill="url(#th-exclusion)" stroke={NW.red}
              strokeWidth="1.1" strokeDasharray="6 4" opacity="0.8" />
            <text x="600" y="160" fontSize="10" fontFamily={NW.mono} fill={NW.red}
              textAnchor="middle" letterSpacing="3.5" fontWeight="700">EXCLUSION · B</text>
            <text x="600" y="172" fontSize="8" fontFamily={NW.mono} fill={NW.red}
              textAnchor="middle" letterSpacing="2" opacity="0.75">SEALED · FED</text>
          </g>

          {/* control blobs — soft territory fills */}
          <g>
            {/* daigo control — south cluster */}
            <path d="M 480 640 Q 600 600 780 640 Q 820 720 720 760 Q 600 780 500 720 Q 440 680 480 640 Z"
              fill={NW.magentaSoft} stroke={NW.magenta} strokeOpacity="0.3" strokeWidth="0.6" />
            {/* meridian — port */}
            <path d="M 450 700 Q 540 720 540 760 Q 500 800 420 790 Q 400 750 450 700 Z"
              fill={NW.amberSoft} stroke={NW.amber} strokeOpacity="0.3" strokeWidth="0.6" />
            {/* kessler — Nakano/Yokosuka corridor */}
            <path d="M 400 480 Q 460 500 480 560 Q 470 620 420 620 Q 380 580 380 520 Q 380 500 400 480 Z"
              fill="rgba(24,224,255,0.12)" stroke={NW.cyan} strokeOpacity="0.5" strokeWidth="0.8" />
            <circle cx="440" cy="820" r="38" fill="rgba(24,224,255,0.12)" stroke={NW.cyan}
              strokeOpacity="0.5" strokeWidth="0.7" />
            {/* federal — north-east line */}
            <path d="M 720 360 Q 800 340 860 400 Q 880 480 840 540 Q 780 540 740 460 Q 720 400 720 360 Z"
              fill="rgba(51,255,160,0.08)" stroke={NW.green} strokeOpacity="0.3" strokeWidth="0.5" />
            {/* redcell — wild ridge */}
            <path d="M 230 380 Q 340 360 380 450 Q 360 520 280 520 Q 220 480 230 380 Z"
              fill="rgba(255,74,92,0.07)" stroke={NW.red} strokeOpacity="0.3" strokeWidth="0.5" />
          </g>

          {/* supply corridors */}
          <g>
            {TH.supply.map((s, i) => {
              const c = s.tone === 'amber' ? NW.amber :
                        s.tone === 'green' ? NW.green : NW.cyan;
              const d = s.pts.map((p, k) => `${k ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={c} strokeWidth="2.6" opacity="0.18" />
                  <path d={d} fill="none" stroke={c} strokeWidth="1.2"
                    strokeDasharray={s.status === 'HARASSED' ? '4 5' : '0'} opacity="0.85" />
                  {/* flow chevrons */}
                  {s.pts.slice(0, -1).map((p, k) => {
                    const n = s.pts[k + 1];
                    const mx = (p[0] + n[0]) / 2, my = (p[1] + n[1]) / 2;
                    const a = Math.atan2(n[1] - p[1], n[0] - p[0]) * 180 / Math.PI;
                    return (
                      <path key={k} d="M -4 -4 L 2 0 L -4 4"
                        transform={`translate(${mx} ${my}) rotate(${a})`}
                        fill="none" stroke={c} strokeWidth="1.2" />
                    );
                  })}
                </g>
              );
            })}
          </g>

          {/* fringe incident pings — scanner-style */}
          <g>
            {TH.pings.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="5" fill={toneC[p.c]} opacity="0.9" />
                <circle cx={p.x} cy={p.y} r="14" fill="none" stroke={toneC[p.c]} strokeWidth="0.6"
                  opacity="0.6">
                  <animate attributeName="r" values="6;22;6" dur="2.8s"
                    begin={`${i * 0.35}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0;0.7" dur="2.8s"
                    begin={`${i * 0.35}s`} repeatCount="indefinite" />
                </circle>
              </g>
            ))}
          </g>

          {/* zones — clickable markers */}
          <g>
            {TH.zones.map(z => {
              const c = holderC[z.holder] || NW.fg2;
              const isSel = sel === z.id;
              const isHot = z.kind === 'hot';
              return (
                <g key={z.id} style={{ cursor: 'pointer' }} onClick={() => onSel(z.id)}>
                  {/* selection aura */}
                  {isSel && (
                    <circle cx={z.x} cy={z.y} r="26" fill="none" stroke={NW.cyan}
                      strokeWidth="1.3" strokeDasharray="3 3" />
                  )}
                  {/* kind-specific marker */}
                  {z.kind === 'city' && (
                    <g transform={`translate(${z.x} ${z.y})`}>
                      <path d="M 0 -11 L 10 -5 L 10 7 L 0 13 L -10 7 L -10 -5 Z"
                        fill={NW.bg0} stroke={c} strokeWidth="1.3" />
                      <circle r="3" fill={c} />
                    </g>
                  )}
                  {z.kind === 'base' && (
                    <g transform={`translate(${z.x} ${z.y})`}>
                      <path d="M 0 -11 L 10 -5 L 10 7 L 0 13 L -10 7 L -10 -5 Z"
                        fill={NW.cyanSoft} stroke={c} strokeWidth="1.4" />
                      <path d="M -4 -4 L 4 -4 L 4 4 L -4 4 Z" fill={c} />
                    </g>
                  )}
                  {z.kind === 'hot' && (
                    <g transform={`translate(${z.x} ${z.y})`}>
                      <path d="M 0 -14 L 13 0 L 0 14 L -13 0 Z" fill={NW.magenta} opacity="0.9" />
                      <path d="M 0 -8 L 7 0 L 0 8 L -7 0 Z" fill={NW.bg0} />
                      <circle r="2.6" fill={NW.magenta}>
                        <animate attributeName="opacity" values="1;0.3;1" dur="1.1s" repeatCount="indefinite" />
                      </circle>
                    </g>
                  )}
                  {z.kind === 'airport' && (
                    <g transform={`translate(${z.x} ${z.y})`}>
                      <circle r="11" fill={NW.bg0} stroke={c} strokeWidth="1.2" />
                      <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill={c} />
                    </g>
                  )}
                  {z.kind === 'water' && (
                    <g transform={`translate(${z.x} ${z.y})`}>
                      <path d="M 0 -10 L 9 0 L 0 10 L -9 0 Z"
                        fill="none" stroke={c} strokeWidth="1.1" strokeDasharray="3 2" />
                    </g>
                  )}
                  {z.kind === 'wilds' && (
                    <g transform={`translate(${z.x} ${z.y})`}>
                      <path d="M -11 6 L -5 -6 L 0 2 L 5 -8 L 11 6 Z"
                        fill="none" stroke={c} strokeWidth="1.2" />
                    </g>
                  )}
                  {z.kind === 'exclusion' && null}

                  {/* label */}
                  {z.kind !== 'exclusion' && (
                    <text x={z.x} y={z.y + (isHot ? 28 : 24)} fontSize="9"
                      fontFamily={NW.mono} fill={isSel ? NW.cyan : c}
                      textAnchor="middle" letterSpacing="1.5" fontWeight={isSel ? 700 : 500}>
                      {z.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* active ops badges — tethered to their zone */}
          <g>
            {TH.ops.map((o, i) => {
              const z = TH.zones.find(zz => zz.id === o.zone);
              if (!z) return null;
              const c = toneC[o.tone];
              const bx = z.x + (i % 2 ? 90 : -90);
              const by = z.y + (i < 2 ? -40 : 40);
              return (
                <g key={i}>
                  <line x1={z.x} y1={z.y} x2={bx} y2={by} stroke={c} strokeWidth="0.6"
                    strokeDasharray="2 2" opacity="0.7" />
                  <rect x={bx - 62} y={by - 12} width="124" height="24"
                    fill={NW.bg0} stroke={c} strokeWidth="1" />
                  <text x={bx - 58} y={by - 2} fontSize="9" fontFamily={NW.mono}
                    fill={c} letterSpacing="1.5" fontWeight="700">{o.code}</text>
                  <text x={bx - 58} y={by + 8} fontSize="8" fontFamily={NW.mono}
                    fill={NW.fg2} letterSpacing="1">{o.state} · {o.meta.split('·')[0].trim()}</text>
                </g>
              );
            })}
          </g>

          {/* scale + compass */}
          <g transform="translate(40 840)">
            <line x1="0" y1="0" x2="120" y2="0" stroke={NW.fg1} strokeWidth="0.8" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke={NW.fg1} />
            <line x1="60" y1="-2" x2="60" y2="2" stroke={NW.fg1} />
            <line x1="120" y1="-3" x2="120" y2="3" stroke={NW.fg1} />
            <text x="60" y="14" fontSize="9" fontFamily={NW.mono} fill={NW.fg1}
              textAnchor="middle" letterSpacing="2">40 KM</text>
          </g>
          <g transform="translate(60 60)">
            <circle r="22" fill="none" stroke={NW.cyan} strokeWidth="0.8" opacity="0.7" />
            <path d="M 0 -20 L 4 0 L 0 22 L -4 0 Z" fill={NW.cyan} />
            <text y="-26" fontSize="10" fontFamily={NW.mono} fill={NW.cyan}
              textAnchor="middle" letterSpacing="2" fontWeight="700">N</text>
          </g>

          {/* coordinate ticks across top */}
          <g fontSize="8" fontFamily={NW.mono} fill={NW.fg2} letterSpacing="1.5">
            {[200, 400, 600, 800].map(x => (
              <g key={x}>
                <line x1={x} y1="0" x2={x} y2="6" stroke={NW.line2} strokeWidth="0.6" />
                <text x={x} y="18" textAnchor="middle">
                  E 139°{Math.round((x / 1000) * 72 + 8)}
                </text>
              </g>
            ))}
          </g>
        </svg>

        {/* corner HUD chips */}
        <div style={{ position: 'absolute', right: 12, bottom: 12,
          display: 'flex', gap: 6, fontFamily: NW.mono, fontSize: 9.5,
          color: NW.fg2, letterSpacing: '0.1em' }}>
          <span style={{ padding: '3px 7px', border: `1px solid ${NW.line2}`, background: NW.bg1 }}>
            SAT·RT · T−04:22
          </span>
          <span style={{ padding: '3px 7px', border: `1px solid ${NW.line2}`, background: NW.bg1 }}>
            WX · CLR · 12KT @ 240°
          </span>
        </div>
      </div>
    </NWPanel>
  );
}

/* ========== RIGHT RAIL ========== */

function THZoneFocus({ zone }) {
  const c = holderC[zone.holder] || NW.fg2;
  const linkedOp = TH.ops.find(o => o.zone === zone.id);
  return (
    <NWPanel padding={0} accent={zone.kind === 'hot' ? 'magenta' : 'cyan'}
      title={`FOCUS · ${zone.name}`}
      right={<span style={{ color: NW.fg2, fontFamily: NW.mono, fontSize: 10 }}>
        GRID {Math.round(zone.x)}-{Math.round(zone.y)}
      </span>}>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: NW.display, fontSize: 22, fontWeight: 700,
            color: NW.fg0, letterSpacing: '0.04em', lineHeight: 1 }}>{zone.label}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: NW.mono, fontSize: 10, color: c,
            letterSpacing: '0.2em', border: `1px solid ${c}77`, padding: '2px 6px' }}>
            {zone.holder ? zone.holder.toUpperCase() : 'UNHELD'}
          </span>
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 10.5, color: NW.fg1,
          marginTop: 6, letterSpacing: '0.06em' }}>{zone.sub}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
          <THFocusStat k="KIND" v={zone.kind.toUpperCase()} tone={c} />
          <THFocusStat k="CIV·DEN" v={zone.civ} tone={zone.civ === 'HIGH' ? NW.amber : NW.fg0} />
          <THFocusStat k="THREAT" v={zone.kind === 'hot' ? 'ACTIVE' : zone.holder === 'redcell' ? 'HIGH' : zone.holder === 'kessler' ? 'LOW' : 'MED'}
            tone={zone.kind === 'hot' ? NW.magenta : NW.fg0} />
        </div>

        {linkedOp && (
          <div style={{ marginTop: 14, padding: 10, background: NW.bg0,
            border: `1px solid ${toneC[linkedOp.tone]}55`,
            borderLeft: `3px solid ${toneC[linkedOp.tone]}` }}>
            <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2,
              letterSpacing: '0.22em' }}>◆ LINKED OPERATION</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: NW.display, fontSize: 14, fontWeight: 700,
                color: toneC[linkedOp.tone], letterSpacing: '0.06em' }}>{linkedOp.code}</span>
              <span style={{ fontFamily: NW.mono, fontSize: 9.5, color: toneC[linkedOp.tone],
                letterSpacing: '0.18em' }}>{linkedOp.state}</span>
            </div>
            <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg1,
              marginTop: 3 }}>{linkedOp.meta}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <NWChip small kbd="J">JUMP TO OP</NWChip>
          <NWChip small>BRIEF</NWChip>
          <NWChip small>INTEL DOSSIER</NWChip>
          <NWChip small primary>PLAN OP ▸</NWChip>
        </div>
      </div>
    </NWPanel>
  );
}

function THFocusStat({ k, v, tone }) {
  return (
    <div style={{ borderLeft: `2px solid ${NW.line2}`, paddingLeft: 8 }}>
      <div style={{ fontFamily: NW.mono, fontSize: 8.5, color: NW.fg2,
        letterSpacing: '0.24em' }}>{k}</div>
      <div style={{ fontFamily: NW.display, fontSize: 14, fontWeight: 700,
        color: tone, letterSpacing: '0.04em', marginTop: 2 }}>{v}</div>
    </div>
  );
}

function THIntelFeed() {
  return (
    <NWPanel title="THEATER INTEL · DARKNET" accent="amber" padding={0}
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
      right={<><NWChip small primary>ALL</NWChip><NWChip small>HOT</NWChip><NWChip small>ECON</NWChip></>}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {TH.intel.map((m, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '46px 48px 1fr',
            gap: 8, padding: '7px 12px',
            borderTop: i > 0 ? `1px dashed ${NW.line}` : 'none',
            fontFamily: NW.mono, fontSize: 10.5, alignItems: 'baseline',
            background: m.c === 'magenta' ? 'rgba(255,45,154,0.05)' : 'transparent',
          }}>
            <span style={{ color: NW.fg2, fontVariantNumeric: 'tabular-nums' }}>{m.t}</span>
            <span style={{ color: toneC[m.c], fontWeight: 700, letterSpacing: '0.14em',
              fontSize: 9.5 }}>{m.tag}</span>
            <span style={{ color: NW.fg1, letterSpacing: '0.04em' }}>{m.x}</span>
          </div>
        ))}
      </div>
    </NWPanel>
  );
}

/* ========== FOOTER ========== */

function THFooter() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 18px', background: NW.bg1, borderTop: `1px solid ${NW.line2}`,
    }}>
      <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.24em' }}>
        ◆ CMD/THEATER · KESSLER &amp; SONS · 4TH IRR "CORDON"
      </span>
      <span style={{ flex: 1 }} />
      <NWChip kbd="M">MEASURE</NWChip>
      <NWChip kbd="L">LAYERS</NWChip>
      <NWChip kbd="O">ORBAT</NWChip>
      <NWChip kbd="B">BATTLE</NWChip>
      <NWChip primary kbd="↵" style={{ padding: '10px 22px', fontSize: 12 }}>ASSIGN CONTRACT ▸</NWChip>
    </div>
  );
}

Object.assign(window, { NeonwireTheater });
