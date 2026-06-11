// src/components/refereebox/PiDirectLinkReceiver.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Direct Link RECEIVER (Pi → LED)
//
// Renders the live game that a paired phone/laptop is scoring over the
// LAN. Pure display: it consumes DirectLinkSnapshot frames from the
// WebRTC DataChannel and paints the existing LockedScoreboardMinimal —
// NO Supabase dependency, so the LED keeps updating with zero latency
// even when the venue internet is down.
//
// The game clock is interpolated locally between snapshots (the proven
// epoch-anchor pattern) so it ticks smoothly at 60fps regardless of how
// often the controller pushes.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import LockedScoreboardMinimal from './LockedScoreboardMinimal';
import { useDirectLinkReceiver, type DirectLinkSnapshot } from '../../hooks/useLanGameLink';

interface Props {
    gameCode: string;
    /** URL the controller (phone/laptop) opens — encoded into the pairing QR. */
    controllerUrl?: string;
    onBack: () => void;
}

const PiDirectLinkReceiver: React.FC<Props> = ({ gameCode, controllerUrl, onBack }) => {
    const [snap, setSnap] = useState<DirectLinkSnapshot | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!controllerUrl) { setQrDataUrl(null); return; }
        let alive = true;
        QRCode.toDataURL(controllerUrl, { width: 240, margin: 1, color: { dark: '#0a0a0c', light: '#ffffff' } })
            .then(url => { if (alive) setQrDataUrl(url); })
            .catch(() => { if (alive) setQrDataUrl(null); });
        return () => { alive = false; };
    }, [controllerUrl]);
    // Clock anchor — last snapshot's clock + the wall-clock moment we got it.
    const anchorRef = useRef<{ gameMs: number; shotMs: number; isRunning: boolean; at: number } | null>(null);
    const [displayMs, setDisplayMs] = useState<{ gameMs: number; shotMs: number }>({ gameMs: 0, shotMs: 0 });

    const { linked } = useDirectLinkReceiver(gameCode, (s) => {
        setSnap(s);
        anchorRef.current = {
            gameMs: s.clock.gameMs,
            shotMs: s.clock.shotMs,
            isRunning: s.clock.isRunning,
            at: Date.now(),
        };
    });

    // ── Local interpolation loop ────────────────────────────────
    useEffect(() => {
        let raf = 0;
        const loop = () => {
            const a = anchorRef.current;
            if (a) {
                if (a.isRunning) {
                    const elapsed = Date.now() - a.at;
                    setDisplayMs({
                        gameMs: Math.max(0, a.gameMs - elapsed),
                        shotMs: Math.max(0, a.shotMs - elapsed),
                    });
                } else {
                    setDisplayMs({ gameMs: a.gameMs, shotMs: a.shotMs });
                }
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);

    // ── Waiting / pairing state — before the first snapshot lands ─
    if (!snap || !linked) {
        return (
            <div style={{
                width: '100vw', height: '100vh', background: '#0a0a0c',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 20,
                fontFamily: "'JetBrains Mono', monospace", color: '#A1A1AA',
                userSelect: 'none',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        width: 9, height: 9, borderRadius: '50%', background: '#F59E0B',
                        boxShadow: '0 0 16px #F59E0B', animation: 'dlrPulse 1.2s ease-in-out infinite',
                    }} />
                    <span style={{ fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#F4F4F5' }}>
                        Direct Link · Beta
                    </span>
                </div>

                {qrDataUrl && (
                    <div style={{ padding: 12, background: '#fff', borderRadius: 4, lineHeight: 0 }}>
                        <img src={qrDataUrl} width={220} height={220} alt="Scan to control" />
                    </div>
                )}

                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#71717A', textTransform: 'uppercase' }}>
                        Scan to score from your phone / laptop
                    </div>
                    <div style={{ fontSize: 13, letterSpacing: '0.4em', color: '#22C55E', fontWeight: 700 }}>
                        CODE · {gameCode.toUpperCase()}
                    </div>
                    {controllerUrl && (
                        <div style={{ fontSize: 9, letterSpacing: '0.05em', color: '#52525B' }}>
                            {controllerUrl}
                        </div>
                    )}
                </div>

                <button
                    onClick={onBack}
                    style={{
                        marginTop: 6, padding: '8px 18px',
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
                        color: '#A1A1AA', fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.2em',
                        textTransform: 'uppercase', cursor: 'pointer',
                    }}
                >← Back</button>
                <style>{`@keyframes dlrPulse { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }`}</style>
            </div>
        );
    }

    // ── Live — paint the snapshot ───────────────────────────────
    const totalPeriods = snap.clock.totalPeriods || 4;
    return (
        <LockedScoreboardMinimal
            teamA={{ name: snap.teamA.name, score: snap.teamA.score, fouls: snap.teamA.fouls, timeouts: snap.teamA.timeouts, color: snap.teamA.color }}
            teamB={{ name: snap.teamB.name, score: snap.teamB.score, fouls: snap.teamB.fouls, timeouts: snap.teamB.timeouts, color: snap.teamB.color }}
            clock={{
                gameMs: displayMs.gameMs,
                shotMs: displayMs.shotMs,
                isRunning: snap.clock.isRunning,
                period: snap.clock.period,
                totalPeriods,
            }}
            possession={snap.possession}
            canUndo={false}
            teamAColor={snap.teamA.color}
            teamBColor={snap.teamB.color}
            isConnected={linked}
            gameMode="advanced"
            gameCode={snap.gameCode}
        />
    );
};

export default PiDirectLinkReceiver;
