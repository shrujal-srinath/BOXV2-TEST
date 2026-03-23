import React from 'react';
import { GameState } from '../../hooks/useRefereeBox';

interface Props {
    data: GameState;
    gameClock: string;
    shotClock: string;
    sendAction: (type: string, payload?: any) => void;
}

export default function UnlockedSettings({ data, gameClock, shotClock, sendAction }: Props) {

    // Helper for rendering identical +/- touch buttons
    const renderTouchBtn = (label: string, onClick: () => void, color: string, bg: string, border: string) => (
        <div
            onClick={onClick}
            style={{ width: '24px', height: '24px', background: bg, border: `1px solid ${border}`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}
        >
            {label}
        </div>
    );

    return (
        <div style={{ padding: '0.5rem 0', display: 'flex', justifyContent: 'center', backgroundColor: '#000', minHeight: '100vh', userSelect: 'none' }}>
            <div style={{ width: '100%', maxWidth: '640px', aspectRatio: '1024/600', background: '#0a0a0a', borderRadius: '12px', border: '2px solid #c50', overflow: 'hidden', fontFamily: 'monospace', position: 'relative' }}>

                <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>

                    {/* HEADER */}
                    <div style={{ background: '#1a0800', padding: '4px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #c50', flexShrink: 0 }}>
                        <span style={{ fontSize: '9px', color: '#c50', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700 }}>settings — touch active</span>
                        <span style={{ fontSize: '9px', color: '#c50' }}>press SETTINGS button to lock</span>
                    </div>

                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, minHeight: 0, overflow: 'hidden' }}>

                        {/* TEAM A CONTROLS */}
                        <div style={{ padding: '8px', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '8px', color: '#4488cc', letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center' }}>{data.teamA.name}</div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#555', marginBottom: '2px' }}>score</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    {renderTouchBtn('-', () => sendAction('EDIT_SCORE', { team: 'teamA', amount: -1 }), '#88aadd', '#1a1a2a', '#334')}
                                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#5599dd', minWidth: '50px' }}>{data.teamA.score}</div>
                                    {renderTouchBtn('+', () => sendAction('EDIT_SCORE', { team: 'teamA', amount: 1 }), '#88aadd', '#1a1a2a', '#334')}
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#555', marginBottom: '2px' }}>fouls</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    {renderTouchBtn('-', () => sendAction('EDIT_FOULS', { team: 'teamA', amount: -1 }), '#88aadd', '#1a1a2a', '#334')}
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#aaa', minWidth: '30px' }}>{data.teamA.fouls}</div>
                                    {renderTouchBtn('+', () => sendAction('EDIT_FOULS', { team: 'teamA', amount: 1 }), '#88aadd', '#1a1a2a', '#334')}
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#555', marginBottom: '2px' }}>timeouts</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    {renderTouchBtn('-', () => sendAction('EDIT_TIMEOUTS', { team: 'teamA', amount: -1 }), '#88aadd', '#1a1a2a', '#334')}
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#aaa', minWidth: '30px' }}>{data.teamA.timeouts}</div>
                                    {renderTouchBtn('+', () => sendAction('EDIT_TIMEOUTS', { team: 'teamA', amount: 1 }), '#88aadd', '#1a1a2a', '#334')}
                                </div>
                            </div>
                        </div>

                        {/* CLOCK & SYSTEM CONTROLS */}
                        <div style={{ padding: '8px', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                            <div style={{ fontSize: '8px', color: '#666', letterSpacing: '2px', textTransform: 'uppercase' }}>clocks</div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#555', marginBottom: '2px' }}>game clock (sec)</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {renderTouchBtn('-', () => sendAction('EDIT_GAME_CLOCK', { amount: -1 }), '#0c0', '#0a1a0a', '#243')}
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f0', minWidth: '70px' }}>{gameClock}</div>
                                    {renderTouchBtn('+', () => sendAction('EDIT_GAME_CLOCK', { amount: 1 }), '#0c0', '#0a1a0a', '#243')}
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#555', marginBottom: '2px' }}>shot clock (sec)</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {renderTouchBtn('-', () => sendAction('EDIT_SHOT_CLOCK', { amount: -1 }), '#cc0', '#1a1a00', '#333300')}
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#cc0', minWidth: '40px' }}>{shotClock}</div>
                                    {renderTouchBtn('+', () => sendAction('EDIT_SHOT_CLOCK', { amount: 1 }), '#cc0', '#1a1a00', '#333300')}
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#555', marginBottom: '2px' }}>period</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {renderTouchBtn('-', () => sendAction('EDIT_PERIOD', { amount: -1 }), '#aaa', '#1a1a1a', '#333')}
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff', minWidth: '30px' }}>{data.clock.period}</div>
                                    {renderTouchBtn('+', () => sendAction('EDIT_PERIOD', { amount: 1 }), '#aaa', '#1a1a1a', '#333')}
                                </div>
                            </div>
                        </div>

                        {/* TEAM B CONTROLS */}
                        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '8px', color: '#cc4444', letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center' }}>{data.teamB.name}</div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#555', marginBottom: '2px' }}>score</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    {renderTouchBtn('-', () => sendAction('EDIT_SCORE', { team: 'teamB', amount: -1 }), '#dd8888', '#2a1a1a', '#433')}
                                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#dd5555', minWidth: '50px' }}>{data.teamB.score}</div>
                                    {renderTouchBtn('+', () => sendAction('EDIT_SCORE', { team: 'teamB', amount: 1 }), '#dd8888', '#2a1a1a', '#433')}
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#555', marginBottom: '2px' }}>fouls</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    {renderTouchBtn('-', () => sendAction('EDIT_FOULS', { team: 'teamB', amount: -1 }), '#dd8888', '#2a1a1a', '#433')}
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#aaa', minWidth: '30px' }}>{data.teamB.fouls}</div>
                                    {renderTouchBtn('+', () => sendAction('EDIT_FOULS', { team: 'teamB', amount: 1 }), '#dd8888', '#2a1a1a', '#433')}
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#555', marginBottom: '2px' }}>timeouts</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    {renderTouchBtn('-', () => sendAction('EDIT_TIMEOUTS', { team: 'teamB', amount: -1 }), '#dd8888', '#2a1a1a', '#433')}
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#aaa', minWidth: '30px' }}>{data.teamB.timeouts}</div>
                                    {renderTouchBtn('+', () => sendAction('EDIT_TIMEOUTS', { team: 'teamB', amount: 1 }), '#dd8888', '#2a1a1a', '#433')}
                                </div>
                            </div>
                        </div>

                    </div>

                    <div style={{ background: '#1a0800', borderTop: '1px solid #c50', padding: '4px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '9px', color: '#c50', fontWeight: 700, letterSpacing: '1px' }}>MANUAL OVERRIDE MODE</span>
                    </div>

                </div>
            </div>
        </div>
    );
}