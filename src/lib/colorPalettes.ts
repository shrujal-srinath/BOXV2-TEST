// src/lib/colorPalettes.ts
// ═══════════════════════════════════════════════════════════════
// THE BOX — Color palette + accessibility helpers
//
// Cividis  — colorblind-safe, perceptually uniform (default heatmap).
// Classic  — red→amber→green ramp (familiar; opt-in fallback).
// Wong     — 8-color categorical safe across deuteranopia/protanopia/tritanopia.
//
// All palette functions take t ∈ [0,1] and return "#rrggbb" strings.
// Heatmap fills are Bayesian-shrunk so 1-of-1 hexes do not over-paint.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

// ── Cividis (9 stops, sampled from cmcrameri / Nuñez et al. 2018) ────────────
const CIVIDIS_STOPS: ReadonlyArray<[number, number, number]> = [
    [0x00, 0x20, 0x4d], // dark indigo
    [0x18, 0x3a, 0x6c],
    [0x37, 0x53, 0x7d],
    [0x55, 0x6c, 0x83],
    [0x70, 0x83, 0x83],
    [0x8c, 0x9a, 0x7c],
    [0xab, 0xb2, 0x6f],
    [0xcb, 0xcb, 0x57],
    [0xfd, 0xea, 0x45], // bright yellow
];

// ── Classic (red → orange → amber → lime → green) ───────────────────────────
const CLASSIC_STOPS: ReadonlyArray<[number, number, number]> = [
    [0xb9, 0x1c, 0x1c], // deep red
    [0xef, 0x44, 0x44],
    [0xf9, 0x73, 0x16], // orange
    [0xf5, 0x9e, 0x0b], // amber
    [0xfa, 0xcc, 0x15],
    [0x84, 0xcc, 0x16], // lime
    [0x22, 0xc5, 0x5e], // green
    [0x15, 0x80, 0x3d], // deep green
];

export type PaletteFn = (t: number) => string;

function buildLerp(stops: ReadonlyArray<[number, number, number]>): PaletteFn {
    return (t: number) => {
        const clamped = Math.max(0, Math.min(1, t));
        const scaled = clamped * (stops.length - 1);
        const i = Math.floor(scaled);
        const f = scaled - i;
        const a = stops[i];
        const b = stops[Math.min(i + 1, stops.length - 1)];
        const r = Math.round(a[0] + (b[0] - a[0]) * f);
        const g = Math.round(a[1] + (b[1] - a[1]) * f);
        const bl = Math.round(a[2] + (b[2] - a[2]) * f);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
    };
}

export const cividis: PaletteFn     = buildLerp(CIVIDIS_STOPS);
export const classicHeat: PaletteFn = buildLerp(CLASSIC_STOPS);

// ── Palette registry + theme preference (mirrors scoreboardTheme.ts) ─────────
export type HeatPaletteId = 'cividis' | 'classic';

const PALETTE_REGISTRY: Record<HeatPaletteId, PaletteFn> = {
    cividis,
    classic: classicHeat,
};

export function paletteById(id: HeatPaletteId): PaletteFn {
    return PALETTE_REGISTRY[id] ?? cividis;
}

const LS_PALETTE = 'THE_BOX_HEAT_PALETTE';
const EVT_PALETTE = 'heat-palette-change';

export function getHeatPalette(): HeatPaletteId {
    try {
        const v = localStorage.getItem(LS_PALETTE);
        return v === 'classic' ? 'classic' : 'cividis';
    } catch { return 'cividis'; }
}

export function setHeatPalette(id: HeatPaletteId): void {
    try { localStorage.setItem(LS_PALETTE, id); } catch { /* swallow */ }
    window.dispatchEvent(new CustomEvent<HeatPaletteId>(EVT_PALETTE, { detail: id }));
}

export function useHeatPalette(): [HeatPaletteId, (id: HeatPaletteId) => void] {
    const [palette, setPalette] = useState<HeatPaletteId>(() => getHeatPalette());
    useEffect(() => {
        const handler = (e: Event) => setPalette((e as CustomEvent<HeatPaletteId>).detail);
        window.addEventListener(EVT_PALETTE, handler);
        return () => window.removeEventListener(EVT_PALETTE, handler);
    }, []);
    return [palette, setHeatPalette];
}

// ── Wong categorical (8 colorblind-safe colors, Nature Methods 2011) ────────
export const WONG = {
    black:      '#000000',
    orange:     '#E69F00',
    skyBlue:    '#56B4E9',
    bluishGreen:'#009E73',
    yellow:     '#F0E442',
    blue:       '#0072B2',
    vermillion: '#D55E00',
    reddishPurple:'#CC79A7',
} as const;

// Convenience aliases for the shot tracker (made/miss)
export const MADE_COLOR  = WONG.bluishGreen;   // safe green
export const MISS_COLOR  = WONG.vermillion;    // safe red

