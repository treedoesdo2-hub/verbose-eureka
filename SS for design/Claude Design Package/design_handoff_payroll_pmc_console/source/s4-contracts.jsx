// s4-contracts.jsx — NEON WIRE · Contract Board (full screen)
// Dedicated contract browsing screen. Left: filterable contract list.
// Right: detail pane for the selected contract with map preview, client brief,
// objectives, risk, payment structure, and deploy CTA.

function NeonwireContracts() {
  return (
    <NWFrame>
      <NWSystemBar
        path="/OPS/CONTRACTS/BOARD"
        right={<>
          <span style={{ color: NW.cyan }}>12 OPEN</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.amber }}>03 PRIORITY</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.fg1 }}>REFRESH · T+00:48</span>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '560px 1fr', gap: 14,
        padding: 14, height: 'calc(100% - 32px)', position: 'relative', zIndex: 1 }}>
        {/* LEFT — list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <NWContractFilters />
          <NWContractList />
          <NWContractSummary />
        </div>

        {/* RIGHT — detail */}
        <div style={{ display: 'grid', gridTemplateRows: '300px 1fr 120px', gap: 12, minHeight: 0 }}>
          <NWContractMap />
          <NWContractDetail />
          <NWContractActions />
        </div>
      </div>
    </NWFrame>
  );
}

// ── LEFT ──────────────────────────────────────────

