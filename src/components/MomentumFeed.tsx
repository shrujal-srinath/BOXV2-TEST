// src/components/MomentumFeed.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — MOMENTUM FEED
//
// Tracks scoring runs and hot streaks in real-time.
// Drop into SpectatorView below the main score.
//
// Props: pass the full game state and shot events.
// The component derives all insights internally.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';

interface TeamState { name: string; score: number; color: string; }
interface MomentumFeedProps {
    teamA: TeamState;
    teamB: TeamState;
    period: number;
    isRunning: boolean;
}

interface FeedEvent {
    id: string;
    text: string;
    type: 'run' | 'lead_change' | 'tied' | 'hot' | 'milestone';
    color: string;
    timestamp: number;
}

const MAX_FEED_ITEMS = 4;
const RUN_THRESHOLD = 6; // points unanswered before calling it a "run"

// ═══════════════════════════════════════════════════════════════

export const MomentumFeed: React.FC<MomentumFeedProps> = ({
    teamA, teamB, period, isRunning,
}) => {
    const [feed, setFeed] = useState<FeedEvent[]>([]);
    const prevScoreRef = useRef({ a: teamA.score, b: teamB.score });
    const runRef = useRef({ team: null as 'A' | 'B' | null, points: 0 });
    const lastLeadRef = useRef<'A' | 'B' | 'tied' | null>(null);

    useEffect(() => {
        const prev = prevScoreRef.current;
        const events: FeedEvent[] = [];
        const now = Date.now();

        const deltaA = teamA.score - prev.a;
        const deltaB = teamB.score - prev.b;

        // Track run
        if (deltaA > 0 && deltaB === 0) {
            if (runRef.current.team === 'A') {
                runRef.current.points += deltaA;
            } else {
                runRef.current = { team: 'A', points: deltaA };
            }
        } else if (deltaB > 0 && deltaA === 0) {
            if (runRef.current.team === 'B') {
                runRef.current.points += deltaB;
            } else {
                runRef.current = { team: 'B', points: deltaB };
            }
        } else if (deltaA > 0 && deltaB > 0) {
            runRef.current = { team: null, points: 0 };
        }

        // Emit run notification
        if (runRef.current.points >= RUN_THRESHOLD && (deltaA > 0 || deltaB > 0)) {
            const runTeam = runRef.current.team;
            const name = runTeam === 'A' ? teamA.name : teamB.name;
            const color = runTeam === 'A' ? teamA.color : teamB.color;
            events.push({
                id: `run-${now}`,
                text: `${name} on a ${runRef.current.points}-0 run`,
                type: 'run',
                color,
                timestamp: now,
            });
        }

        // Lead change
        const currentLead: 'A' | 'B' | 'tied' =
            teamA.score > teamB.score ? 'A' :
                teamB.score > teamA.score ? 'B' : 'tied';

        if (lastLeadRef.current !== null && currentLead !== lastLeadRef.current) {
            if (currentLead === 'tied') {
                events.push({
                    id: `tied-${now}`,
                    text: `Game tied ${teamA.score}–${teamB.score}`,
                    type: 'tied',
                    color: '#F59E0B',
                    timestamp: now,
                });
                runRef.current = { team: null, points: 0 };
            } else {
                const name = currentLead === 'A' ? teamA.name : teamB.name;
                const color = currentLead === 'A' ? teamA.color : teamB.color;
                const margin = Math.abs(teamA.score - teamB.score);
                events.push({
                    id: `lead-${now}`,
                    text: `${name} takes the lead +${margin}`,
                    type: 'lead_change',
                    color,
                    timestamp: now,
                });
                runRef.current = { team: null, points: 0 };
            }
        }

        // Score milestones (every 10 points)
        if (deltaA > 0 && teamA.score % 10 === 0 && teamA.score > 0) {
            events.push({
                id: `mile-a-${now}`,
                text: `${teamA.name} reaches ${teamA.score} points`,
                type: 'milestone',
                color: teamA.color,
                timestamp: now,
            });
        }
        if (deltaB > 0 && teamB.score % 10 === 0 && teamB.score > 0) {
            events.push({
                id: `mile-b-${now}`,
                text: `${teamB.name} reaches ${teamB.score} points`,
                type: 'milestone',
                color: teamB.color,
                timestamp: now,
            });
        }

        // Update refs
        prevScoreRef.current = { a: teamA.score, b: teamB.score };
        lastLeadRef.current = currentLead;

        if (events.length > 0) {
            setFeed(prev => [...events, ...prev].slice(0, MAX_FEED_ITEMS));
        }
    }, [teamA.score, teamB.score]);

    if (feed.length === 0) return null;

    const typeIcon = (type: FeedEvent['type']) => {
        switch (type) {
            case 'run': return '🔥';
            case 'lead_change': return '⚡';
            case 'tied': return '⚖';
            case 'hot': return '🎯';
            case 'milestone': return '●';
            default: return '●';
        }
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: '4px',
            padding: '0 12px',
        }}>
            {feed.map((event, i) => (
                <div
                    key={event.id}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '5px 10px', borderRadius: '6px',
                        background: `${event.color}10`,
                        border: `1px solid ${event.color}22`,
                        opacity: 1 - i * 0.2,
                        transition: 'opacity 0.3s',
                        animation: i === 0 ? 'feedSlideIn 0.3s ease' : 'none',
                    }}
                >
                    <span style={{ fontSize: 12 }}>{typeIcon(event.type)}</span>
                    <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: i === 0 ? '#fff' : '#666',
                        fontFamily: "'Barlow', sans-serif",
                        letterSpacing: '0.02em',
                    }}>
                        {event.text}
                    </span>
                </div>
            ))}
            <style>{`
                @keyframes feedSlideIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default MomentumFeed;