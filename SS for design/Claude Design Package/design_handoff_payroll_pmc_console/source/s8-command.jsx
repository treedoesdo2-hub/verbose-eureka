// s8-command.jsx — NEON WIRE · Battalion Command View
// Live combat across multiple concurrent squad engagements. Commander POV:
// 3 active ops, one in contact, live comms, decisions pending.
// Counterpart to s6-debrief (after-action → during-action).

/* ========== DATA ========== */

const BC = {
  bn: '4TH IRR · "CORDON"',
  theatre: 'KANTŌ FRINGE · SECTOR 7',
  t0: '14:32:08',
  ops: [
    {
      id: 'blackline', code: 'OP-BLACKLINE',
      unit: 'BRAVO COY', sqd: 'SB-04 · 6/6',
      phase: 'IN CONTACT', tone: 'magenta',
      loc: 'TOHO FLATS · sub-blk 4', tElap: '00:41:22',
      heat: 0.86,
      lines: [
        ['T+00:38:04', 'SB-04', 'contact · 3 rifles, 1 lmg · grid 487-221'],
        ['T+00:38:22', 'HOLST', 'engage · flank east'],
        ['T+00:39:11', 'DRU',   'pinned · sub-blk 4 stairwell'],
        ['T+00:40:02', 'SB-04', 'requesting smoke · QRF standby'],
      ],
      stats: { friendly: 6, contact: 3, wounded: 1, killed: 0 },
      mode: 'live',
    },
    {
      id: 'kite', code: 'OP-KITE-7',
      unit: 'ALPHA · 3 PLT', sqd: '"KITE" · 18/20',
      phase: 'RECON', tone: 'cyan',
      loc: 'KANTŌ-W RIDGE · grid 219-604', tElap: '04:17:09',
      heat: 0.14,
      lines: [
        ['T+04:12:00', 'KITE', 'overwatch · ridge NE · nil contact'],
        ['T+04:14:30', 'KITE', 'rival drone track · 2km E · observing'],
      ],
      stats: { friendly: 18, contact: 0, wounded: 0, killed: 0 },
      mode: 'quiet',
    },
    {
      id: 'tailback', code: 'OP-TAILBACK',
      unit: 'HQ · LOG', sqd: '"TAIL" · 10/12',
      phase: 'CONVOY', tone: 'amber',
      loc: 'KAWASAKI → NAKANO-I', tElap: '01:55:41',
      heat: 0.32,
      lines: [
        ['T+01:48:00', 'TAIL', 'checkpoint Kōhoku · clear'],
        ['T+01:52:18', 'TAIL', 'unknown tail · 600m · observing'],
      ],
      stats: { friendly: 10, contact: 0, wounded: 0, killed: 0 },
      mode: 'watch',
    },
  ],
  decisions: [
    { code: 'D-01', from: 'SB-04', ask: 'REQ SMOKE + QRF · ¥42K munitions · T−30s', opts: ['APPROVE', 'DENY', 'DEFER'], hot: true },
    { code: 'D-02', from: 'TAIL',  ask: 'DEVIATE RTE  · alt via R-17 · +18min', opts: ['APPROVE', 'DENY'] },
    { code: 'D-03', from: 'KITE',  ask: 'EXTEND OVERWATCH · +2h · rival drone',  opts: ['EXTEND', 'RECALL'] },
  ],
  comms: [
    { t: '14:32:02', u: 'SB-04', c: NW.magenta, x: 'contact NE · danger close · breaking' },
    { t: '14:31:58', u: 'HOLST', c: NW.fg0,     x: 'push east · DRU cover · 3 rounds' },
    { t: '14:31:40', u: 'CMD',   c: NW.cyan,    x: '→ SB-04 authorize 40mm' },
    { t: '14:31:22', u: 'KITE',  c: NW.fg1,     x: 'drone bearing 095 · 2km · still passive' },
    { t: '14:30:49', u: 'TAIL',  c: NW.amber,   x: 'possible tail · non-agg posture' },
    { t: '14:30:18', u: 'SB-04', c: NW.fg1,     x: 'stack ready · sub-blk 4 stairwell' },
    { t: '14:29:55', u: 'WHITE', c: NW.magenta, x: 'medevac pre-stage · Nakano' },
    { t: '14:29:30', u: 'CMD',   c: NW.cyan,    x: '→ BN ALL · hot posture · sector 7' },
  ],
};

/* ========== FRAME ========== */

