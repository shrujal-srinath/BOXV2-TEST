// src/components/pi/PiScoreboard.tsx
// Top 60px bar: team scores + possession + clock + play/pause (biggest tap target).
import React from 'react';

const BARLOW = '"Barlow Condensed", system-ui, sans-serif';
const fmt = (n: number) => n.toString().padStart(2, '0');
const qLabel = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`);

interface SideProps {
    name: string; color: string; score: number; fouls: number; timeouts: number;
    hasPossession: boolean; align: 'left' | 'right';
}

const TeamBlock: React.FC<SideProps> = ({ name, color, score, fouls, timeouts, hasPossession, align }) => {
    const right = align === 'right';
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            justifyContent: right ? 'flex-end' : 'flex-start',
            flexDirection: right ? 'row-reverse' : 'row',
        }}>
            <div style={{
                fontSize: 40, fontWeight: 800, fontStyle: 'italic', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                color: hasPossession ? color : '#F0F4FF',
                textShadow: hasPossession ? `0 0 18px ${color}66` : 'none',
            }}>{score}</div>
            <div style={{ textAlign: right ? 'right' : 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase', color, letterSpacing: 0.5, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5E6B7D', letterSpacing: 1, display: 'flex', gap: 8, justifyContent: right ? 'flex-end' : 'flex-start' }}>
                    <span style={{ color: fouls >= 4 ? '#EF4444' : '#5E6B7D' }}>F:{fouls}</span>
                    <span>T:{timeouts}</span>
                </div>
            </div>
        </div>
    );
};

interface Props {
    teamAName: string; teamAColor: string; teamAScore: number; teamAFouls: number; teamATimeouts: number;
    teamBName: string; teamBColor: string; teamBScore: number; teamBFouls: number; teamBTimeouts: number;
    period: number; minutes: number; seconds: number; shotClock: number;
    gameRunning: boolean; possession: 'A' | 'B';
    onToggleClock: () => void; onTogglePossession: () => void;
}

export const PiScoreboard: React.FC<Props> = (p) => (
    <div style={{
        background: '#0D1320', borderBottom: '1px solid #1B2640',
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12,
        padding: '0 16px', fontFamily: BARLOW,
    }}>
        <TeamBlock name={p.teamAName} color={p.teamAColor} score={p.teamAScore} fouls={p.teamAFouls} timeouts={p.teamATimeouts} hasPossession={p.possession === 'A'} align="left" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={p.onTogglePossession} style={{
                width: 44, height: 44, borderRadius: 10, border: '1px solid #2B3E5A', cursor: 'pointer',
                background: 'transparent', color: p.possession === 'A' ? p.teamAColor : p.teamBColor,
                fontSize: 18, fontWeight: 900, fontStyle: 'italic', fontFamily: BARLOW,
            }}>{p.possession === 'A' ? '◀P' : 'P▶'}</button>

            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#E8112D', letterSpacing: 1.4, fontStyle: 'italic' }}>● {qLabel(p.period)}</div>
                <div style={{ fontSize: 56, fontWeight: 800, fontStyle: 'italic', lineHeight: 1, color: p.gameRunning ? '#F0F4FF' : '#22C55E', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                    {fmt(p.minutes)}:{fmt(p.seconds)}
                </div>
            </div>

            <div style={{
                width: 48, height: 48, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 800, fontStyle: 'italic', color: p.shotClock <= 5 ? '#EF4444' : '#F0F4FF',
                border: `1px solid ${p.shotClock <= 5 ? '#EF4444' : '#2B3E5A'}`, fontVariantNumeric: 'tabular-nums',
            }}>{p.shotClock}</div>

            <button onClick={p.onToggleClock} style={{
                width: 48, height: 48, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: p.gameRunning ? '#E8112D' : '#22C55E', color: '#FFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: p.gameRunning ? '0 4px 16px rgba(232,17,45,0.5)' : '0 4px 16px rgba(34,197,94,0.4)',
            }}>
                {p.gameRunning
                    ? <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="5" height="14" rx="1.5" /><rect x="10" y="1" width="5" height="14" rx="1.5" /></svg>
                    : <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1l11 7-11 7z" /></svg>}
            </button>
        </div>

        <TeamBlock name={p.teamBName} color={p.teamBColor} score={p.teamBScore} fouls={p.teamBFouls} timeouts={p.teamBTimeouts} hasPossession={p.possession === 'B'} align="right" />
    </div>
);
