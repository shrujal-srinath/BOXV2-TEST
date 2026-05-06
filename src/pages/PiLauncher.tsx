// src/pages/PiLauncher.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BG            = '#080808';
const SURFACE       = '#121212';
const RED           = '#dc2626';
const WHITE         = '#ffffff';
const MUTED         = '#888888';
const BORDER        = 'rgba(255,255,255,0.15)';
const BORDER_BRIGHT = '#ffffff';

const SG  = "'Space Grotesk', sans-serif";
const JBM = "'JetBrains Mono', monospace";

const PULSE_CSS = `
@keyframes livePulse {
  0%, 100% { opacity: 0.5 }
  50%       { opacity: 1   }
}
`;

const PiLauncher: React.FC = () => {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<'start' | 'watch' | null>(null);
  const [hoveredBtn,  setHoveredBtn]  = useState<'start' | 'watch' | null>(null);

  // ── ROOT ──────────────────────────────────────────────────────────────
  const rootStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    background: BG,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    userSelect: 'none',
    fontFamily: SG,
  };

  // ── HEADER ────────────────────────────────────────────────────────────
  const headerStyle: React.CSSProperties = {
    flexShrink: 0,
    height: 80,
    background: BG,
    borderBottom: `2px solid ${BORDER_BRIGHT}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
  };

  const wordmarkStyle: React.CSSProperties = {
    fontFamily: SG,
    fontWeight: 900,
    fontStyle: 'italic',
    fontSize: 28,
    letterSpacing: '-0.05em',
    color: WHITE,
    textTransform: 'uppercase',
  };

  const navLinksStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: 80,
  };

  const makeNavLinkStyle = (hov: boolean): React.CSSProperties => ({
    fontFamily: SG,
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: hov ? WHITE : MUTED,
    height: 80,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    borderBottom: `4px solid ${hov ? WHITE : 'transparent'}`,
    cursor: 'default',
  });

  const headerRightStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const chipsRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    marginRight: 16,
  };

  const chipStyle: React.CSSProperties = {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    padding: '4px 8px',
    fontFamily: JBM,
    fontSize: 11,
    color: WHITE,
  };

  const makeStartBtnStyle = (): React.CSSProperties => ({
    background: hoveredBtn === 'start' ? WHITE : RED,
    color: hoveredBtn === 'start' ? '#000' : WHITE,
    border: `2px solid ${hoveredBtn === 'start' ? WHITE : RED}`,
    padding: '8px 24px',
    fontFamily: SG,
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  });

  const makeWatchBtnStyle = (): React.CSSProperties => ({
    background: hoveredBtn === 'watch' ? WHITE : 'transparent',
    color: hoveredBtn === 'watch' ? '#000' : WHITE,
    border: `2px solid ${BORDER_BRIGHT}`,
    padding: '8px 24px',
    fontFamily: SG,
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  });

  // ── MAIN ──────────────────────────────────────────────────────────────
  const mainStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 0,
  };

  const topTextStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: 64,
  };

  const opLabelStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 12px',
    fontFamily: JBM,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.25em',
    color: WHITE,
    textTransform: 'uppercase',
    marginBottom: 24,
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: SG,
    fontWeight: 700,
    fontSize: 'clamp(40px, 6vw, 60px)',
    letterSpacing: '-0.02em',
    textTransform: 'uppercase',
    color: WHITE,
    marginBottom: 24,
    margin: '0 0 24px 0',
  };

  const subParaStyle: React.CSSProperties = {
    fontFamily: JBM,
    fontSize: 12,
    color: MUTED,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    lineHeight: 1.6,
    maxWidth: 640,
    textAlign: 'center',
    margin: 0,
  };

  const cardsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 32,
    width: '100%',
    maxWidth: 900,
  };

  // ── START CARD ────────────────────────────────────────────────────────
  const startCardStyle: React.CSSProperties = {
    background: hoveredCard === 'start' ? RED : SURFACE,
    border: `2px solid ${RED}`,
    padding: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 280,
    cursor: 'pointer',
    position: 'relative',
  };

  const startIconBoxStyle: React.CSSProperties = {
    width: 64,
    height: 64,
    border: `2px solid ${hoveredCard === 'start' ? WHITE : RED}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  };

  const startTriangleStyle: React.CSSProperties = {
    width: 0,
    height: 0,
    borderTop: '12px solid transparent',
    borderBottom: '12px solid transparent',
    borderLeft: `20px solid ${hoveredCard === 'start' ? WHITE : RED}`,
    marginLeft: 4,
  };

  const startHeadingStyle: React.CSSProperties = {
    fontFamily: SG,
    fontWeight: 700,
    fontSize: 28,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: WHITE,
    marginBottom: 16,
    margin: '0 0 16px 0',
  };

  const startBodyStyle: React.CSSProperties = {
    fontFamily: JBM,
    fontSize: 12,
    color: hoveredCard === 'start' ? 'rgba(255,255,255,0.9)' : MUTED,
    lineHeight: 1.6,
    margin: 0,
  };

  const startBottomStyle: React.CSSProperties = {
    marginTop: 'auto',
    paddingTop: 24,
    borderTop: '1px solid rgba(255,255,255,0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  };

  const startCtaTextStyle: React.CSSProperties = {
    fontFamily: JBM,
    fontSize: 11,
    fontWeight: 700,
    color: WHITE,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
  };

  const startArrowStyle: React.CSSProperties = {
    color: hoveredCard === 'start' ? WHITE : RED,
    fontSize: 16,
  };

  // ── WATCH CARD ────────────────────────────────────────────────────────
  const watchCardStyle: React.CSSProperties = {
    background: hoveredCard === 'watch' ? WHITE : SURFACE,
    border: `2px solid ${RED}`,
    padding: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 280,
    cursor: 'pointer',
    position: 'relative',
  };

  const watchIconBoxStyle: React.CSSProperties = {
    width: 64,
    height: 64,
    border: `2px solid ${hoveredCard === 'watch' ? '#000' : RED}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    color: hoveredCard === 'watch' ? '#000' : WHITE,
  };

  const watchBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: 24,
    right: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: `1px solid ${hoveredCard === 'watch' ? 'rgba(0,0,0,0.3)' : BORDER}`,
    padding: '4px 12px',
  };

  const livePipStyle: React.CSSProperties = {
    width: 8,
    height: 8,
    background: RED,
    animation: 'livePulse 2s ease-in-out infinite',
  };

  const liveFeedTextStyle: React.CSSProperties = {
    fontFamily: JBM,
    fontSize: 11,
    fontWeight: 700,
    color: hoveredCard === 'watch' ? '#000' : WHITE,
    textTransform: 'uppercase',
  };

  const watchHeadingStyle: React.CSSProperties = {
    fontFamily: SG,
    fontWeight: 700,
    fontSize: 28,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: hoveredCard === 'watch' ? '#000' : WHITE,
    margin: '0 0 16px 0',
  };

  const watchBodyStyle: React.CSSProperties = {
    fontFamily: JBM,
    fontSize: 12,
    color: hoveredCard === 'watch' ? 'rgba(0,0,0,0.7)' : MUTED,
    lineHeight: 1.6,
    margin: 0,
  };

  const watchBottomStyle: React.CSSProperties = {
    marginTop: 'auto',
    paddingTop: 24,
    borderTop: `1px solid ${hoveredCard === 'watch' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)'}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  };

  const watchCtaTextStyle: React.CSSProperties = {
    fontFamily: JBM,
    fontSize: 11,
    fontWeight: 700,
    color: hoveredCard === 'watch' ? '#000' : WHITE,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
  };

  const watchArrowStyle: React.CSSProperties = {
    color: hoveredCard === 'watch' ? '#000' : RED,
    fontSize: 16,
  };

  // ── FOOTER ────────────────────────────────────────────────────────────
  const footerStyle: React.CSSProperties = {
    flexShrink: 0,
    height: 48,
    background: SURFACE,
    borderTop: `2px solid ${BORDER_BRIGHT}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
  };

  const footerLeftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  };

  const sysReadyStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const greenSquareStyle: React.CSSProperties = {
    width: 12,
    height: 12,
    background: '#00ff00',
  };

  const sysReadyTextStyle: React.CSSProperties = {
    fontFamily: JBM,
    fontSize: 11,
    fontWeight: 700,
    color: WHITE,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
  };

  const sepStyle: React.CSSProperties = {
    width: 1,
    height: 16,
    background: BORDER,
    margin: '0 4px',
  };

  const uplinkStyle: React.CSSProperties = {
    fontFamily: JBM,
    fontSize: 11,
    color: MUTED,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
  };

  const versionStyle: React.CSSProperties = {
    fontFamily: JBM,
    fontSize: 11,
    color: MUTED,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
  };

  // ── NAV LINK STATE ────────────────────────────────────────────────────
  const [hovNav, setHovNav] = useState<string | null>(null);

  return (
    <>
      <style>{PULSE_CSS}</style>
      <div style={rootStyle}>

        {/* ── HEADER ── */}
        <header style={headerStyle}>
          <span style={wordmarkStyle}>THE BOX</span>

          <nav style={navLinksStyle}>
            {(['DASHBOARD', 'ANALYTICS', 'TEAM MANAGEMENT'] as const).map(label => (
              <span
                key={label}
                style={makeNavLinkStyle(hovNav === label)}
                onMouseEnter={() => setHovNav(label)}
                onMouseLeave={() => setHovNav(null)}
              >
                {label}
              </span>
            ))}
          </nav>

          <div style={headerRightStyle}>
            <div style={chipsRowStyle}>
              {(['RPI4_OK', 'PICO_OK', 'ESP32_OK'] as const).map(chip => (
                <span key={chip} style={chipStyle}>{chip}</span>
              ))}
            </div>

            <button
              style={makeStartBtnStyle()}
              onMouseEnter={() => setHoveredBtn('start')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => navigate('/referee')}
            >
              START GAME
            </button>

            <button
              style={makeWatchBtnStyle()}
              onMouseEnter={() => setHoveredBtn('watch')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => navigate('/pi-receiver')}
            >
              WATCH GAME
            </button>
          </div>
        </header>

        {/* ── MAIN ── */}
        <main style={mainStyle}>
          <div style={topTextStyle}>
            <div style={opLabelStyle}>OPERATION SELECT</div>
            <h1 style={headingStyle}>DIGITAL ARENA</h1>
            <p style={subParaStyle}>
              SELECT OPERATIONAL MODE. CONFIGURE MATCH SETTINGS, CONTROL
              HARDWARE PARAMETERS, OR INITIALIZE REAL-TIME SPECTATOR FEEDS.
            </p>
          </div>

          <div style={cardsGridStyle}>

            {/* START GAME card */}
            <div
              style={startCardStyle}
              onClick={() => navigate('/referee')}
              onMouseEnter={() => setHoveredCard('start')}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={startIconBoxStyle}>
                <div style={startTriangleStyle} />
              </div>

              <h2 style={startHeadingStyle}>START GAME</h2>

              <p style={startBodyStyle}>
                Primary operator console. Configure match parameters,
                initialize hardware systems, and control live gameplay state.
              </p>

              <div style={startBottomStyle}>
                <span style={startCtaTextStyle}>INITIALIZE CONSOLE</span>
                <span style={startArrowStyle}>→</span>
              </div>
            </div>

            {/* WATCH GAME card */}
            <div
              style={watchCardStyle}
              onClick={() => navigate('/pi-receiver')}
              onMouseEnter={() => setHoveredCard('watch')}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Live badge */}
              <div style={watchBadgeStyle}>
                <div style={livePipStyle} />
                <span style={liveFeedTextStyle}>LIVE FEED</span>
              </div>

              <div style={watchIconBoxStyle}>
                <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
                  <ellipse cx="14" cy="10" rx="13" ry="9"
                    stroke="currentColor" strokeWidth="2" />
                  <circle cx="14" cy="10" r="4"
                    stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>

              <h2 style={watchHeadingStyle}>WATCH GAME</h2>

              <p style={watchBodyStyle}>
                Spectator dashboard. View real-time scoreboards, active
                clock data, and live match analytics.
              </p>

              <div style={watchBottomStyle}>
                <span style={watchCtaTextStyle}>ENTER SPECTATOR VIEW</span>
                <span style={watchArrowStyle}>→</span>
              </div>
            </div>

          </div>
        </main>

        {/* ── FOOTER ── */}
        <footer style={footerStyle}>
          <div style={footerLeftStyle}>
            <div style={sysReadyStyle}>
              <div style={greenSquareStyle} />
              <span style={sysReadyTextStyle}>SYSTEM READY</span>
            </div>
            <div style={sepStyle} />
            <span style={uplinkStyle}>UPLINK: SECURE</span>
          </div>
          <span style={versionStyle}>V. 3.0_FIELD</span>
        </footer>

      </div>
    </>
  );
};

export default PiLauncher;
