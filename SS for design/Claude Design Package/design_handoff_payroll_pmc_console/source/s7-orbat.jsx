// s7-orbat.jsx — NEON WIRE · Order of Battle / Roster Manager
// Battalion-scale roster: HQ + 3 line companies + support, ~240 souls, combined arms.
// "Wall of the ops room" layout — companies as columns of APP-6-inspired plaques.
// Click a plaque → right panel drills into that formation's subunits & assets.

/* ========== DATA ========== */

const BN = {
  desig: '4TH IRR. BN',
  nick: '"CORDON"',
  crest: 'C4',
  totals: { souls: 237, walkers: 9, armor: 8, support: 12 },
  readiness: { ready: 148, limited: 62, refit: 21, casualty: 6 },
  treasury: '¥ 4.27M',
  retainer: 'SATORI KŌGYŌ · 180d',
  theatre: 'KANTŌ FRINGE · SECTOR 7',
};

// Branch codes: INF INF CMD CMD REC MEC ARM ART SPT MED ENG SIG
// Echelon: sqd, sec, plt, coy, bn

const COYS = [
  {
    id: 'hq', desig: 'HQ & SPT', nick: '"KEYSTONE"', role: 'COMMAND · LOGISTICS',
    souls: [27, 30], ready: 'green', deploy: 'GARRISON · NAKANO-I',
    units: [
      { e: 'sec', b: 'CMD', d: 'BN HQ', n: '"KESTREL"',  s: [8, 8],   r: 'green', x: 'CO · XO · S-3' },
      { e: 'plt', b: 'SIG', d: 'COMMS',  n: '"LONGLINE"', s: [11,12], r: 'green', x: 'drone relay' },
      { e: 'plt', b: 'MED', d: 'MED',    n: '"WHITE FLAG"', s: [8, 10], r: 'amber', x: 'field surgery' },
      { e: 'sec', b: 'ENG', d: 'LOG',    n: '"TAIL"',     s: [10, 12], r: 'green', x: '+12 trucks · 3 ambul.' },
    ],
  },
  {
    id: 'alpha', desig: 'ALPHA COY', nick: '"IRONWIRE"', role: 'LINE INFANTRY',
    souls: [78, 88], ready: 'green', deploy: 'GARRISON · SHINJUKU-IV',
    units: [
      { e: 'plt', b: 'INF', d: '1 PLT', n: '"ANVIL"',   s: [28, 32], r: 'green', x: '3 sqd · +1 GPMG' },
      { e: 'plt', b: 'INF', d: '2 PLT', n: '"HAMMER"',  s: [30, 32], r: 'green', x: '3 sqd · +1 GPMG' },
      { e: 'plt', b: 'REC', d: '3 PLT', n: '"KITE"',    s: [18, 20], r: 'amber', x: 'scout · +2 ATV' },
      { e: 'sec', b: 'CMD', d: 'HQ SEC', n: '"PIN"',    s: [12, 12], r: 'green', x: 'CO / XO / FAC' },
    ],
    attached: [{ t: 'ARM', n: '×2 MBT ·  "OXBOW"' }, { t: 'SPT', n: '×1 mortar det.' }],
  },
  {
    id: 'bravo', desig: 'BRAVO COY', nick: '"GHOSTLINE"', role: 'MIXED · INFIL / RECON',
    souls: [62, 84], ready: 'amber', deploy: 'DEPLOYED · OP-BLACKLINE',
    units: [
      { e: 'plt', b: 'INF', d: '1 PLT', n: '"BLACKBIRD"', s: [24, 28], r: 'green', x: 'urban' },
      { e: 'plt', b: 'REC', d: '2 PLT', n: '"WOLFPACK"',  s: [16, 20], r: 'amber', x: '1 KIA (mo.) · 2 WIA' },
      { e: 'sqd', b: 'INF', d: 'SQD 06', n: '"BRAVO·06"', s: [6, 6],  r: 'magenta', x: '1 WIA · post-op refit', highlight: true },
      { e: 'sec', b: 'ENG', d: 'DEMO',   n: '"TALL CAN"', s: [8, 10], r: 'amber', x: 'breach specialists' },
      { e: 'sec', b: 'CMD', d: 'HQ SEC', n: '"NIGHTJAR"', s: [8, 10], r: 'green', x: 'acting CO' },
    ],
    attached: [{ t: 'SPT', n: '×3 drone pilots' }],
  },
  {
    id: 'charlie', desig: 'CHARLIE COY', nick: '"DEADLINE"', role: 'MECHANIZED · HEAVY',
    souls: [70, 90], ready: 'amber', deploy: 'REFIT · KAWASAKI YARD',
    units: [
      { e: 'plt', b: 'MEC', d: '1 LNC', n: '"IRONCLAD"', s: [9, 12],  r: 'amber',   x: '3 walkers · 1 refit' },
      { e: 'plt', b: 'MEC', d: '2 LNC', n: '"HARROW"',   s: [10, 12], r: 'green',   x: '3 walkers' },
      { e: 'plt', b: 'MEC', d: '3 LNC', n: '"LATE"',     s: [6, 12],  r: 'magenta', x: '2 walkers · 1 DESTR' },
      { e: 'plt', b: 'ARM', d: '1 ARM', n: '"CASEMATE"', s: [24, 28], r: 'green',   x: '6 IFV · 2 MBT' },
      { e: 'sec', b: 'CMD', d: 'HQ SEC', n: '"BELL"',    s: [10, 12], r: 'amber',   x: 'CO wounded · XO act.' },
    ],
    attached: [{ t: 'SPT', n: '×4 tech · ×2 recovery' }],
  },
];