function NeonwireCommand() {
  const [focus, setFocus] = React.useState('blackline');
  const op = BC.ops.find(o => o.id === focus);
  return (
    <NWFrame>
      <NWSystemBar
        path="/CMD/BATTLE/LIVE"
        right={<>
          <span style={{ color: NW.magenta }}>● IN CONTACT · 1</span>
          <span style={{ color: NW.fgDim, margin: '0 8px' }}>║</span>
          <span style={{ color: NW.amber }}>◆ HOT · 2</span>
          <span style={{ color: NW.fgDim, margin: '0 8px' }}>║</span>
          <span style={{ color: NW.fg1 }}>{BC.theatre} · T {BC.t0}</span>
        </>}
      />

      {/* top banner */}
      <BCBanner />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '340px 1fr 360px',
        gridTemplateRows: '1fr auto',
        gap: 12, padding: 12, height: 'calc(100% - 32px - 68px)',
        position: 'relative', zIndex: 1,
      }}>
        {/* LEFT — ops cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2,
            letterSpacing: '0.24em', padding: '2px 2px 6px' }}>
            ◆ ACTIVE OPERATIONS · 3
          </div>
          {BC.ops.map(o => (
            <BCOpCard key={o.id} o={o} selected={o.id === focus} onClick={() => setFocus(o.id)} />
          ))}
          <div style={{ flex: 1 }} />
          <BCAttrTicker />
        </div>

        {/* CENTER — focused tactical picture */}
        <BCTacticalFeed op={op} />

        {/* RIGHT — comms + decisions */}
        <div style={{ display: 'grid', gridTemplateRows: '1fr auto', gap: 12, minHeight: 0 }}>
          <BCCommsLog />
          <BCDecisionQueue />
        </div>
      </div>

      {/* BOTTOM cmd bar */}
      <BCFooter />
    </NWFrame>
  );
}

/* ========== TOP BANNER ========== */

function BCBanner() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto',
      gap: 24, alignItems: 'center', padding: '12px 20px',
      background: 'linear-gradient(90deg, rgba(255,45,154,0.10), transparent 50%, rgba(24,224,255,0.06))',
      borderBottom: `1px solid ${NW.line2}`, height: 68, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <svg width="40" height="44" viewBox="0 0 40 44">
          <path d="M 20 2 L 36 11 L 36 33 L 20 42 L 4 33 L 4 11 Z"
            fill="rgba(255,45,154,0.08)" stroke={NW.magenta} strokeWidth="1.3" />
          <circle cx="20" cy="22" r="3.5" fill={NW.magenta}>
            <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
          </circle>
        </svg>
        <div>
          <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.28em' }}>
            BATTALION COMMAND · LIVE
          </div>
          <div style={{ fontFamily: NW.display, fontSize: 26, fontWeight: 700,
            color: NW.fg0, letterSpacing: '0.06em', lineHeight: 1 }}>{BC.bn}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18, paddingLeft: 24 }}>
        <BCMiniStat k="COMMITTED" v="34" s="of 237" tone="cyan" />
        <BCMiniStat k="IN CONTACT" v="6"  s="1 wia" tone="magenta" />
        <BCMiniStat k="WIA·24h"   v="1"  s="stable" tone="amber" />
        <BCMiniStat k="KIA·24h"   v="0"  s="—"     tone="green" />
        <BCMiniStat k="BURN·OP"   v="¥182K" s="proj" tone="amber" />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <NWChip small>RULES OF ENGAGEMENT</NWChip>
        <NWChip small danger>DECLARE WITHDRAW</NWChip>
      </div>
    </div>
  );
}

function BCMiniStat({ k, v, s, tone }) {
  const c = tone === 'cyan' ? NW.cyan : tone === 'magenta' ? NW.magenta :
            tone === 'amber' ? NW.amber : tone === 'green' ? NW.green : NW.fg0;
  return (
    <div>
      <div style={{ fontFamily: NW.mono, fontSize: 8.5, color: NW.fg2, letterSpacing: '0.22em' }}>{k}</div>
      <div style={{ fontFamily: NW.display, fontSize: 20, fontWeight: 700, color: c,
        letterSpacing: '0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{v}</div>
      <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2, marginTop: 2 }}>{s}</div>
    </div>
  );
}

/* ========== OP CARD ========== */

