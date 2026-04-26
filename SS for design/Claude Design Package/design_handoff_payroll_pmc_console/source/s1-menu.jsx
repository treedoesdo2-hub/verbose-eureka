// dir-b-neonwire-menu.jsx — NEON WIRE main menu / ops console

function NeonwireMainMenu() {
  return (
    <NWFrame>
      <NWSystemBar
        path="/OPS/HQ"
        right={<>
          <span style={{ color: NW.green }}>● UPLINK</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.fg1 }}>OP/HOLST·K</span>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 440px',
        gap: 14, padding: 14, height: 'calc(100% - 32px)', position: 'relative', zIndex: 1 }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <NWCompanyCard />
          <NWNavStack />
          <NWFundsCard />
        </div>

        {/* CENTER — big city hologram */}
        <div style={{ position: 'relative' }}>
          <NWPanel title="OPS / LIVE GRID · OSAKA-MC14" accent="cyan" padding={0}
            style={{ height: '100%' }}
            right={<>
              <span style={{ color: NW.fg2 }}>SAT·T−04:22</span>
              <NWChip small kbd="1">SECTOR</NWChip>
              <NWChip small primary kbd="2">CONTRACTS</NWChip>
              <NWChip small kbd="3">RIVALS</NWChip>
            </>}
          >
            <NWHoloMap />
          </NWPanel>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <NWPriorityContract />
          <NWContractBoard />
          <NWTicker />
        </div>
      </div>
    </NWFrame>
  );
}

function NWCompanyCard() {
  return (
    <NWPanel accent="cyan" padding={16}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="44" height="48" viewBox="0 0 44 48">
          <path d="M 22 2 L 41 12 L 41 34 L 22 46 L 3 34 L 3 12 Z"
            fill="none" stroke={NW.cyan} strokeWidth="1.4" />
          <path d="M 22 10 L 34 17 L 34 29 L 22 37 L 10 29 L 10 17 Z" fill={NW.cyanSoft} stroke={NW.cyan} strokeWidth="0.8" />
          <circle cx="22" cy="23" r="4" fill={NW.cyan} />
        </svg>
        <div>
          <div style={{ fontFamily: NW.mono, fontSize: 9, letterSpacing: '0.18em', color: NW.fg2 }}>CLASS-C PMC · LIC MR-8814</div>
          <div style={{ fontFamily: NW.display, fontSize: 22, color: NW.fg0, fontWeight: 700, letterSpacing: '0.04em' }}>
            KESSLER <span style={{ color: NW.cyan }}>&amp;</span> SONS
          </div>
          <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>OSAKA·ARC · EST 2037</div>
        </div>
      </div>
    </NWPanel>
  );
}

function NWNavStack() {
  const items = [
    { label: 'OPERATIONS', k: 'F1', active: true },
    { label: 'CONTRACTS',  k: 'F2', badge: 12 },
    { label: 'ROSTER',     k: 'F3', badge: 34 },
    { label: 'ARMORY',     k: 'F4' },
    { label: 'FACILITIES', k: 'F5' },
    { label: 'LEDGER',     k: 'F6' },
    { label: 'INTEL',      k: 'F7', alert: true },
  ];
  return (
    <NWPanel accent="cyan" padding={0} style={{ flex: 0 }}>
      {items.map((it, i) => (
        <div key={it.label} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderBottom: i < items.length - 1 ? `1px solid ${NW.line}` : 'none',
          background: it.active ? NW.cyanSoft : 'transparent',
          borderLeft: `2px solid ${it.active ? NW.cyan : 'transparent'}`,
          fontFamily: NW.mono, fontSize: 11.5, letterSpacing: '0.12em',
          color: it.active ? NW.cyan : NW.fg0, fontWeight: 600,
        }}>
          <NWHexIcon size={14} color={it.active ? NW.cyan : NW.fg2} filled={it.active} />
          <span style={{ flex: 1 }}>{it.label}</span>
          {it.badge && <span style={{ fontSize: 9, color: NW.fg1, background: NW.bg3, padding: '1px 6px' }}>{it.badge}</span>}
          {it.alert && <span style={{ fontSize: 9, color: NW.magenta }}>● NEW</span>}
          <span style={{ fontSize: 9, color: NW.fg2, letterSpacing: 0 }}>{it.k}</span>
        </div>
      ))}
    </NWPanel>
  );
}