const BRANCH_COLOR = (b) => ({
  INF: NW.cyan, REC: NW.cyan, MEC: NW.amber, ARM: NW.amber, ART: NW.amber,
  CMD: NW.fg0, SPT: NW.fg1, MED: NW.magenta, ENG: NW.fg1, SIG: NW.fg1,
}[b] || NW.fg1);

const READY_COLOR = (r) => ({ green: NW.green, amber: NW.amber, magenta: NW.magenta }[r] || NW.fg1);

/* ========== FRAME ========== */

function NeonwireOrbat() {
  const [selectedCoy, setSelectedCoy] = React.useState('alpha');
  const coy = COYS.find(c => c.id === selectedCoy);

  return (
    <NWFrame>
      <NWSystemBar
        path="/CMD/ORBAT/BATTALION"
        right={<>
          <span style={{ color: NW.cyan }}>◈ 237 SOULS</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.amber }}>9 WALKER · 8 ARM · 12 SPT</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.fg1 }}>{BN.theatre}</span>
        </>}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 480px',
        gridTemplateRows: 'auto 1fr auto',
        height: 'calc(100% - 32px)',
        position: 'relative', zIndex: 1,
      }}>
        {/* battalion banner — spans both cols */}
        <NWBnBanner />

        {/* OOB board — companies as columns */}
        <div style={{
          gridColumn: '1', gridRow: '2',
          padding: '14px 10px 14px 14px',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            height: '100%',
            alignItems: 'stretch',
          }}>
            {COYS.map(c => (
              <NWCoyColumn key={c.id} coy={c}
                selected={c.id === selectedCoy}
                onSelect={() => setSelectedCoy(c.id)} />
            ))}
          </div>
        </div>

        {/* drill-in */}
        <div style={{ gridColumn: '2', gridRow: '2', padding: '14px 14px 14px 4px', minHeight: 0 }}>
          <NWCoyDetail coy={coy} />
        </div>

        <NWOrbatFooter />
      </div>
    </NWFrame>
  );
}

/* ========== BATTALION BANNER ========== */

