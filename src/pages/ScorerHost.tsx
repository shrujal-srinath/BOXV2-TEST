// src/pages/ScorerHost.tsx
// ═══════════════════════════════════════════════════════════════
// Picks the right scorer for the device at /host/:gameCode:
//   • narrow viewport (phone)  → MobileScorer  (portrait touch deck)
//   • wide viewport (desktop)  → HostConsole   (full console)
//
// Only ONE mounts at a time, so the game-engine hooks never double up.
// A phone user can jump to the full console (e.g. for the advanced
// shot chart) via the monitor button; reloading returns to auto.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { HostConsole } from './HostConsole';
import MobileScorer from './MobileScorer';

const MOBILE_QUERY = '(max-width: 768px)';

export default function ScorerHost() {
    const [isNarrow, setIsNarrow] = useState<boolean>(
        () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
    );
    // Ephemeral per-session override (phone → full console).
    const [forceDesktop, setForceDesktop] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia(MOBILE_QUERY);
        const onChange = () => setIsNarrow(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    if (isNarrow && !forceDesktop) {
        return <MobileScorer onSwitchToDesktop={() => setForceDesktop(true)} />;
    }
    return <HostConsole />;
}