function BCOpCard({ o, selected, onClick }) {
  const c = o.tone === 'magenta' ? NW.magenta : o.tone === 'amber' ? NW.amber : NW.cyan;
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(24,224,255,0.05)' : NW.bg1,
      borderLeft: `3px solid ${c}`,
      border: `1px solid ${selected ? NW.cyan : NW.line}`,
      padding: '10px 12px', cursor: 'pointer', position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: NW.display, fontSize: 14, fontWeight: 700,
          color: NW.fg0, letterSpacing: '0.06em' }}>{o.code}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: NW.mono, fontSize: 9, color: c,
          letterSpacing: '0.2em', border: `1px solid ${c}77`, padding: '1px 5px' }}>
          {o.phase}
        </span>
      </div>
      <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg1,
        letterSpacing: '0.08em', marginTop: 4 }}>
        {o.unit} · <span style={{ color: c }}>{o.sqd}</span>
      </div>
      <div style={{ fontFamily: NW.mono, fontSize: 9.5, color: NW.fg2,
        letterSpacing: '0.06em', marginTop: 2 }}>▸ {o.loc}</div>

      {/* heat bar */}
      <div style={{ marginTop: 8 }}>
        <NWBar value={o.heat} tone={o.tone} height={2} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3,
          fontFamily: NW.mono, fontSize: 8.5, color: NW.fg2, letterSpacing: '0.14em' }}>
          <span>HEAT {Math.round(o.heat * 100)}%</span>
          <span>T+{o.tElap}</span>
        </div>
      </div>

      {/* quick stats */}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, fontFamily: NW.mono, fontSize: 10 }}>
        <span style={{ color: NW.cyan }}>◈ {o.stats.friendly}</span>
        {o.stats.contact > 0 && <span style={{ color: NW.magenta }}>▼ {o.stats.contact}</span>}
        {o.stats.wounded > 0 && <span style={{ color: NW.amber }}>+ {o.stats.wounded}W</span>}
      </div>

      {o.mode === 'live' && (
        <div style={{ position: 'absolute', top: 8, right: 10, width: 6, height: 6,
          background: NW.magenta, borderRadius: '50%',
          boxShadow: `0 0 8px ${NW.magenta}` }}>
          <div style={{ width: '100%', height: '100%', background: NW.magenta, borderRadius: '50%' }}>
            <style>{`@keyframes bcpulse {0%,100% {opacity:1} 50% {opacity:0.3}}`}</style>
          </div>
        </div>
      )}
    </div>
  );
}

function BCAttrTicker() {
  return (
    <NWPanel title="BN ATTRITION · 24h" accent="amber" padding={10}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        fontFamily: NW.mono, fontSize: 10 }}>
        <div>
          <div style={{ color: NW.fg2, fontSize: 8.5, letterSpacing: '0.22em' }}>WIA</div>
          <div style={{ color: NW.amber, fontFamily: NW.display, fontSize: 18, fontWeight: 700 }}>+1</div>
        </div>
        <div>
          <div style={{ color: NW.fg2, fontSize: 8.5, letterSpacing: '0.22em' }}>MUNS</div>
          <div style={{ color: NW.fg0, fontFamily: NW.display, fontSize: 18, fontWeight: 700 }}>¥42K</div>
        </div>
        <div>
          <div style={{ color: NW.fg2, fontSize: 8.5, letterSpacing: '0.22em' }}>PROJ·P&amp;L</div>
          <div style={{ color: NW.green, fontFamily: NW.display, fontSize: 18, fontWeight: 700 }}>+1.9M</div>
        </div>
      </div>
    </NWPanel>
  );
}

/* ========== TACTICAL FEED (center) ========== */

function BCTacticalFeed({ op }) {
  return (
    <NWPanel title={`FOCUS · ${op.code} · ${op.unit}`} padding={0}
      accent={op.tone}
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
      right={<>
        <span style={{ color: NW.fg2, fontFamily: NW.mono, fontSize: 10 }}>DRONE·N3 · SAT·LOW</span>
        <NWChip small kbd="M">MAP</NWChip>
        <NWChip small primary kbd="F">FEED</NWChip>
      </>}
    >
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <BCTacticalMap op={op} />
      </div>
      <BCFeedStrip op={op} />
    </NWPanel>
  );
}

