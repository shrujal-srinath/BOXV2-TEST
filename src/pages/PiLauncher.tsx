// src/pages/PiLauncher.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BG      = '#080808';
const SURFACE = '#111111';
const SURF2   = '#181818';
const BDR     = '#2A2A2A';
const BDR_HI  = '#444444';
const RED     = '#DC2626';
const RED_DIM = 'rgba(220,38,38,0.10)';
const TXT     = '#F0F0F0';
const TXT_DIM = '#888888';
const TXT_MUT = '#444444';
const GREEN   = '#22C55E';
const BLUE    = '#3B82F6';
const RM      = "'JetBrains Mono', monospace";
const OSW     = "'Oswald', sans-serif";
const SG      = "'Space Grotesk', sans-serif";

const STYLE_CSS = `
@keyframes livePulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
@keyframes pulsePip  { 0%,100%{opacity:1}   50%{opacity:0.3} }
`;

const PiLauncher: React.FC = () => {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<'start' | 'watch' | null>(null);
  const [hoveredBtn,  setHoveredBtn]  = useState<'start' | 'watch' | null>(null);
  const [hovNav,      setHovNav]      = useState<string | null>(null);

  const rootStyle: React.CSSProperties = {
    width: '100vw', height: '100vh', background: BG,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden', userSelect: 'none', fontFamily: SG,
  };

  const headerStyle: React.CSSProperties = {
    flexShrink: 0, height: 32, background: BG,
    borderBottom: `1px solid ${BDR}`,
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '0 24px',
  };

  const mainStyle: React.CSSProperties = {
    flex: 1, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: 32,
  };

  const cardsGridStyle: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 24, width: '100%', maxWidth: 900,
  };

  const startCardStyle: React.CSSProperties = {
    background: hoveredCard === 'start' ? RED_DIM : SURF2,
    border: hoveredCard === 'start' ? `2px solid ${RED}` : `1px solid ${BDR}`,
    padding: 36, display: 'flex', flexDirection: 'column',
    alignItems: 'flex-start', minHeight: 260,
    cursor: 'pointer', position: 'relative', overflow: 'hidden',
    transition: 'border-color 0.12s, background 0.12s',
  };

  const watchCardStyle: React.CSSProperties = {
    background: hoveredCard === 'watch' ? RED_DIM : SURF2,
    border: hoveredCard === 'watch' ? `2px solid ${RED}` : `1px solid ${BDR}`,
    padding: 36, display: 'flex', flexDirection: 'column',
    alignItems: 'flex-start', minHeight: 260,
    cursor: 'pointer', position: 'relative', overflow: 'hidden',
    transition: 'border-color 0.12s, background 0.12s',
  };

  const footerStyle: React.CSSProperties = {
    flexShrink: 0, height: 40, background: BG,
    borderTop: `1px solid ${BDR}`,
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '0 24px',
  };

  return (
    <>
      <style>{STYLE_CSS}</style>
      <div style={rootStyle}>

        {/* ── HEADER ── */}
        <header style={headerStyle}>
          <span style={{ fontFamily: OSW, fontWeight: 700, fontStyle: 'italic', fontSize: 20, letterSpacing: '0.03em', color: TXT, textTransform: 'uppercase' }}>
            THE BOX
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {[
              { label: 'RPI4', color: BLUE, status: 'OK'   },
              { label: 'PICO', color: BLUE, status: 'RDY'  },
              { label: 'ESP32', color: BDR, status: 'WAIT' },
            ].map(({ label, color, status }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                border: `1px solid ${BDR}`, background: BG, padding: '2px 8px',
              }}>
                <div style={{ width: 7, height: 7, background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: SG, fontSize: 8, color: status === 'WAIT' ? TXT_MUT : TXT_DIM, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}: {status}</span>
              </div>
            ))}
            <span style={{ fontFamily: SG, fontSize: 9, color: TXT_MUT, letterSpacing: '0.1em', textTransform: 'uppercase', marginLeft: 4 }}>V. 3.0_FIELD</span>
          </div>
        </header>

        {/* ── MAIN ── */}
        <main style={mainStyle}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontFamily: RM, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', color: TXT_DIM, textTransform: 'uppercase', marginBottom: 14 }}>OPERATION SELECT</div>
            <h1 style={{ fontFamily: OSW, fontWeight: 700, fontStyle: 'italic', fontSize: 'clamp(40px, 6vw, 60px)' as unknown as number, letterSpacing: '0.02em', textTransform: 'uppercase', color: TXT, margin: '0 0 14px 0' }}>DIGITAL ARENA</h1>
            <p style={{ fontFamily: RM, fontSize: 11, color: TXT_DIM, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.6, maxWidth: 640, textAlign: 'center', margin: 0 }}>
              SELECT OPERATIONAL MODE. CONFIGURE MATCH SETTINGS, CONTROL HARDWARE PARAMETERS, OR INITIALIZE REAL-TIME SPECTATOR FEEDS.
            </p>
          </div>

          <div style={cardsGridStyle}>

            {/* START GAME */}
            <div style={startCardStyle} onClick={() => navigate('/referee')} onMouseEnter={() => setHoveredCard('start')} onMouseLeave={() => setHoveredCard(null)}>
              {hoveredCard === 'start' && <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: RED, pointerEvents: 'none' }} />}
              <div style={{ width: 64, height: 64, border: `2px solid ${RED}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <div style={{ width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderLeft: `20px solid ${RED}`, marginLeft: 4 }} />
              </div>
              <h2 style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 28, letterSpacing: '0.05em', textTransform: 'uppercase', color: TXT, margin: '0 0 12px 0' }}>START GAME</h2>
              <p style={{ fontFamily: RM, fontSize: 11, color: TXT_DIM, lineHeight: 1.6, margin: 0, flex: 1 }}>
                Primary operator console. Configure match parameters, initialize hardware systems, and control live gameplay state.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${BDR}`, width: '100%' }}>
                <span style={{ fontFamily: RM, fontSize: 10, fontWeight: 700, color: TXT, textTransform: 'uppercase', letterSpacing: '0.15em' }}>INITIALIZE CONSOLE →</span>
              </div>
            </div>

            {/* WATCH GAME */}
            <div style={watchCardStyle} onClick={() => navigate('/pi-receiver')} onMouseEnter={() => setHoveredCard('watch')} onMouseLeave={() => setHoveredCard(null)}>
              {hoveredCard === 'watch' && <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: RED, pointerEvents: 'none' }} />}
              {/* Live badge */}
              <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${BDR}`, padding: '3px 10px', background: BG }}>
                <div style={{ width: 7, height: 7, background: RED, animation: 'livePulse 2s ease-in-out infinite' }} />
                <span style={{ fontFamily: RM, fontSize: 10, fontWeight: 700, color: TXT_DIM, textTransform: 'uppercase', letterSpacing: '0.1em' }}>LIVE FEED</span>
              </div>
              <div style={{ width: 64, height: 64, border: `2px solid ${RED}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, color: RED }}>
                <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
                  <ellipse cx="14" cy="10" rx="13" ry="9" stroke="currentColor" strokeWidth="2" />
                  <circle cx="14" cy="10" r="4" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <h2 style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 28, letterSpacing: '0.05em', textTransform: 'uppercase', color: TXT, margin: '0 0 12px 0' }}>WATCH GAME</h2>
              <p style={{ fontFamily: RM, fontSize: 11, color: TXT_DIM, lineHeight: 1.6, margin: 0, flex: 1 }}>
                Spectator dashboard. View real-time scoreboards, active clock data, and live match analytics.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${BDR}`, width: '100%' }}>
                <span style={{ fontFamily: RM, fontSize: 10, fontWeight: 700, color: TXT, textTransform: 'uppercase', letterSpacing: '0.15em' }}>ENTER SPECTATOR VIEW →</span>
              </div>
            </div>

          </div>
        </main>

        {/* ── FOOTER ── */}
        <footer style={footerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, background: GREEN, animation: 'pulsePip 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: RM, fontSize: 10, fontWeight: 700, color: TXT, letterSpacing: '0.2em', textTransform: 'uppercase' }}>SYSTEM READY</span>
            </div>
            <div style={{ width: 1, height: 14, background: BDR }} />
            <span style={{ fontFamily: RM, fontSize: 10, color: TXT_DIM, letterSpacing: '0.15em', textTransform: 'uppercase' }}>UPLINK: SECURE</span>
          </div>
          <span style={{ fontFamily: RM, fontSize: 10, color: TXT_DIM, letterSpacing: '0.15em', textTransform: 'uppercase' }}>V. 3.0_FIELD</span>
        </footer>

      </div>
    </>
  );
};

export default PiLauncher;