function NWContractFilters() {
  const tabs = ['ALL · 12', 'PRIORITY · 3', 'BOUNTY · 2', 'STANDING · 4', 'BLACKLINE · 1'];
  return (
    <NWPanel padding={0} accent="cyan">
      <div style={{ display: 'flex', borderBottom: `1px solid ${NW.line}` }}>
        {tabs.map((t, i) => (
          <div key={t} style={{ flex: 1, padding: '10px 8px', textAlign: 'center',
            fontFamily: NW.mono, fontSize: 10, letterSpacing: '0.14em',
            color: i === 0 ? NW.cyan : NW.fg1, fontWeight: 600,
            background: i === 0 ? NW.cyanSoft : 'transparent',
            borderRight: i < tabs.length - 1 ? `1px solid ${NW.line}` : 'none',
            borderBottom: i === 0 ? `1px solid ${NW.cyan}` : `1px solid transparent`,
            marginBottom: -1,
          }}>{t}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', fontFamily: NW.mono, fontSize: 10.5, alignItems: 'center' }}>
        <span style={{ color: NW.fg2, letterSpacing: '0.16em' }}>FILTER ▸</span>
        {[['TYPE', 'ANY'], ['RISK', '≤ HIGH'], ['PAY', '≥ ¥100K'], ['DIST', '≤ 12KM']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 6, padding: '3px 8px',
            border: `1px solid ${NW.line2}`, fontFamily: NW.mono }}>
            <span style={{ color: NW.fg2 }}>{k}</span>
            <span style={{ color: NW.cyan }}>{v}</span>
          </div>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ color: NW.fg2, letterSpacing: '0.16em' }}>SORT: PAY ↓</span>
      </div>
    </NWPanel>
  );
}

const NW_CONTRACTS = [
  { id: 'OP-BLACKLINE', sel: true, pri: 'BLACKLINE', client: 'ANON · VERIFIED', loc: 'TOHO FLATS / SB-04',
    type: 'DENIAL',   pay: 980, risk: 'HIGH',  dur: '48H', civ: 'AMBER', dist: '6.2KM',
    desc: 'Recover drive. No client attribution. Prefer quiet.' },
  { id: 'OP-MERCATO',   pri: 'STANDING', client: 'MERIDIAN RISK', loc: 'N-6TH MARKET',
    type: 'ESCORT',   pay: 310, risk: 'MED',   dur: '14H', civ: 'HIGH',  dist: '3.8KM',
    desc: 'Courier escort through market zone to LZ-04. Civilian exposure likely.' },
  { id: 'OP-RIVER',     pri: 'BOUNTY',   client: 'TBD · ESCROW',  loc: 'KOGA PIER',
    type: 'RECOVERY', pay: 420, risk: 'MED',   dur: '36H', civ: 'LOW',   dist: '11.0KM',
    desc: 'Bring in target alive. Kill fee forfeits bonus. Flexible window.' },
  { id: 'OP-LATHE',     pri: 'STANDING', client: 'NORTH-6TH PCT', loc: 'PRECINCT LINE',
    type: 'DEFENSIVE',pay: 240, risk: 'LOW',   dur: '72H', civ: 'LOW',   dist: '4.1KM',
    desc: 'Hold north line against expected DAIGO pressure. Well-supplied.' },
  { id: 'OP-DITCH',     pri: 'STANDING', client: 'KESSLER HLDG',  loc: 'S-WARD YARDS',
    type: 'SWEEP',    pay: 160, risk: 'LOW',   dur: '18H', civ: 'LOW',   dist: '2.2KM',
    desc: 'Clear squatters from yard 19A. Non-lethal preferred.' },
  { id: 'OP-AMBER',     pri: 'PRIORITY', client: 'MURAKAMI GLOBAL', loc: 'TENJIN ROOF',
    type: 'SANCTION', pay: 1400, risk: 'EXTR', dur: '24H', civ: 'HIGH',  dist: '7.4KM',
    desc: 'Single target. Corporate board member. Full denial required.' },
  { id: 'OP-GLASS',     pri: 'BOUNTY',   client: 'TBD · ESCROW',  loc: 'E-IND SUB-09',
    type: 'SANCTION', pay: 650, risk: 'HIGH',  dur: '60H', civ: 'LOW',   dist: '9.8KM',
    desc: 'Three targets. Kill-on-ID authorized. Photo proof required.' },
  { id: 'OP-TIDE',      pri: 'STANDING', client: 'MERIDIAN RISK', loc: 'HARBOR CUT',
    type: 'ESCORT',   pay: 280, risk: 'MED',   dur: '12H', civ: 'MED',   dist: '5.5KM',
    desc: 'VIP extraction from consulate to airstrip. 2x blackout SUVs.' },
];

function NWContractList() {
  return (
    <NWPanel title="OPEN CONTRACTS" right={<span style={{ color: NW.fg2, fontSize: 10 }}>8 / 12</span>}
      padding={0} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {NW_CONTRACTS.map((c, i) => {
        const priColor = c.pri === 'BLACKLINE' ? NW.magenta : c.pri === 'PRIORITY' ? NW.amber : c.pri === 'BOUNTY' ? NW.cyan : NW.fg2;
        const riskColor = c.risk === 'EXTR' ? NW.magenta : c.risk === 'HIGH' ? NW.magenta : c.risk === 'MED' ? NW.amber : NW.green;
        return (
          <div key={c.id} style={{
            display: 'grid', gridTemplateColumns: '1fr 84px', gap: 10, padding: '12px 14px',
            borderBottom: i < NW_CONTRACTS.length - 1 ? `1px solid ${NW.line}` : 'none',
            background: c.sel ? NW.cyanSoft : 'transparent',
            borderLeft: `3px solid ${c.sel ? NW.cyan : 'transparent'}`,
            cursor: 'pointer',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: NW.mono, fontSize: 8.5, color: priColor, letterSpacing: '0.22em',
                  border: `1px solid ${priColor}55`, padding: '1px 5px' }}>{c.pri}</span>
                <span style={{ fontFamily: NW.display, fontWeight: 700, color: NW.fg0, letterSpacing: '0.08em',
                  fontSize: 14 }}>{c.id}</span>
              </div>
              <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, marginTop: 3, letterSpacing: '0.04em' }}>
                {c.client} <span style={{ color: NW.fgDim }}>▸</span> <span style={{ color: NW.cyan }}>{c.type}</span> <span style={{ color: NW.fgDim }}>▸</span> {c.loc}
              </div>
              <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg1, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.desc}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: NW.mono }}>
              <div style={{ fontFamily: NW.display, fontSize: 16, color: NW.cyan, fontWeight: 700, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>
                ¥{c.pay}K
              </div>
              <div style={{ fontSize: 9, color: riskColor, letterSpacing: '0.16em', marginTop: 2 }}>● {c.risk}</div>
              <div style={{ fontSize: 9, color: NW.fg2, letterSpacing: '0.12em', marginTop: 1 }}>{c.dur}</div>
            </div>
          </div>
        );
      })}
    </NWPanel>
  );
}