// ───────── procedural battle generation ─────────
// top-down zoomed-out view: ~300 combatants, vehicles, mechs, tracer streaks,
// explosion bursts, smoke plumes. Seeded so the layout is stable.
function bcRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function BCTacticalMap({ op }) {
  const battle = React.useMemo(() => {
    const rnd = bcRng(9141);
    const W = 1600, H = 900;
    // buildings — irregular urban grid, rotated some. north side = us, south = them contested, center = river+bridge.
    const buildings = [];
    const blockCols = [80, 240, 420, 620, 820, 1010, 1200, 1380];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < blockCols.length - 1; c++) {
        if (rnd() < 0.22) continue; // street gap
        if (r === 2) continue; // river row
        const x = blockCols[c] + rnd() * 20;
        const y = 60 + r * 170 + rnd() * 20;
        const w = (blockCols[c + 1] - blockCols[c]) - 30 - rnd() * 30;
        const h = 110 + rnd() * 40;
        buildings.push({ x, y, w, h,
          rubble: rnd() < 0.18,
          burning: rnd() < 0.1 && r >= 2,
        });
      }
    }

    // units: friendlies north/center pushing south, enemies south holding + counter-attacking north.
    // breakdown: ~220 infantry, ~40 power-armor, ~24 vehicles, ~10 mechs, ~6 artillery.
    const units = [];
    const push = (team, kind, n, band) => {
      for (let i = 0; i < n; i++) {
        const u = {
          id: units.length, team, kind,
          x: band.x[0] + rnd() * (band.x[1] - band.x[0]),
          y: band.y[0] + rnd() * (band.y[1] - band.y[0]),
          a: rnd() * Math.PI * 2,
          d: rnd(),
        };
        units.push(u);
      }
    };
    // friendlies — dense line south edge of north blocks, bridgehead, pushing into south
    push('us', 'inf', 120, { x: [60, 1540],  y: [400, 640] });
    push('us', 'inf', 30,  { x: [620, 1020], y: [620, 760] }); // bridgehead
    push('us', 'pow', 22,  { x: [200, 1400], y: [420, 600] });
    push('us', 'veh', 14,  { x: [120, 1480], y: [360, 520] });
    push('us', 'mech', 5,  { x: [280, 1280], y: [340, 500] });
    push('us', 'art', 3,   { x: [180, 1420], y: [40, 120] });

    // enemies — south blocks + counter-push
    push('em', 'inf', 90,  { x: [80, 1520],  y: [640, 860] });
    push('em', 'inf', 20,  { x: [520, 1100], y: [560, 680] }); // urban defenders near bridge
    push('em', 'pow', 18,  { x: [200, 1400], y: [680, 840] });
    push('em', 'veh', 10,  { x: [160, 1440], y: [740, 860] });
    push('em', 'mech', 5,  { x: [320, 1240], y: [700, 820] });
    push('em', 'art', 3,   { x: [240, 1360], y: [830, 880] });

    // tracer streaks — short arcs between opposing positions, biased toward the bridgehead.
    const tracers = [];
    for (let i = 0; i < 240; i++) {
      // pick a random friendly shooter and a nearby enemy
      const shooters = units.filter(u => u.team === 'us' && (u.kind === 'inf' || u.kind === 'pow' || u.kind === 'veh'));
      const shooter = shooters[Math.floor(rnd() * shooters.length)];
      if (!shooter) continue;
      const cand = units.filter(u => u.team === 'em' && Math.abs(u.x - shooter.x) < 260 && u.y > shooter.y);
      if (!cand.length) continue;
      const target = cand[Math.floor(rnd() * cand.length)];
      const dx = target.x - shooter.x, dy = target.y - shooter.y;
      const len = Math.hypot(dx, dy);
      if (len < 20) continue;
      const t = 0.35 + rnd() * 0.55;
      const jitter = (rnd() - 0.5) * 40;
      const perp = [-dy / len, dx / len];
      tracers.push({
        x1: shooter.x, y1: shooter.y,
        x2: shooter.x + dx * t + perp[0] * jitter,
        y2: shooter.y + dy * t + perp[1] * jitter,
        team: 'us', w: shooter.kind === 'veh' ? 2.2 : shooter.kind === 'pow' ? 1.6 : 1.0,
        o: 0.55 + rnd() * 0.4,
      });
    }
    for (let i = 0; i < 180; i++) {
      const shooters = units.filter(u => u.team === 'em' && (u.kind === 'inf' || u.kind === 'pow' || u.kind === 'veh'));
      const shooter = shooters[Math.floor(rnd() * shooters.length)];
      if (!shooter) continue;
      const cand = units.filter(u => u.team === 'us' && Math.abs(u.x - shooter.x) < 260 && u.y < shooter.y);
      if (!cand.length) continue;
      const target = cand[Math.floor(rnd() * cand.length)];
      const dx = target.x - shooter.x, dy = target.y - shooter.y;
      const len = Math.hypot(dx, dy);
      if (len < 20) continue;
      const t = 0.35 + rnd() * 0.55;
      const jitter = (rnd() - 0.5) * 40;
      const perp = [-dy / len, dx / len];
      tracers.push({
        x1: shooter.x, y1: shooter.y,
        x2: shooter.x + dx * t + perp[0] * jitter,
        y2: shooter.y + dy * t + perp[1] * jitter,
        team: 'em', w: shooter.kind === 'veh' ? 2.2 : shooter.kind === 'pow' ? 1.6 : 1.0,
        o: 0.55 + rnd() * 0.4,
      });
    }

    // explosions — radial streaks (mortars, shells landing)
    const explosions = [];
    for (let i = 0; i < 18; i++) {
      const ex = 80 + rnd() * 1440;
      const ey = 120 + rnd() * 700;
      const streaks = 14 + Math.floor(rnd() * 10);
      const rMax = 28 + rnd() * 36;
      const team = ey < 500 ? 'em' : 'us'; // who's catching it
      const out = [];
      for (let k = 0; k < streaks; k++) {
        const a = (k / streaks) * Math.PI * 2 + rnd() * 0.3;
        const r1 = 2 + rnd() * 4;
        const r2 = r1 + 14 + rnd() * (rMax - 14);
        out.push({
          x1: ex + Math.cos(a) * r1, y1: ey + Math.sin(a) * r1,
          x2: ex + Math.cos(a) * r2, y2: ey + Math.sin(a) * r2,
        });
      }
      explosions.push({ ex, ey, rMax, streaks: out, team });
    }

    // smoke plumes — from burning blocks + a few on streets
    const smokes = [];
    buildings.forEach(b => { if (b.burning) smokes.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, r: 24 + rnd() * 20 }); });
    for (let i = 0; i < 8; i++) smokes.push({ x: 100 + rnd() * 1400, y: 200 + rnd() * 600, r: 14 + rnd() * 22 });

    return { W, H, buildings, units, tracers, explosions, smokes };
  }, []);

  const { W, H, buildings, units, tracers, explosions, smokes } = battle;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <pattern id="bc-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 H 0 V 40" stroke={NW.line} strokeWidth="0.4" fill="none" opacity="0.5" />
        </pattern>
        <radialGradient id="bc-smoke">
          <stop offset="0%" stopColor="#222a3e" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#151a2c" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0a0f1e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bc-fire">
          <stop offset="0%" stopColor={NW.amber} stopOpacity="0.9" />
          <stop offset="40%" stopColor={NW.magenta} stopOpacity="0.5" />
          <stop offset="100%" stopColor={NW.magenta} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bc-muzzle-us">
          <stop offset="0%" stopColor={NW.cyan} stopOpacity="0.9" />
          <stop offset="100%" stopColor={NW.cyan} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bc-muzzle-em">
          <stop offset="0%" stopColor={NW.magenta} stopOpacity="0.9" />
          <stop offset="100%" stopColor={NW.magenta} stopOpacity="0" />
        </radialGradient>
        <filter id="bc-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect width={W} height={H} fill={NW.bg0} />
      <rect width={W} height={H} fill="url(#bc-grid)" />

      {/* river band across middle */}
      <rect x="0" y="430" width={W} height="40" fill="#0a1428" stroke={NW.cyan} strokeOpacity="0.18" strokeWidth="0.6" />
      <line x1="0" y1="442" x2={W} y2="442" stroke={NW.cyan} strokeWidth="0.5" opacity="0.25" strokeDasharray="6 8" />
      <line x1="0" y1="458" x2={W} y2="458" stroke={NW.cyan} strokeWidth="0.5" opacity="0.2" strokeDasharray="4 10" />

      {/* bridge — obvious choke point */}
      <rect x="760" y="420" width="100" height="60" fill={NW.bg2} stroke={NW.amber} strokeWidth="0.9" />
      <text x="810" y="415" fontSize="9" fontFamily={NW.mono} fill={NW.amber}
        textAnchor="middle" letterSpacing="2">BRIDGE · HOT</text>

      {/* buildings */}
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h}
            fill={b.rubble ? '#0c1020' : NW.bg2}
            stroke={b.rubble ? NW.line2 : NW.line2}
            strokeWidth="0.6" opacity={b.rubble ? 0.6 : 1}
            strokeDasharray={b.rubble ? '3 3' : ''} />
          {/* interior floor lines */}
          {!b.rubble && (
            <>
              <line x1={b.x + b.w * 0.33} y1={b.y} x2={b.x + b.w * 0.33} y2={b.y + b.h}
                stroke={NW.line} strokeWidth="0.3" opacity="0.6" />
              <line x1={b.x + b.w * 0.66} y1={b.y} x2={b.x + b.w * 0.66} y2={b.y + b.h}
                stroke={NW.line} strokeWidth="0.3" opacity="0.6" />
              <line x1={b.x} y1={b.y + b.h * 0.5} x2={b.x + b.w} y2={b.y + b.h * 0.5}
                stroke={NW.line} strokeWidth="0.3" opacity="0.6" />
            </>
          )}
        </g>
      ))}

      {/* smoke plumes — underneath combat so it reads as atmosphere */}
      {smokes.map((s, i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y} r={s.r} fill="url(#bc-smoke)" />
          <circle cx={s.x + s.r * 0.15} cy={s.y - s.r * 0.4} r={s.r * 0.75} fill="url(#bc-smoke)" opacity="0.8" />
          <circle cx={s.x - s.r * 0.3} cy={s.y - s.r * 0.7} r={s.r * 0.6} fill="url(#bc-smoke)" opacity="0.6" />
        </g>
      ))}

      {/* units */}
      <g>{units.map(u => <BCUnit key={u.id} u={u} />)}</g>

      {/* tracers — short streaking arcs, not full lines */}
      <g filter="url(#bc-glow)">
        {tracers.map((t, i) => {
          const col = t.team === 'us' ? NW.cyan : NW.magenta;
          return (
            <g key={i} opacity={t.o}>
              {/* faint trail */}
              <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                stroke={col} strokeWidth={t.w * 0.3} opacity="0.35" />
              {/* bright head streak — last 28% of the path */}
              <line
                x1={t.x1 + (t.x2 - t.x1) * 0.72}
                y1={t.y1 + (t.y2 - t.y1) * 0.72}
                x2={t.x2} y2={t.y2}
                stroke={col} strokeWidth={t.w} strokeLinecap="round" />
            </g>
          );
        })}
      </g>

      {/* muzzle flashes — small glows on friendly shooters in hot zones */}
      <g>
        {units.filter(u => u.team === 'us' && u.d > 0.6).slice(0, 40).map(u => (
          <circle key={u.id} cx={u.x} cy={u.y - 2} r="3" fill="url(#bc-muzzle-us)" />
        ))}
        {units.filter(u => u.team === 'em' && u.d > 0.55).slice(0, 30).map(u => (
          <circle key={u.id} cx={u.x} cy={u.y + 2} r="3" fill="url(#bc-muzzle-em)" />
        ))}
      </g>

      {/* explosions — radial streak bursts */}
      <g filter="url(#bc-glow)">
        {explosions.map((e, i) => (
          <g key={i}>
            {/* flash */}
            <circle cx={e.ex} cy={e.ey} r={e.rMax * 0.55} fill="url(#bc-fire)" />
            <circle cx={e.ex} cy={e.ey} r="3" fill={NW.fg0} />
            {/* streaks */}
            {e.streaks.map((s, k) => (
              <line key={k} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={NW.amber} strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />
            ))}
          </g>
        ))}
      </g>

      {/* named FLOT / forward line — thin dashed cyan */}
      <path d="M 0 490 Q 300 470 620 500 T 1000 470 T 1600 500"
        fill="none" stroke={NW.cyan} strokeWidth="0.8" strokeDasharray="4 4" opacity="0.55" />

      {/* axis of advance arrow — bridgehead push */}
      <g stroke={NW.cyan} strokeWidth="2" strokeDasharray="6 5" fill="none" opacity="0.8">
        <path d="M 810 360 L 810 700" markerEnd="url(#bc-arr)" />
      </g>
      <defs>
        <marker id="bc-arr" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={NW.cyan} />
        </marker>
      </defs>

      {/* key callouts */}
      <g>
        <BCCallout x={810} y={330} color={NW.cyan} label="SB-04 · BRIDGEHEAD" sub="HOLST · 6/6" />
        <BCCallout x={220} y={340} color={NW.cyan} label="IRONCLAD·1 · MECH LANCE" sub="3 WALKERS · LEFT FLANK" />
        <BCCallout x={1380} y={340} color={NW.cyan} label="CASEMATE · IFV COLUMN" sub="6 IFV · RIGHT FLANK" />
        <BCCallout x={400} y={800} color={NW.magenta} label="DAIGO · 3RD SEC" sub="~110 HOSTILE" flip />
        <BCCallout x={1260} y={800} color={NW.magenta} label="DAIGO · WALKER DET" sub="5 WALKERS" flip />
      </g>

      {/* frame HUD */}
      <g>
        <text x="24" y="28" fontSize="11" fontFamily={NW.mono} fill={NW.fg2} letterSpacing="3">
          TOHO FLATS · BRIDGE-4 CROSSING · GRID 487-221
        </text>
        <text x={W - 24} y="28" fontSize="11" fontFamily={NW.mono} fill={NW.magenta}
          textAnchor="end" letterSpacing="3">● CONTACT · T+00:41:22</text>
        <text x="24" y={H - 16} fontSize="10" fontFamily={NW.mono} fill={NW.fg2} letterSpacing="3">
          ◈ 188 US · ▼ 146 EM · +6 WIA · DRONE N3 · SAT LOW
        </text>
        <g transform={`translate(${W - 160} ${H - 28})`}>
          <line x1="0" y1="0" x2="140" y2="0" stroke={NW.fg1} strokeWidth="0.8" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke={NW.fg1} />
          <line x1="140" y1="-3" x2="140" y2="3" stroke={NW.fg1} />
          <text x="70" y="14" fontSize="10" fontFamily={NW.mono} fill={NW.fg1} textAnchor="middle">250M</text>
        </g>
      </g>
    </svg>
  );
}

