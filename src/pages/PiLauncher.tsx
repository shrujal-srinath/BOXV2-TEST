// src/pages/PiLauncher.tsx
// Boot mode-select screen — entry point for the Pi on boot.
// No Tailwind. Inline styles only.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;1,700;1,800&display=swap');

@keyframes pi-bar-fill {
  from { width: 0%; }
  to   { width: 100%; }
}
`;

type CardSide = 'score' | 'watch' | null;

const PiLauncher: React.FC = () => {
    const navigate = useNavigate();
    const [hovered, setHovered] = useState<CardSide>(null);

    const containerStyle: React.CSSProperties = {
        width: '100vw',
        height: '100vh',
        background: '#080808',
        backgroundImage: [
            'radial-gradient(ellipse at 50% 60%, rgba(251,191,36,0.04) 0%, transparent 70%)',
            'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.02) 40px)',
            'repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.02) 40px)',
        ].join(', '),
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Barlow Condensed', sans-serif",
        userSelect: 'none',
    };

    const headerStyle: React.CSSProperties = {
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 14,
        paddingBottom: 0,
    };

    const wordmarkStyle: React.CSSProperties = {
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.4em',
        color: '#2a2a2a',
        textTransform: 'uppercase' as const,
        marginBottom: 12,
    };

    const dividerStyle: React.CSSProperties = {
        width: '100%',
        height: 1,
        background: '#111',
    };

    const cardsRowStyle: React.CSSProperties = {
        flex: 1,
        display: 'flex',
        minHeight: 0,
    };

    const centerDividerStyle: React.CSSProperties = {
        width: 1,
        background: '#111',
        flexShrink: 0,
    };

    const makeCardStyle = (accent: string, side: CardSide): React.CSSProperties => ({
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        background: hovered === side ? '#0a0a0a' : '#000',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 200ms ease',
        padding: '0 40px',
    });

    const makeBottomBarStyle = (accent: string, side: CardSide): React.CSSProperties => ({
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 3,
        background: accent,
        width: hovered === side ? '100%' : '0%',
        transition: 'width 200ms ease',
    });

    const makeLabelStyle = (accent: string, side: CardSide): React.CSSProperties => ({
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800,
        fontStyle: 'italic',
        fontSize: 96,
        lineHeight: 1,
        color: accent,
        opacity: hovered === side ? 1 : 0.4,
        transition: 'opacity 200ms ease',
        letterSpacing: '0.01em',
    });

    const subtitleStyle: React.CSSProperties = {
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: '0.3em',
        color: '#333',
        textTransform: 'uppercase' as const,
    };

    const descStyle: React.CSSProperties = {
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 400,
        fontSize: 11,
        color: '#222',
        textAlign: 'center' as const,
        letterSpacing: '0.05em',
    };

    return (
        <>
            <style>{FONT_CSS}</style>
            <div style={containerStyle}>
                {/* Header */}
                <div style={headerStyle}>
                    <div style={wordmarkStyle}>THE BOX</div>
                    <div style={dividerStyle} />
                </div>

                {/* Cards */}
                <div style={cardsRowStyle}>
                    {/* SCORE card */}
                    <div
                        style={makeCardStyle('#F59E0B', 'score')}
                        onClick={() => navigate('/referee')}
                        onMouseEnter={() => setHovered('score')}
                        onMouseLeave={() => setHovered(null)}
                        onTouchStart={() => setHovered('score')}
                        onTouchEnd={() => { navigate('/referee'); setHovered(null); }}
                    >
                        <div style={makeLabelStyle('#F59E0B', 'score')}>SCORE</div>
                        <div style={subtitleStyle}>PRIMARY SCORER</div>
                        <div style={descStyle}>Full stats · Clock control · Advanced mode</div>
                        <div style={makeBottomBarStyle('#F59E0B', 'score')} />
                    </div>

                    <div style={centerDividerStyle} />

                    {/* WATCH card */}
                    <div
                        style={makeCardStyle('#3B82F6', 'watch')}
                        onClick={() => navigate('/pi-receiver')}
                        onMouseEnter={() => setHovered('watch')}
                        onMouseLeave={() => setHovered(null)}
                        onTouchStart={() => setHovered('watch')}
                        onTouchEnd={() => { navigate('/pi-receiver'); setHovered(null); }}
                    >
                        <div style={makeLabelStyle('#3B82F6', 'watch')}>WATCH</div>
                        <div style={subtitleStyle}>RECEIVE &amp; DISPLAY</div>
                        <div style={descStyle}>Cast from website · Enter game code · LED wall display</div>
                        <div style={makeBottomBarStyle('#3B82F6', 'watch')} />
                    </div>
                </div>
            </div>
        </>
    );
};

export default PiLauncher;