// ── Bayesian-shrunk heat fill (replaces buildHeatmap()'s if-ladder) ──────────
// stat: {made, attempts} for the hex
// prior: league FG% prior (from xppa.ZONE_PRIOR) for the hex's zone
// k: shrinkage strength (3 = live attribution, 8 = analytics review)
export interface HexStat { made: number; attempts: number }

export function shrunkRate(stat: HexStat, prior: number, k: number): number {
    return (stat.made + k * prior) / (stat.attempts + k);
}

export function heatFill(
    stat: HexStat,
    prior: number,
    k: number = 3,
    palette: PaletteFn = cividis,
): string {
    if (stat.attempts === 0) return 'transparent';
    const rate = shrunkRate(stat, prior, k);
    // Center palette around prior so a hex at league average sits mid-palette.
    // Map [0, prior] → [0, 0.5] and [prior, 1] → [0.5, 1].
    const t = rate <= prior
        ? (rate / Math.max(prior, 1e-6)) * 0.5
        : 0.5 + ((rate - prior) / Math.max(1 - prior, 1e-6)) * 0.5;
    return withAlpha(palette(t), heatAlpha(stat.attempts));
}

// Opacity ramps with attempt volume so a 12-attempt hex reads heavier than a 1-attempt.
export function heatAlpha(attempts: number): number {
    return Math.min(1, 0.32 + attempts / 9);
}

// ── Color utilities ──────────────────────────────────────────────────────────

const HEX_RE = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
const HEX_SHORT_RE = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;

function parseHex(hex: string): { r: number; g: number; b: number } | null {
    const long = HEX_RE.exec(hex);
    if (long) return { r: parseInt(long[1], 16), g: parseInt(long[2], 16), b: parseInt(long[3], 16) };
    const short = HEX_SHORT_RE.exec(hex);
    if (short) return {
        r: parseInt(short[1] + short[1], 16),
        g: parseInt(short[2] + short[2], 16),
        b: parseInt(short[3] + short[3], 16),
    };
    return null;
}

export function withAlpha(color: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    const parsed = parseHex(color);
    if (!parsed) return color;
    return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${a})`;
}

export function teamScale(teamColor: string, t: number): string {
    const parsed = parseHex(teamColor);
    if (!parsed) return teamColor;
    const clamped = Math.max(0, Math.min(1, t));
    const r = Math.round(parsed.r * clamped + 18 * (1 - clamped));
    const g = Math.round(parsed.g * clamped + 18 * (1 - clamped));
    const b = Math.round(parsed.b * clamped + 18 * (1 - clamped));
    return `rgb(${r}, ${g}, ${b})`;
}

// ── WCAG contrast helpers ────────────────────────────────────────────────────

function relativeLuminance(r: number, g: number, b: number): number {
    const transform = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function contrastRatio(fg: string, bg: string): number {
    const fgP = parseHex(fg) ?? { r: 0, g: 0, b: 0 };
    const bgP = parseHex(bg) ?? { r: 255, g: 255, b: 255 };
    const L1 = relativeLuminance(fgP.r, fgP.g, fgP.b);
    const L2 = relativeLuminance(bgP.r, bgP.g, bgP.b);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
}

export function pickReadableText(bg: string): '#000' | '#fff' {
    const whiteCR = contrastRatio('#ffffff', bg);
    const blackCR = contrastRatio('#000000', bg);
    return whiteCR >= blackCR ? '#fff' : '#000';
}

// ── Reduced motion ───────────────────────────────────────────────────────────

const LS_REDUCED_MOTION = 'THE_BOX_REDUCED_MOTION';
const EVT_REDUCED_MOTION = 'reduced-motion-change';

export function getReducedMotionOverride(): boolean | null {
    try {
        const v = localStorage.getItem(LS_REDUCED_MOTION);
        if (v === 'on') return true;
        if (v === 'off') return false;
        return null;
    } catch { return null; }
}

export function setReducedMotionOverride(value: boolean | null): void {
    try {
        if (value === null) localStorage.removeItem(LS_REDUCED_MOTION);
        else localStorage.setItem(LS_REDUCED_MOTION, value ? 'on' : 'off');
    } catch { /* swallow */ }
    window.dispatchEvent(new CustomEvent<boolean | null>(EVT_REDUCED_MOTION, { detail: value }));
}

export function useReducedMotion(): boolean {
    const compute = (): boolean => {
        const override = getReducedMotionOverride();
        if (override !== null) return override;
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch { return false; }
    };
    const [reduced, setReduced] = useState<boolean>(compute);
    useEffect(() => {
        const handler = () => setReduced(compute());
        window.addEventListener(EVT_REDUCED_MOTION, handler);
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mq.addEventListener) mq.addEventListener('change', handler);
        else mq.addListener?.(handler);
        return () => {
            window.removeEventListener(EVT_REDUCED_MOTION, handler);
            if (mq.removeEventListener) mq.removeEventListener('change', handler);
            else mq.removeListener?.(handler);
        };
    }, []);
    return reduced;
}