function NWContractSummary() {
  return (
    <NWPanel padding={12} accent="cyan" style={{ flex: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <NWStat label="OPEN"     value="12" tone="cyan" />
        <NWStat label="VALUE"    value="¥4.6M" tone="green" />
        <NWStat label="EXPIRING" value="02" sub="< 12H" tone="amber" />
        <NWStat label="DECLINED" value="07" sub="30D" tone="magenta" />
      </div>
    </NWPanel>
  );
}

// ── RIGHT ─────────────────────────────────────────

function NWContractMap() {
  return (
    <NWPanel title="OP-BLACKLINE · AREA OF OPERATION" accent="cyan" padding={0}
      right={<>
        <span style={{ color: NW.fg2 }}>TOHO FLATS · SB-04</span>
        <NWChip small kbd="M">EXPAND</NWChip>
      </>}>
      <div style={{ position: 'relative', height: '100%' }}>
        <svg viewBox="0 0 1040 240" style={{ width: '100%', height: '100%', display: 'block' }} preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="cb-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 H 0 V 24" stroke={NW.line} strokeWidth="0.4" fill="none" />
            </pattern>
            <radialGradient id="cb-aoi">
              <stop offset="0%" stopColor={NW.magenta} stopOpacity="0.35" />
              <stop offset="60%" stopColor={NW.magenta} stopOpacity="0.08" />
              <stop offset="100%" stopColor={NW.magenta} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1040" height="240" fill={NW.bg0} />
          <rect width="1040" height="240" fill="url(#cb-grid)" />

          {/* blocks */}
          {Array.from({ length: 24 }).map((_, i) => {
            const x = 40 + (i % 8) * 120;
            const y = 30 + Math.floor(i / 8) * 70;
            return <rect key={i} x={x} y={y} width={90} height={50} fill={NW.bg2} stroke={NW.line2} strokeWidth="0.5" />;
          })}

          {/* streets highlighted */}
          <rect x="0" y="95" width="1040" height="2" fill={NW.line2} />
          <rect x="0" y="165" width="1040" height="2" fill={NW.line2} />

          {/* AOI */}
          <g transform="translate(640 120)">
            <circle r="90" fill="url(#cb-aoi)" />
            <path d="M 0 -40 L 35 -20 L 35 20 L 0 40 L -35 20 L -35 -20 Z"
              fill="none" stroke={NW.magenta} strokeWidth="1.4" strokeDasharray="4 3" />
            <circle r="4" fill={NW.magenta} />
            <text y="-52" fill={NW.magenta} fontSize="10" fontFamily={NW.mono} textAnchor="middle" letterSpacing="2">▼ TARGET · SB-04</text>
          </g>

          {/* insertion */}
          <g transform="translate(220 200)">
            <path d="M 0 -10 L 9 0 L 0 10 L -9 0 Z" fill="none" stroke={NW.cyan} strokeWidth="1.2" />
            <circle r="2" fill={NW.cyan} />
            <text x="14" y="4" fill={NW.cyan} fontSize="9" fontFamily={NW.mono} letterSpacing="1.2">LZ·ALPHA</text>
          </g>
          {/* extraction */}
          <g transform="translate(920 50)">
            <path d="M 0 -10 L 9 0 L 0 10 L -9 0 Z" fill="none" stroke={NW.amber} strokeWidth="1.2" />
            <circle r="2" fill={NW.amber} />
            <text x="14" y="4" fill={NW.amber} fontSize="9" fontFamily={NW.mono} letterSpacing="1.2">LZ·BRAVO · EXFIL</text>
          </g>

          {/* route */}
          <path d="M 220 200 Q 440 180 640 120" stroke={NW.cyan} strokeWidth="1" strokeDasharray="4 3" fill="none" opacity="0.8" />
          <path d="M 640 120 Q 800 80 920 50" stroke={NW.amber} strokeWidth="1" strokeDasharray="4 3" fill="none" opacity="0.8" />

          {/* hostile assets */}
          {[[560,90,'PATROL'],[720,160,'CHECKPT'],[680,80,'CCTV']].map(([x,y,l],i)=>(
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M 0 -6 L 5 5 L -5 5 Z" fill="none" stroke={NW.magenta} strokeWidth="1" />
              <text x="8" y="3" fill={NW.magenta} fontSize="8" fontFamily={NW.mono} letterSpacing="1">{l}</text>
            </g>
          ))}

          {/* scale + north */}
          <g transform="translate(30 220)">
            <line x1="0" y1="0" x2="60" y2="0" stroke={NW.fg1} strokeWidth="0.8" />
            <text y="-4" fill={NW.fg1} fontSize="8" fontFamily={NW.mono}>200 M</text>
          </g>
          <g transform="translate(1010 30)">
            <path d="M 0 -12 L 3 0 L 0 12 L -3 0 Z" fill={NW.cyan} />
            <text y="-16" fill={NW.cyan} fontSize="8" fontFamily={NW.mono} textAnchor="middle">N</text>
          </g>
        </svg>
      </div>
    </NWPanel>
  );
}

function NWContractDetail() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        {/* header */}
        <div style={{ position: 'relative' }}>
          <NWPanel padding={18} style={{ background: 'linear-gradient(135deg, rgba(255,45,154,0.08), rgba(10,15,30,0.4))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.magenta, letterSpacing: '0.24em',
                border: `1px solid ${NW.magenta}77`, padding: '2px 8px' }}>◆ BLACKLINE</span>
              <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.18em' }}>CLIENT ATTRIBUTION · NONE</span>
            </div>
            <div style={{ fontFamily: NW.display, fontSize: 40, color: NW.fg0, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1 }}>
              OP-BLACKLINE
            </div>
            <div style={{ fontFamily: NW.mono, fontSize: 12, color: NW.fg1, marginTop: 8, letterSpacing: '0.08em' }}>
              ANON · VERIFIED · ESCROW 80% / DROP 20% <span style={{ color: NW.fgDim }}>║</span> TOHO FLATS SB-04 <span style={{ color: NW.fgDim }}>║</span> 6.2 KM
            </div>
            <div style={{ fontFamily: NW.body, fontSize: 13, color: NW.fg1, marginTop: 12, lineHeight: 1.55, maxWidth: 620 }}>
              Recover an encrypted storage drive from a third-floor residential unit in the TOHO FLATS / SB-04 block.
              Client has not disclosed contents. Package must remain sealed. Client will not claim responsibility;
              mission failure is denied. Civ-density AMBER during daylight, LOW after 22:00.
            </div>
          </NWPanel>
        </div>

        {/* objectives + risk */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1, minHeight: 0 }}>
          <NWPanel title="OBJECTIVES · 4" accent="cyan" padding={14}>
            {[
              ['PRI', 'RECOVER PACKAGE', 'SB-04 · UNIT 3-C', NW.cyan],
              ['SEC', 'SEAL REMAINS INTACT', '— drive must not be copied', NW.cyan],
              ['OPT', 'NO CIVILIAN CASUALTIES', '+ ¥120K completion bonus', NW.amber],
              ['OPT', 'NO EVIDENCE LEFT', '+ ¥80K completion bonus', NW.amber],
            ].map(([tag, title, sub, c], i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0',
                borderBottom: i < 3 ? `1px solid ${NW.line}` : 'none' }}>
                <span style={{ fontFamily: NW.mono, fontSize: 9, color: c, letterSpacing: '0.2em',
                  border: `1px solid ${c}55`, padding: '1px 5px', alignSelf: 'flex-start', marginTop: 2 }}>{tag}</span>
                <div>
                  <div style={{ fontFamily: NW.display, fontSize: 13, color: NW.fg0, fontWeight: 600, letterSpacing: '0.04em' }}>{title}</div>
                  <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, marginTop: 2 }}>{sub}</div>
                </div>
              </div>
            ))}
          </NWPanel>

          <NWPanel title="RISK PROFILE" accent="magenta" padding={14}>
            {[
              ['HOSTILE FORCE', 0.72, '18–24 · DAIGO SEC', NW.magenta],
              ['CIV EXPOSURE',  0.55, 'AMBER · 240 IN AO',  NW.amber],
              ['RESPONSE TIME', 0.60, 'POLICE ~ 6MIN',       NW.amber],
              ['SURVEILLANCE',  0.44, '12 CAMS · 3 CCTV AI', NW.cyan],
              ['EXFIL RISK',    0.30, 'LOW · 2 ROUTES',      NW.green],
            ].map(([l, v, s, c], i) => (
              <div key={i} style={{ marginBottom: i < 4 ? 10 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: NW.mono, fontSize: 10, letterSpacing: '0.14em' }}>
                  <span style={{ color: NW.fg2 }}>{l}</span>
                  <span style={{ color: NW.fg1 }}>{s}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <NWBar value={v} tone={c === NW.magenta ? 'magenta' : c === NW.amber ? 'amber' : c === NW.cyan ? 'cyan' : 'green'} height={3} />
                </div>
              </div>
            ))}
          </NWPanel>
        </div>
      </div>

      {/* RIGHT — payment + terms */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <NWPanel title="COMPENSATION" accent="cyan" padding={14}>
          <div style={{ fontFamily: NW.display, fontSize: 38, color: NW.cyan, fontWeight: 700,
            letterSpacing: '0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>¥980K</div>
          <div style={{ fontFamily: NW.mono, fontSize: 10.5, color: NW.fg2, marginTop: 4 }}>BASE · EXCL. BONUSES</div>
          <div style={{ height: 1, background: NW.line, margin: '14px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', rowGap: 7, columnGap: 10,
            fontFamily: NW.mono, fontSize: 11 }}>
            <span style={{ color: NW.fg2 }}>ESCROW</span><span style={{ color: NW.fg1 }}>ON ACCEPT</span><span style={{ color: NW.green, textAlign: 'right' }}>¥784K</span>
            <span style={{ color: NW.fg2 }}>COMPLETION</span><span style={{ color: NW.fg1 }}>ON DROP</span><span style={{ color: NW.cyan, textAlign: 'right' }}>¥196K</span>
            <span style={{ color: NW.fg2 }}>BONUS · CLEAN</span><span style={{ color: NW.fg1 }}>NO CIV CAS</span><span style={{ color: NW.amber, textAlign: 'right' }}>+¥120K</span>
            <span style={{ color: NW.fg2 }}>BONUS · SILENT</span><span style={{ color: NW.fg1 }}>NO EVIDENCE</span><span style={{ color: NW.amber, textAlign: 'right' }}>+¥80K</span>
            <span style={{ color: NW.fg2 }}>PENALTY</span><span style={{ color: NW.fg1 }}>SEAL BROKEN</span><span style={{ color: NW.magenta, textAlign: 'right' }}>−¥400K</span>
          </div>
          <div style={{ height: 1, background: NW.line, margin: '14px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: NW.display,
            fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}>
            <span style={{ color: NW.fg0 }}>MAX POTENTIAL</span>
            <span style={{ color: NW.green, fontVariantNumeric: 'tabular-nums' }}>¥1.18M</span>
          </div>
        </NWPanel>

        <NWPanel title="TERMS" accent="amber" padding={14} style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 6, columnGap: 10,
            fontFamily: NW.mono, fontSize: 11, color: NW.fg1 }}>
            <span style={{ color: NW.fg2 }}>WINDOW</span><span>48:00:00</span>
            <span style={{ color: NW.fg2 }}>DENIAL</span><span style={{ color: NW.magenta }}>FULL</span>
            <span style={{ color: NW.fg2 }}>COMMS</span><span>Q-ENCR · CH-7</span>
            <span style={{ color: NW.fg2 }}>RoE</span><span style={{ color: NW.amber }}>DISCRETIONARY</span>
            <span style={{ color: NW.fg2 }}>CIV HARM</span><span style={{ color: NW.magenta }}>PENALTY</span>
            <span style={{ color: NW.fg2 }}>KIA CAP</span><span>2 · COVERED</span>
          </div>
        </NWPanel>
      </div>
    </div>
  );
}

