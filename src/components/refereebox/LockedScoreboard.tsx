import React from 'react';
import { GameState } from '../../hooks/useRefereeBox';

interface Props {
    data: GameState;
    gameClock: string;
    shotClock: string;
}

export default function LockedScoreboard({ data, gameClock, shotClock }: Props) {
    return (
        <div style={{ padding: '0.5rem 0', display: 'flex', justifyContent: 'center', backgroundColor: '#000', minHeight: '100vh', userSelect: 'none' }}>
            <div style={{ width: '100%', maxWidth: '640px', aspectRatio: '1024/600', background: '#0a0a0a', borderRadius: '12px', border: '2px solid #222', overflow: 'hidden', fontFamily: 'monospace', position: 'relative' }}>

                <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>

                    <div style={{ background: '#111', padding: '4px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', flexShrink: 0 }}>
                        <span style={{ fontSize: '9px', color: '#555', letterSpacing: '2px', textTransform: 'uppercase' }}>the box</span>
                        <span style={{ fontSize: '9px', color: '#555' }}>Q{data.clock.period} &bull; touch locked</span>
                        <span style={{ fontSize: '9px', color: '#2a2' }}>daemon ok</span>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, minHeight: 0 }}>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d1520', borderRight: '1px solid #1a2a3a', padding: '8px' }}>
                                <div style={{ fontSize: '9px', color: '#4488cc', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>{data.teamA.name}</div>
                                <div style={{ fontSize: '56px', fontWeight: 900, color: '#5599dd', lineHeight: 1, fontFamily: 'monospace' }}>{data.teamA.score}</div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                                    <span style={{ fontSize: '9px', color: '#4477aa' }}>F: {data.teamA.fouls}</span>
                                    <span style={{ fontSize: '9px', color: '#4477aa' }}>TO: {data.teamA.timeouts}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 16px', minWidth: '120px' }}>
                                <div style={{ fontSize: '9px', color: '#666', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>period {data.clock.period}</div>
                                <div style={{ fontSize: '36px', fontWeight: 700, color: '#0f0', lineHeight: 1, fontFamily: 'monospace' }}>{gameClock}</div>
                                <div style={{ fontSize: '9px', color: data.clock.isRunning ? '#0f0' : '#f00', marginTop: '2px' }}>
                                    {data.clock.isRunning ? 'running' : 'stopped'}
                                </div>

                                <div style={{ marginTop: '8px', padding: '4px 12px', background: '#1a1a00', border: '1px solid #333300', borderRadius: '6px' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#cc0', fontFamily: 'monospace' }}>{shotClock}</div>
                                </div>
                                <div style={{ fontSize: '8px', color: '#665500', marginTop: '2px' }}>shot clock</div>

                                <div style={{ marginTop: '6px' }}>
                                    <svg width="20" height="12" viewBox="0 0 20 12">
                                        <polygon points="0,6 10,0 10,12" fill="#5599dd" />
                                        <polygon points="10,0 20,6 10,12" fill="#333" />
                                    </svg>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1a0d0d', borderLeft: '1px solid #2a1a1a', padding: '8px' }}>
                                <div style={{ fontSize: '9px', color: '#cc4444', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>{data.teamB.name}</div>
                                <div style={{ fontSize: '56px', fontWeight: 900, color: '#dd5555', lineHeight: 1, fontFamily: 'monospace' }}>{data.teamB.score}</div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                                    <span style={{ fontSize: '9px', color: '#aa4444' }}>F: {data.teamB.fouls}</span>
                                    <span style={{ fontSize: '9px', color: '#aa4444' }}>TO: {data.teamB.timeouts}</span>
                                </div>
                            </div>

                        </div>

                        <div style={{ background: '#111', borderTop: '1px solid #222', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0a0' }}></div>
                                <span style={{ fontSize: '8px', color: '#555' }}>System Active &bull; Waiting for hardware input</span>
                            </div>
                            <div style={{ padding: '2px 8px', border: '1px solid #333', borderRadius: '4px', fontSize: '8px', color: '#666' }}>
                                press SETTINGS to unlock touch
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}