function NWFundsCard() {
  return (
    <NWPanel accent="cyan" title="LIQUID · ESCROW · BURN" padding={14}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: NW.display, fontSize: 14, color: NW.cyan, fontWeight: 700 }}>¥</span>
        <span style={{ fontFamily: NW.display, fontSize: 34, color: NW.cyan, fontWeight: 700,
          letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>2,418,040</span>
      </div>
      <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, marginTop: 4 }}>+ ¥812K ESCROW · OP-CLEARWATER</div>
      <div style={{ marginTop: 12 }}>
        <NWBar value={0.62} tone="cyan" height={4} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: NW.mono, fontSize: 9,
          color: NW.fg2, marginTop: 4, letterSpacing: '0.14em' }}>
          <span>BURN · 62%</span><span>30-DAY</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginTop: 14 }}>
        <NWStat label="READY"    value="28" tone="green" />
        <NWStat label="DEPLOYED" value="04" tone="cyan" />
        <NWStat label="WOUNDED"  value="03" tone="magenta" />
        <NWStat label="TRAINING" value="05" tone="amber" />
      </div>
    </NWPanel>
  );
}

// ── Map ─────────────────────────────────────────────

function NWHoloMap() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 820 }}>
      <svg viewBox="0 0 1080 820" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <pattern id="nw-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 H 0 V 32" stroke={NW.line} strokeWidth="0.5" fill="none" />
          </pattern>
          <pattern id="nw-grid-hex" width="44" height="38" patternUnits="userSpaceOnUse">
            <path d="M 11 0 L 33 0 L 44 19 L 33 38 L 11 38 L 0 19 Z"
              fill="none" stroke={NW.line2} strokeWidth="0.4" opacity="0.4" />
          </pattern>
          <radialGradient id="nw-pulse">
            <stop offset="0%" stopColor={NW.cyan} stopOpacity="0.5" />
            <stop offset="60%" stopColor={NW.cyan} stopOpacity="0.05" />
            <stop offset="100%" stopColor={NW.cyan} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nw-pulse-m">
            <stop offset="0%" stopColor={NW.magenta} stopOpacity="0.4" />
            <stop offset="100%" stopColor={NW.magenta} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="1080" height="820" fill={NW.bg0} />
        <rect width="1080" height="820" fill="url(#nw-grid)" />
        <rect width="1080" height="820" fill="url(#nw-grid-hex)" opacity="0.6" />

        {/* river */}
        <path d="M -40 560 L 1120 340 L 1120 400 L -40 620 Z" fill={NW.bg2} />
        <path d="M -40 560 L 1120 340" stroke={NW.cyan} strokeWidth="0.6" opacity="0.4" />

        {/* districts — hex tiles */}
        {NW_DISTRICTS.map((d, i) => (
          <g key={i}>
            <polygon points={d.pts} fill={d.fill || 'transparent'}
              stroke={NW.line2} strokeWidth="0.8" />
            <text x={d.cx} y={d.cy} fill={NW.fg2} fontSize="10" fontFamily={NW.mono}
              letterSpacing="2" textAnchor="middle">{d.name}</text>
          </g>
        ))}

        {/* active AOI */}
        <g transform="translate(680 280)">
          <circle r="100" fill="url(#nw-pulse)" />
          <path d="M 0 -60 L 52 -30 L 52 30 L 0 60 L -52 30 L -52 -30 Z"
            fill="none" stroke={NW.cyan} strokeWidth="1.4" strokeDasharray="4 3" />
          <path d="M 0 -28 L 24 -14 L 24 14 L 0 28 L -24 14 L -24 -14 Z"
            fill={NW.cyanSoft} stroke={NW.cyan} strokeWidth="1.2" />
          <circle r="4" fill={NW.cyan} />
          <text y="-72" fill={NW.cyan} fontSize="10" fontFamily={NW.mono}
            letterSpacing="2" textAnchor="middle" fontWeight="600">▸ OP-CLEARWATER · ACTIVE</text>
        </g>

        {/* rival */}
        <g transform="translate(840 660)">
          <circle r="46" fill="url(#nw-pulse-m)" />
          <path d="M 0 -20 L 17 -10 L 17 10 L 0 20 L -17 10 L -17 -10 Z" fill="none" stroke={NW.magenta} strokeWidth="1.2" />
          <text y="36" fill={NW.magenta} fontSize="9" fontFamily={NW.mono} letterSpacing="2" textAnchor="middle">DAIGO COMBINE</text>
        </g>

        {/* offered contracts */}
        {NW_PINS.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            <path d="M 0 -8 L 7 -4 L 7 4 L 0 8 L -7 4 L -7 -4 Z" fill={NW.bg0} stroke={p.c} strokeWidth="1.1" />
            <circle r="2.5" fill={p.c} />
            <text x="11" y="3" fill={NW.fg1} fontSize="9" fontFamily={NW.mono} letterSpacing="1.2">{p.label}</text>
          </g>
        ))}

        {/* drone tracks */}
        <path d="M 180 200 Q 540 120 900 200" fill="none" stroke={NW.amber}
          strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
        <circle cx="540" cy="150" r="3" fill={NW.amber}>
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2.4s" repeatCount="indefinite" />
        </circle>

        {/* compass + scale */}
        <g transform="translate(70 720)">
          <path d="M 0 -22 L 4 0 L 0 22 L -4 0 Z" fill={NW.cyan} />
          <text y="-28" fill={NW.cyan} fontSize="10" fontFamily={NW.mono} textAnchor="middle">N</text>
        </g>
        <g transform="translate(960 770)">
          <line x1="0" y1="0" x2="100" y2="0" stroke={NW.fg1} strokeWidth="1" />
          <text x="50" y="14" fill={NW.fg1} fontSize="9" fontFamily={NW.mono} textAnchor="middle">2 KM</text>
        </g>
      </svg>

      {/* HUD info chips */}
      <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', gap: 8,
        fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.14em' }}>
        <span>ATMO 18°C · OVERCAST</span>
        <span style={{ color: NW.fgDim }}>║</span>
        <span>WIND 12KT @ 240°</span>
        <span style={{ color: NW.fgDim }}>║</span>
        <span>CIV·DEN HIGH</span>
      </div>
    </div>
  );
}