function NWBnBanner() {
  const r = BN.readiness;
  const total = r.ready + r.limited + r.refit + r.casualty;
  return (
    <div style={{
      gridColumn: '1 / 3', gridRow: '1',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center', gap: 24,
      padding: '16px 20px',
      background: 'linear-gradient(90deg, rgba(24,224,255,0.08), transparent 70%)',
      borderBottom: `1px solid ${NW.line2}`,
    }}>
      {/* crest */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg viewBox="0 0 72 80" style={{ width: 56, height: 62 }}>
          <path d="M 36 2 L 68 18 L 68 54 L 36 78 L 4 54 L 4 18 Z"
            fill="rgba(24,224,255,0.08)" stroke={NW.cyan} strokeWidth="1.5" />
          <path d="M 36 10 L 60 22 L 60 50 L 36 70 L 12 50 L 12 22 Z"
            fill="none" stroke={NW.cyan} strokeWidth="0.6" opacity="0.5" />
          <text x="36" y="46" textAnchor="middle" fontFamily="'Chakra Petch'"
            fontSize="22" fontWeight="700" fill={NW.cyan} letterSpacing="2">C4</text>
        </svg>
        <div>
          <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.28em' }}>
            ORDER OF BATTLE · REV 2041.03.14
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
            <span style={{ fontFamily: NW.display, fontSize: 30, color: NW.fg0, fontWeight: 700,
              letterSpacing: '0.06em', lineHeight: 1 }}>{BN.desig}</span>
            <span style={{ fontFamily: NW.display, fontSize: 22, color: NW.cyan, fontWeight: 500,
              letterSpacing: '0.1em' }}>{BN.nick}</span>
          </div>
          <div style={{ fontFamily: NW.mono, fontSize: 10.5, color: NW.fg1,
            letterSpacing: '0.1em', marginTop: 2 }}>
            RETAINER · {BN.retainer}  ·  TREASURY · <span style={{ color: NW.green }}>{BN.treasury}</span>
          </div>
        </div>
      </div>

      {/* readiness bar — stacked */}
      <div style={{ paddingLeft: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontFamily: NW.mono, fontSize: 9.5, letterSpacing: '0.22em', color: NW.fg2, marginBottom: 6 }}>
          <span>READINESS · BN</span>
          <span>
            <span style={{ color: NW.green }}>{r.ready} READY</span>
            <span style={{ color: NW.fgDim, margin: '0 8px' }}>║</span>
            <span style={{ color: NW.amber }}>{r.limited} LIMITED</span>
            <span style={{ color: NW.fgDim, margin: '0 8px' }}>║</span>
            <span style={{ color: NW.magenta }}>{r.refit + r.casualty} OOC</span>
          </span>
        </div>
        <div style={{ display: 'flex', height: 6, gap: 2 }}>
          <div style={{ flex: r.ready, background: NW.green, boxShadow: `0 0 8px ${NW.green}80` }} />
          <div style={{ flex: r.limited, background: NW.amber, boxShadow: `0 0 8px ${NW.amber}80` }} />
          <div style={{ flex: r.refit, background: NW.magenta, boxShadow: `0 0 8px ${NW.magenta}80` }} />
          <div style={{ flex: r.casualty, background: NW.red, boxShadow: `0 0 8px ${NW.red}80` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6,
          fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2, letterSpacing: '0.1em' }}>
          <span>ATTRITION · 30d · <span style={{ color: NW.green }}>+12</span> <span style={{ color: NW.magenta }}>−4</span></span>
          <span>PAY DAY · <span style={{ color: NW.cyan }}>T-09d</span></span>
          <span>INTAKE QUEUE · <span style={{ color: NW.fg1 }}>7 CONTRACTED</span></span>
        </div>
      </div>

      {/* combined arms counters */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', paddingLeft: 24,
        borderLeft: `1px solid ${NW.line2}` }}>
        <ArmCount t="INF" n={BN.totals.souls - 66} />
        <ArmCount t="MEC" n={BN.totals.walkers} />
        <ArmCount t="ARM" n={BN.totals.armor} />
        <ArmCount t="SPT" n={BN.totals.support} />
      </div>
    </div>
  );
}

