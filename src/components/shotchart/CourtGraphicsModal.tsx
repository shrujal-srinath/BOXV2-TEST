// src/components/shotchart/CourtGraphicsModal.tsx
// Court graphics settings modal — theme picker + hex grid opacity

import React from 'react';
import type { CourtTheme } from './HalfCourtCanvas';

interface CourtGraphicsModalProps {
    theme: CourtTheme;
    hexOpacity: number;
    onThemeChange: (t: CourtTheme) => void;
    onHexOpacityChange: (v: number) => void;
    onClose: () => void;
}

const THEMES: { id: CourtTheme; label: string; bg: string; floor: string; line: string; paint: string }[] = [
    { id: 'dark', label: 'Dark', bg: '#0a0a0a', floor: '#0D0C0A', line: 'rgba(255,255,255,0.3)', paint: '#100E08' },
    { id: 'light', label: 'Light', bg: '#c8c0b4', floor: '#E8E0D4', line: 'rgba(0,0,0,0.35)', paint: '#D8CFC4' },
    { id: 'wood', label: 'Wood', bg: '#6a3c14', floor: '#B87840', line: 'rgba(255,255,255,0.45)', paint: '#9A6030' },
];

const CourtPreview: React.FC<{ t: typeof THEMES[0]; selected: boolean; onClick: () => void }> = ({ t, selected, onClick }) => (
    <button
        onClick={onClick}
        className={`relative flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all active:scale-95 ${selected ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'}`}
    >
        {/* Mini court preview */}
        <div className="w-full aspect-[100/94] rounded-lg overflow-hidden border border-zinc-700/50" style={{ background: t.bg }}>
            <svg viewBox="0 0 100 94" width="100%" height="100%" style={{ display: 'block' }}>
                {/* Floor */}
                <rect width="100" height="94" fill={t.floor} />
                {/* Paint */}
                <rect x="38" y="0" width="24" height="35" fill={t.paint} />
                {/* Court boundary */}
                <rect x="0.5" y="0.5" width="99" height="93" fill="none" stroke={t.line} strokeWidth="1.5" />
                {/* 3pt line simplified */}
                <path d="M 6 0 L 6 28 A 44 44 0 0 0 94 28 L 94 0" fill="none" stroke={t.line} strokeWidth="1.5" />
                {/* Paint box */}
                <rect x="38" y="0" width="24" height="35" fill="none" stroke={t.line} strokeWidth="1" />
                {/* FT circle */}
                <circle cx="50" cy="35" r="10" fill="none" stroke={t.line} strokeWidth="1" />
                {/* Rim */}
                <circle cx="50" cy="7" r="3" fill="none" stroke="rgba(220,80,30,0.8)" strokeWidth="1.2" />
                {/* Backboard */}
                <line x1="38" y1="10" x2="62" y2="10" stroke={t.line} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">{t.label}</span>
        {selected && (
            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
        )}
    </button>
);

export const CourtGraphicsModal: React.FC<CourtGraphicsModalProps> = ({
    theme, hexOpacity, onThemeChange, onHexOpacityChange, onClose,
}) => {
    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
                style={{ fontFamily: '"Barlow", sans-serif' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M5.34 5.34L3.93 3.93M12 2v2M12 20v2" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">Court Graphics</div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Display Settings</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </button>
                </div>

                <div className="p-5 space-y-6">
                    {/* Court theme */}
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Court Floor</div>
                        <div className="grid grid-cols-3 gap-2">
                            {THEMES.map(t => (
                                <CourtPreview key={t.id} t={t} selected={theme === t.id} onClick={() => onThemeChange(t.id)} />
                            ))}
                        </div>
                    </div>

                    {/* Hex grid opacity */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Hex Grid Overlay</div>
                            <div className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                                {Math.round(hexOpacity * 100)}%
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest w-6">OFF</span>
                            <input
                                type="range" min="0" max="100" value={Math.round(hexOpacity * 100)}
                                onChange={e => onHexOpacityChange(Number(e.target.value) / 100)}
                                className="flex-1 h-1 rounded-full outline-none cursor-pointer"
                                style={{
                                    WebkitAppearance: 'none',
                                    background: `linear-gradient(to right, #7c3aed ${Math.round(hexOpacity * 100)}%, #27272a ${Math.round(hexOpacity * 100)}%)`,
                                }}
                            />
                            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest w-6">MAX</span>
                        </div>
                        {/* Preview strip */}
                        <div className="mt-3 h-8 rounded-lg overflow-hidden border border-zinc-800 relative" style={{ background: THEMES.find(t => t.id === theme)?.floor }}>
                            <svg viewBox="0 0 120 30" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                                <defs>
                                    <pattern id="hexPrev" x="0" y="0" width="3.46" height="6" patternUnits="userSpaceOnUse">
                                        <polygon points="1.73,0 3.46,1 3.46,3 1.73,4 0,3 0,1" fill="none"
                                            stroke={theme === 'light' ? `rgba(0,0,0,${hexOpacity * 0.5})` : `rgba(255,255,255,${hexOpacity})`}
                                            strokeWidth="0.15" />
                                    </pattern>
                                </defs>
                                {hexOpacity > 0 && <rect width="120" height="30" fill="url(#hexPrev)" />}
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold uppercase tracking-widest transition-all active:scale-[0.98]"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </>
    );
};