const NW_DISTRICTS = [
  { name: 'TENJIN',    pts: '60 40 340 60 320 220 50 200', cx: 190, cy: 130 },
  { name: 'YARD·07',   pts: '340 60 680 80 660 240 320 220', cx: 510, cy: 160, fill: 'rgba(24,224,255,0.04)' },
  { name: 'N·6TH',     pts: '680 80 1020 100 1000 280 660 240', cx: 840, cy: 180 },
  { name: 'THE·CUT',   pts: '50 200 320 220 300 460 60 440', cx: 180, cy: 330 },
  { name: 'DAIGO·CBD', pts: '320 220 660 240 640 520 300 460', cx: 480, cy: 370 },
  { name: 'TOHO',      pts: '660 240 1000 280 980 520 640 520', cx: 820, cy: 400 },
  { name: 'KOGA·PIER', pts: '60 620 300 620 280 800 80 800', cx: 180, cy: 710 },
  { name: 'S·WARD',    pts: '300 620 640 640 620 800 280 800', cx: 470, cy: 720 },
  { name: 'E·IND',     pts: '640 640 980 660 960 800 620 800', cx: 800, cy: 730, fill: 'rgba(255,45,154,0.04)' },
];

const NW_PINS = [
  { x: 200, y: 140, c: NW.cyan,    label: 'LATHE' },
  { x: 480, y: 370, c: NW.cyan,    label: 'BLACKLINE' },
  { x: 840, y: 180, c: NW.cyan,    label: 'MERCATO' },
  { x: 180, y: 720, c: NW.amber,   label: 'DITCH' },
  { x: 470, y: 720, c: NW.cyan,    label: 'RIVER' },
];

// ── Right column ─────────────────────────────────────