function ArmCount({ t, n }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <NWBranchGlyph b={t} size={30} />
      <div>
        <div style={{ fontFamily: NW.mono, fontSize: 8.5, color: NW.fg2, letterSpacing: '0.22em' }}>{t}</div>
        <div style={{ fontFamily: NW.display, fontSize: 18, color: NW.fg0, fontWeight: 700,
          letterSpacing: '0.04em', lineHeight: 1 }}>{n}</div>
      </div>
    </div>
  );
}

/* ========== APP-6-esque unit glyph ========== */

function NWBranchGlyph({ b, e, size = 34, color }) {
  const w = size * 1.4, h = size;
  const c = color || BRANCH_COLOR(b);
  // echelon dots above
  const echelon = { sqd: '●', sec: '●●', plt: '●●●', coy: '│', bn: '││' }[e] || '';
  return (
    <svg width={w} height={h + 10} viewBox={`0 0 ${w} ${h + 10}`} style={{ display: 'block' }}>
      {/* echelon marks */}
      {echelon && (
        <text x={w / 2} y="8" textAnchor="middle" fontSize="8" fontFamily="'Chakra Petch'"
          fill={c} letterSpacing="1" fontWeight="700">{echelon}</text>
      )}
      {/* outer frame */}
      <rect x="1" y="11" width={w - 2} height={h - 2} fill="none" stroke={c} strokeWidth="1.4" />
      <rect x="3" y="13" width={w - 6} height={h - 6} fill={c + '22'} />

      {/* branch-specific interior */}
      {b === 'INF' && (
        <>
          <line x1="4"  y1="13" x2={w - 4} y2={h + 7} stroke={c} strokeWidth="1.2" />
          <line x1={w - 4} y1="13" x2="4" y2={h + 7} stroke={c} strokeWidth="1.2" />
        </>
      )}
      {b === 'REC' && (
        <line x1={w - 5} y1="13" x2="5" y2={h + 7} stroke={c} strokeWidth="1.4" />
      )}
      {b === 'ARM' && (
        <ellipse cx={w / 2} cy={(h + 10) / 2 + 1} rx={w / 3} ry={h / 4} fill={c} />
      )}
      {b === 'MEC' && (
        <>
          <path d={`M ${w / 2} 14 L ${w - 5} ${(h + 10) / 2 + 1} L ${w / 2} ${h + 7} L 5 ${(h + 10) / 2 + 1} Z`}
            fill="none" stroke={c} strokeWidth="1.4" />
          <text x={w / 2} y={(h + 10) / 2 + 5} textAnchor="middle" fontSize="8"
            fontFamily="'Chakra Petch'" fontWeight="700" fill={c}>M</text>
        </>
      )}
      {b === 'ART' && (
        <circle cx={w / 2} cy={(h + 10) / 2 + 1} r={h / 4} fill={c} />
      )}
      {b === 'CMD' && (
        <>
          <path d={`M 4 13 L ${w / 2 - 4} 13 L ${w / 2 + 4} 18 L ${w / 2 - 4} 23 L 4 23 Z`} fill={c} />
          <line x1="4" y1="13" x2="4" y2={h + 7} stroke={c} strokeWidth="1.2" />
        </>
      )}
      {b === 'SPT' && (
        <>
          <circle cx={w / 2 - 5} cy={(h + 10) / 2 + 1} r="2.5" fill={c} />
          <circle cx={w / 2 + 5} cy={(h + 10) / 2 + 1} r="2.5" fill={c} />
        </>
      )}
      {b === 'MED' && (
        <>
          <rect x={w / 2 - 1.5} y="14" width="3" height={h - 5} fill={c} />
          <rect x="5" y={(h + 10) / 2 - 0.5} width={w - 10} height="3" fill={c} />
        </>
      )}
      {b === 'ENG' && (
        <text x={w / 2} y={(h + 10) / 2 + 5} textAnchor="middle" fontSize="10"
          fontFamily="'Chakra Petch'" fontWeight="700" fill={c}>E</text>
      )}
      {b === 'SIG' && (
        <text x={w / 2} y={(h + 10) / 2 + 5} textAnchor="middle" fontSize="9"
          fontFamily="'Chakra Petch'" fontWeight="700" fill={c}>◄►</text>
      )}
    </svg>
  );
}

