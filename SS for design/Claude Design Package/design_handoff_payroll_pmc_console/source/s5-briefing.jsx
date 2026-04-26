// s5-briefing.jsx — NEON WIRE · Mission Briefing / Deployment Order

function NeonwireBriefing() {
  return (
    <NWFrame>
      <NWSystemBar
        path="/OPS/BRIEF/OP-BLACKLINE"
        right={<>
          <span style={{ color: NW.amber }}>● BRIEF · T−00:42</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.cyan }}>SQUAD 6/6</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.fg1 }}>LOADOUT LOCKED</span>
        </>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr 420px', gap: 14,
        padding: 14, height: 'calc(100% - 32px)', position: 'relative', zIndex: 1 }}>
        {/* LEFT — brief */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <NWBriefHeader />
          <NWBriefObjectives />
          <NWBriefComms />
        </div>
        {/* CENTER — tactical map */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <NWBriefMap />
          <NWBriefTimeline />
        </div>
        {/* RIGHT — squad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <NWBriefSquad />
          <NWBriefDeploy />
        </div>
      </div>
    </NWFrame>
  );
}

function NWBriefHeader() {
  return (
    <NWPanel padding={16} style={{ background: 'linear-gradient(135deg, rgba(255,45,154,0.08), rgba(10,15,30,0.4))' }}>
      <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.magenta, letterSpacing: '0.24em',
        border: `1px solid ${NW.magenta}77`, padding: '2px 8px', display: 'inline-block' }}>◆ BLACKLINE · DENIAL</div>
      <div style={{ fontFamily: NW.display, fontSize: 32, color: NW.fg0, fontWeight: 700,
        letterSpacing: '0.02em', lineHeight: 1, marginTop: 8 }}>OP-BLACKLINE</div>
      <div style={{ fontFamily: NW.mono, fontSize: 10.5, color: NW.fg2, marginTop: 6, letterSpacing: '0.1em' }}>
        TOHO FLATS · SB-04 · UNIT 3-C
      </div>
      <div style={{ fontFamily: NW.body, fontSize: 12.5, color: NW.fg1, marginTop: 12, lineHeight: 1.5 }}>
        Recover sealed drive. Exfil via LZ-BRAVO (rooftop). Daigo Sec patrol rotates 04:40.
        Civilian density LOW after 22:00 — insertion at 22:45.
      </div>
    </NWPanel>
  );
}

function NWBriefObjectives() {
  const rows = [
    ['PRI', 'RECOVER', 'Sealed drive · Unit 3-C', NW.cyan, '¥196K'],
    ['SEC', 'SEAL INTACT', 'Drive must not be copied', NW.cyan, '—'],
    ['OPT', 'NO CIV CAS', 'No civilian casualties', NW.amber, '+¥120K'],
    ['OPT', 'NO EVIDENCE', 'No forensic trace', NW.amber, '+¥80K'],
  ];
  return (
    <NWPanel title="OBJECTIVES" accent="cyan" padding={0} style={{ flex: 1, minHeight: 0 }}>
      {rows.map(([tag, h, s, c, pay], i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto',
          gap: 10, padding: '11px 14px', alignItems: 'center',
          borderBottom: i < rows.length - 1 ? `1px solid ${NW.line}` : 'none' }}>
          <span style={{ fontFamily: NW.mono, fontSize: 9, color: c, letterSpacing: '0.2em',
            border: `1px solid ${c}55`, padding: '2px 5px', textAlign: 'center' }}>{tag}</span>
          <div>
            <div style={{ fontFamily: NW.display, fontSize: 13, color: NW.fg0, fontWeight: 700, letterSpacing: '0.06em' }}>{h}</div>
            <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, marginTop: 1 }}>{s}</div>
          </div>
          <div style={{ fontFamily: NW.mono, fontSize: 11, color: c, fontVariantNumeric: 'tabular-nums' }}>{pay}</div>
        </div>
      ))}
    </NWPanel>
  );
}

function NWBriefComms() {
  return (
    <NWPanel title="COMMS / RoE" accent="amber" padding={12} style={{ flex: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 5, columnGap: 10,
        fontFamily: NW.mono, fontSize: 11, color: NW.fg1 }}>
        <span style={{ color: NW.fg2 }}>NET</span><span>Q-ENCR · CH-7 · BRAVO</span>
        <span style={{ color: NW.fg2 }}>CALL</span><span style={{ color: NW.cyan }}>"BLACKLINE ACTUAL"</span>
        <span style={{ color: NW.fg2 }}>QRF</span><span>NONE · DENIAL</span>
        <span style={{ color: NW.fg2 }}>RoE</span><span style={{ color: NW.amber }}>DISCRETIONARY</span>
        <span style={{ color: NW.fg2 }}>CODEWD</span><span style={{ color: NW.magenta }}>"GHOSTKITE"</span>
      </div>
    </NWPanel>
  );
}

function NWBriefMap() {
  return (
    <NWPanel title="TACTICAL PLAN · SB-04 / UNIT 3-C" accent="cyan" padding={0}
      right={<>
        <NWChip small kbd="1" primary>PLAN·A</NWChip>
        <NWChip small kbd="2">PLAN·B</NWChip>
        <NWChip small kbd="3">ROUTES</NWChip>
      </>}
      style={{ flex: 1, minHeight: 0 }}>
      <svg viewBox="0 0 1040 520" style={{ width: '100%', height: '100%', display: 'block' }} preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="bm-grid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M 26 0 H 0 V 26" stroke={NW.line} strokeWidth="0.4" fill="none" />
          </pattern>
          <radialGradient id="bm-tgt"><stop offset="0%" stopColor={NW.magenta} stopOpacity="0.35" /><stop offset="100%" stopColor={NW.magenta} stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="1040" height="520" fill={NW.bg0} />
        <rect width="1040" height="520" fill="url(#bm-grid)" />

        {/* building footprints */}
        {[[90,80,220,140,'SB-03'],[340,80,220,140,'SB-04',true],[590,80,220,140,'SB-05'],[840,80,140,140,'SVC'],
          [90,280,300,200,'ALLEY'],[420,280,140,200,'YARD'],[590,280,220,200,'SB-14'],[840,280,140,200,'DEPOT']].map(([x,y,w,h,l,t],i)=>(
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill={t ? '#1a1224' : NW.bg2} stroke={t ? NW.magenta : NW.line2} strokeWidth={t ? 1.2 : 0.8} />
            <text x={x + 8} y={y + h - 8} fill={t ? NW.magenta : NW.fg2} fontSize="10" fontFamily={NW.mono} letterSpacing="2">{l}</text>
          </g>
        ))}

        {/* target */}
        <g transform="translate(450 150)">
          <circle r="60" fill="url(#bm-tgt)" />
          <rect x="-14" y="-10" width="28" height="20" fill={NW.magenta} opacity="0.25" stroke={NW.magenta} strokeWidth="1.4" />
          <text y="28" fill={NW.magenta} fontSize="10" fontFamily={NW.mono} textAnchor="middle" letterSpacing="2">▼ UNIT 3-C</text>
        </g>

        {/* insertion */}
        <g transform="translate(120 440)">
          <path d="M 0 -12 L 10 0 L 0 12 L -10 0 Z" fill="none" stroke={NW.cyan} strokeWidth="1.4" />
          <circle r="2.5" fill={NW.cyan} />
          <text y="26" fill={NW.cyan} fontSize="10" fontFamily={NW.mono} textAnchor="middle" letterSpacing="2">▲ LZ·ALPHA · INSERT</text>
        </g>
        {/* staging */}
        <g transform="translate(260 330)">
          <circle r="10" fill="none" stroke={NW.cyan} strokeWidth="1" strokeDasharray="2 2" />
          <text y="24" fill={NW.cyan} fontSize="9" fontFamily={NW.mono} textAnchor="middle" letterSpacing="1.5">RALLY·1</text>
        </g>
        {/* breach */}
        <g transform="translate(390 180)">
          <rect x="-9" y="-9" width="18" height="18" fill="none" stroke={NW.amber} strokeWidth="1.4" strokeDasharray="3 2" />
          <text y="24" fill={NW.amber} fontSize="9" fontFamily={NW.mono} textAnchor="middle" letterSpacing="1.5">BREACH</text>
        </g>
        {/* extraction */}
        <g transform="translate(910 150)">
          <path d="M 0 -12 L 10 0 L 0 12 L -10 0 Z" fill="none" stroke={NW.amber} strokeWidth="1.4" />
          <circle r="2.5" fill={NW.amber} />
          <text y="-22" fill={NW.amber} fontSize="10" fontFamily={NW.mono} textAnchor="middle" letterSpacing="2">▼ LZ·BRAVO · EXFIL</text>
        </g>

        {/* routes */}
        <path d="M 120 440 L 260 330 L 390 180 L 450 150" stroke={NW.cyan} strokeWidth="1.4" strokeDasharray="5 3" fill="none" />
        <path d="M 450 150 L 700 140 L 910 150" stroke={NW.amber} strokeWidth="1.4" strokeDasharray="5 3" fill="none" />
        {/* alt route */}
        <path d="M 120 440 L 380 460 L 590 380 L 700 260 L 910 150" stroke={NW.fg2} strokeWidth="1" strokeDasharray="2 4" fill="none" opacity="0.6" />

        {/* patrols */}
        {[[700,110],[260,170],[730,180],[860,340]].map(([x,y],i)=>(
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M 0 -7 L 6 6 L -6 6 Z" fill="none" stroke={NW.magenta} strokeWidth="1" />
            <circle r="18" fill="none" stroke={NW.magenta} strokeWidth="0.4" strokeDasharray="2 3" opacity="0.7" />
          </g>
        ))}

        {/* cameras */}
        {[[380,110],[560,110],[410,270],[720,300]].map(([x,y],i)=>(
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r="3" fill={NW.amber} />
            <path d="M 0 0 L -14 -10 L -14 10 Z" fill={NW.amber} opacity="0.18" />
          </g>
        ))}

        {/* legend */}
        <g transform="translate(24 20)" fontFamily={NW.mono} fontSize="9">
          <rect x="0" y="0" width="220" height="72" fill="rgba(6,9,20,0.85)" stroke={NW.line2} strokeWidth="0.5" />
          <text x="10" y="16" fill={NW.cyan} letterSpacing="2">◆ LEGEND</text>
          <g transform="translate(10 28)"><path d="M 0 -4 L 4 0 L 0 4 L -4 0 Z" fill="none" stroke={NW.cyan} strokeWidth="1" /><text x="12" y="3" fill={NW.fg1}>FRIENDLY · LZ</text></g>
          <g transform="translate(10 44)"><path d="M 0 -4 L 4 0 L 0 4 L -4 0 Z" fill="none" stroke={NW.amber} strokeWidth="1" /><text x="12" y="3" fill={NW.fg1}>EXFIL</text></g>
          <g transform="translate(10 60)"><path d="M 0 -4 L 4 4 L -4 4 Z" fill="none" stroke={NW.magenta} strokeWidth="1" /><text x="12" y="8" fill={NW.fg1}>HOSTILE PATROL</text></g>
        </g>
      </svg>
    </NWPanel>
  );
}

