// THE BOX — Court Hex Map Operator Console
// Shot location capture tool for referees / analysts.

import React, { useState, useEffect, useCallback } from 'react';
import { CourtHexMap, ZONE_META, zoneAccent } from '../components/shotchart/CourtHexMap';
import type { HoverInfo, HexShotEvent, CourtTweaks, CourtTheme } from '../components/shotchart/CourtHexMap';

// ── LED / status pill ────────────────────────────────────────────────────────

function Led({ color = 'green' }: { color?: string }) {
  const col = color === 'red' ? '#EF4444' : '#22C55E';
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: col, boxShadow: `0 0 8px ${col}`,
      animation: 'ledPulse 2s ease-in-out infinite',
      flexShrink: 0,
    }} />
  );
}

// ── HUD readout ──────────────────────────────────────────────────────────────

function HUD({ hover, pendingShotType, setPendingShotType }: {
  hover: HoverInfo | null;
  pendingShotType: string;
  setPendingShotType: (t: string) => void;
}) {
  const zoneInfo = hover ? ZONE_META[hover.zone] : null;
  const ptsClass = zoneInfo?.pts === 3 ? 'p3' : 'p2';
  const showSubPicker = hover && (hover.zone === 'at_rim' || hover.zone === 'restricted');
  const SHOT_TYPES = (hover && hover.zone === 'at_rim')
    ? ['DUNK', 'TIP', 'PUTBACK']
    : ['LAYUP', 'FLOAT', 'TIP', 'PUTBACK'];

  const distM = hover?.dist.meters.toFixed(2) ?? '—.——';
  const distFt = hover?.dist.feet.toFixed(1) ?? '—.—';
  const cx = hover ? hover.cell.x.toFixed(1) : '——.—';
  const cy = hover ? hover.cell.y.toFixed(1) : '——.—';

  return (
    <div style={{
      background: 'linear-gradient(180deg,#050505,#000)', border: '1px solid #2a2a2a',
      borderRadius: 6, padding: '14px 16px', marginBottom: 14,
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8),inset 0 -1px 0 rgba(255,255,255,0.05)',
      display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 0, minHeight: 86,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg,rgba(34,197,94,0.04) 0 1px,transparent 1px 3px)', pointerEvents: 'none' }} />
      {[
        { label: 'Zone', value: zoneInfo ? zoneInfo.label : '— STANDBY —', style: { fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 16, letterSpacing:'0.04em', textTransform:'uppercase' as const } },
        { label: 'Dist · Rim', value: distM, unit: 'M' },
        { label: 'Dist · FT', value: distFt, unit: 'FT' },
        { label: 'Coord X / Y', value: `${cx}`, unit: `/ ${cy}`, small: true },
      ].map((cell, i) => (
        <div key={i} style={{ padding: '0 16px', borderLeft: i === 0 ? 0 : '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 900, fontSize: 9, letterSpacing:'0.3em', textTransform:'uppercase', color: '#666', marginBottom: 6 }}>{cell.label}</div>
          <div style={{ ...(cell.style || { fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: cell.small ? 14 : 22, lineHeight: 1, color: hover ? '#fff' : '#3F3F46', textShadow: hover ? '0 0 10px rgba(255,255,255,0.18)' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFeatureSettings: '"tnum"' }) }}>
            {cell.value}{cell.unit && <span style={{ fontSize: 11, color: '#71717A', marginLeft: 4, letterSpacing:'0.1em' }}>{cell.unit}</span>}
          </div>
        </div>
      ))}
      <div style={{ padding: '0 16px', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection:'column', justifyContent:'center' }}>
        <div style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 900, fontSize: 9, letterSpacing:'0.3em', textTransform:'uppercase', color: '#666', marginBottom: 6 }}>{showSubPicker ? 'Shot Type' : 'Point Value'}</div>
        {showSubPicker ? (
          <div style={{ display: 'inline-flex', background: '#050505', border: '1px solid #2a2a2a', borderRadius: 3, padding: 2, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)' }}>
            {SHOT_TYPES.map(t => (
              <button key={t} onClick={() => setPendingShotType(t)} style={{
                appearance: 'none', border: 0, borderRadius: 2,
                background: pendingShotType === t ? 'linear-gradient(180deg,#2a1a05,#150c02)' : 'transparent',
                color: pendingShotType === t ? '#FCD34D' : '#71717A',
                fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 9, letterSpacing:'0.18em',
                padding: '5px 9px', cursor: 'pointer',
                boxShadow: pendingShotType === t ? 'inset 0 1px 0 rgba(255,255,255,0.08),0 0 8px rgba(245,158,11,0.3)' : 'none',
              }}>{t}</button>
            ))}
          </div>
        ) : zoneInfo ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 3,
            fontFamily: "'Barlow',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing:'0.18em',
            ...(ptsClass === 'p3'
              ? { background: 'rgba(59,130,246,0.15)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.4)', boxShadow: '0 0 10px rgba(59,130,246,0.2)' }
              : { background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.35)' })
          }}>
            {zoneInfo.pts} PT{zoneInfo.short ? ` · ${zoneInfo.short}` : ''}
          </span>
        ) : (
          <span style={{ color: '#3F3F46', fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>—</span>
        )}
      </div>
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────────

function Stats({ shots }: { shots: HexShotEvent[] }) {
  const fga = shots.length;
  const fgm = shots.filter(s => s.made).length;
  const pts = shots.filter(s => s.made).reduce((a, s) => a + s.points, 0);
  const pct = fga ? Math.round((fgm / fga) * 100) : 0;
  const pctColor = pct >= 50 ? '#22C55E' : pct >= 35 ? '#F59E0B' : fga ? '#EF4444' : '#fff';
  const stats = [
    { label: 'FGM/FGA', value: `${fgm}/${fga}`, color: '#fff' },
    { label: 'FG %', value: `${pct}%`, color: pctColor },
    { label: 'PTS', value: String(pts), color: '#22C55E' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: '#050505', padding: '10px 8px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 900, fontSize: 8, letterSpacing:'0.25em', textTransform:'uppercase', color: '#666', marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 18, color: s.color, textShadow: s.color === '#22C55E' ? '0 0 6px rgba(34,197,94,0.4)' : 'none' }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Shot log ─────────────────────────────────────────────────────────────────

function ShotLog({ shots, onUndo, onClear }: { shots: HexShotEvent[]; onUndo: () => void; onClear: () => void }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#161616,#0a0a0a)', border: '2px solid #2a2a2a', borderRadius: 8, padding: 16, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1),inset 0 -1px 0 rgba(0,0,0,0.5),0 2px 8px rgba(0,0,0,0.5)' }}>
      <h3 style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 12, letterSpacing:'0.22em', textTransform:'uppercase', color: '#a1a1aa', margin: '0 0 12px', paddingBottom: 8, borderBottom: '1px solid #1a1a1a', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 6px #F59E0B', flexShrink: 0, display:'inline-block' }} />
        Shot Log
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: 10 }}>{shots.length}</span>
      </h3>
      <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight: 280, overflowY:'auto' }}>
        {shots.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 8px', color: '#3F3F46', fontFamily:"'Barlow',sans-serif", fontWeight:700, fontSize:10, letterSpacing:'0.25em', textTransform:'uppercase' }}>— NO SHOTS LOGGED —</div>
        ) : (
          [...shots].reverse().map((s, i) => {
            const meta = ZONE_META[s.zone];
            return (
              <div key={s.id} style={{ display:'grid', gridTemplateColumns:'24px 1fr auto auto', gap:8, alignItems:'center', padding:'8px 10px', background:'#050505', border:'1px solid #1a1a1a', borderRadius:3, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, fontSize:11 }}>
                <span style={{ color:'#666', fontSize:9, letterSpacing:'0.15em' }}>#{String(shots.length - i).padStart(2, '0')}</span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:"'Barlow',sans-serif", fontWeight:700, fontSize:10, letterSpacing:'0.15em', textTransform:'uppercase', color:'#a1a1aa' }}>
                  {s.playerNum ? <span style={{ color:'#F59E0B' }}>P{s.playerNum} · </span> : null}
                  {meta?.short || '??'}{s.shotType ? ` · ${s.shotType}` : ''} · {meta?.label || s.zone}
                </span>
                <span style={{ color:'#71717A', fontSize:10 }}>{s.distM.toFixed(1)}m</span>
                <span style={{ fontSize:9, padding:'2px 6px', borderRadius:2, ...(meta?.pts === 3 ? { background:'rgba(59,130,246,0.18)', color:'#93C5FD' } : { background:'rgba(245,158,11,0.15)', color:'#FCD34D' }) }}>
                  {s.made ? `+${meta?.pts || 2}` : '0'}
                </span>
              </div>
            );
          })
        )}
      </div>
      <div style={{ display:'flex', gap:6, marginTop:10 }}>
        {[
          { label: 'Undo Last', onClick: onUndo, disabled: !shots.length, danger: false },
          { label: 'Clear All', onClick: onClear, disabled: !shots.length, danger: true },
        ].map(btn => (
          <button key={btn.label} onClick={btn.onClick} disabled={btn.disabled} style={{
            flex: 1, appearance:'none', border: `1px solid ${btn.danger ? 'rgba(239,68,68,0.4)' : '#2a2a2a'}`,
            background: 'linear-gradient(180deg,#1a1a1a,#0a0a0a)',
            color: btn.disabled ? '#3F3F46' : btn.danger ? '#F87171' : '#a1a1aa',
            padding:'9px 12px', fontFamily:"'Barlow',sans-serif", fontWeight:800,
            fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase',
            borderRadius:3, cursor: btn.disabled ? 'not-allowed' : 'pointer',
            boxShadow:'0 2px 0 #050505',
          }}>{btn.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { label: 'Made', sw: { background: '#22C55E', boxShadow: '0 0 6px #22C55E' } },
    { label: 'Missed', sw: { border: '1.5px solid #EF4444' } },
    { label: '2PT Zone', sw: { background: 'rgba(245,158,11,0.5)' } },
    { label: '3PT Zone', sw: { background: 'rgba(59,130,246,0.5)' } },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontFamily:"'Barlow',sans-serif", fontSize:10, color:'#71717A', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:700 }}>
      {items.map(it => (
        <div key={it.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:14, height:14, borderRadius:2, flexShrink:0, display:'inline-block', ...it.sw }} />
          {it.label}
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const DEFAULTS: CourtTweaks = {
  hexRadius: 1.9,
  tintByZone: true,
  theme: 'dark',
  fullCourt: false,
  showZoneHL: true,
  showLineToRim: false,
};

export default function CourtHexMapPage() {
  const [tweaks, setTweaks] = useState<CourtTweaks>(DEFAULTS);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [shots, setShots] = useState<HexShotEvent[]>([]);
  const [mode, setMode] = useState<'made' | 'miss'>('made');
  const [jersey, setJersey] = useState('');
  const [pendingShotType, setPendingShotType] = useState('LAYUP');

  const setTweak = <K extends keyof CourtTweaks>(key: K, val: CourtTweaks[K]) => {
    setTweaks(prev => ({ ...prev, [key]: val }));
  };

  useEffect(() => {
    if (!hover) return;
    if (hover.zone === 'at_rim' && !['DUNK','TIP','PUTBACK'].includes(pendingShotType)) setPendingShotType('DUNK');
    else if (hover.zone === 'restricted' && pendingShotType === 'DUNK') setPendingShotType('LAYUP');
  }, [hover?.zone]);

  const setShotsWithType = useCallback((updater: React.SetStateAction<HexShotEvent[]>) => {
    setShots(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next.length > prev.length) {
        const last = next[next.length - 1];
        if (last && (last.zone === 'at_rim' || last.zone === 'restricted')) {
          return [...next.slice(0, -1), { ...last, shotType: pendingShotType }];
        }
      }
      return next;
    });
  }, [pendingShotType]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'm') setMode('made');
      else if (k === 'x') setMode('miss');
      else if (k === 'u') setShots(p => p.slice(0, -1));
      else if (k === 'c') setShots([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const courtTitle = tweaks.fullCourt ? 'Full Court · FIBA' : 'Half Court · FIBA';
  const courtDims  = tweaks.fullCourt ? '15.0m × 28.2m' : '15.0m × 14.1m';

  const segBtnStyle = (active: boolean, variant: 'default' | 'made' | 'miss' = 'default'): React.CSSProperties => ({
    appearance: 'none', border: 0, borderRadius: 3, padding: '6px 14px',
    fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing:'0.22em', textTransform:'uppercase',
    cursor: 'pointer',
    ...(active ? (
      variant === 'made' ? { background: 'linear-gradient(180deg,#16361F,#0A1F12)', color: '#4ADE80', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08),0 0 12px rgba(34,197,94,0.25)' }
        : variant === 'miss' ? { background: 'linear-gradient(180deg,#3B1414,#1A0808)', color: '#F87171', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08),0 0 12px rgba(239,68,68,0.25)' }
        : { background: 'linear-gradient(180deg,#1A2030,#0A1018)', color: '#93C5FD', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06),0 0 8px rgba(59,130,246,0.20)' }
    ) : { background: 'transparent', color: '#71717A' }),
  });

  const pillBtn = (active: boolean): React.CSSProperties => ({
    appearance: 'none', background: active ? 'linear-gradient(180deg,#16361F,#0A1F12)' : '#0A0A0A',
    border: `1px solid ${active ? 'rgba(34,197,94,0.4)' : '#1a1a1a'}`,
    color: active ? '#4ADE80' : '#a1a1aa',
    fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 9, letterSpacing:'0.16em',
    padding: '5px 10px', borderRadius: 3, cursor: 'pointer',
    boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.06),0 0 8px rgba(34,197,94,0.18)' : 'none',
  });

  return (
    <div style={{ minHeight: '100vh', padding: '28px 32px 40px', background: 'radial-gradient(ellipse at 50% 0%,#1A0707 0%,#000 70%)', color: '#fff', fontFamily: "'Barlow',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700;900&family=JetBrains+Mono:wght@700&family=Barlow:wght@700;800;900&family=Barlow+Condensed:wght@700;800&display=swap');
        @keyframes ledPulse { 0%,100% { opacity:1 } 50% { opacity:0.55 } }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* Brand strip */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:24, paddingBottom:20, borderBottom:'1px solid #1a1a1a', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:36, height:36, border:'2px solid #DC2626', background:'linear-gradient(135deg,#1a1a1a,#0a0a0a)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.1),inset 0 -1px 0 rgba(0,0,0,0.5),0 2px 8px rgba(0,0,0,0.5),0 0 14px rgba(220,38,38,0.35)', display:'grid', placeItems:'center', color:'#DC2626', fontFamily:"'Oswald',sans-serif", fontWeight:900, fontStyle:'italic', fontSize:18, letterSpacing:'-0.04em' }}>B</div>
          <div>
            <div style={{ fontFamily:"'Oswald',sans-serif", fontWeight:900, fontStyle:'italic', fontSize:22, letterSpacing:'-0.04em', color:'#fff' }}>THE <span style={{ color:'#DC2626' }}>BOX</span></div>
            <div style={{ fontFamily:"'Barlow',sans-serif", fontWeight:800, fontSize:9, letterSpacing:'0.3em', color:'#666', textTransform:'uppercase', marginTop:1 }}>BMSCE • Department of Sports</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:18 }}>
          {['Operator Console', 'Court Feed Live'].map(label => (
            <div key={label} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 12px', background:'linear-gradient(135deg,#0a0a0a,#050505)', border:'1px solid #2a2a2a', borderRadius:100, fontFamily:"'Barlow',sans-serif", fontWeight:800, fontSize:10, letterSpacing:'0.2em', textTransform:'uppercase', color:'#71717A' }}>
              <Led />{label}
            </div>
          ))}
        </div>
      </div>

      {/* Page header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:"'Oswald',sans-serif", fontWeight:900, fontStyle:'italic', fontSize:40, letterSpacing:'-0.02em', textTransform:'uppercase', margin:'0 0 6px', background:'linear-gradient(180deg,#fff 30%,#999 100%)', WebkitBackgroundClip:'text', backgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          Shot Location Capture
        </h1>
        <div style={{ fontFamily:"'Barlow',sans-serif", fontWeight:700, fontSize:11, letterSpacing:'0.25em', color:'#666', textTransform:'uppercase' }}>
          Hex Court Map &nbsp;//&nbsp; <span style={{ color:'#F59E0B' }}>Hover</span> to read distance &amp; zone &nbsp;//&nbsp; <span style={{ color:'#F59E0B' }}>Click</span> to log shot
        </div>
      </div>

      {/* Console grid */}
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 320px', gap:28, alignItems:'start' }}>

        {/* Court panel */}
        <div style={{ background:'linear-gradient(135deg,#161616,#0a0a0a)', border:'2px solid #2a2a2a', borderRadius:8, padding:18, boxShadow:'inset 0 1px 0 rgba(255,255,255,0.1),inset 0 -1px 0 rgba(0,0,0,0.5),0 2px 8px rgba(0,0,0,0.5)' }}>

          {/* Toolbar */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Led />
              <span style={{ fontFamily:"'Oswald',sans-serif", fontWeight:700, fontSize:13, letterSpacing:'0.2em', textTransform:'uppercase', color:'#a1a1aa' }}>
                {courtTitle} <span style={{ color:'#71717A', marginLeft:8 }}>{courtDims}</span>
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {/* Jersey # */}
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#050505', border:'1px solid #2a2a2a', borderRadius:4, padding:'4px 6px 4px 10px', boxShadow:'inset 0 2px 8px rgba(0,0,0,0.8)' }}>
                <span style={{ fontFamily:"'Barlow',sans-serif", fontWeight:900, fontSize:9, letterSpacing:'0.25em', textTransform:'uppercase', color:'#666' }}>#</span>
                <input
                  type="text" inputMode="numeric" placeholder="--"
                  value={jersey}
                  onChange={e => setJersey(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                  style={{ width:44, appearance:'none', background:'#000', border:'1px solid #1a1a1a', borderRadius:2, color:'#F59E0B', fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:14, textAlign:'center', padding:'4px 2px', textShadow:'0 0 6px rgba(245,158,11,0.5)', outline:'none' }}
                />
              </div>
              {/* Made / Miss toggle */}
              <div style={{ display:'inline-flex', background:'#050505', border:'1px solid #2a2a2a', borderRadius:4, padding:2, boxShadow:'inset 0 2px 8px rgba(0,0,0,0.8)' }}>
                <button style={segBtnStyle(mode === 'made', 'made')} onClick={() => setMode('made')}>● Made</button>
                <button style={segBtnStyle(mode === 'miss', 'miss')} onClick={() => setMode('miss')}>✕ Miss</button>
              </div>
            </div>
          </div>

          <HUD hover={hover} pendingShotType={pendingShotType} setPendingShotType={setPendingShotType} />

          {/* Inline control bar */}
          <div style={{ background:'linear-gradient(180deg,#0A0A0A,#050505)', border:'1px solid #2a2a2a', borderRadius:6, padding:'10px 12px', marginBottom:14, boxShadow:'inset 0 2px 8px rgba(0,0,0,0.8)', display:'flex', flexWrap:'wrap', alignItems:'center', gap:'10px 18px' }}>

            {/* Theme */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:"'Barlow',sans-serif", fontWeight:900, fontSize:9, letterSpacing:'0.18em', color:'#71717A', textTransform:'uppercase' }}>Theme</span>
              <div style={{ display:'inline-flex', background:'#050505', border:'1px solid #2a2a2a', borderRadius:4, padding:2, boxShadow:'inset 0 2px 8px rgba(0,0,0,0.8)' }}>
                {(['wooden', 'white', 'dark'] as CourtTheme[]).map(t => (
                  <button key={t} style={{ ...segBtnStyle(tweaks.theme === t), padding:'4px 10px', fontSize:9, letterSpacing:'0.14em' }} onClick={() => setTweak('theme', t)}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Court */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:"'Barlow',sans-serif", fontWeight:900, fontSize:9, letterSpacing:'0.18em', color:'#71717A', textTransform:'uppercase' }}>Court</span>
              <div style={{ display:'inline-flex', background:'#050505', border:'1px solid #2a2a2a', borderRadius:4, padding:2, boxShadow:'inset 0 2px 8px rgba(0,0,0,0.8)' }}>
                <button style={{ ...segBtnStyle(!tweaks.fullCourt), padding:'4px 10px', fontSize:9 }} onClick={() => setTweak('fullCourt', false)}>HALF</button>
                <button style={{ ...segBtnStyle(tweaks.fullCourt), padding:'4px 10px', fontSize:9 }} onClick={() => setTweak('fullCourt', true)}>FULL</button>
              </div>
            </div>

            {/* Zones */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:"'Barlow',sans-serif", fontWeight:900, fontSize:9, letterSpacing:'0.18em', color:'#71717A', textTransform:'uppercase' }}>Zones</span>
              <button style={pillBtn(tweaks.showZoneHL !== false)} onClick={() => setTweak('showZoneHL', !(tweaks.showZoneHL !== false))}>
                {tweaks.showZoneHL !== false ? '● SHOW' : '○ HIDE'}
              </button>
            </div>

            {/* Heat */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:"'Barlow',sans-serif", fontWeight:900, fontSize:9, letterSpacing:'0.18em', color:'#71717A', textTransform:'uppercase' }}>Heat</span>
              <button style={pillBtn(tweaks.tintByZone)} onClick={() => setTweak('tintByZone', !tweaks.tintByZone)}>
                {tweaks.tintByZone ? '● ON' : '○ OFF'}
              </button>
            </div>

            {/* Hex size */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, flex:'1 1 220px' }}>
              <span style={{ fontFamily:"'Barlow',sans-serif", fontWeight:900, fontSize:9, letterSpacing:'0.18em', color:'#71717A', textTransform:'uppercase', whiteSpace:'nowrap' }}>Hex Size</span>
              <input
                type="range" min="0.6" max="2.4" step="0.1"
                value={tweaks.hexRadius}
                onChange={e => setTweak('hexRadius', parseFloat(e.target.value))}
                style={{ flex:1, height:4, minWidth:100, background:'#050505', border:'1px solid #1a1a1a', borderRadius:2, outline:0, appearance:'none', WebkitAppearance:'none' }}
              />
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:11, color:'#a1a1aa', minWidth:36, textAlign:'right' }}>
                {(tweaks.hexRadius * 0.15 * 100).toFixed(0)}cm
              </span>
            </div>

            {/* Line to rim */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:"'Barlow',sans-serif", fontWeight:900, fontSize:9, letterSpacing:'0.18em', color:'#71717A', textTransform:'uppercase' }}>Line</span>
              <button style={pillBtn(tweaks.showLineToRim)} onClick={() => setTweak('showLineToRim', !tweaks.showLineToRim)}>
                {tweaks.showLineToRim ? '● ON' : '○ OFF'}
              </button>
            </div>
          </div>

          {/* Court frame */}
          <div style={{ background:'#000', border:'1px solid #2a2a2a', borderRadius:4, padding:8, boxShadow:'inset 0 2px 8px rgba(0,0,0,0.8),0 0 24px rgba(0,0,0,0.6)', position:'relative' }}>
            {/* Corner accents */}
            {[
              { top:-3, left:-3, borderRight:0, borderBottom:0 },
              { top:-3, right:-3, borderLeft:0, borderBottom:0 },
              { bottom:-3, left:-3, borderRight:0, borderTop:0 },
              { bottom:-3, right:-3, borderLeft:0, borderTop:0 },
            ].map((s, i) => (
              <span key={i} style={{ position:'absolute', width:10, height:10, border:'1px solid #666', pointerEvents:'none', ...s }} />
            ))}
            <div style={{ aspectRatio: tweaks.fullCourt ? '100/188' : '100/94', width:'100%', overflow:'hidden', borderRadius:2 }}>
              <CourtHexMap
                tweaks={tweaks}
                onHoverChange={setHover}
                shots={shots}
                setShots={setShotsWithType}
                mode={mode}
                jersey={jersey}
              />
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div style={{ background:'linear-gradient(135deg,#161616,#0a0a0a)', border:'2px solid #2a2a2a', borderRadius:8, padding:16, boxShadow:'inset 0 1px 0 rgba(255,255,255,0.1),inset 0 -1px 0 rgba(0,0,0,0.5),0 2px 8px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontFamily:"'Oswald',sans-serif", fontWeight:700, fontSize:12, letterSpacing:'0.22em', textTransform:'uppercase', color:'#a1a1aa', margin:'0 0 12px', paddingBottom:8, borderBottom:'1px solid #1a1a1a', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#F59E0B', boxShadow:'0 0 6px #F59E0B', flexShrink:0, display:'inline-block' }} />
              Session Stats
            </h3>
            <Stats shots={shots} />
            <Legend />
          </div>
          <ShotLog shots={shots} onUndo={() => setShots(p => p.slice(0, -1))} onClear={() => setShots([])} />
        </div>
      </div>

      {/* Keyboard hint */}
      <div style={{ marginTop:18, textAlign:'center', fontFamily:"'Barlow',sans-serif", fontWeight:700, fontSize:10, letterSpacing:'0.25em', textTransform:'uppercase', color:'#666' }}>
        {[['Hover', 'any hex to inspect'], ['Click', 'to log'], ['M', 'made'], ['X', 'miss'], ['U', 'undo'], ['C', 'clear']].map(([key, desc]) => (
          <span key={key} style={{ marginRight: 16 }}>
            <kbd style={{ background:'linear-gradient(180deg,#1a1a1a,#0a0a0a)', border:'1px solid #2a2a2a', borderRadius:3, padding:'2px 6px', margin:'0 4px', color:'#a1a1aa', fontFamily:"'JetBrains Mono',monospace", fontSize:9, boxShadow:'0 1px 0 #000' }}>{key}</kbd>
            {desc}
          </span>
        ))}
      </div>
    </div>
  );
}
