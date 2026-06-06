// src/components/pi/PiPlayerRail.tsx
// Left/right rail: 5 player chips (48px) + SUB button. Touch-first.
import React from 'react';
import type { Player } from '../../types';

const BARLOW = '"Barlow Condensed", system-ui, sans-serif';

interface Props {
    color: string;
    players: Player[];
    selId: string | null;
    period: number;
    onSelect: (id: string) => void;
    onSub: () => void;
}

export const PiPlayerRail: React.FC<Props> = ({ color, players, selId, period, onSelect, onSub }) => {
    const five = players.slice(0, 5);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 6, fontFamily: BARLOW, minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflow: 'hidden' }}>
                {five.map(pl => {
                    const active = pl.id === selId;
                    const foulWarn = pl.fouls >= 4 ? '#EF4444' : (pl.fouls >= 3 && period <= 2) ? '#F59E0B' : null;
                    return (
                        <button key={pl.id} onClick={() => onSelect(pl.id)} style={{
                            height: 48, width: '100%', borderRadius: 10, cursor: 'pointer',
                            background: active ? `${color}22` : '#152032',
                            border: `1.5px solid ${active ? color : foulWarn ?? '#1B2640'}`,
                            boxShadow: active ? `inset 0 0 12px ${color}33` : 'none',
                            color: '#F0F4FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0,
                            fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase',
                        }}>
                            <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: active ? color : '#F0F4FF' }}>#{pl.number}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: foulWarn ?? '#8D97AA', maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {pl.name}{foulWarn ? ` ${pl.fouls}f` : ''}
                            </span>
                        </button>
                    );
                })}
            </div>
            <button onClick={onSub} style={{
                height: 44, width: '100%', borderRadius: 10, cursor: 'pointer',
                background: '#152032', border: '1px solid #2B3E5A', color: '#8D97AA',
                fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase', fontWeight: 800, fontSize: 14, letterSpacing: 1,
            }}>SUB</button>
        </div>
    );
};