function BCUnit({ u }) {
  const col = u.team === 'us' ? NW.cyan : NW.magenta;
  switch (u.kind) {
    case 'inf':
      return <circle cx={u.x} cy={u.y} r="1.8" fill={col} />;
    case 'pow':
      return (
        <g transform={`translate(${u.x} ${u.y})`}>
          <path d="M -2.5 -2.5 L 2.5 -2.5 L 2.5 2.5 L -2.5 2.5 Z"
            fill={col} stroke={NW.bg0} strokeWidth="0.4" />
        </g>
      );
    case 'veh':
      return (
        <g transform={`translate(${u.x} ${u.y}) rotate(${(u.a * 180 / Math.PI) | 0})`}>
          <rect x="-5" y="-3" width="10" height="6" fill={col} stroke={NW.bg0} strokeWidth="0.5" />
          <rect x="-2" y="-1.5" width="7" height="3" fill={NW.bg0} stroke={col} strokeWidth="0.4" />
        </g>
      );
    case 'mech':
      return (
        <g transform={`translate(${u.x} ${u.y})`}>
          <path d="M 0 -8 L 6 -2 L 6 4 L 3 8 L -3 8 L -6 4 L -6 -2 Z"
            fill="none" stroke={col} strokeWidth="1.2" />
          <circle r="1.8" fill={col} />
          <line x1="-6" y1="-2" x2="-10" y2="0" stroke={col} strokeWidth="1.2" />
          <line x1="6" y1="-2" x2="10" y2="0" stroke={col} strokeWidth="1.2" />
        </g>
      );
    case 'art':
      return (
        <g transform={`translate(${u.x} ${u.y})`}>
          <rect x="-5" y="-4" width="10" height="8" fill="none" stroke={col} strokeWidth="0.8" />
          <line x1="0" y1="-4" x2="0" y2="-12" stroke={col} strokeWidth="1.4" />
          <circle r="1.4" fill={col} />
        </g>
      );
    default:
      return <circle cx={u.x} cy={u.y} r="1.6" fill={col} />;
  }
}