function NWContractActions() {
  return (
    <NWPanel padding={14} accent="cyan" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2, letterSpacing: '0.22em' }}>ACCEPTING ▸</div>
          <div style={{ fontFamily: NW.display, fontSize: 22, color: NW.fg0, fontWeight: 700, letterSpacing: '0.06em' }}>OP-BLACKLINE</div>
        </div>
        <span style={{ width: 1, height: 42, background: NW.line2 }} />
        <div>
          <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2, letterSpacing: '0.22em' }}>ESCROW POSTS</div>
          <div style={{ fontFamily: NW.display, fontSize: 20, color: NW.green, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>¥784,000</div>
        </div>
        <span style={{ width: 1, height: 42, background: NW.line2 }} />
        <div>
          <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2, letterSpacing: '0.22em' }}>CLOCK STARTS</div>
          <div style={{ fontFamily: NW.display, fontSize: 20, color: NW.amber, fontWeight: 700 }}>ON BRIEF</div>
        </div>
        <span style={{ flex: 1 }} />
        <NWChip kbd="ESC">DECLINE</NWChip>
        <NWChip kbd="Q">COUNTER-OFFER</NWChip>
        <NWChip primary kbd="↵" style={{ padding: '10px 22px', fontSize: 13 }}>ACCEPT &amp; BRIEF ▸</NWChip>
      </div>
    </NWPanel>
  );
}

Object.assign(window, { NeonwireContracts });
