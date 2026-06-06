// src/components/refereebox/court/CourtToolbar.tsx
// Top toolbar: zone label + HEAT / RINGS / FLIP toggles + theme cycle.

import React from 'react';
import type { ShotZoneId } from '../../shotchart/types/shotTypes';
import { ZONES } from '../../shotchart/courtZones';

const RM = "'JetBrains Mono', monospace";

export type HexSize = 'S' | 'M' | 'L';
export type MadeFilter = 'all' | 'made' | 'miss';

interface ToolbarProps {
    selectedZone: ShotZoneId | null;
    teamColor: string;
    isLight: boolean;

    hexSize: HexSize;
    onHexSize: (s: HexSize) => void;

    showHeat: boolean;
    onShowHeat: (v: boolean) => void;
    showRings: boolean;
    onShowRings: (v: boolean) => void;
    mirror: boolean;
    onMirror: (v: boolean) => void;

    madeFilter: MadeFilter;
    onMadeFilter: (f: MadeFilter) => void;

    themeLabel: string;
    onCycleTheme: () => void;

    topBarBg: string;
    borderColor: string;
}

// All controls hit 44×44 minimum (WCAG 2.5.5 AAA). Toolbar height is 52 so
// the buttons can sit comfortably inside it. Contrast on inactive states bumped
// to 0.6/0.65 white to pass axe-core.

const ToggleBtn: React.FC<{
    label: string; active: boolean; color: string;
    onClick: () => void; isLight: boolean;
}> = ({ label, active, color, onClick, isLight }) => (
    <button onClick={onClick}
        aria-pressed={active}
        style={{
            height: 44, minWidth: 50, padding: '0 12px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: active ? `${color}26` : (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'),
            border: `1px solid ${active ? color : (isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.16)')}`,
            color: active ? color : (isLight ? 'rgba(0,0,0,0.68)' : 'rgba(255,255,255,0.65)'),
            fontFamily: RM, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            borderRadius: 8,
            boxShadow: active ? `0 0 12px ${color}44` : 'none',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        }}>{label}</button>
);

const SegBtn: React.FC<{
    value: string; active: boolean; color: string;
    onClick: () => void; isLight: boolean;
}> = ({ value, active, color, onClick, isLight }) => (
    <button onClick={onClick}
        aria-pressed={active}
        style={{
            height: 44, minWidth: 44, padding: '0 12px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: active ? color : 'transparent',
            color: active ? '#fff' : (isLight ? 'rgba(0,0,0,0.68)' : 'rgba(255,255,255,0.6)'),
            border: 'none',
            fontFamily: RM, fontSize: 11, fontWeight: 800,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            borderRadius: 6,
            transition: 'background 0.12s, color 0.12s',
        }}>{value}</button>
);

const SegGroup: React.FC<{ children: React.ReactNode; isLight: boolean }> = ({ children, isLight }) => (
    <div style={{
        display: 'inline-flex', alignItems: 'center',
        background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.16)'}`,
        borderRadius: 10, padding: 2,
    }}>{children}</div>
);

const CourtToolbar: React.FC<ToolbarProps> = ({
    selectedZone, teamColor, isLight,
    hexSize, onHexSize,
    showHeat, onShowHeat,
    showRings, onShowRings,
    mirror, onMirror,
    madeFilter, onMadeFilter,
    themeLabel, onCycleTheme,
    topBarBg, borderColor,
}) => {
    const zoneLabel = selectedZone ? (ZONES[selectedZone]?.label ?? selectedZone) : null;
    return (
        <div style={{
            height: 52, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            background: topBarBg,
            borderBottom: `1px solid ${borderColor}`,
            padding: '0 12px',
            gap: 8,
        }}>
            <span style={{
                fontFamily: RM, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: selectedZone ? teamColor : (isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)'),
                transition: 'color 0.18s',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                flex: 1, minWidth: 0,
            }}>
                {zoneLabel ?? 'TAP A HEX TO MARK SHOT'}
            </span>

            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                {showHeat && (
                    <SegGroup isLight={isLight}>
                        <SegBtn value="ALL"  active={madeFilter === 'all'}  color={teamColor} onClick={() => onMadeFilter('all')}  isLight={isLight} />
                        <SegBtn value="✓"    active={madeFilter === 'made'} color="#22C55E"   onClick={() => onMadeFilter('made')} isLight={isLight} />
                        <SegBtn value="✕"    active={madeFilter === 'miss'} color="#EF4444"   onClick={() => onMadeFilter('miss')} isLight={isLight} />
                    </SegGroup>
                )}

                <SegGroup isLight={isLight}>
                    <SegBtn value="S" active={hexSize === 'S'} color={teamColor} onClick={() => onHexSize('S')} isLight={isLight} />
                    <SegBtn value="M" active={hexSize === 'M'} color={teamColor} onClick={() => onHexSize('M')} isLight={isLight} />
                    <SegBtn value="L" active={hexSize === 'L'} color={teamColor} onClick={() => onHexSize('L')} isLight={isLight} />
                </SegGroup>

                <ToggleBtn label="HEAT"  active={showHeat}  color="#F97316" onClick={() => onShowHeat(!showHeat)}    isLight={isLight} />
                <ToggleBtn label="RINGS" active={showRings} color="#22C55E" onClick={() => onShowRings(!showRings)}  isLight={isLight} />
                <ToggleBtn label="FLIP"  active={mirror}    color="#3B82F6" onClick={() => onMirror(!mirror)}        isLight={isLight} />
                <ToggleBtn label={themeLabel} active={false} color={teamColor} onClick={onCycleTheme}                isLight={isLight} />
            </div>
        </div>
    );
};

export default React.memo(CourtToolbar);