/* ========== COMPANY COLUMN ========== */

function NWCoyColumn({ coy, selected, onSelect }) {
  const sc = READY_COLOR(coy.ready);
  const frac = coy.souls[0] / coy.souls[1];
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        background: selected ? 'rgba(24,224,255,0.04)' : NW.bg1,
        border: `1px solid ${selected ? NW.cyan : NW.line}`,
        boxShadow: selected ? `0 0 0 1px ${NW.cyan}55, inset 0 0 0 1px ${NW.cyan}22` : 'none',
        cursor: 'pointer', minHeight: 0, overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${NW.line}`,
        background: selected ? 'rgba(24,224,255,0.06)' : NW.bg2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: NW.display, fontSize: 15, fontWeight: 700,
            color: NW.fg0, letterSpacing: '0.1em' }}>{coy.desig}</span>
          <span style={{ fontFamily: NW.display, fontSize: 12, color: sc,
            letterSpacing: '0.1em', fontWeight: 600 }}>{coy.nick}</span>
          <span style={{ flex: 1 }} />
          <span style={{
            fontFamily: NW.mono, fontSize: 8.5, letterSpacing: '0.22em',
            color: sc, border: `1px solid ${sc}77`, padding: '1px 5px',
          }}>{coy.ready === 'green' ? 'READY' : coy.ready === 'amber' ? 'LIMITED' : 'OOC'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4,
          fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2, letterSpacing: '0.1em' }}>
          <span>{coy.role}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ fontFamily: NW.display, fontSize: 22, fontWeight: 700,
            color: NW.fg0, letterSpacing: '0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {coy.souls[0]}
          </span>
          <span style={{ fontFamily: NW.mono, fontSize: 11, color: NW.fg2 }}>/ {coy.souls[1]} souls</span>
          <span style={{ flex: 1 }} />
          <div style={{ width: 80 }}>
            <NWBar value={frac} tone={coy.ready} height={2} />
          </div>
        </div>
        <div style={{ marginTop: 6, fontFamily: NW.mono, fontSize: 9, color: NW.fg1,
          letterSpacing: '0.1em' }}>
          {coy.deploy === 'GARRISON · SHINJUKU-IV' || coy.deploy === 'GARRISON · NAKANO-I' ? <span style={{ color: NW.cyan }}>◈ </span> :
           coy.deploy.startsWith('DEPLOYED') ? <span style={{ color: NW.amber }}>◆ </span> :
           <span style={{ color: NW.magenta }}>◇ </span>}
          {coy.deploy}
        </div>
      </div>

      {/* units */}
      <div style={{ flex: 1, overflow: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {coy.units.map((u, i) => <NWUnitPlaque key={i} u={u} />)}
      </div>

      {/* attached */}
      {coy.attached && (
        <div style={{ padding: '6px 10px', borderTop: `1px solid ${NW.line}`, background: NW.bg0 }}>
          <div style={{ fontFamily: NW.mono, fontSize: 8.5, color: NW.fg2,
            letterSpacing: '0.22em', marginBottom: 4 }}>ATTACHED</div>
          {coy.attached.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <NWBranchGlyph b={a.t} size={18} />
              <span style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg1, letterSpacing: '0.04em' }}>
                {a.n}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NWUnitPlaque({ u }) {
  const rc = READY_COLOR(u.r);
  const hi = u.highlight;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8,
      padding: '6px 8px',
      background: hi ? 'rgba(255,45,154,0.06)' : NW.bg2,
      border: `1px solid ${hi ? NW.magenta + '77' : NW.line}`,
      borderLeft: `3px solid ${rc}`,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <NWBranchGlyph b={u.b} e={u.e} size={30} color={rc} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: NW.display, fontSize: 12, fontWeight: 700,
            color: NW.fg0, letterSpacing: '0.08em' }}>{u.d}</span>
          <span style={{ fontFamily: NW.display, fontSize: 11, color: rc,
            letterSpacing: '0.08em', fontWeight: 600 }}>{u.n}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg1,
            fontVariantNumeric: 'tabular-nums' }}>{u.s[0]}/{u.s[1]}</span>
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2,
          letterSpacing: '0.08em', marginTop: 1 }}>{u.x}</div>
      </div>
    </div>
  );
}

/* ========== DRILL-IN DETAIL ========== */

function NWCoyDetail({ coy }) {
  const sc = READY_COLOR(coy.ready);
  return (
    <NWPanel
      accent={coy.ready === 'green' ? 'cyan' : coy.ready === 'amber' ? 'amber' : 'magenta'}
      padding={0}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {/* header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${NW.line}` }}>
        <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2, letterSpacing: '0.26em' }}>
          ◆ FORMATION DETAIL · {coy.role}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
          <span style={{ fontFamily: NW.display, fontSize: 28, fontWeight: 700,
            color: NW.fg0, letterSpacing: '0.06em', lineHeight: 1 }}>{coy.desig}</span>
          <span style={{ fontFamily: NW.display, fontSize: 22, color: sc,
            letterSpacing: '0.1em', fontWeight: 500 }}>{coy.nick}</span>
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 10.5, color: NW.fg1,
          letterSpacing: '0.08em', marginTop: 6 }}>{coy.deploy}</div>
      </div>

      {/* numbers strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        borderBottom: `1px solid ${NW.line}` }}>
        <DetStat k="HEAD"  v={`${coy.souls[0]}/${coy.souls[1]}`} tone="cyan" />
        <DetStat k="UNITS" v={coy.units.length} tone="cyan" />
        <DetStat k="READY" v={coy.ready === 'green' ? '96%' : coy.ready === 'amber' ? '71%' : '52%'} tone={coy.ready} />
        <DetStat k="XP·AVG" v={coy.id === 'bravo' ? 'VET·3' : coy.id === 'charlie' ? 'VET·2' : 'RGLR·4'} tone="amber" last />
      </div>

      {/* roster breakdown */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
        <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2,
          letterSpacing: '0.24em', marginBottom: 8 }}>SUBORDINATE ELEMENTS</div>
        {coy.units.map((u, i) => <NWDetailUnit key={i} u={u} />)}

        {/* named personnel */}
        <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2,
          letterSpacing: '0.24em', marginTop: 16, marginBottom: 8 }}>KEY PERSONNEL · {coy.desig}</div>
        {PERS_FOR[coy.id].map((p, i) => <NWPersRow key={i} p={p} />)}

        {/* orders log */}
        <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2,
          letterSpacing: '0.24em', marginTop: 16, marginBottom: 8 }}>ORDERS · 72h</div>
        {ORDERS_FOR[coy.id].map((o, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '68px 1fr',
            padding: '5px 0', borderTop: i > 0 ? `1px dashed ${NW.line}` : 'none',
            fontFamily: NW.mono, fontSize: 10, color: NW.fg1, letterSpacing: '0.05em' }}>
            <span style={{ color: NW.fg2 }}>{o[0]}</span>
            <span>{o[1]}</span>
          </div>
        ))}
      </div>

      {/* ctas */}
      <div style={{ padding: 10, borderTop: `1px solid ${NW.line}`, background: NW.bg0,
        display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <NWChip small kbd="A">ARMORY</NWChip>
        <NWChip small kbd="D">REDEPLOY</NWChip>
        <NWChip small kbd="P">PROMOTE/XFER</NWChip>
        <NWChip small kbd="R">REFIT</NWChip>
        <NWChip small primary kbd="↵">DRILL → SQUAD</NWChip>
      </div>
    </NWPanel>
  );
}

