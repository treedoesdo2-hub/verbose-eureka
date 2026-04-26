// dir-b-neonwire-combat.jsx — NEON WIRE combat view (v2)
// Fixes: nameplates only on selected/firing, panels drop glow & go translucent,
// objective markers shrunk, kill feed flush-left monochrome, roster on dark inlay.

function NeonwireCombat() {
  return (
    <NWFrame>
      <NWSystemBar
        path="/OPS/LIVE/OP-CLEARWATER"
        right={<>
          <span style={{ color: NW.magenta }}>● CONTACT</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.cyan }}>DRONE·01 · 340M AGL</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.fg1 }}>T+08:14</span>
        </>}
      />
      <div style={{ position: 'relative', height: 'calc(100% - 32px)' }}>
        <NWCombatMap />

        {/* Objective top — smaller, flush top edge, no glow */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(6,9,20,0.72)', backdropFilter: 'blur(6px)',
          borderLeft: `1px solid ${NW.line2}`, borderRight: `1px solid ${NW.line2}`,
          borderBottom: `1px solid ${NW.cyan}`,
          padding: '8px 22px', display: 'flex', gap: 16, alignItems: 'center', minWidth: 560 }}>
          <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.cyan, letterSpacing: '0.2em' }}>◆ OBJ 1/3</span>
          <span style={{ width: 1, height: 14, background: NW.line2 }} />
          <span style={{ fontFamily: NW.display, fontSize: 13, color: NW.fg0, fontWeight: 700, letterSpacing: '0.1em' }}>
            SECURE MANIFEST · WAREHOUSE 07
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.16em' }}>T+08:14 / 25:00</span>
          <div style={{ width: 120 }}><NWBar value={0.33} tone="cyan" height={2} /></div>
        </div>

        {/* Kill feed — flush-left, no panel chrome, monochrome type */}
        <div style={{ position: 'absolute', top: 56, left: 24, width: 400,
          fontFamily: NW.mono, fontSize: 11, pointerEvents: 'none' }}>
          <div style={{ fontSize: 9, color: NW.cyan, letterSpacing: '0.22em', marginBottom: 4,
            textShadow: '0 1px 3px rgba(0,0,0,1)' }}>◆ KILL FEED</div>
          {NW_KILLS.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '1.5px 0',
              color: NW.fg1, textShadow: '0 1px 3px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.8)',
              opacity: 1 - i * 0.11 }}>
              <span style={{ color: NW.fg2 }}>{r.t}</span>
              <span style={{ color: r.tone }}>{r.a}</span>
              <span style={{ color: NW.fg2 }}>▸</span>
              <span style={{ color: r.tone === NW.magenta ? NW.magenta : NW.fg1 }}>{r.v}</span>
              <span style={{ color: NW.fg2, fontSize: 10 }}>{r.w}</span>
            </div>
          ))}
        </div>

        {/* Drone / time ctrl — translucent, hairline only */}
        <div style={{ position: 'absolute', top: 56, right: 24, width: 220,
          background: 'rgba(6,9,20,0.78)', backdropFilter: 'blur(6px)',
          border: `1px solid ${NW.line2}`, padding: 12 }}>
          <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.cyan, letterSpacing: '0.16em', marginBottom: 8 }}>◆ DRONE·01 · OVERWATCH</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', fontFamily: NW.mono, fontSize: 10.5 }}>
            <span style={{ color: NW.fg2 }}>ALT</span><span style={{ color: NW.fg1 }}>340M AGL</span>
            <span style={{ color: NW.fg2 }}>FUEL</span><span style={{ color: NW.green }}>74%</span>
            <span style={{ color: NW.fg2 }}>LINK</span><span style={{ color: NW.green }}>Q-ENCR</span>
            <span style={{ color: NW.fg2 }}>IR</span><span style={{ color: NW.amber }}>ACTIVE</span>
          </div>
          <div style={{ height: 1, background: NW.line, margin: '10px 0' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {['❚❚', '▶', '▶▶', '▶▶▶'].map((g, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', padding: '4px 0',
                fontFamily: NW.mono, fontSize: 10, color: i === 1 ? NW.cyan : NW.fg1,
                background: i === 1 ? NW.cyanSoft : 'transparent',
                border: `1px solid ${i === 1 ? NW.cyan : NW.line2}` }}>{g}</div>
            ))}
          </div>
        </div>

        {/* Dark inlay behind bottom HUD so it reads as its own deck */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 200,
          background: 'linear-gradient(180deg, rgba(6,9,20,0) 0%, rgba(6,9,20,0.55) 35%, rgba(6,9,20,0.82) 100%)',
          pointerEvents: 'none' }} />

        {/* Selected operator — bottom left, ONE glow allowed (the selected-unit echo) */}
        <div style={{ position: 'absolute', left: 24, bottom: 24, width: 400,
          background: 'rgba(6,9,20,0.88)', backdropFilter: 'blur(8px)',
          border: `1px solid ${NW.cyan}`, clipPath: HEX_CLIP_TL_BR }}>
          <div style={{ display: 'flex', gap: 16, padding: 16 }}>
            <NWPaperdoll />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.cyan, letterSpacing: '0.2em' }}>◆ SELECTED · BRAVO·01</div>
              <div style={{ fontFamily: NW.display, fontSize: 28, color: NW.fg0, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.05, marginTop: 2 }}>"HOLST"</div>
              <div style={{ fontFamily: NW.mono, fontSize: 10.5, color: NW.fg2, marginBottom: 10 }}>K. HOLST · SGT · RIFLEMAN</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' }}>
                <NWMini l="HP"     v="82/100" bar={0.82} c={NW.green} />
                <NWMini l="STAM"   v="64/100" bar={0.64} c={NW.amber} />
                <NWMini l="SUPP"   v="22/100" bar={0.22} c={NW.cyan} />
                <NWMini l="MORALE" v="88/100" bar={0.88} c={NW.green} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px',
                fontFamily: NW.mono, fontSize: 10.5, marginTop: 12, color: NW.fg1 }}>
                <span style={{ color: NW.fg2 }}>WEAP</span><span>HK-416 · 18/30 · 4 MAG</span>
                <span style={{ color: NW.fg2 }}>SIDE</span><span>M17 · 12/15</span>
                <span style={{ color: NW.fg2 }}>NAD</span><span>FRAG×2 · SMK×1</span>
                <span style={{ color: NW.fg2 }}>STANCE</span><span style={{ color: NW.cyan }}>CROUCH · COV·L3</span>
              </div>
            </div>
          </div>
        </div>

        {/* Squad roster — darker, hairline, no glow */}
        <div style={{ position: 'absolute', left: 440, bottom: 24, right: 380, display: 'flex', gap: 6,
          padding: 8, background: 'rgba(3,5,13,0.85)', backdropFilter: 'blur(6px)',
          border: `1px solid ${NW.line2}` }}>
          {NW_SQUAD.map(op => (
            <div key={op.name} style={{ flex: 1,
              background: op.sel ? NW.cyanSoft : op.down ? 'rgba(255,45,154,0.08)' : 'rgba(14,19,42,0.7)',
              border: `1px solid ${op.sel ? NW.cyan : op.down ? NW.magenta : NW.line2}`,
              padding: '7px 9px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <NWHexIcon size={12} color={op.sel ? NW.cyan : op.down ? NW.magenta : NW.fg2} filled={op.sel} />
                <span style={{ fontFamily: NW.display, fontSize: 11.5, fontWeight: 700,
                  color: op.down ? NW.magenta : NW.fg0, letterSpacing: '0.06em',
                  textDecoration: op.down ? 'line-through' : 'none' }}>{op.name}</span>
              </div>
              <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2, letterSpacing: '0.12em', marginTop: 2 }}>{op.role}</div>
              {!op.down && (
                <>
                  <div style={{ marginTop: 5 }}><NWBar value={op.hp} tone={op.hp < 0.35 ? 'magenta' : op.hp < 0.7 ? 'amber' : 'green'} height={2} /></div>
                  <div style={{ marginTop: 2 }}><NWBar value={op.ammo} tone="cyan" height={2} /></div>
                </>
              )}
              {op.down && <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.magenta, letterSpacing: '0.18em', marginTop: 6 }}>▼ CAS</div>}
            </div>
          ))}
        </div>

        {/* Orders — translucent, hairline */}
        <div style={{ position: 'absolute', right: 24, bottom: 24, width: 340,
          background: 'rgba(6,9,20,0.88)', backdropFilter: 'blur(8px)',
          border: `1px solid ${NW.line2}` }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${NW.line}`,
            fontFamily: NW.mono, fontSize: 10, color: NW.cyan, letterSpacing: '0.18em' }}>◆ ORDERS · "HOLST"</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', padding: 10, gap: 6 }}>
            {NW_ORDERS.map(([k, l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                background: l === 'ADVANCE' ? NW.cyanSoft : 'transparent',
                border: `1px solid ${l === 'ADVANCE' ? NW.cyan : NW.line2}`,
                fontFamily: NW.mono, fontSize: 11, color: l === 'ADVANCE' ? NW.cyan : c }}>
                <span style={{ fontSize: 9, color: NW.fg2, border: `1px solid ${NW.line2}`, padding: '0 4px' }}>{k}</span>
                <span style={{ letterSpacing: '0.1em' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </NWFrame>
  );
}

const NW_KILLS = [
  { t: '08:12', a: '"HOLST"',  v: 'CTC·11', w: '5.56 · 42m',   tone: NW.green },
  { t: '08:04', a: '"VANCE"',  v: 'CTC·10', w: 'frag · 9m',    tone: NW.green },
  { t: '07:48', a: 'CTC·8',    v: '"ORTA"', w: '7.62 · DOWN',  tone: NW.magenta },
  { t: '07:22', a: '"KIM"',    v: 'CTC·4',  w: 'DMR · 140m',   tone: NW.green },
  { t: '06:58', a: '"MARA"',   v: 'DRONE·03', w: 'AP · 0m',    tone: NW.green },
  { t: '06:40', a: 'CTC·2',    v: '"ORTA"', w: 'SUPPRESSED',   tone: NW.amber },
];

const NW_SQUAD = [
  { name: '"HOLST"', role: 'SGT · RFL', hp: 0.82, ammo: 0.6, sel: true },
  { name: '"MARA"',  role: 'CPL · MED', hp: 0.95, ammo: 0.8 },
  { name: '"VANCE"', role: 'SPC · BRE', hp: 0.68, ammo: 0.4 },
  { name: '"KIM"',   role: 'CPL · DMR', hp: 0.50, ammo: 0.7 },
  { name: '"ORTA"',  role: 'PVT · AST', hp: 0,    ammo: 0, down: true },
  { name: '"REN"',   role: 'PVT · AR',  hp: 0.88, ammo: 0.55 },
  { name: '"TAI"',   role: 'CPL · GRN', hp: 0.72, ammo: 0.9 },
  { name: '"DRU"',   role: 'SPC · ENG', hp: 0.99, ammo: 1.0 },
];

const NW_ORDERS = [
  ['Q', 'MOVE',      NW.fg0],
  ['W', 'HOLD',      NW.fg0],
  ['E', 'ADVANCE',   NW.cyan],
  ['R', 'FALL BACK', NW.fg0],
  ['T', 'SUPPRESS',  NW.amber],
  ['Y', 'FRAG',      NW.magenta],
  ['U', 'SMOKE',     NW.cyan],
  ['I', 'HEAL',      NW.green],
];

function NWMini({ l, v, bar, c }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: NW.mono,
        fontSize: 10, color: NW.fg2, letterSpacing: '0.1em' }}>
        <span>{l}</span><span style={{ color: NW.fg1 }}>{v}</span>
      </div>
      <div style={{ marginTop: 3 }}><NWBar value={bar} tone={c === NW.green ? 'green' : c === NW.amber ? 'amber' : c === NW.cyan ? 'cyan' : 'magenta'} height={2} /></div>
    </div>
  );
}

function NWPaperdoll() {
  // Hit-zone diagram. 14 regions, color-coded by HP. Selected zone gets a callout.
  const color = (hp) => hp < 0.4 ? NW.magenta : hp < 0.8 ? NW.amber : NW.cyan;
  const fill  = (hp) => hp < 0.4 ? 'rgba(255,45,154,0.2)' : hp < 0.8 ? 'rgba(255,160,32,0.18)' : 'rgba(24,224,255,0.1)';
  const zones = [
    { id: 'head',  d: 'M 70 10 a 16 18 0 1 0 0.1 0 Z',            hp: 1.0 },
    { id: 'neck',  d: 'M 60 46 L 80 46 L 80 54 L 60 54 Z',         hp: 1.0 },
    { id: 'chest', d: 'M 46 54 L 94 54 L 96 96 L 44 96 Z',         hp: 0.85, sel: true },
    { id: 'abd',   d: 'M 48 96 L 92 96 L 90 124 L 50 124 Z',       hp: 1.0 },
    { id: 'lsh',   d: 'M 30 56 L 46 54 L 48 80 L 32 82 Z',         hp: 0.95 },
    { id: 'rsh',   d: 'M 94 54 L 110 56 L 108 82 L 92 80 Z',       hp: 0.5 },
    { id: 'larm',  d: 'M 32 82 L 48 80 L 48 116 L 30 118 Z',       hp: 1.0 },
    { id: 'rarm',  d: 'M 92 80 L 108 82 L 110 118 L 92 116 Z',     hp: 1.0 },
    { id: 'lhand', d: 'M 28 118 L 48 116 L 48 134 L 28 134 Z',     hp: 1.0 },
    { id: 'rhand', d: 'M 92 116 L 112 118 L 112 134 L 92 134 Z',   hp: 1.0 },
    { id: 'lleg',  d: 'M 50 124 L 68 124 L 66 180 L 48 180 Z',     hp: 0.7 },
    { id: 'rleg',  d: 'M 72 124 L 90 124 L 92 180 L 74 180 Z',     hp: 1.0 },
    { id: 'lft',   d: 'M 48 180 L 68 180 L 66 200 L 46 200 Z',     hp: 1.0 },
    { id: 'rft',   d: 'M 72 180 L 92 180 L 94 200 L 74 200 Z',     hp: 1.0 },
  ];
  return (
    <svg width="130" height="210" viewBox="0 0 160 220" style={{ flexShrink: 0 }}>
      {zones.map(z => (
        <path key={z.id} d={z.d} fill={fill(z.hp)} stroke={color(z.hp)} strokeWidth={z.sel ? 1.6 : 0.7} />
      ))}
      {/* center axis */}
      <line x1="70" y1="8" x2="70" y2="214" stroke={NW.fgDim} strokeWidth="0.4" strokeDasharray="2 3" />
      {/* callout for selected (chest) */}
      <line x1="96" y1="75" x2="128" y2="75" stroke={NW.cyan} strokeWidth="0.5" strokeDasharray="2 2" />
      <text x="130" y="70" fill={NW.cyan} fontSize="8" fontFamily={NW.mono} letterSpacing="1">CHEST</text>
      <text x="130" y="80" fill={NW.fg2} fontSize="7.5" fontFamily={NW.mono}>85%</text>
      {/* damage marker on rsh */}
      <circle cx="102" cy="68" r="3" fill={NW.magenta} />
      <circle cx="102" cy="68" r="7" fill="none" stroke={NW.magenta} strokeWidth="0.5" strokeDasharray="1.5 1.5" />
      {/* damage marker on lleg */}
      <circle cx="58" cy="150" r="2.5" fill={NW.amber} />
    </svg>
  );
}

// ── MAP ─────────────────────────────────────────

function NWCombatMap() {
  return (
    <svg viewBox="0 0 1920 1048" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <pattern id="nw-concrete" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect width="60" height="60" fill="#0c1022" />
          <circle cx="10" cy="14" r="0.5" fill="#172040" />
          <circle cx="42" cy="32" r="0.5" fill="#172040" />
        </pattern>
        <pattern id="nw-asphalt" width="80" height="80" patternUnits="userSpaceOnUse">
          <rect width="80" height="80" fill="#070a18" />
          <circle cx="18" cy="30" r="0.4" fill="#121830" />
          <circle cx="54" cy="60" r="0.4" fill="#121830" />
        </pattern>
        <pattern id="nw-grav" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#0a0e1e" />
          <circle cx="8" cy="10" r="0.6" fill="#141a32" />
          <circle cx="26" cy="18" r="0.8" fill="#18204a" />
          <circle cx="14" cy="30" r="0.5" fill="#121830" />
        </pattern>
        <radialGradient id="nw-smoke"><stop offset="0%" stopColor="#c8d0dc" stopOpacity="0.85" /><stop offset="70%" stopColor="#5a6680" stopOpacity="0.5" /><stop offset="100%" stopColor="#5a6680" stopOpacity="0" /></radialGradient>
        <radialGradient id="nw-muzzle"><stop offset="0%" stopColor="#ffe8a0" stopOpacity="1" /><stop offset="50%" stopColor="#ffc048" stopOpacity="0.7" /><stop offset="100%" stopColor="#ff8a14" stopOpacity="0" /></radialGradient>
        <radialGradient id="nw-blast"><stop offset="0%" stopColor="#fff8d8" /><stop offset="30%" stopColor="#ffa020" stopOpacity="0.85" /><stop offset="70%" stopColor="#ff2d9a" stopOpacity="0.4" /><stop offset="100%" stopColor="#ff2d9a" stopOpacity="0" /></radialGradient>
        <radialGradient id="nw-los-c"><stop offset="0%" stopColor={NW.cyan} stopOpacity="0.12" /><stop offset="100%" stopColor={NW.cyan} stopOpacity="0" /></radialGradient>
        <clipPath id="nw-fov"><path d="M 180 220 L 520 160 L 980 140 L 1420 200 L 1640 340 L 1720 620 L 1560 880 L 1140 940 L 720 920 L 380 820 L 220 600 Z" /></clipPath>
      </defs>

      <rect width="1920" height="1048" fill="url(#nw-grav)" />
      <rect width="1920" height="1048" fill="#03050d" opacity="0.78" />

      <g clipPath="url(#nw-fov)">
        <rect width="1920" height="1048" fill="url(#nw-asphalt)" />
        <rect x="300" y="220" width="1200" height="60" fill="#05081a" />
        <rect x="300" y="640" width="1200" height="60" fill="#05081a" />
        <rect x="440" y="140" width="40" height="920" fill="#05081a" />
        <rect x="1040" y="140" width="40" height="920" fill="#05081a" />
        {Array.from({ length: 20 }).map((_, i) => <rect key={i} x={320 + i * 60} y={249} width={20} height={2} fill={NW.cyan} opacity="0.22" />)}
        {Array.from({ length: 20 }).map((_, i) => <rect key={`b${i}`} x={320 + i * 60} y={669} width={20} height={2} fill={NW.cyan} opacity="0.22" />)}

        {[
          [320,300,100,320,'W-04A'],[500,300,520,340,'WAREHOUSE 07',true],
          [1100,300,200,120,'OFF-01'],[1100,440,200,200,'DEPOT'],
          [1320,300,200,340,'YARD'],
          [320,720,260,220,'BLK-12'],[620,720,280,220,'TERMINAL'],
          [940,720,200,220,'LOT-22'],[1180,720,340,220,'STAGING'],
        ].map(([x,y,w,h,l,p],i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill={p ? '#122040' : '#0a1128'} stroke="#030510" strokeWidth="1.5" />
            <rect x={x + 2} y={y + 2} width={w - 4} height={2} fill={NW.cyan} opacity="0.3" />
            <rect x={x} y={y + h - 3} width={w} height={3} fill="#02040c" />
            {Array.from({ length: Math.floor(w / 40) }).map((_, j) => (
              <rect key={j} x={x + 8 + j * 40} y={y + 8} width={16} height={3} fill="#06091a" />
            ))}
            <text x={x + 10} y={y + h - 10} fill={NW.cyan} opacity="0.45" fontSize="10" fontFamily={NW.mono} letterSpacing="2">{l}</text>
          </g>
        ))}

        {/* cargo */}
        {[['#1a2a44'],['#441a2a'],['#1a2a44'],['#3a2e15'],['#1c2850'],['#441a2a']].map((c,i) => (
          <rect key={i} x={1340 + (i % 3) * 44} y={320 + Math.floor(i / 3) * 100} width={40} height={96}
            fill={c} stroke={NW.cyan} strokeWidth="0.4" opacity="0.9" />
        ))}

        {/* vehicles */}
        <g transform="translate(780 250)"><rect x="-16" y="-10" width="32" height="20" fill="#0a0d1a" stroke={NW.magenta} strokeWidth="1" /><rect x="-10" y="-4" width="16" height="8" fill="#1a2040" /></g>
        <g transform="translate(1060 680)"><rect x="-16" y="-10" width="32" height="20" fill="#0a0d1a" stroke={NW.magenta} strokeWidth="1" /></g>
        <g transform="translate(360 260)"><rect x="-16" y="-10" width="32" height="20" fill="#0a0d1a" stroke={NW.cyan} strokeWidth="1" /></g>
        <g transform="translate(900 660)"><circle r="80" fill="url(#nw-blast)" /></g>
      </g>

      {/* tracers */}
      {[[420,560,760,300,NW.cyan],[420,580,770,310,NW.cyan],[1120,490,900,340,NW.cyan,0.7],[780,290,430,570,NW.magenta],[1060,680,1160,520,NW.magenta,0.7]].map(([x1,y1,x2,y2,t,op],i) => (
        <g key={i} opacity={op || 0.9}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={t} strokeWidth="0.8" opacity="0.35" />
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={t} strokeWidth="0.4" />
          <circle cx={x1} cy={y1} r="5" fill="url(#nw-muzzle)" />
          <circle cx={x2} cy={y2} r="3" fill={t} />
        </g>
      ))}

      {/* smoke */}
      {[[980,560,180],[1060,480,140],[920,620,110]].map(([x,y,r],i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r={r} fill="url(#nw-smoke)" />
          <circle r={r * 0.6} fill="url(#nw-smoke)" opacity="0.7" cx={-r * 0.2} cy={-r * 0.15} />
          <circle r={r * 0.5} fill="url(#nw-smoke)" opacity="0.55" cx={r * 0.25} cy={r * 0.2} />
        </g>
      ))}

      {/* LOS */}
      <g opacity="0.55">
        <path d="M 420 560 L 760 300 L 880 400 Z" fill="url(#nw-los-c)" />
        <path d="M 1120 490 L 880 320 L 980 430 Z" fill="url(#nw-los-c)" />
      </g>

      {/* Objective markers — smaller, rings not fills, off-center */}
      <g transform="translate(760 470)">
        <circle r="14" fill="none" stroke={NW.cyan} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.85" />
        <circle r="5" fill="none" stroke={NW.cyan} strokeWidth="1.4" />
        <circle r="1.5" fill={NW.cyan} />
      </g>
      <g transform="translate(1260 810)">
        <circle r="11" fill="none" stroke={NW.amber} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.85" />
        <path d="M -4 0 h 8 M 0 -4 v 8" stroke={NW.amber} strokeWidth="1.2" />
      </g>

      {/* Units — rendered AFTER objective markers so they're never obscured */}
      {NW_FRIENDLY.map((u, i) => <NWUnit key={`f${i}`} {...u} team="f" />)}
      {NW_HOSTILE.map((u, i) => <NWUnit key={`h${i}`} {...u} team="h" />)}
    </svg>
  );
}

const NW_FRIENDLY = [
  { x: 420, y: 560, selected: true, name: '"HOLST"', hp: 0.82, firing: true },
  { x: 400, y: 590, name: '"MARA"', hp: 0.95 },
  { x: 470, y: 600, name: '"VANCE"', hp: 0.68, firing: true },
  { x: 1120, y: 490, name: '"KIM"', hp: 0.5, firing: true, prone: true },
];
const NW_HOSTILE = [
  { x: 760, y: 300, name: 'CTC·7', hp: 0.72, firing: true },
  { x: 820, y: 320, name: 'CTC·8', hp: 0.35 },
  { x: 900, y: 340, name: 'CTC·9', hp: 0.9 },
  { x: 1040, y: 690, name: 'CTC·3', hp: 0.6, firing: true },
  { x: 1200, y: 710, name: 'CTC·2', hp: 1, suppressed: true },
  { x: 680, y: 420, ghost: true },
  { x: 1340, y: 480, ghost: true },
];

// Unit: nameplate ONLY shows for selected OR firing. Otherwise just a dot + role pip.
function NWUnit({ x, y, team, selected, name, hp, firing, prone, ghost, suppressed }) {
  const c = team === 'f' ? NW.cyan : NW.magenta;
  const op = ghost ? 0.3 : 1;
  const showPlate = selected || firing;
  return (
    <g transform={`translate(${x} ${y})`} opacity={op}>
      <ellipse cx="0" cy="2" rx="8" ry="3" fill="#000" opacity="0.55" />
      <path d={team === 'f' ? 'M 0 -8 L 8 0 L 0 8 L -8 0 Z' : 'M 0 -8 L 7 7 L -7 7 Z'}
        fill="#0a0d1a" stroke={c} strokeWidth={selected ? 2 : 1.2} />
      {!prone && <line x1="0" y1="0" x2="0" y2="-13" stroke={c} strokeWidth="0.9" />}
      {firing && !ghost && <circle cx="0" cy="-12" r="4.5" fill="url(#nw-muzzle)" />}
      {suppressed && <circle r="13" fill="none" stroke={NW.amber} strokeWidth="0.6" strokeDasharray="2 2" />}
      {selected && (
        <path d="M 0 -16 L 14 -8 L 14 8 L 0 16 L -14 8 L -14 -8 Z"
          fill="none" stroke={NW.cyan} strokeWidth="1" strokeDasharray="3 2" />
      )}
      {showPlate && name && !ghost && (
        <g transform="translate(0 -22)">
          <rect x={-name.length * 3 - 8} y="-7" width={name.length * 6 + 16} height="10"
            fill="rgba(6,9,20,0.88)" stroke={c} strokeWidth="0.5" />
          <text y="1.5" fill={c} fontSize="7.5" fontFamily={NW.mono} textAnchor="middle" letterSpacing="1.2">{name}</text>
          {hp !== undefined && (
            <g transform="translate(-10 5)">
              {Array.from({ length: 5 }).map((_, i) => {
                const on = i < Math.round(hp * 5);
                return <rect key={i} x={i * 4.5} y="0" width="3" height="1.5"
                  fill={on ? (hp < 0.35 ? NW.magenta : hp < 0.7 ? NW.amber : NW.green) : NW.fgDim} />;
              })}
            </g>
          )}
        </g>
      )}
      {ghost && <text y="16" fill={NW.fg2} fontSize="8" fontFamily={NW.mono} textAnchor="middle" letterSpacing="1">LAST·SEEN</text>}
    </g>
  );
}

Object.assign(window, { NeonwireCombat });