function BCCallout({ x, y, color, label, sub, flip }) {
  const dir = flip ? 1 : -1;
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* ring */}
      <circle r="16" fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
      <circle r="4" fill={color} opacity="0.5" />
      {/* tick line */}
      <line x1="0" y1={dir * 16} x2="0" y2={dir * 36} stroke={color} strokeWidth="0.8" />
      <line x1="0" y1={dir * 36} x2="60" y2={dir * 36} stroke={color} strokeWidth="0.8" />
      <text x="66" y={dir * 36 + 3} fontSize="10" fontFamily={NW.mono}
        fill={color} letterSpacing="1.4" fontWeight="700">{label}</text>
      <text x="66" y={dir * 36 + 15} fontSize="9" fontFamily={NW.mono}
        fill={NW.fg2} letterSpacing="1">{sub}</text>
    </g>
  );
}

function BCFeedStrip({ op }) {
  return (
    <div style={{ borderTop: `1px solid ${NW.line}`, padding: '8px 14px',
      background: NW.bg0, display: 'flex', gap: 16, alignItems: 'center',
      fontFamily: NW.mono, fontSize: 10 }}>
      <span style={{ color: NW.fg2, letterSpacing: '0.24em' }}>◆ RECENT</span>
      {op.lines.slice(-3).map((l, i) => (
        <span key={i} style={{ display: 'flex', gap: 8, color: NW.fg1 }}>
          <span style={{ color: NW.fg2 }}>{l[0]}</span>
          <span style={{ color: NW.cyan }}>{l[1]}</span>
          <span>{l[2]}</span>
        </span>
      ))}
    </div>
  );
}