function DetStat({ k, v, tone, last }) {
  const c = READY_COLOR(tone) !== NW.fg1 ? READY_COLOR(tone) : (tone === 'cyan' ? NW.cyan : NW.amber);
  return (
    <div style={{ padding: '10px 12px', borderRight: last ? 'none' : `1px solid ${NW.line}` }}>
      <div style={{ fontFamily: NW.mono, fontSize: 8.5, color: NW.fg2, letterSpacing: '0.24em' }}>{k}</div>
      <div style={{ fontFamily: NW.display, fontSize: 18, color: c, fontWeight: 700,
        letterSpacing: '0.02em', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  );
}

function NWDetailUnit({ u }) {
  const rc = READY_COLOR(u.r);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '46px 1fr auto', gap: 10,
      padding: '6px 8px', marginBottom: 4,
      background: NW.bg2, borderLeft: `2px solid ${rc}`,
    }}>
      <NWBranchGlyph b={u.b} e={u.e} size={28} color={rc} />
      <div>
        <div style={{ fontFamily: NW.display, fontSize: 12, fontWeight: 700,
          color: NW.fg0, letterSpacing: '0.08em' }}>
          {u.d} <span style={{ color: rc, fontSize: 11 }}>{u.n}</span>
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2,
          letterSpacing: '0.06em', marginTop: 2 }}>{u.x}</div>
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg1, fontVariantNumeric: 'tabular-nums' }}>
          {u.s[0]}/{u.s[1]}
        </span>
        <div style={{ width: 56 }}><NWBar value={u.s[0] / u.s[1]} tone={u.r} height={2} /></div>
      </div>
    </div>
  );
}

