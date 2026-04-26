// s6-debrief.jsx — NEON WIRE · After Action Report (battalion-scale)
// OP-FALLINGBIRD: CORDON BN vs. DAIGO PMC incursion across the Kawagoe Corridor.
// Map-centric, but now regional. Unit counters for companies (not operator pawns),
// phase lines, axes of advance, contested outposts. Embedded within it: OP-BLACKLINE
// — the BRAVO·06 squad infil — as one event among many.

function NeonwireDebrief() {
  return (
    <NWFrame>
      <NWSystemBar
        path="/OPS/DEBRIEF/OP-FALLINGBIRD"
        right={<>
          <span style={{ color: NW.amber }}>◈ PARTIAL SUCCESS</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.cyan }}>DOC · FB-0314-07</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.fg1 }}>ARCHIVED · 23:41 JST</span>
        </>}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 360px',
        gridTemplateRows: '1fr auto',
        gap: 0,
        height: 'calc(100% - 32px)',
        position: 'relative', zIndex: 1,
      }}>
        <NWDBLeftRail />
        <NWDBMap />
        <NWDBRightRail />
        <NWDBFooter />
      </div>
    </NWFrame>
  );
}

/* ========== LEFT RAIL ========== */

function NWDBLeftRail() {
  return (
    <div style={{
      gridColumn: '1', gridRow: '1',
      borderRight: `1px solid ${NW.line}`,
      background: NW.bg1, fontFamily: NW.mono,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '8px 16px',
        background: 'repeating-linear-gradient(-45deg, rgba(255,160,32,0.16) 0 8px, transparent 8px 16px)',
        borderBottom: `1px solid ${NW.amber}55`,
        fontSize: 9.5, letterSpacing: '0.3em', color: NW.amber, fontWeight: 700,
      }}>
        ◆ RESTRICTED ◆ BN COMMAND ◆
      </div>

      <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${NW.line}` }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: NW.fg2 }}>AFTER ACTION REPORT</div>
        <div style={{ fontFamily: NW.display, fontSize: 24, color: NW.fg0, fontWeight: 700,
          letterSpacing: '0.08em', marginTop: 6, lineHeight: 1 }}>
          OP — FALLINGBIRD
        </div>
        <div style={{ fontSize: 10, color: NW.fg1, marginTop: 8, letterSpacing: '0.1em' }}>
          KAWAGOE CORRIDOR · SECTOR 7
        </div>
        <div style={{ fontSize: 10, color: NW.fg2, marginTop: 2, letterSpacing: '0.06em' }}>
          35.93°N · 139.48°E  ·  MGRS 54S·UE·4187
        </div>
      </div>

      <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13, overflow: 'auto' }}>
        <NWField k="DATE"       v="2041 · 03 · 14" />
        <NWField k="H-HOUR"     v="09:19 JST" />
        <NWField k="ENDEX"      v="23:41 JST" />
        <NWField k="DURATION"   v="14:22:00" tone="cyan" />
        <NWField k="CLIENT"     v="SATORI KŌGYŌ" />
        <NWField k="OPPFOR"     v="DAIGO PMC · 2 COY est." tone="magenta" />
        <NWField k="DEPLOYED"   v="BN(-) · 3 COY" />
        <NWField k="COMMITTED"  v="194 · 9 WLK · 8 ARM" />
        <NWField k="KIA"        v="11" tone="magenta" />
        <NWField k="WIA"        v="24 · 3 CRIT" tone="magenta" />
        <NWField k="WALKERS"    v="2 DESTR · 1 SALV" tone="magenta" />
        <NWField k="COLLATERAL" v="6 CIV · 1 LTL" tone="magenta" />
        <NWField k="TERRAIN"    v="3/4 AXES HELD" tone="amber" />
        <NWField k="VERDICT"    v="PARTIAL SUCCESS" tone="amber" big />
      </div>

      <div style={{
        padding: '12px 18px', borderTop: `1px solid ${NW.line}`,
        fontSize: 9, letterSpacing: '0.22em', color: NW.fg2, lineHeight: 1.8,
      }}>
        FILED BY · BN·CO "KESTREL"<br/>
        COUNTERSIGN · S-3 "NIGHTJAR"<br/>
        HASH · A4 19 C7 0E · 3B 81
      </div>
    </div>
  );
}

function NWField({ k, v, tone, big }) {
  const c = tone === 'cyan' ? NW.cyan : tone === 'amber' ? NW.amber :
            tone === 'magenta' ? NW.magenta : NW.fg0;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.24em', color: NW.fg2, minWidth: 82 }}>{k}</span>
        <span style={{ flex: 1, height: 1, background: NW.line,
          borderBottom: `1px dashed ${NW.line2}`, position: 'relative', top: -3 }} />
      </div>
      <div style={{
        fontFamily: big ? NW.display : NW.mono,
        fontSize: big ? 16 : 12, color: c, letterSpacing: big ? '0.08em' : '0.04em',
        marginTop: 3, fontWeight: big ? 700 : 500,
      }}>{v}</div>
    </div>
  );
}

/* ========== CENTER — THEATER MAP ========== */

const MW = 1200;
const MH = 780;

// Friendly & hostile unit counters placed on map. (x,y,side,branch,echelon,desig,nick,state)
// state: ok / dmg / lost (for rendering)
const COUNTERS = [
  // Friendly (blue/cyan) — CORDON BN
  { x: 90,  y: 640, s: 'b', b: 'CMD', e: 'bn',  d: 'BN HQ',   n: '"KESTREL"', st: 'ok'  },
  { x: 300, y: 420, s: 'b', b: 'INF', e: 'coy', d: 'A COY',   n: '"IRONWIRE"', st: 'ok' },
  { x: 440, y: 380, s: 'b', b: 'INF', e: 'plt', d: '2 PLT',   n: '"HAMMER"',   st: 'ok' },
  { x: 720, y: 260, s: 'b', b: 'REC', e: 'plt', d: 'B-3 PLT', n: '"WOLFPACK"', st: 'dmg' },
  { x: 680, y: 210, s: 'b', b: 'INF', e: 'sqd', d: 'B·06',    n: '"BRAVO·06"', st: 'dmg', pulse: true },
  { x: 410, y: 560, s: 'b', b: 'MEC', e: 'plt', d: '1 LNC',   n: '"IRONCLAD"', st: 'ok' },
  { x: 340, y: 660, s: 'b', b: 'MEC', e: 'plt', d: '3 LNC',   n: '"LATE"',     st: 'lost' },
  { x: 530, y: 650, s: 'b', b: 'ARM', e: 'plt', d: 'CASEMATE', n: '"CSMT"',    st: 'ok' },
  { x: 230, y: 700, s: 'b', b: 'ART', e: 'sec', d: 'MORT',    n: '"CHIME"',    st: 'ok' },

  // Hostile (magenta) — DAIGO PMC
  { x: 1020, y: 230, s: 'r', b: 'MEC', e: 'plt', d: 'D·1 LNC', n: '"KITE·R"',  st: 'dmg' },
  { x: 920,  y: 340, s: 'r', b: 'INF', e: 'coy', d: 'D·1 COY', n: '"GRIMJAW"', st: 'ok' },
  { x: 860,  y: 500, s: 'r', b: 'ARM', e: 'plt', d: 'D·ARM',   n: '"AX"',      st: 'lost' },
  { x: 1060, y: 620, s: 'r', b: 'INF', e: 'plt', d: 'D·RSV',   n: '"LATEMAIL"', st: 'ok' },
];

// Engagement events (spatial, 9 of them — company-scale, not operator-scale)
const EVENTS = [
  { n: 1, x: 160, y: 500, t: '09:19', k: 'LINE OF DEP',   b: 'BN crosses PL·SPARK · 3 coys abreast', c: 'cyan'    },
  { n: 2, x: 880, y: 340, t: '11:02', k: 'FIRST CONTACT', b: 'DAIGO recon sighted at grid J-4',       c: 'amber'   },
  { n: 3, x: 470, y: 540, t: '12:14', k: 'ARMOR CLASH',   b: 'CHARLIE mech vs "AX" · 4 kills 1 loss',  c: 'magenta' },
  { n: 4, x: 700, y: 210, t: '14:46', k: 'OP-BLACKLINE',  b: 'BRAVO·06 infil SB-04 · package recovered', c: 'cyan' },
  { n: 5, x: 380, y: 690, t: '16:20', k: 'WALKER LOST',   b: '"LATE·3" DESTR · pilot KIA',             c: 'magenta' },
  { n: 6, x: 1080, y: 470, t: '18:03', k: 'AXIS LOST',    b: 'Outpost BLACKPINE overrun · 2 sqd KIA',  c: 'magenta' },
  { n: 7, x: 720, y: 400, t: '19:55', k: 'COUNTER',       b: 'ALPHA 2 PLT seals PL·BLADE',             c: 'cyan'    },
  { n: 8, x: 990, y: 150, t: '21:12', k: 'ARTY',          b: '"CHIME" suppression · D·1 LNC disabled', c: 'amber'   },
  { n: 9, x: 1060, y: 640, t: '23:04', k: 'WITHDRAWAL',   b: 'DAIGO breaks east · consolidate lines',  c: 'green'   },
];

function NWDBMap() {
  return (
    <div style={{
      gridColumn: '2', gridRow: '1',
      position: 'relative', background: '#050810',
      overflow: 'hidden',
    }}>
      <svg viewBox={`0 0 ${MW} ${MH}`} preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <pattern id="dbGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#18e0ff" strokeWidth="0.5" opacity="0.1" />
          </pattern>
          <pattern id="dbGridMajor" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="#18e0ff" strokeWidth="0.7" opacity="0.2" />
          </pattern>
          <pattern id="forest" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="1.5" fill="#18e0ff" opacity="0.22" />
          </pattern>
          <pattern id="urban" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect x="2" y="2" width="4" height="4" fill="#18e0ff" opacity="0.28" />
            <rect x="8" y="7" width="3" height="3" fill="#18e0ff" opacity="0.22" />
          </pattern>
          <pattern id="industrial" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="20" height="20" fill="none" stroke="#ffa020" strokeWidth="0.4" opacity="0.25" />
            <rect x="4" y="4" width="12" height="2" fill="#ffa020" opacity="0.2" />
            <rect x="4" y="14" width="12" height="2" fill="#ffa020" opacity="0.2" />
          </pattern>
          <marker id="arrowCyan" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={NW.cyan} />
          </marker>
          <marker id="arrowMag" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={NW.magenta} />
          </marker>
        </defs>

        <rect width={MW} height={MH} fill="url(#dbGrid)" />
        <rect width={MW} height={MH} fill="url(#dbGridMajor)" />

        {/* grid coord labels (MGRS-flavored) */}
        {['A','B','C','D','E','F'].map((g, i) => (
          <text key={g} x={100 + i * 200} y={18} fontSize="10" fontFamily="'IBM Plex Mono'"
            fill={NW.fg2} letterSpacing="2" textAnchor="middle">{g}</text>
        ))}
        {[1, 2, 3, 4].map(n => (
          <text key={n} x={14} y={110 + (n - 1) * 200} fontSize="10"
            fontFamily="'IBM Plex Mono'" fill={NW.fg2} letterSpacing="2">
            {String(n).padStart(2, '0')}
          </text>
        ))}

        {/* RIVER (east side) */}
        <path d="M 1180 0 Q 1140 200 1170 400 Q 1190 580 1130 780"
          fill="none" stroke="#18e0ff" strokeWidth="10" strokeOpacity="0.3" />
        <text x="1150" y="760" fontSize="9" fontFamily="'IBM Plex Mono'"
          fill={NW.fg2} letterSpacing="2" textAnchor="end">ARAKAWA R.</text>

        {/* RAIL LINE (east–west) */}
        <g stroke={NW.fg2} strokeOpacity="0.45" strokeWidth="1" fill="none">
          <line x1="0" y1="440" x2="1200" y2="440" strokeDasharray="10 6" />
        </g>
        <text x="20" y="434" fontSize="8.5" fontFamily="'IBM Plex Mono'"
          fill={NW.fg2} letterSpacing="2">RAIL · SEIBU</text>

        {/* HIGHWAY (NW-SE) */}
        <path d="M 0 620 L 1200 520" stroke="#18e0ff" strokeOpacity="0.3" strokeWidth="8" />

        {/* URBAN ZONE — central */}
        <g>
          <rect x="360" y="260" width="320" height="220" fill="url(#urban)" stroke="#18e0ff"
            strokeOpacity="0.4" strokeWidth="1" />
          <text x="520" y="282" fontSize="10" fontFamily="'Chakra Petch'" fill={NW.fg1}
            letterSpacing="3" textAnchor="middle" fontWeight="700">KAWAGOE · URBAN</text>
        </g>

        {/* INDUSTRIAL — north-east */}
        <g>
          <rect x="760" y="140" width="300" height="180" fill="url(#industrial)" stroke={NW.amber}
            strokeOpacity="0.5" strokeWidth="1" />
          <text x="910" y="162" fontSize="10" fontFamily="'Chakra Petch'" fill={NW.amber}
            letterSpacing="3" textAnchor="middle" fontWeight="700">SB-04 · INDUSTRIAL</text>
          {/* small building where OP-BLACKLINE hit */}
          <rect x="870" y="200" width="60" height="40" fill="#0c1226" stroke={NW.amber}
            strokeOpacity="0.8" strokeWidth="1" />
        </g>

        {/* FOREST — south-west */}
        <g>
          <rect x="120" y="560" width="220" height="180" fill="url(#forest)" stroke="#18e0ff"
            strokeOpacity="0.3" strokeWidth="1" />
          <text x="230" y="580" fontSize="9" fontFamily="'IBM Plex Mono'" fill={NW.fg2}
            letterSpacing="2" textAnchor="middle">HIKAWA WOODS</text>
        </g>

        {/* OUTPOSTS */}
        <OutpostMarker x={90}  y={640} name="FOB · CORDON"  tone="cyan"    note="BN HQ" />
        <OutpostMarker x={660} y={460} name="RP · BLADE"    tone="cyan"    note="rally" />
        <OutpostMarker x={1080} y={470} name="BLACKPINE"    tone="magenta" note="LOST 18:03" lost />
        <OutpostMarker x={880} y={220} name="SB-04"         tone="amber"   note="obj · held" />

        {/* PHASE LINES */}
        <PhaseLine y={200} label="PL · TORCH" dashed />
        <PhaseLine y={360} label="PL · BLADE" />
        <PhaseLine y={500} label="PL · SPARK" dashed />

        {/* AXES OF ADVANCE — friendly */}
        <path d="M 110 640 Q 280 500 440 400" stroke={NW.cyan} strokeWidth="2.5"
          fill="none" strokeDasharray="14 6" markerEnd="url(#arrowCyan)" opacity="0.85" />
        <path d="M 130 660 Q 340 680 520 650" stroke={NW.cyan} strokeWidth="2.5"
          fill="none" strokeDasharray="14 6" markerEnd="url(#arrowCyan)" opacity="0.7" />
        <path d="M 440 400 Q 560 320 700 220" stroke={NW.cyan} strokeWidth="1.8"
          fill="none" strokeDasharray="8 5" markerEnd="url(#arrowCyan)" opacity="0.85" />

        {/* Hostile axes */}
        <path d="M 1140 300 Q 1000 350 900 340" stroke={NW.magenta} strokeWidth="2.5"
          fill="none" strokeDasharray="14 6" markerEnd="url(#arrowMag)" opacity="0.85" />
        <path d="M 1150 480 Q 1050 480 960 510" stroke={NW.magenta} strokeWidth="2.5"
          fill="none" strokeDasharray="14 6" markerEnd="url(#arrowMag)" opacity="0.8" />
        {/* withdrawal (ghosted) */}
        <path d="M 900 340 Q 1060 300 1140 240" stroke={NW.green} strokeWidth="1.8"
          fill="none" strokeDasharray="4 4" markerEnd="url(#arrowCyan)" opacity="0.55" />

        {/* UNIT COUNTERS */}
        {COUNTERS.map((c, i) => <MapCounter key={i} {...c} />)}

        {/* EVENT PINS */}
        {EVENTS.map(e => <EventPin key={e.n} {...e} />)}

        {/* NORTH COMPASS */}
        <g transform={`translate(${MW - 90}, 80)`}>
          <circle r="34" fill="none" stroke={NW.line2} strokeWidth="1" />
          <path d="M 0 -30 L 5 0 L 0 -3 L -5 0 Z" fill={NW.cyan} />
          <text y="-40" fontSize="10" fontFamily="'Chakra Petch'" fill={NW.cyan}
            letterSpacing="3" textAnchor="middle" fontWeight="700">N</text>
        </g>

        {/* SCALE BAR */}
        <g transform={`translate(40, ${MH - 34})`}>
          <line x1="0" y1="0" x2="200" y2="0" stroke={NW.fg1} strokeWidth="1.5" />
          <line x1="0" y1="-5" x2="0" y2="5" stroke={NW.fg1} strokeWidth="1.5" />
          <line x1="100" y1="-3" x2="100" y2="3" stroke={NW.fg1} strokeWidth="1" />
          <line x1="200" y1="-5" x2="200" y2="5" stroke={NW.fg1} strokeWidth="1.5" />
          <text y="-8" fontSize="9" fontFamily="'IBM Plex Mono'" fill={NW.fg1} letterSpacing="2">0</text>
          <text x="94" y="-8" fontSize="9" fontFamily="'IBM Plex Mono'" fill={NW.fg1} letterSpacing="2">2 km</text>
          <text x="188" y="-8" fontSize="9" fontFamily="'IBM Plex Mono'" fill={NW.fg1} letterSpacing="2">4 km</text>
        </g>

        {/* recon sketch note */}
        <g transform="translate(48, 76)">
          <text fontSize="9" fontFamily="'IBM Plex Mono'" fill={NW.fg2} letterSpacing="1.5">
            <tspan x="0" dy="0">NOTE · DAIGO committed</tspan>
            <tspan x="0" dy="12">reserve earlier than sig</tspan>
            <tspan x="0" dy="12">intel predicted. Adjust</tspan>
            <tspan x="0" dy="12">threat model on BLACKPINE.</tspan>
          </text>
          <path d="M -4 -12 L 200 -12 L 200 44 L -4 44 Z"
            fill="none" stroke={NW.fg2} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.6" />
        </g>
      </svg>

      {/* diagonal rubber stamp */}
      <div style={{
        position: 'absolute', top: 36, right: 110,
        transform: 'rotate(-7deg)', pointerEvents: 'none',
      }}>
        <div style={{
          padding: '10px 26px', border: `3px solid ${NW.amber}`, color: NW.amber,
          fontFamily: NW.display, fontSize: 22, fontWeight: 700,
          letterSpacing: '0.22em', textAlign: 'center',
          background: 'rgba(255,160,32,0.08)',
          boxShadow: `inset 0 0 0 1px ${NW.amber}, 0 0 24px rgba(255,160,32,0.25)`,
          textShadow: `0 0 8px ${NW.amber}88`, opacity: 0.92,
        }}>
          PARTIAL SUCCESS
          <div style={{ fontSize: 10, letterSpacing: '0.26em', marginTop: 3, fontWeight: 500 }}>
            · 3 / 4 AXES HELD · 1 OUTPOST LOST ·
          </div>
        </div>
      </div>

      {/* friendly / hostile legend */}
      <div style={{
        position: 'absolute', bottom: 12, left: 270,
        display: 'flex', gap: 18, fontFamily: NW.mono, fontSize: 9.5,
        color: NW.fg1, letterSpacing: '0.18em',
      }}>
        <span><span style={{ color: NW.cyan }}>◼</span> CORDON BN</span>
        <span><span style={{ color: NW.magenta }}>◼</span> DAIGO PMC</span>
        <span><span style={{ color: NW.amber }}>◼</span> OBJECTIVE</span>
        <span><span style={{ color: NW.green }}>→</span> WITHDRAWAL</span>
      </div>

      <div style={{
        position: 'absolute', bottom: 12, right: 20, textAlign: 'right',
        fontFamily: NW.mono, fontSize: 9, color: NW.fg2, letterSpacing: '0.22em',
      }}>
        CHART · KAWAGOE-07 · REV 4<br/>
        SRC · RECON DRONES ×4 · SIGINT "LONGLINE"
      </div>
    </div>
  );
}

function PhaseLine({ y, label, dashed }) {
  return (
    <g>
      <line x1="50" y1={y} x2="1150" y2={y} stroke={NW.fg2} strokeWidth="1.2"
        strokeDasharray={dashed ? '2 8' : '0'} opacity="0.55" />
      <text x="60" y={y - 5} fontSize="9" fontFamily="'IBM Plex Mono'"
        fill={NW.fg2} letterSpacing="2">{label}</text>
    </g>
  );
}

function OutpostMarker({ x, y, name, tone, note, lost }) {
  const c = tone === 'magenta' ? NW.magenta : tone === 'amber' ? NW.amber : NW.cyan;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M 0 -9 L 8 0 L 0 9 L -8 0 Z" fill={lost ? 'none' : c + '33'}
        stroke={c} strokeWidth="1.4" />
      {lost && <line x1="-8" y1="-8" x2="8" y2="8" stroke={c} strokeWidth="1.5" />}
      <text y="-14" fontSize="9" fontFamily="'Chakra Petch'" fill={c}
        letterSpacing="2" textAnchor="middle" fontWeight="700">{name}</text>
      <text y="22" fontSize="8" fontFamily="'IBM Plex Mono'" fill={NW.fg2}
        letterSpacing="1.5" textAnchor="middle">{note}</text>
    </g>
  );
}

/* APP-6 counter drawn inline on the map */
function MapCounter({ x, y, s, b, e, d, n, st, pulse }) {
  const base = s === 'r' ? NW.magenta : NW.cyan;
  const c = st === 'lost' ? NW.red : st === 'dmg' ? NW.amber : base;
  const w = 34, h = 24;

  // Echelon marks
  const ech = { sqd: '●', sec: '●●', plt: '●●●', coy: '│', bn: '││' }[e] || '';

  return (
    <g transform={`translate(${x} ${y})`}>
      {pulse && (
        <circle r="26" fill="none" stroke={c} strokeWidth="1" opacity="0.5">
          <animate attributeName="r" from="18" to="34" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* echelon */}
      {ech && (
        <text y={-h / 2 - 4} fontSize="7" fontFamily="'Chakra Petch'"
          fill={c} letterSpacing="0.5" textAnchor="middle" fontWeight="700">{ech}</text>
      )}

      {/* outer frame — rounded for friendly, sharp diamond-ish for hostile? use color to tell apart */}
      <rect x={-w / 2} y={-h / 2} width={w} height={h}
        fill={st === 'lost' ? 'rgba(255,74,92,0.15)' : s === 'r' ? 'rgba(255,45,154,0.12)' : 'rgba(24,224,255,0.12)'}
        stroke={c} strokeWidth="1.4" />
      {st === 'lost' && (
        <>
          <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} stroke={c} strokeWidth="1.4" />
          <line x1={w / 2} y1={-h / 2} x2={-w / 2} y2={h / 2} stroke={c} strokeWidth="1.4" />
        </>
      )}

      {/* branch symbol */}
      {b === 'INF' && (
        <>
          <line x1={-w / 2 + 3} y1={-h / 2 + 3} x2={w / 2 - 3} y2={h / 2 - 3} stroke={c} strokeWidth="1.2" />
          <line x1={w / 2 - 3} y1={-h / 2 + 3} x2={-w / 2 + 3} y2={h / 2 - 3} stroke={c} strokeWidth="1.2" />
        </>
      )}
      {b === 'REC' && (
        <line x1={w / 2 - 3} y1={-h / 2 + 3} x2={-w / 2 + 3} y2={h / 2 - 3} stroke={c} strokeWidth="1.4" />
      )}
      {b === 'ARM' && <ellipse cx="0" cy="0" rx={w / 2.8} ry={h / 3.6} fill={c} />}
      {b === 'MEC' && (
        <>
          <path d={`M 0 ${-h / 2 + 2} L ${w / 2 - 3} 0 L 0 ${h / 2 - 2} L ${-w / 2 + 3} 0 Z`}
            fill="none" stroke={c} strokeWidth="1.4" />
          <text fontSize="7" fontFamily="'Chakra Petch'" fontWeight="700"
            fill={c} textAnchor="middle" dy="2.5">M</text>
        </>
      )}
      {b === 'ART' && <circle r="4" fill={c} />}
      {b === 'CMD' && (
        <>
          <path d={`M ${-w / 2 + 3} ${-h / 2 + 3} L 2 ${-h / 2 + 3} L 6 0 L 2 ${h / 2 - 3} L ${-w / 2 + 3} ${h / 2 - 3} Z`} fill={c} />
        </>
      )}

      {/* label to the side */}
      <text x={w / 2 + 4} y={-h / 2 + 7} fontSize="8.5" fontFamily="'Chakra Petch'"
        fontWeight="700" fill={c} letterSpacing="1">{d}</text>
      <text x={w / 2 + 4} y={-h / 2 + 18} fontSize="7.5" fontFamily="'IBM Plex Mono'"
        fill={s === 'r' ? NW.fg2 : NW.fg1} letterSpacing="1">{n}</text>
    </g>
  );
}

function EventPin({ n, x, y, t, k, b, c }) {
  const color = c === 'cyan' ? NW.cyan : c === 'amber' ? NW.amber :
                c === 'magenta' ? NW.magenta : c === 'green' ? NW.green : NW.fg1;
  // alternate label side to avoid collisions, with a few manual tweaks
  const leftSide = [2, 5].includes(n);
  const above = [1, 3, 4, 6, 7, 8].includes(n);
  const lx = leftSide ? -170 : 16;
  const anchor = leftSide ? 'end' : 'start';
  const ly = above ? -42 : 10;
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* connector */}
      <line x1={leftSide ? -10 : 10} y1="0"
        x2={leftSide ? -150 : 150} y2={above ? -30 : 20}
        stroke={color} strokeWidth="0.7" opacity="0.45" />
      {/* pin */}
      <path d="M 0 -8 L 7 -4 L 7 4 L 0 8 L -7 4 L -7 -4 Z"
        fill={NW.bg0} stroke={color} strokeWidth="1.5" />
      <text fontSize="9" fontFamily="'Chakra Petch'" fill={color} fontWeight="700"
        textAnchor="middle" dy="3">{n}</text>
      {c === 'magenta' && (
        <circle r="10" fill="none" stroke={color} strokeWidth="0.9" opacity="0.4">
          <animate attributeName="r" from="8" to="18" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.5" to="0" dur="1.8s" repeatCount="indefinite" />
        </circle>
      )}
      {/* label */}
      <g transform={`translate(${lx} ${ly})`}>
        <text fontSize="9" fontFamily="'IBM Plex Mono'" fill={NW.fg2}
          letterSpacing="2" textAnchor={anchor}>{t}</text>
        <text y="11" fontSize="10" fontFamily="'Chakra Petch'" fill={color}
          letterSpacing="2.2" textAnchor={anchor} fontWeight="700">{k}</text>
        <text y="22" fontSize="8.5" fontFamily="'IBM Plex Mono'" fill={NW.fg1}
          letterSpacing="0.5" textAnchor={anchor}>{b}</text>
      </g>
    </g>
  );
}

/* ========== RIGHT RAIL — formation ledger + payout ========== */

const FORMATIONS = [
  { d: 'A COY', n: '"IRONWIRE"', branch: 'INF',
    com: 78, kia: 4, wia: 8, ready: 82, r: 'green',
    notes: '2 PLT "HAMMER" seal · XO → CO track' },
  { d: 'B COY', n: '"GHOSTLINE"', branch: 'REC',
    com: 54, kia: 3, wia: 9, ready: 68, r: 'amber',
    notes: 'BRAVO·06 sub-op · "ORTA" WIA · NIGHTJAR act.' },
  { d: 'C COY', n: '"DEADLINE"', branch: 'MEC',
    com: 62, kia: 4, wia: 7, ready: 54, r: 'magenta',
    notes: '"LATE·3" DESTR · FLINT wounded · refit' },
  { d: 'HQ/SPT', n: '"KEYSTONE"', branch: 'CMD',
    com: 22, kia: 0, wia: 2, ready: 96, r: 'green',
    notes: 'mortar "CHIME" · 2 sorties' },
];

function NWDBRightRail() {
  return (
    <div style={{
      gridColumn: '3', gridRow: '1',
      borderLeft: `1px solid ${NW.line}`,
      background: NW.bg1,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${NW.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: NW.mono, fontSize: 9.5, letterSpacing: '0.26em', color: NW.fg2 }}>
            FORMATION LEDGER · POST-ACTION
          </span>
          <span style={{ fontFamily: NW.mono, fontSize: 9, color: NW.magenta, letterSpacing: '0.22em' }}>
            11 KIA · 24 WIA
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {FORMATIONS.map((f, i) => <FormationRow key={i} f={f} last={i === FORMATIONS.length - 1} />)}

        {/* Embedded sub-op callout — OP-BLACKLINE */}
        <div style={{
          margin: '10px 12px', padding: '10px 12px',
          background: 'rgba(24,224,255,0.05)',
          border: `1px solid ${NW.cyan}55`,
          borderLeft: `3px solid ${NW.cyan}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: NW.display, fontSize: 12, fontWeight: 700,
              color: NW.cyan, letterSpacing: '0.14em' }}>SUB-OP · BLACKLINE</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: NW.mono, fontSize: 9, color: NW.cyan,
              letterSpacing: '0.22em', border: `1px solid ${NW.cyan}77`, padding: '0 4px' }}>
              ◆ SUCCESS
            </span>
          </div>
          <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg1,
            letterSpacing: '0.05em', marginTop: 5, lineHeight: 1.45 }}>
            BRAVO·06 squad infil of SB-04 under cover of the industrial push.
            Package secured; 1 WIA ("ORTA"). <span style={{ color: NW.cyan }}>→ SQUAD AAR</span>
          </div>
        </div>
      </div>

      {/* Payout — upscaled */}
      <div style={{
        padding: '14px 16px 18px',
        borderTop: `2px solid ${NW.line2}`,
        background: NW.bg2,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -6, left: 0, right: 0, height: 6,
          backgroundImage: `radial-gradient(circle at 4px 6px, ${NW.bg1} 3px, transparent 3.5px)`,
          backgroundSize: '8px 6px', backgroundRepeat: 'repeat-x',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: NW.mono, fontSize: 9.5, letterSpacing: '0.26em', color: NW.fg2 }}>
            PAYOUT · WIRE
          </span>
          <span style={{ fontFamily: NW.mono, fontSize: 9, color: NW.green, letterSpacing: '0.2em' }}>
            ◆ CLEARED
          </span>
        </div>
        <div style={{ fontFamily: NW.display, fontSize: 34, color: NW.green, fontWeight: 700,
          letterSpacing: '0.02em', lineHeight: 1, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
          ¥ 9,820,000
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2, marginTop: 4, letterSpacing: '0.1em' }}>
          NET TO TREASURY · 01:12 JST · COSTS DEDUCTED
        </div>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 3,
          fontFamily: NW.mono, fontSize: 10, letterSpacing: '0.04em' }}>
          <span style={{ color: NW.fg1 }}>Retainer · corridor held</span>
          <span style={{ color: NW.cyan, fontVariantNumeric: 'tabular-nums' }}>¥ 12,000,000</span>
          <span style={{ color: NW.fg1 }}>Axis bonus · 3 / 4</span>
          <span style={{ color: NW.amber, fontVariantNumeric: 'tabular-nums' }}>+¥ 4,500,000</span>
          <span style={{ color: NW.fg1 }}>Intel · DAIGO OOB</span>
          <span style={{ color: NW.amber, fontVariantNumeric: 'tabular-nums' }}>+¥ 2,500,000</span>
          <span style={{ color: NW.fg1 }}>BLACKPINE forfeit</span>
          <span style={{ color: NW.magenta, fontVariantNumeric: 'tabular-nums' }}>−¥ 2,000,000</span>
          <span style={{ color: NW.fg1 }}>Replacements · 11 KIA</span>
          <span style={{ color: NW.magenta, fontVariantNumeric: 'tabular-nums' }}>−¥ 4,400,000</span>
          <span style={{ color: NW.fg1 }}>Medical · 24 WIA</span>
          <span style={{ color: NW.magenta, fontVariantNumeric: 'tabular-nums' }}>−¥ 1,200,000</span>
          <span style={{ color: NW.fg2 }}>Walker refit/salvage</span>
          <span style={{ color: NW.magenta, fontVariantNumeric: 'tabular-nums' }}>−¥ 1,580,000</span>
        </div>
      </div>
    </div>
  );
}

