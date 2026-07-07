// src/components/refereebox/PiDirectLinkScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Direct Link SESSION (Pi side, full-screen)
//
// Creates a fresh game in Supabase (so the public website still sees it),
// then shows the pairing QR + short code. The operator scans it from a
// phone/laptop on the same WiFi to open the controller; once they connect,
// this swaps to the live LED scoreboard, driven over LAN by the controller.
//
// The QR encodes the PUBLIC site URL (not the Pi's localhost), because the
// phone can't reach the Pi's own origin. Live score data still flows
// LAN-direct over WebRTC regardless of where the controller page loaded.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import PiDirectLinkReceiver from './PiDirectLinkReceiver';
import { initializeNewGame } from '../../services/supabaseGameService';
import type { GameSettings } from '../../types';

interface Props {
    onBack: () => void;
}

// Public deployment — the controller page must be reachable from a phone.
const PUBLIC_BASE = 'https://theboxbybmsce.in';

const controllerBase = (): string => {
    if (typeof window === 'undefined') return PUBLIC_BASE;
    return /localhost|127\.0\.0\.1/.test(window.location.host)
        ? PUBLIC_BASE
        : window.location.origin;
};

const PiDirectLinkScreen: React.FC<Props> = ({ onBack }) => {
    const [code, setCode] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [piStatus, setPiStatus] = useState<{ ip: string; online: boolean } | null>(null);
    const createdRef = useRef(false);

    useEffect(() => {
        createdRef.current = false;
        setCode(null);
        setError(false);
        setPiStatus(null);
        let alive = true;

        (async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                const statusResp = await fetch('http://localhost:3001/api/network-status', { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!alive) return;
                const status = await statusResp.json();
                if (alive) setPiStatus(status);
            } catch (e) {
                if (alive) setPiStatus({ ip: 'localhost', online: false });
            }
        })();

        const settings: GameSettings = {
            gameName: 'LAN Game',
            periodDuration: 10,
            shotClockDuration: 24,
            periodType: 'quarter',
            gameMode: 'advanced',
            periods: 4,
        };

        (async () => {
            try {
                const newCode = await initializeNewGame(
                    settings,
                    { name: 'TEAM A', color: '#2563EB' },
                    { name: 'TEAM B', color: '#DC2626' },
                    false,          // local game
                    'basketball',
                    'THE-BOX-PI',
                );
                if (!alive) return;
                if (newCode) { createdRef.current = true; setCode(newCode.toUpperCase()); }
                else setError(true);
            } catch {
                if (alive) setError(true);
            }
        })();

        return () => { alive = false; };
    }, [attempt]);

    if (error) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 80, background: '#0a0a0c',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
                fontFamily: "'JetBrains Mono', monospace", color: '#A1A1AA',
            }}>
                <div style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#EF4444' }}>
                    Couldn't start session
                </div>
                <div style={{ fontSize: 10, color: '#71717A', maxWidth: 340, textAlign: 'center', lineHeight: 1.6 }}>
                    Direct Link needs a brief internet connection to pair. Check WiFi and retry.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setAttempt(a => a + 1)} style={btn('#22C55E')}>RETRY</button>
                    <button onClick={onBack} style={btn('#A1A1AA')}>← BACK</button>
                </div>
            </div>
        );
    }

    if (!code) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 80, background: '#0a0a0c',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace", color: '#A1A1AA',
                fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
            }}>
                Creating session…
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80 }}>
            <PiDirectLinkReceiver
                gameCode={code}
                controllerUrl={`${controllerBase()}/lan-control/${code}?pi=${piStatus?.ip ?? ''}`}
                piStatus={piStatus}
                onBack={onBack}
            />
        </div>
    );
};

function btn(color: string): React.CSSProperties {
    return {
        padding: '8px 18px', background: 'transparent', border: `1px solid ${color}55`,
        color, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
        letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
    };
}

export default PiDirectLinkScreen;
