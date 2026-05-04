// src/pages/PiDisplay.tsx
// Fullscreen game display — wraps SpectatorView with cast lifecycle management.
// No Tailwind. Inline styles only.

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SpectatorView } from './SpectatorView';
import {
    startTvHeartbeat,
    subscribeTvDisplay,
    subscribeCastSignal,
    type TvDisplay,
} from '../services/tvDisplayService';

const PiDisplay: React.FC = () => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        const tvCode = localStorage.getItem('tv_kiosk_code');
        if (!tvCode) return;

        const stopHB = startTvHeartbeat(tvCode);

        const unsubDisplay = subscribeTvDisplay(tvCode, (d: TvDisplay) => {
            if (d.status === 'idle' && !d.game_code) {
                navigate('/pi-receiver', { replace: true });
            }
        });

        const unsubSignal = subscribeCastSignal(
            tvCode,
            (newGameCode) => {
                // A new game was cast — navigate to it
                navigate(`/pi-display/${newGameCode.toUpperCase()}`, { replace: true });
            },
            () => {
                navigate('/pi-receiver', { replace: true });
            },
        );

        return () => {
            stopHB();
            unsubDisplay();
            unsubSignal();
        };
    }, [navigate]);

    if (!gameCode) {
        navigate('/pi-receiver', { replace: true });
        return null;
    }

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
            <SpectatorView gameCode={gameCode} />
        </div>
    );
};

export default PiDisplay;