function NWPriorityContract() {
  return (
    <div style={{ position: 'relative' }}>
      <NWPanel accent="amber" padding={16}
        style={{ background: 'linear-gradient(135deg, rgba(255,160,32,0.10), rgba(10,15,30,0.4))' }}>
        <div style={{ fontFamily: NW.mono, fontSize: 9, letterSpacing: '0.2em', color: NW.amber,
          display: 'flex', gap: 8, alignItems: 'center' }}>
          <NWDiamond color={NW.amber} /> PRIORITY INQUIRY · AUTH VERIFIED
        </div>
        <div style={{ fontFamily: NW.display, fontSize: 30, color: NW.fg0, fontWeight: 700,
          letterSpacing: '0.02em', lineHeight: 1, marginTop: 6 }}>ASSET RECOVERY</div>
        <div style={{ fontFamily: NW.mono, fontSize: 11, color: NW.fg1, marginTop: 6, letterSpacing: '0.08em' }}>
          DAIGO COMBINE · ¥1.8M · 48H WINDOW
        </div>
        <div style={{ fontFamily: NW.body, fontSize: 12, color: NW.fg1, marginTop: 10, lineHeight: 1.5 }}>
          Lost drive. Toho Flats sub-block 4. Prefer quiet.
          Civ-density AMBER. No client attribution.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <NWChip primary style={{ flex: 1, justifyContent: 'center' }}>ACCEPT ▸</NWChip>
          <NWChip>DECLINE</NWChip>
        </div>
      </NWPanel>
    </div>
  );
}

function NWContractBoard() {
  const rows = [
    { code: 'OP-LATHE',    c: 'NORTH-6TH PCT', t: 'DEFENSIVE', pay: '¥240K', risk: 'LOW',  tone: NW.green },
    { code: 'OP-BLACKLINE',c: 'ANON·VER',      t: 'DENIAL',    pay: '¥980K', risk: 'HIGH', tone: NW.magenta },
    { code: 'OP-MERCATO',  c: 'MERIDIAN RISK', t: 'ESCORT',    pay: '¥310K', risk: 'MED',  tone: NW.amber },
    { code: 'OP-DITCH',    c: 'KESSLER HLDG',  t: 'SWEEP',     pay: '¥160K', risk: 'LOW',  tone: NW.green },
    { code: 'OP-RIVER',    c: 'TBD',           t: 'RECOVERY',  pay: '¥420K', risk: 'MED',  tone: NW.amber },
  ];
  return (
    <NWPanel title="CONTRACT BOARD · 12 OPEN" right={<span style={{ color: NW.fg2 }}>SORT ▾</span>}
      padding={0} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr auto', padding: '12px 14px',
          borderBottom: i < rows.length - 1 ? `1px solid ${NW.line}` : 'none',
          background: i === 1 ? 'rgba(255,45,154,0.04)' : 'transparent',
          borderLeft: `2px solid ${i === 1 ? NW.magenta : 'transparent'}`,
        }}>
          <div>
            <div style={{ fontFamily: NW.display, fontWeight: 700, color: NW.fg0, letterSpacing: '0.06em' }}>{r.code}</div>
            <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, marginTop: 2 }}>
              {r.c} · <span style={{ color: NW.cyan }}>{r.t}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: NW.display, fontSize: 16, color: NW.cyan, fontWeight: 700, letterSpacing: '0.04em' }}>{r.pay}</div>
            <div style={{ fontFamily: NW.mono, fontSize: 9, color: r.tone, letterSpacing: '0.16em', marginTop: 2 }}>● {r.risk}</div>
          </div>
        </div>
      ))}
    </NWPanel>
  );
}

function NWTicker() {
  const items = [
    { t: '14:30', c: NW.amber,   x: 'DAIGO mobilizes 3rd Security · Toho' },
    { t: '14:12', c: NW.cyan,    x: 'MERIDIAN opens bounty · ¥420K' },
    { t: '13:58', c: NW.magenta, x: 'RIVAL "REDCELL" recruits 2 ex-JSDF' },
  ];
  return (
    <NWPanel title="DARKNET · TICKER" accent="magenta" padding={10} style={{ flex: 0 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '3px 0', fontFamily: NW.mono, fontSize: 10.5 }}>
          <span style={{ color: NW.fg2 }}>{it.t}</span>
          <span style={{ color: it.c }}>▪</span>
          <span style={{ color: NW.fg1 }}>{it.x}</span>
        </div>
      ))}
    </NWPanel>
  );
}

Object.assign(window, { NeonwireMainMenu });