function NWBriefTimeline() {
  const stages = [
    { t: 'T−00', l: 'INSERT', sub: 'LZ·A · 22:45', c: NW.cyan },
    { t: 'T+04', l: 'RALLY',  sub: 'RP·1 · quiet move', c: NW.cyan },
    { t: 'T+09', l: 'BREACH', sub: 'SB-04 · mechanical', c: NW.amber },
    { t: 'T+14', l: 'SECURE', sub: 'Unit 3-C · recover', c: NW.magenta },
    { t: 'T+22', l: 'EGRESS', sub: 'roof stair · up', c: NW.cyan },
    { t: 'T+28', l: 'EXFIL',  sub: 'LZ·B · 23:13', c: NW.amber },
  ];
  return (
    <NWPanel title="PLAN·A · TIMELINE" accent="cyan" padding={14} style={{ flex: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {stages.map((s, i) => (
          <div key={i} style={{ position: 'relative' }}>
            {i < 5 && <div style={{ position: 'absolute', right: -8, top: 12, width: 10, height: 1, background: NW.line2 }} />}
            <div style={{ fontFamily: NW.mono, fontSize: 9, color: s.c, letterSpacing: '0.18em' }}>{s.t}</div>
            <div style={{ fontFamily: NW.display, fontSize: 14, color: NW.fg0, fontWeight: 700, letterSpacing: '0.08em', marginTop: 2 }}>{s.l}</div>
            <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </NWPanel>
  );
}

const NW_BRIEF_SQUAD = [
  { name: '"HOLST"', role: 'SGT · RIFLEMAN',   kit: 'HK-416 · M17 · FRAG×2', hp: 1.0, lead: true },
  { name: '"MARA"',  role: 'CPL · MEDIC',      kit: 'MP5SD · TOURN·8 · SMK×2', hp: 1.0 },
  { name: '"VANCE"', role: 'SPC · BREACHER',   kit: 'SPAS-12 · BREACH CHG·3', hp: 1.0 },
  { name: '"KIM"',   role: 'CPL · DMR',        kit: 'HK-417 · GHILLIE · M17', hp: 0.88 },
  { name: '"REN"',   role: 'PVT · AUTO',       kit: 'M249 · ARMOR·L3 · FRAG×4', hp: 1.0 },
  { name: '"DRU"',   role: 'SPC · ENGINEER',   kit: 'UMP-45 · HACK·KIT · DRONE-C', hp: 1.0 },
];

function NWBriefSquad() {
  return (
    <NWPanel title="SQUAD · BRAVO · 6/6" accent="cyan" padding={0} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
      right={<span style={{ color: NW.fg2 }}>EDIT ▾</span>}>
      {NW_BRIEF_SQUAD.map((op, i) => (
        <div key={op.name} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto',
          gap: 10, padding: '10px 14px', alignItems: 'center',
          borderBottom: i < NW_BRIEF_SQUAD.length - 1 ? `1px solid ${NW.line}` : 'none',
          background: op.lead ? NW.cyanSoft : 'transparent' }}>
          <svg width="34" height="36" viewBox="0 0 34 36">
            <path d="M 17 2 L 31 10 L 31 26 L 17 34 L 3 26 L 3 10 Z" fill={op.lead ? NW.cyanSoft : NW.bg2} stroke={op.lead ? NW.cyan : NW.line2} strokeWidth="1" />
            <circle cx="17" cy="14" r="4" fill="#1a2340" stroke={op.lead ? NW.cyan : NW.fg2} strokeWidth="0.6" />
            <path d="M 10 28 Q 17 20 24 28" fill="#1a2340" stroke={op.lead ? NW.cyan : NW.fg2} strokeWidth="0.6" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: NW.display, fontSize: 13, color: op.lead ? NW.cyan : NW.fg0, fontWeight: 700, letterSpacing: '0.06em' }}>{op.name}</span>
              {op.lead && <span style={{ fontFamily: NW.mono, fontSize: 8.5, color: NW.cyan, letterSpacing: '0.22em', border: `1px solid ${NW.cyan}77`, padding: '0 4px' }}>LEAD</span>}
            </div>
            <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2, letterSpacing: '0.14em', marginTop: 1 }}>{op.role}</div>
            <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg1, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{op.kit}</div>
          </div>
          <div style={{ width: 60 }}>
            <div style={{ fontFamily: NW.mono, fontSize: 8.5, color: NW.fg2, letterSpacing: '0.18em', textAlign: 'right' }}>COND</div>
            <NWBar value={op.hp} tone={op.hp < 0.6 ? 'amber' : 'green'} height={2} />
          </div>
        </div>
      ))}
    </NWPanel>
  );
}

function NWBriefDeploy() {
  return (
    <NWPanel padding={14} accent="amber" style={{ flex: 0, background: 'linear-gradient(135deg, rgba(255,160,32,0.08), rgba(10,15,30,0.4))' }}>
      <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.amber, letterSpacing: '0.22em' }}>◆ DEPLOY · CLOCK STARTS</div>
      <div style={{ fontFamily: NW.display, fontSize: 28, color: NW.fg0, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1, marginTop: 4 }}>LZ·ALPHA · 22:45</div>
      <div style={{ fontFamily: NW.mono, fontSize: 11, color: NW.fg2, marginTop: 6 }}>INSERT T−00:42 · EXFIL WINDOW 23:13 → 23:35</div>
      <div style={{ height: 1, background: NW.line, margin: '12px 0' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <NWChip kbd="B">BACK</NWChip>
        <NWChip kbd="S">SAVE PLAN</NWChip>
        <NWChip primary kbd="↵" style={{ flex: 1, justifyContent: 'center', padding: '10px 0', fontSize: 12 }}>CONFIRM DEPLOY ▸</NWChip>
      </div>
    </NWPanel>
  );
}

Object.assign(window, { NeonwireBriefing });