function NWPersRow({ p }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto',
      padding: '5px 0', gap: 8, alignItems: 'center',
      borderTop: `1px dashed ${NW.line}` }}>
      <span style={{ fontFamily: NW.mono, fontSize: 9, color: p.tone === 'magenta' ? NW.magenta : NW.fg2,
        letterSpacing: '0.22em' }}>{p.rank}</span>
      <span style={{ fontFamily: NW.display, fontSize: 12, fontWeight: 600,
        color: p.tone === 'magenta' ? NW.magenta : NW.fg0, letterSpacing: '0.08em' }}>
        {p.cs}<span style={{ color: NW.fg2, fontFamily: NW.mono, fontSize: 9,
          letterSpacing: '0.14em', marginLeft: 6 }}>{p.role}</span>
      </span>
      <span style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg1, letterSpacing: '0.08em' }}>
        {p.note}
      </span>
    </div>
  );
}

/* ========== DATA: personnel + orders per company ========== */

const PERS_FOR = {
  hq: [
    { rank: 'BN·CO',   cs: '"KESTREL"',   role: 'MAJ · ACT. LT. COL',  note: '14y svc' },
    { rank: 'S-3',     cs: '"NIGHTJAR"',  role: 'OPS',                  note: 'act. XO' },
    { rank: 'SURGEON', cs: 'DR. HA-RIN',  role: 'WHITE FLAG',           note: 'post-grad' },
  ],
  alpha: [
    { rank: 'CO',   cs: '"OXBOW"',    role: 'CAPT',     note: '11y' },
    { rank: 'XO',   cs: '"ANVIL·6"',  role: '1LT',      note: 'promote pending' },
    { rank: 'CSM',  cs: '"BUCK"',     role: 'MSG',      note: 'marksman · 3★' },
    { rank: 'ACE',  cs: '"HOLST"',    role: 'SGT/RFL',  note: 'BRAVO·06 lead · cross-posted' },
  ],
  bravo: [
    { rank: 'CO',   cs: '"RAVEN"',     role: 'CAPT',  note: 'KIA · 12d ago', tone: 'magenta' },
    { rank: 'ACT.', cs: '"NIGHTJAR"',  role: '1LT',   note: 'acting · cross-posted S-3' },
    { rank: 'ACE',  cs: '"HOLST"',     role: 'SGT',   note: 'OP-BLACKLINE · SB-04' },
    { rank: 'WIA',  cs: '"ORTA"',      role: 'PVT',   note: 'FMJ thigh · 10d recov', tone: 'magenta' },
    { rank: 'NEW',  cs: '"DRU"',       role: 'SPC',   note: '2wk in · promising' },
  ],
  charlie: [
    { rank: 'CO',    cs: '"FLINT"',     role: 'CAPT',  note: 'WIA · on leave', tone: 'magenta' },
    { rank: 'ACT.',  cs: '"BELL"',      role: '1LT',   note: 'acting' },
    { rank: 'MWO',   cs: '"IRONCLAD·A"', role: 'WO',  note: 'ace pilot · 4★' },
    { rank: 'MECH',  cs: '"LATE·3"',    role: 'SPC',  note: 'walker DESTR · salvage 30%', tone: 'magenta' },
    { rank: 'ARM',   cs: '"CASEMATE·L"', role: 'SSG', note: 'IFV plt sgt' },
  ],
};