function FormationRow({ f, last }) {
  const rc = f.r === 'green' ? NW.green : f.r === 'amber' ? NW.amber : NW.magenta;
  return (
    <div style={{
      padding: '11px 16px',
      borderBottom: last ? 'none' : `1px solid ${NW.line}`,
      borderLeft: `3px solid ${rc}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: NW.display, fontSize: 13, fontWeight: 700,
          color: NW.fg0, letterSpacing: '0.1em' }}>{f.d}</span>
        <span style={{ fontFamily: NW.display, fontSize: 11, color: rc,
          letterSpacing: '0.08em', fontWeight: 600 }}>{f.n}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2,
          letterSpacing: '0.2em' }}>{f.branch}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 5, alignItems: 'baseline',
        fontFamily: NW.mono, fontSize: 10, letterSpacing: '0.06em' }}>
        <span style={{ color: NW.fg2 }}>COM·<span style={{ color: NW.fg0, fontWeight: 700 }}>{f.com}</span></span>
        {f.kia > 0 && <span style={{ color: NW.magenta }}>KIA·<span style={{ fontWeight: 700 }}>{f.kia}</span></span>}
        {f.wia > 0 && <span style={{ color: NW.magenta }}>WIA·<span style={{ fontWeight: 700 }}>{f.wia}</span></span>}
        <span style={{ flex: 1 }} />
        <span style={{ color: rc, fontWeight: 700 }}>{f.ready}%</span>
      </div>
      <div style={{ marginTop: 4 }}><NWBar value={f.ready / 100} tone={f.r} height={2} /></div>
      <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg1,
        letterSpacing: '0.04em', marginTop: 5 }}>{f.notes}</div>
    </div>
  );
}

/* ========== FOOTER ========== */

function NWDBFooter() {
  return (
    <div style={{
      gridColumn: '1 / 4', gridRow: '2',
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 18px',
      background: NW.bg1, borderTop: `1px solid ${NW.line2}`,
    }}>
      <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.24em' }}>
        ◆ NEXT
      </span>
      <span style={{ flex: 1 }} />
      <NWChip kbd="F">FILE FULL AAR</NWChip>
      <NWChip kbd="R">REPLACEMENTS · 11 KIA</NWChip>
      <NWChip kbd="M">MEDBAY · 24 WIA</NWChip>
      <NWChip kbd="C">REFIT CHARLIE COY</NWChip>
      <NWChip kbd="P">REPLAY ON MAP</NWChip>
      <NWChip primary kbd="↵" style={{ padding: '10px 22px', fontSize: 12 }}>RETURN TO HQ ▸</NWChip>
    </div>
  );
}

Object.assign(window, { NeonwireDebrief });