/* ========== COMMS LOG (right top) ========== */

function BCCommsLog() {
  return (
    <NWPanel title="BN COMMS · ALL CHANNELS" accent="cyan" padding={0}
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
      right={<><NWChip small primary>ALL</NWChip><NWChip small>BRAVO</NWChip><NWChip small>ALPHA</NWChip></>}>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 0' }}>
        {BC.comms.map((m, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 68px 1fr',
            padding: '5px 12px', gap: 8, alignItems: 'baseline',
            borderTop: i > 0 ? `1px dashed ${NW.line}` : 'none',
            fontFamily: NW.mono, fontSize: 10.5, letterSpacing: '0.04em' }}>
            <span style={{ color: NW.fg2, fontSize: 9.5, fontVariantNumeric: 'tabular-nums' }}>{m.t}</span>
            <span style={{ color: m.c, fontWeight: 600 }}>{m.u}</span>
            <span style={{ color: NW.fg1 }}>{m.x}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '6px 12px', borderTop: `1px solid ${NW.line}`,
        background: NW.bg0, display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>
        <span style={{ color: NW.cyan }}>▸</span>
        <span style={{ flex: 1, color: NW.fg2 }}>TX · type to transmit · [TAB] to switch chan</span>
        <span style={{ color: NW.fgDim }}>|</span>
      </div>
    </NWPanel>
  );
}

/* ========== DECISIONS QUEUE (right bottom) ========== */

function BCDecisionQueue() {
  return (
    <NWPanel title="DECISIONS PENDING" accent="amber" padding={0}
      right={<span style={{ color: NW.amber, fontFamily: NW.mono, fontSize: 10 }}>3</span>}>
      {BC.decisions.map((d, i) => (
        <div key={i} style={{
          padding: '10px 12px',
          borderTop: i > 0 ? `1px solid ${NW.line}` : 'none',
          background: d.hot ? 'rgba(255,45,154,0.06)' : 'transparent',
          borderLeft: `2px solid ${d.hot ? NW.magenta : NW.amber}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2,
              letterSpacing: '0.22em' }}>{d.code}</span>
            <span style={{ fontFamily: NW.display, fontSize: 12, fontWeight: 700,
              color: d.hot ? NW.magenta : NW.fg0, letterSpacing: '0.08em' }}>{d.from}</span>
            {d.hot && <span style={{ fontFamily: NW.mono, fontSize: 9, color: NW.magenta,
              letterSpacing: '0.2em' }}>◆ HOT</span>}
          </div>
          <div style={{ fontFamily: NW.mono, fontSize: 10.5, color: NW.fg1,
            marginTop: 4, letterSpacing: '0.04em', lineHeight: 1.4 }}>{d.ask}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {d.opts.map((opt, j) => (
              <NWChip key={j} small primary={j === 0 && d.hot} danger={opt === 'DENY'}>{opt}</NWChip>
            ))}
          </div>
        </div>
      ))}
    </NWPanel>
  );
}

/* ========== FOOTER ========== */

function BCFooter() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 18px', background: NW.bg1, borderTop: `1px solid ${NW.line2}`,
    }}>
      <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.24em' }}>
        ◆ COMMANDER · {BC.bn}
      </span>
      <span style={{ flex: 1 }} />
      <NWChip kbd="O">ORBAT</NWChip>
      <NWChip kbd="T">THEATER</NWChip>
      <NWChip kbd="C">COMMS</NWChip>
      <NWChip kbd="H">HOLD ALL</NWChip>
      <NWChip primary kbd="↵" style={{ padding: '10px 22px', fontSize: 12 }}>ISSUE BN ORDER ▸</NWChip>
    </div>
  );
}

Object.assign(window, { NeonwireCommand });
