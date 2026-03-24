// src/components/referee/SplashScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — BOOT SEQUENCE
// Inspired by F1 steering wheel initialization + PS5 boot
// Duration: ~3 seconds, auto-advances when daemon is connected
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
    isDaemonConnected: boolean;
    onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isDaemonConnected, onComplete }) => {
    const [phase, setPhase] = useState<'logo' | 'status' | 'ready'>('logo');
    const [statusLines, setStatusLines] = useState<string[]>([]);

    const bootMessages = [
        'GPIO SUBSYSTEM ............. OK',
        'CLOCK ENGINE 100Hz ......... OK',
        'WEBSOCKET SERVER :3001 ..... OK',
        'DSI DISPLAY 1024×600 ....... OK',
        'HDMI OUTPUT ................ OK',
        'BUZZER RELAY ............... OK',
    ];

    useEffect(() => {
        // Phase 1: Logo for 800ms
        const t1 = setTimeout(() => setPhase('status'), 800);
        return () => clearTimeout(t1);
    }, []);

    useEffect(() => {
        if (phase !== 'status') return;

        // Rapid-fire boot messages
        bootMessages.forEach((msg, i) => {
            setTimeout(() => {
                setStatusLines(prev => [...prev, msg]);
            }, i * 180);
        });

        // After all messages, check daemon
        setTimeout(() => {
            setPhase('ready');
        }, bootMessages.length * 180 + 400);
    }, [phase]);

    useEffect(() => {
        if (phase === 'ready' && isDaemonConnected) {
            const t = setTimeout(onComplete, 600);
            return () => clearTimeout(t);
        }
    }, [phase, isDaemonConnected, onComplete]);

    return (
        <div style={{
            width: '1024px',
            height: '600px',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Subtle scanline overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px)',
                pointerEvents: 'none',
                zIndex: 10,
            }} />

            {/* Corner brackets */}
            <svg style={{ position: 'absolute', top: 20, left: 20, opacity: 0.15 }} width="40" height="40" viewBox="0 0 40 40">
                <path d="M0 12 L0 0 L12 0" fill="none" stroke="#fff" strokeWidth="1.5" />
            </svg>
            <svg style={{ position: 'absolute', top: 20, right: 20, opacity: 0.15 }} width="40" height="40" viewBox="0 0 40 40">
                <path d="M28 0 L40 0 L40 12" fill="none" stroke="#fff" strokeWidth="1.5" />
            </svg>
            <svg style={{ position: 'absolute', bottom: 20, left: 20, opacity: 0.15 }} width="40" height="40" viewBox="0 0 40 40">
                <path d="M0 28 L0 40 L12 40" fill="none" stroke="#fff" strokeWidth="1.5" />
            </svg>
            <svg style={{ position: 'absolute', bottom: 20, right: 20, opacity: 0.15 }} width="40" height="40" viewBox="0 0 40 40">
                <path d="M28 40 L40 40 L40 28" fill="none" stroke="#fff" strokeWidth="1.5" />
            </svg>

            {/* Logo */}
            <div style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: '72px',
                letterSpacing: '0.15em',
                color: '#fff',
                lineHeight: 1,
                opacity: phase === 'logo' ? 1 : 0.6,
                transition: 'all 0.5s ease',
                transform: phase === 'logo' ? 'scale(1)' : 'scale(0.7)',
                marginBottom: phase === 'logo' ? 0 : '8px',
            }}>
                THE BOX
            </div>

            {/* Subtitle */}
            <div style={{
                fontFamily: "'Barlow', sans-serif",
                fontWeight: 400,
                fontSize: '13px',
                letterSpacing: '0.4em',
                color: '#444',
                textTransform: 'uppercase',
                opacity: phase === 'logo' ? 1 : 0.4,
                transition: 'opacity 0.5s ease',
                marginBottom: phase !== 'logo' ? '24px' : 0,
            }}>
                REFEREE CONSOLE v2.0
            </div>

            {/* Boot log */}
            {phase !== 'logo' && (
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '12px',
                    color: '#0f0',
                    lineHeight: 1.8,
                    textAlign: 'left',
                    width: '420px',
                    animation: 'fadeIn 0.3s ease',
                }}>
                    {statusLines.map((line, i) => (
                        <div key={i} style={{
                            animation: 'fadeIn 0.15s ease',
                            opacity: 0.8,
                        }}>
                            <span style={{ color: '#555' }}>[{String(i).padStart(2, '0')}]</span>{' '}
                            {line}
                        </div>
                    ))}

                    {/* Connection status */}
                    {phase === 'ready' && (
                        <div style={{
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid #1a1a1a',
                            color: isDaemonConnected ? '#22C55E' : '#F59E0B',
                            fontWeight: 600,
                            animation: isDaemonConnected ? 'fadeIn 0.3s ease' : 'breathe 1.5s infinite',
                        }}>
                            {isDaemonConnected
                                ? '■ DAEMON CONNECTED — INITIALIZING'
                                : '○ WAITING FOR HARDWARE DAEMON...'}
                        </div>
                    )}
                </div>
            )}

            {/* Bottom version strip */}
            <div style={{
                position: 'absolute',
                bottom: 16,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0 28px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                color: '#2a2a2a',
                letterSpacing: '0.05em',
            }}>
                <span>BMSCE SPORTS TECH</span>
                <span>1024×600 DSI</span>
                <span>PI4B / ARM64</span>
            </div>
        </div>
    );
};

export default SplashScreen;