const ORDERS_FOR = {
  hq: [
    ['T-02h',  'S-3 brief · sector 7 rival movement · DAIGO PMC elements.'],
    ['T-18h',  'Logistics train dispatched Kawasaki → Nakano-I. ETA T+04h.'],
    ['T-36h',  'Drone relay "LONGLINE" upgraded · q-encr now N-3.'],
  ],
  alpha: [
    ['T-02h',  'Posture · GARRISON. Readiness drills 08:00 daily.'],
    ['T-24h',  '3 PLT "KITE" returns from recon · Kantō-W ridge.'],
    ['T-48h',  '2 MBT "OXBOW" serviced · full ammo rack.'],
  ],
  bravo: [
    ['T-00h',  'OP-BLACKLINE · exfil confirmed. 1 WIA. Package secure.'],
    ['T-06h',  'SQD "BRAVO·06" → post-op refit 72h.'],
    ['T-18h',  'Client payout cleared ¥ 1.06M (partial).'],
    ['T-30h',  'NIGHTJAR cross-post · acts CO until rotation.'],
  ],
  charlie: [
    ['T-04h',  'Walker "LATE·3" DESTR · Kawasaki yard salvage 30%.'],
    ['T-24h',  'IFV "CASEMATE" plt drills · combined-arms fundamentals.'],
    ['T-60h',  'FLINT WIA evac · CPT Bell acts.'],
    ['T-72h',  'Req · 2× replacement walkers ¥ 820K ea · CFO review.'],
  ],
};

/* ========== FOOTER ========== */

function NWOrbatFooter() {
  return (
    <div style={{
      gridColumn: '1 / 3', gridRow: '3',
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 18px',
      background: NW.bg1, borderTop: `1px solid ${NW.line2}`,
    }}>
      <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.24em' }}>
        ◆ BATTALION COMMAND
      </span>
      <span style={{ flex: 1 }} />
      <NWChip kbd="F">FILTER · BRANCH · STATUS</NWChip>
      <NWChip kbd="X">CROSS-POST</NWChip>
      <NWChip kbd="L">LOGISTICS</NWChip>
      <NWChip kbd="T">THEATER MAP</NWChip>
      <NWChip primary kbd="↵" style={{ padding: '10px 22px', fontSize: 12 }}>ISSUE ORDERS ▸</NWChip>
    </div>
  );
}

Object.assign(window, { NeonwireOrbat });
