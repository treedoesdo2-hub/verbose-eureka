// dir-b-neonwire-armory.jsx — NEON WIRE armory / mechlab

function NeonwireArmory() {
  return (
    <NWFrame>
      <NWSystemBar path="/ARMORY/OPERATOR/HOLST·K"
        right={<><span style={{ color: NW.green }}>● SYNC</span>
          <span style={{ color: NW.fgDim, margin: '0 10px' }}>║</span>
          <span style={{ color: NW.fg1 }}>DEPOT · OSAKA-1</span></>} />

      <NWArmoryTop />
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 360px',
        height: 'calc(100% - 32px - 88px - 70px)', padding: 12, gap: 12 }}>
        <NWStockpile />
        <NWPaperdollEditor />
        <NWZoneInspector />
      </div>
      <NWArmoryBottom />
    </NWFrame>
  );
}

function NWArmoryTop() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr 340px',
      height: 88, borderBottom: `1px solid ${NW.line}`, background: NW.bg1, position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px',
        borderRight: `1px solid ${NW.line}` }}>
        <div style={{ width: 54, height: 58, position: 'relative' }}>
          <svg viewBox="0 0 54 58"><path d="M 27 2 L 50 14 L 50 42 L 27 56 L 4 42 L 4 14 Z"
            fill={NW.cyanSoft} stroke={NW.cyan} strokeWidth="1.2" /><circle cx="27" cy="22" r="6" fill={NW.cyan} /><path d="M 12 46 Q 27 34 42 46" fill={NW.cyan} /></svg>
        </div>
        <div>
          <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.cyan, letterSpacing: '0.2em' }}>◆ OPERATOR · SGT</div>
          <div style={{ fontFamily: NW.display, fontSize: 24, color: NW.fg0, fontWeight: 700, letterSpacing: '0.04em' }}>"HOLST"</div>
          <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>K. HOLST · ID 00418 · BRAVO · POS 01</div>
        </div>
      </div>
      <div style={{ padding: '14px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: NW.mono,
          fontSize: 9, letterSpacing: '0.18em', color: NW.fg2, marginBottom: 6 }}>
          <span>◆ COMBAT LOAD</span>
          <span><span style={{ fontFamily: NW.display, fontSize: 16, color: NW.cyan, fontWeight: 700 }}>28.4</span>
            <span style={{ color: NW.fg2 }}> / 32.0 KG · 88%</span></span>
        </div>
        <div style={{ height: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 2, padding: 1, background: NW.line2 }}>
          {[['ARMOR', 0.95], ['WEAPON', 0.88], ['ORDNC', 0.72], ['MED·CMM', 0.42]].map(([l, p]) => (
            <div key={l} style={{ position: 'relative', background: NW.bg2 }}>
              <div style={{ position: 'absolute', inset: 0, width: `${p * 100}%`, background: NW.cyan, opacity: 0.85 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontFamily: NW.mono, fontSize: 9, color: NW.bg0,
                letterSpacing: '0.14em', fontWeight: 700, mixBlendMode: 'screen' }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 18, fontFamily: NW.mono, fontSize: 10,
          color: NW.fg2, letterSpacing: '0.1em', marginTop: 4 }}>
          <span>AR 9.8</span><span>WP 7.1</span><span>OR 6.8</span><span>MC 2.1</span><span>MS 2.6</span>
          <span style={{ flex: 1 }} />
          <span>STAM −12%</span>
          <span style={{ color: NW.magenta }}>MOVE −8%</span>
        </div>
      </div>
      <div style={{ borderLeft: `1px solid ${NW.line}`, padding: 14 }}>
        <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.cyan, letterSpacing: '0.18em', marginBottom: 6 }}>◆ TEMPLATE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {['URBAN·AR','DMR·OW','BREACH','CQB·HVY','CSTM·03'].map((t, i) => (
            <div key={t} style={{ padding: '4px 9px',
              clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
              background: i === 0 ? NW.cyanSoft : NW.bg2,
              boxShadow: `inset 0 0 0 1px ${i === 0 ? NW.cyan : NW.line2}`,
              fontFamily: NW.mono, fontSize: 10, letterSpacing: '0.1em',
              color: i === 0 ? NW.cyan : NW.fg1 }}>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NWStockpile() {
  const cats = [['WEAPONS',34,1],['OPTICS',18],['MUZZLE',8],['GRIPS·RAILS',12],['ARMOR·PLATES',22],['HELMETS·COMMS',9],['POUCHES·MAGS',16],['ORDNANCE',14],['MED·UTILITY',11]];
  const items = [
    { code: 'HK-416', type: '5.56 CARBINE', kg: 3.2, tier: 'T2', dmg: 32, equip: true },
    { code: 'MK-18',  type: '5.56 CARBINE', kg: 2.9, tier: 'T2', dmg: 30 },
    { code: 'SCAR-H', type: '7.62 BATTLE',  kg: 3.8, tier: 'T3', dmg: 44 },
    { code: 'MCX·SPR',type: '6.5 DMR',      kg: 3.4, tier: 'T3', dmg: 52 },
    { code: 'RPK-16', type: '5.45 LMG',     kg: 5.1, tier: 'T2', dmg: 28 },
    { code: 'MP7·A2', type: '4.6 PDW',      kg: 1.9, tier: 'T1', dmg: 22 },
    { code: 'M870',   type: '12GA BRE',     kg: 2.8, tier: 'T2', dmg: 60 },
  ];
  return (
    <NWPanel title="STOCKPILE · OSAKA-1" padding={0} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 0' }}>
        {cats.map(([n, c, a]) => (
          <div key={n} style={{ display: 'flex', padding: '5px 14px', fontFamily: NW.mono, fontSize: 11,
            letterSpacing: '0.08em', borderLeft: `2px solid ${a ? NW.cyan : 'transparent'}`,
            background: a ? NW.cyanSoft : 'transparent', color: a ? NW.cyan : NW.fg1 }}>
            <span style={{ flex: 1 }}>{n}</span>
            <span style={{ color: NW.fg2, fontVariantNumeric: 'tabular-nums' }}>{c}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${NW.line}`, padding: 10 }}>
        <div style={{ fontFamily: NW.mono, fontSize: 10, padding: '4px 8px', color: NW.fg2,
          boxShadow: `inset 0 0 0 1px ${NW.line2}` }}>
          <span style={{ color: NW.cyan }}>▸</span> 5.56__
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', borderTop: `1px solid ${NW.line}` }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto',
            padding: '9px 14px', borderBottom: `1px solid ${NW.line}`,
            background: it.equip ? NW.cyanSoft : 'transparent',
            borderLeft: `2px solid ${it.equip ? NW.cyan : 'transparent'}` }}>
            <div>
              <div style={{ fontFamily: NW.display, fontSize: 13, fontWeight: 700,
                color: it.equip ? NW.cyan : NW.fg0, letterSpacing: '0.04em' }}>
                {it.code}
                {it.equip && <span style={{ fontFamily: NW.mono, color: NW.cyan, fontSize: 9, marginLeft: 6 }}>◆ EQUIP</span>}
              </div>
              <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>{it.type}</div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: NW.mono, fontSize: 10 }}>
              <div style={{ color: NW.fg1 }}>{it.kg.toFixed(1)} KG</div>
              <div style={{ color: NW.amber, letterSpacing: '0.1em' }}>{it.tier} · D{it.dmg}</div>
            </div>
          </div>
        ))}
      </div>
    </NWPanel>
  );
}

// Hit-zone paperdoll zones (matching the combat view silhouette),
// repurposed to show ARMOR coverage instead of HP state.
// tone: 'full' (hard plate, cyan), 'soft' (soft armor/pad, cyan dim), 'empty' (dashed)
const NWA_KIT = [
  { id: 'head',  d: 'M 70 10 a 16 18 0 1 0 0.1 0 Z',             tag: 'HLM-04',     kg: 1.1, dr: 4, tone: 'full'  },
  { id: 'neck',  d: 'M 60 46 L 80 46 L 80 54 L 60 54 Z',          tag: 'COLLAR',     kg: 0.2, dr: 1, tone: 'soft'  },
  { id: 'chest', d: 'M 46 54 L 94 54 L 96 96 L 44 96 Z',          tag: 'CPC·M3-L4',  kg: 5.8, dr: 6, tone: 'full', sel: true },
  { id: 'abd',   d: 'M 48 96 L 92 96 L 90 124 L 50 124 Z',        tag: 'SIDE-PLATE', kg: 1.4, dr: 3, tone: 'full'  },
  { id: 'lsh',   d: 'M 30 56 L 46 54 L 48 80 L 32 82 Z',          tag: 'SOFT',       kg: 0.3, dr: 1, tone: 'soft'  },
  { id: 'rsh',   d: 'M 94 54 L 110 56 L 108 82 L 92 80 Z',        tag: 'SOFT',       kg: 0.3, dr: 1, tone: 'soft'  },
  { id: 'larm',  d: 'M 32 82 L 48 80 L 48 116 L 30 118 Z',        tag: 'PAD',        kg: 0.2, dr: 0.5, tone: 'soft' },
  { id: 'rarm',  d: 'M 92 80 L 108 82 L 110 118 L 92 116 Z',      tag: 'PAD',        kg: 0.2, dr: 0.5, tone: 'soft' },
  { id: 'lhand', d: 'M 28 118 L 48 116 L 48 134 L 28 134 Z',      tag: 'GLOVE',      kg: 0.1, dr: 0, tone: 'soft'  },
  { id: 'rhand', d: 'M 92 116 L 112 118 L 112 134 L 92 134 Z',    tag: 'GLOVE',      kg: 0.1, dr: 0, tone: 'soft'  },
  { id: 'lleg',  d: 'M 50 124 L 68 124 L 66 180 L 48 180 Z',      tag: 'KNEE-PAD',   kg: 0.3, dr: 1, tone: 'soft'  },
  { id: 'rleg',  d: 'M 72 124 L 90 124 L 92 180 L 74 180 Z',      tag: 'NONE',       kg: 0,   dr: 0, tone: 'empty' },
  { id: 'lft',   d: 'M 48 180 L 68 180 L 66 200 L 46 200 Z',      tag: 'BOOT·M2',    kg: 0.6, dr: 0.5, tone: 'full' },
  { id: 'rft',   d: 'M 72 180 L 92 180 L 94 200 L 74 200 Z',      tag: 'BOOT·M2',    kg: 0.6, dr: 0.5, tone: 'full' },
];

function NWPaperdollEditor() {
  return (
    <NWPanel title="KIT · HIT ZONES" padding={0} style={{ position: 'relative', overflow: 'hidden' }}
      right={<>{['FRONT','REAR','SIDE'].map((v, i) =>
        <NWChip key={v} small primary={i === 0}>{v}</NWChip>
      )}</>}>
      <svg viewBox="-40 -20 220 255" preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <pattern id="nwa-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 H 0 V 8" stroke={NW.line} strokeWidth="0.2" fill="none" opacity="0.7" />
          </pattern>
        </defs>
        <rect x="-40" y="-20" width="220" height="255" fill="url(#nwa-grid)" />

        {/* center axis + horizon line, schematic chart style */}
        <line x1="70" y1="-10" x2="70" y2="220" stroke={NW.cyan} strokeWidth="0.3" strokeDasharray="2 3" opacity="0.35" />
        <line x1="-30" y1="100" x2="170" y2="100" stroke={NW.cyan} strokeWidth="0.3" strokeDasharray="2 3" opacity="0.2" />

        {/* zone polygons */}
        {NWA_KIT.map(z => <NWHitZone key={z.id} z={z} />)}

        {/* chest callout to preview card */}
        <path d="M 96 75 L 140 60 L 160 60" stroke={NW.cyan} strokeWidth="0.5" strokeDasharray="2 2" fill="none" />

        {/* level / anatomical tick marks, medical-chart flavor */}
        {[ ['HEAD', 22], ['CHEST', 75], ['ABD', 110], ['HIP', 128], ['KNEE', 160], ['FOOT', 192] ].map(([lbl, y]) => (
          <g key={lbl}>
            <line x1="-28" y1={y} x2="-20" y2={y} stroke={NW.fg2} strokeWidth="0.3" />
            <text x="-32" y={y + 2} fill={NW.fg2} fontSize="4.2" fontFamily={NW.mono}
              letterSpacing="0.8" textAnchor="end">{lbl}</text>
          </g>
        ))}
      </svg>

      <div style={{ position: 'absolute', right: 20, top: 90, width: 240,
        clipPath: HEX_CLIP_TL_BR, background: 'rgba(6,9,20,0.96)',
        boxShadow: `inset 0 0 0 1px ${NW.amber}, 0 0 10px rgba(255,160,32,0.35)`, padding: 12 }}>
        <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.amber, letterSpacing: '0.18em', marginBottom: 4 }}>◆ PREVIEW · SCAR-H</div>
        <div style={{ fontFamily: NW.display, fontSize: 14, color: NW.fg0, fontWeight: 700 }}>IF EQUIPPED</div>
        <div style={{ height: 1, background: NW.line, margin: '6px 0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px', fontFamily: NW.mono, fontSize: 10.5 }}>
          <span style={{ color: NW.fg2 }}>WEIGHT</span><span style={{ color: NW.magenta }}>+0.6 KG</span>
          <span style={{ color: NW.fg2 }}>DMG</span><span style={{ color: NW.green }}>+12 (32→44)</span>
          <span style={{ color: NW.fg2 }}>RANGE</span><span style={{ color: NW.green }}>+80M</span>
          <span style={{ color: NW.fg2 }}>RECOIL</span><span style={{ color: NW.magenta }}>+18%</span>
          <span style={{ color: NW.fg2 }}>MOVE</span><span style={{ color: NW.magenta }}>−3%</span>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 20, bottom: 16, display: 'flex', gap: 18,
        fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.12em' }}>
        <span><span style={{ color: NW.cyan }}>■</span> FULL</span>
        <span><span style={{ color: NW.cyan, opacity: 0.5 }}>■</span> PARTIAL</span>
        <span><span style={{ color: NW.line2 }}>■</span> EMPTY</span>
        <span><span style={{ color: NW.amber }}>◆</span> HOVER</span>
      </div>
    </NWPanel>
  );
}

function NWHitZone({ z }) {
  const tone = z.tone;
  const fill  = tone === 'full'  ? 'rgba(24,224,255,0.22)'
              : tone === 'soft'  ? 'rgba(24,224,255,0.09)'
              :                    'rgba(24,224,255,0.02)';
  const stroke = z.sel ? NW.amber
                : tone === 'empty' ? NW.line2
                : tone === 'soft'  ? `${NW.cyan}aa`
                :                    NW.cyan;
  const sw = z.sel ? 1.4 : tone === 'empty' ? 0.5 : 0.8;
  const dash = tone === 'empty' ? '2 2' : '';
  // compute an approximate centroid from the path's first two moveTo coords for labeling.
  // we use a small lookup keyed by zone id to place text cleanly.
  const POS = {
    head:  [70, 22],  neck: [70, 50],  chest: [70, 75], abd: [70, 110],
    lsh:   [39, 68],  rsh:  [101, 68], larm:  [40, 98], rarm: [100, 98],
    lhand: [38, 126], rhand: [102, 126],
    lleg:  [59, 150], rleg:  [81, 150],
    lft:   [57, 190], rft:   [83, 190],
  };
  const [tx, ty] = POS[z.id] || [70, 100];
  const labelColor = tone === 'empty' ? NW.fg2 : z.sel ? NW.amber : NW.cyan;
  return (
    <g>
      <path d={z.d} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
      {tone !== 'empty' && (
        <text x={tx} y={ty} fill={labelColor} fontSize="3.4" fontFamily={NW.mono}
          textAnchor="middle" letterSpacing="0.5" fontWeight="700">{z.tag}</text>
      )}
      {tone !== 'empty' && (
        <text x={tx} y={ty + 5} fill={NW.fg2} fontSize="2.8" fontFamily={NW.mono}
          textAnchor="middle" letterSpacing="0.4">{z.kg}KG · DR{z.dr}</text>
      )}
      {tone === 'empty' && (
        <text x={tx} y={ty} fill={NW.fg2} fontSize="3" fontFamily={NW.mono}
          textAnchor="middle" letterSpacing="0.6" opacity="0.6">NONE</text>
      )}
      {z.sel && (
        <path d={z.d} fill="none" stroke={NW.amber} strokeWidth="0.4"
          strokeDasharray="1 1" opacity="0.8" />
      )}
    </g>
  );
}

function NWZoneInspector() {
  return (
    <NWPanel title="INSPECTOR · ZONE 03" accent="amber" padding={0} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${NW.line}` }}>
        <div style={{ fontFamily: NW.display, fontSize: 22, color: NW.fg0, fontWeight: 700, letterSpacing: '0.04em' }}>TORSO · PLATE</div>
        <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>CAPACITY · 8.0 KG · USED 5.8</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.cyan, letterSpacing: '0.18em', marginBottom: 8 }}>◆ EQUIPPED</div>
        {[
          ['CPC·M3','CHEST RIG',1.4,1.0,'T2'],
          ['L4 PLATE · FRONT','CERAMIC · NIJ IV',2.2,3.0,'T3',true],
          ['L4 PLATE · REAR','CERAMIC · NIJ IV',2.2,3.0,'T3'],
          ['SIDE SAPI L','STEEL · NIJ III',0.9,1.0,'T2'],
          ['SIDE SAPI R','STEEL · NIJ III',0.9,1.0,'T2'],
        ].map(([code,type,kg,dr,tier,p], i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 10px',
            clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
            background: p ? NW.cyanSoft : NW.bg2, boxShadow: `inset 0 0 0 1px ${p ? NW.cyan : NW.line2}`,
            marginBottom: 4 }}>
            <div>
              <div style={{ fontFamily: NW.display, fontSize: 12, fontWeight: 700, color: p ? NW.cyan : NW.fg0, letterSpacing: '0.04em' }}>{code}</div>
              <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>{type}</div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: NW.mono, fontSize: 10 }}>
              <div style={{ color: NW.fg1 }}>{kg} KG</div>
              <div style={{ color: NW.amber }}>{tier} · DR+{dr}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 6, padding: '8px 0', textAlign: 'center',
          fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.14em',
          boxShadow: `inset 0 0 0 1px ${NW.line2}`, borderRadius: 0,
          backgroundImage: `repeating-linear-gradient(90deg, ${NW.line} 0 4px, transparent 4px 8px)`,
          backgroundSize: '100% 1px', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
          + DRAG HERE · 2 SLOTS FREE
        </div>
      </div>
      <div style={{ padding: 14, borderTop: `1px solid ${NW.line}` }}>
        <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.cyan, letterSpacing: '0.18em', marginBottom: 10 }}>◆ ZONE STATS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
          {[['DMG RES','+6',0.85,NW.cyan],['PEN RES','+4',0.6,NW.cyan],['FIRE','+2',0.3,NW.amber],['EMP','+1',0.15,NW.cyan]].map(([l,v,b,c]) => (
            <div key={l}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>
                <span>{l}</span><span style={{ color: c, fontWeight: 700 }}>{v}</span>
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{ height: 3, background: NW.bg3 }}><div style={{ width: `${b * 100}%`, height: '100%', background: c, boxShadow: `0 0 6px ${c}80` }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: 14, borderTop: `1px solid ${NW.line}`, flex: 1, overflow: 'hidden' }}>
        <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.cyan, letterSpacing: '0.18em', marginBottom: 8 }}>◆ DAMAGE LOG</div>
        {[['OP-CLEARWATER','7.62 PEN','PLATE · SPALL'],['OP-LATHE','FRAG×3','SOFT · COSMETIC'],['OP-YARD','5.45×2','PLATE · HELD']].map(([a,b,c], i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 70px 1fr',
            padding: '6px 0', borderBottom: `1px solid ${NW.line}`, fontFamily: NW.mono, fontSize: 10 }}>
            <span style={{ color: NW.cyan }}>{a}</span>
            <span style={{ color: NW.fg1 }}>{b}</span>
            <span style={{ color: NW.fg2 }}>{c}</span>
          </div>
        ))}
      </div>
    </NWPanel>
  );
}

function NWArmoryBottom() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', height: 70,
      borderTop: `1px solid ${NW.line}`, background: NW.bg1, padding: '0 20px', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 26 }}>
        {[['MOVE','5.4 M/S','−0.3','r'],['SPRINT','7.8 M/S','−0.5','r'],['STAM','0.42/S','+0.06','r'],['CMP DR','4.6','+1.0','g'],['EFF RNG','320M','+80','g'],['RCL','72%','−8','r'],['MAG','30','±0','n']].map(([l,v,d,t]) => (
          <div key={l}>
            <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2, letterSpacing: '0.18em' }}>{l}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: NW.display, fontSize: 15, color: NW.fg0, fontWeight: 700 }}>{v}</span>
              <span style={{ fontFamily: NW.mono, fontSize: 10, color: t === 'r' ? NW.magenta : t === 'g' ? NW.green : NW.fg2 }}>{d}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <NWChip small>RESET</NWChip>
        <NWChip small>COPY · SQUAD</NWChip>
        <NWChip small>SAVE TEMPL</NWChip>
        <NWChip primary>✓ CONFIRM LOADOUT</NWChip>
      </div>
    </div>
  );
}

Object.assign(window, { NeonwireArmory });
