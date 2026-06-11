// src/components/refereebox/SplashScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Pi Boot Dial v5  (pixel-matched to splash-a.html reference)
// Phase 0: Minimal "LOADING.." hold until fonts + first paint are ready
//          (the dial clock does NOT start until the screen is visible)
// Phase 1 (0–3500ms after arming): Animated radial dial, 7 SVG layers
// Phase 2 (+350ms):  Wordmark end screen, QR + Enter CTA
//
// Light mode (Courtside): same geometry, animation, and timing —
// only the color palette swaps. Dark mode is byte-for-byte identical
// to the legacy hardcoded values.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useTheme } from '../../contexts/ThemeContext';

interface SplashScreenProps {
    isDaemonConnected: boolean;
    onComplete: () => void;
}

// ── Constants ──────────────────────────────────────────────────

// +500ms over the original 3000 — the dial only starts once the page has
// actually painted (see the arming effect), so it can afford to breathe.
const DURATION = 3500;

// Pre-boot hold: never start the dial before the loading text has been
// visible this long, and never wait longer than the cap (fonts.ready can
// stall on a Pi with no network).
const PREBOOT_MIN_MS = 500;
const PREBOOT_MAX_MS = 4000;
const C_L3 = 2 * Math.PI * 180;   // ≈ 1131
const C_L4 = 2 * Math.PI * 152;   // ≈ 955

const STAGE_TARGETS = [
    { key: 'KERNEL',   label: 'KERNEL · INIT',    hud: 'BOOT',       link: 'RPI4→SELF',    sub: '▸ resolving /dev/ttyAMA0' },
    { key: 'GPIO',     label: 'GPIO · BUS',        hud: 'GPIO ARM',   link: 'RPI4→PICO',    sub: '▸ wiringpi · 26 lines hi-Z' },
    { key: 'PICO',     label: 'PICO · UART',       hud: 'HANDSHAKE',  link: 'PICO ← RX',    sub: '▸ 115200 8N1 · CRC OK' },
    { key: 'ESP32',    label: 'ESP32 · WIRELESS',  hud: 'NEGOTIATE',  link: 'ESP32 ← MESH', sub: '▸ wifi · ch149 · -42dBm' },
    { key: 'SUPABASE', label: 'SUPABASE · SYNC',   hud: 'CLOUD LINK', link: 'SUPABASE/v1',  sub: '▸ jwt · session · 200 OK' },
    { key: 'OPERATOR', label: 'OPERATOR · READY',  hud: 'READY',      link: 'ALL OK',       sub: '▸ awaiting tap-to-arm' },
] as const;

const SUB_VARIANTS: Record<string, string[]> = {
    KERNEL:   ['▸ resolving /dev/ttyAMA0', '▸ pid 1 · systemd-init', '▸ rt-sched · 99/99'],
    GPIO:     ['▸ wiringpi · 26 lines hi-Z', '▸ pin 21 · BUZZER · ok', '▸ matrix scan @ 1kHz'],
    PICO:     ['▸ 115200 8N1 · CRC OK', '▸ usb cdc · acm0 ↔ acm1', '▸ rp2040 · 9942-FW'],
    ESP32:    ['▸ wifi · ch149 · -42dBm', '▸ esp-now · peer add', '▸ mesh · 1 hop · 2.4GHz'],
    SUPABASE: ['▸ jwt · session · 200 OK', '▸ realtime · subscribed', '▸ row commit · ok'],
    OPERATOR: ['▸ awaiting tap-to-arm', '▸ buzzer · hold-to-test', '▸ ALL OK · ready'],
};

// ── Palette ────────────────────────────────────────────────────

interface SplashPalette {
    pageBg: string;
    primary: string;        // strokes/text replacing #fff
    primaryFaint: string;   // weak strokes (rgba)
    primaryWeak: string;    // medium-weak strokes
    primaryMid: string;     // mid-strength strokes
    primaryStrong: string;  // strong strokes
    accentRed: string;
    accentRedDeep: string;
    accentBlue: string;
    accentRedGhost: string; // background tint for red track
    accentRedGlow: string;
    accentBlueGlow: string;
    cardinal: string;       // 000/090 labels
    intercardinal: string;  // NE/SE labels
    stageKey: string;       // L5 stage keys (idle)
    stageKeyActive: string; // L5 active label
    stageKeyDone: string;   // L5 completed label
    milestone: string;      // 25%/50%/75% label
    hudCaption: string;     // top/bottom rail captions
    hudValue: string;       // emphasized HUD values
    daemonOk: string;
    daemonOff: string;
    bgGrid: string;
    vignette: string;
    scanline: string;
    blendMode: 'overlay' | 'multiply';
    railDivider: string;
    qrPanelBg: string;
    qrPanelBorder: string;
    qrLabelBg: string;
    qrDarkPx: string;       // qr "dark" pixel color
    qrLightPx: string;      // qr "light" pixel color
    orDivider: string;
    enterText: string;
    enterTextSecondary: string;
    enterKeyBorder: string;
    enterKeyShadow: string;
    enterKeyBlinkBg: string;
    cornerBracket: string;
    qrUrlText: string;
    qrUrlAccent: string;
    subTextAccent: string;  // sub stage text color
    subtitleNeutral: string;
    subtitleStrong: string;
}

const DARK_SPLASH: SplashPalette = {
    pageBg: '#000',
    primary: '#fff',
    primaryFaint: 'rgba(255,255,255,0.04)',
    primaryWeak: 'rgba(255,255,255,0.10)',
    primaryMid: 'rgba(255,255,255,0.18)',
    primaryStrong: 'rgba(255,255,255,0.55)',
    accentRed: '#ef2b2d',
    accentRedDeep: '#dc2626',
    accentBlue: '#1d6bff',
    accentRedGhost: 'rgba(239,43,45,0.10)',
    accentRedGlow: 'rgba(239,43,45,0.55)',
    accentBlueGlow: 'rgba(29,107,255,0.45)',
    cardinal: '#cfcfcf',
    intercardinal: '#7a7a7a',
    stageKey: '#666',
    stageKeyActive: '#fff',
    stageKeyDone: '#cfcfcf',
    milestone: '#909090',
    hudCaption: '#6a6a6a',
    hudValue: '#fff',
    daemonOk: '#22e07a',
    daemonOff: '#6a6a6a',
    bgGrid: 'rgba(255,255,255,0.025)',
    vignette: 'radial-gradient(ellipse 100% 90% at 50% 50%,transparent 55%,rgba(0,0,0,0.85) 100%)',
    scanline: 'rgba(255,255,255,0.018)',
    blendMode: 'overlay',
    railDivider: '#262626',
    qrPanelBg: '#000',
    qrPanelBorder: '#181818',
    qrLabelBg: '#000',
    qrDarkPx: '#FFFFFF',
    qrLightPx: '#000000',
    orDivider: '#333',
    enterText: '#888888',
    enterTextSecondary: '#555555',
    enterKeyBorder: 'rgba(220,38,38,0.5)',
    enterKeyShadow: 'inset 0 -3px 0 rgba(220,38,38,0.22), 0 0 28px rgba(220,38,38,0.08)',
    enterKeyBlinkBg: 'rgba(220,38,38,0.15)',
    cornerBracket: '#ef2b2d',
    qrUrlText: '#2a2a2a',
    qrUrlAccent: '#444',
    subTextAccent: '#1d6bff',
    subtitleNeutral: '#6a6a6a',
    subtitleStrong: '#fff',
};

const LIGHT_SPLASH: SplashPalette = {
    pageBg: '#F6F7F9',
    primary: '#111827',
    primaryFaint: 'rgba(17,24,39,0.04)',
    primaryWeak: 'rgba(17,24,39,0.10)',
    primaryMid: 'rgba(17,24,39,0.18)',
    primaryStrong: 'rgba(17,24,39,0.50)',
    accentRed: '#E8112D',
    accentRedDeep: '#B50022',
    accentBlue: '#3B82F6',
    accentRedGhost: 'rgba(232,17,45,0.10)',
    accentRedGlow: 'rgba(232,17,45,0.32)',
    accentBlueGlow: 'rgba(59,130,246,0.30)',
    cardinal: '#6B7280',
    intercardinal: '#9CA3AF',
    stageKey: '#9CA3AF',
    stageKeyActive: '#111827',
    stageKeyDone: '#6B7280',
    milestone: '#9CA3AF',
    hudCaption: '#6B7280',
    hudValue: '#111827',
    daemonOk: '#22C55E',
    daemonOff: '#9CA3AF',
    bgGrid: 'rgba(17,24,39,0.04)',
    vignette: 'radial-gradient(ellipse 100% 90% at 50% 50%,transparent 55%,rgba(246,247,249,0.85) 100%)',
    scanline: 'rgba(17,24,39,0.025)',
    blendMode: 'multiply',
    railDivider: '#E5E7EB',
    qrPanelBg: '#FFFFFF',
    qrPanelBorder: '#E5E7EB',
    qrLabelBg: '#FFFFFF',
    qrDarkPx: '#111827',
    qrLightPx: '#FFFFFF',
    orDivider: '#E5E7EB',
    enterText: '#6B7280',
    enterTextSecondary: '#9CA3AF',
    enterKeyBorder: 'rgba(232,17,45,0.55)',
    enterKeyShadow: 'inset 0 -3px 0 rgba(232,17,45,0.18), 0 0 24px rgba(232,17,45,0.10)',
    enterKeyBlinkBg: 'rgba(232,17,45,0.10)',
    cornerBracket: '#E8112D',
    qrUrlText: '#9CA3AF',
    qrUrlAccent: '#6B7280',
    subTextAccent: '#3B82F6',
    subtitleNeutral: '#6B7280',
    subtitleStrong: '#111827',
};

// ── SVG helpers ────────────────────────────────────────────────

const NS = 'http://www.w3.org/2000/svg';

function se(tag: string, attrs: Record<string, string | number> = {}): SVGElement {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
}

function st(text: string, x: number, y: number, attrs: Record<string, string | number> = {}): SVGElement {
    const el = se('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', ...attrs });
    el.textContent = text;
    return el;
}

function arcPath(r: number, sDeg: number, eDeg: number): string {
    const s = (sDeg - 90) * Math.PI / 180;
    const e = (eDeg - 90) * Math.PI / 180;
    const x1 = Math.cos(s) * r, y1 = Math.sin(s) * r;
    const x2 = Math.cos(e) * r, y2 = Math.sin(e) * r;
    const large = (eDeg - sDeg) > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}


// ── Component ──────────────────────────────────────────────────

const SplashScreen: React.FC<SplashScreenProps> = ({ isDaemonConnected, onComplete }) => {

    const { theme } = useTheme();
    const isLight = theme === 'light';
    const p: SplashPalette = useMemo(() => (isLight ? LIGHT_SPLASH : DARK_SPLASH), [isLight]);

    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    // DOM refs for imperative mutation — avoids re-renders inside rAF loop
    const stageRef    = useRef<HTMLDivElement>(null);
    const svgRef      = useRef<SVGSVGElement>(null);
    const dialWrapRef = useRef<HTMLDivElement>(null);
    const endRef      = useRef<HTMLDivElement>(null);

    const l3ArcRef    = useRef<SVGElement | null>(null);
    const l3HeadRef   = useRef<SVGElement | null>(null);
    const pinRef      = useRef<SVGElement | null>(null);
    const l4ArcRef    = useRef<SVGElement | null>(null);
    const l5FillsRef  = useRef<{ fill: SVGElement; label: SVGElement; len: number }[]>([]);
    const l6OrbitRef  = useRef<SVGElement | null>(null);

    const pctRef      = useRef<HTMLSpanElement>(null);
    const stageNmRef  = useRef<HTMLDivElement>(null);
    const subStgRef   = useRef<HTMLDivElement>(null);
    const hudStgRef   = useRef<HTMLDivElement>(null);
    const hudLinkRef  = useRef<HTMLDivElement>(null);
    const hudDrawRef  = useRef<HTMLDivElement>(null);

    const continuedRef = useRef(false);
    // Re-anchored by the animation effect the moment the dial is armed.
    const t0Ref        = useRef(0);
    const rafRef       = useRef(0);
    const ivRef        = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Pre-boot arming ──────────────────────────────────────────
    // The dial used to start its 3s clock at React mount — but on the Pi the
    // first visible paint lands seconds later (JS parse, font fetch, SVG
    // build), so refs only ever saw the tail end. Hold on a minimal
    // "LOADING.." screen until the page has painted and fonts are in, THEN
    // start the dial from 0. The full splash DOM (SVG layers, QR) builds
    // underneath the loading overlay during the hold, so the dial starts
    // jank-free.
    const [armed, setArmed] = useState(false);
    useEffect(() => {
        let cancelled = false;
        const minHold = new Promise<void>(res => setTimeout(res, PREBOOT_MIN_MS));
        const fonts   = typeof document !== 'undefined' && document.fonts?.ready
            ? document.fonts.ready.then(() => undefined)
            : Promise.resolve();
        const cap     = new Promise<void>(res => setTimeout(res, PREBOOT_MAX_MS));
        Promise.race([Promise.all([minHold, fonts]).then(() => undefined), cap]).then(() => {
            if (cancelled) return;
            // Double-RAF: guarantees the browser has painted (and is keeping
            // up) before the animation clock starts ticking.
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (!cancelled) setArmed(true);
            }));
        });
        return () => { cancelled = true; };
    }, []);

    // ── Exit animation ───────────────────────────────────────────
    function doExit() {
        if (continuedRef.current) return;
        continuedRef.current = true;
        if (autoRef.current) clearTimeout(autoRef.current);
        const el = stageRef.current;
        if (!el) { onCompleteRef.current(); return; }
        el.style.transition = 'transform 900ms cubic-bezier(0.6,0,0.8,0.2), filter 900ms ease, opacity 900ms ease';
        el.style.transform = 'scale(1.06)';
        el.style.filter = 'blur(8px)';
        el.style.opacity = '0';
        setTimeout(() => onCompleteRef.current(), 900);
    }

    // Keyboard: Enter / Space proceed — only once the dial is armed, so a
    // buffered keypress during the pre-boot hold can't skip the splash.
    useEffect(() => {
        if (!armed) return;
        const h = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') doExit(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [armed]);

    // ── Build static SVG structure (7 layers, all imperative) ────
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        // Clear previous build (theme switches retrigger this effect)
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        // ──────────────────────────────────────────────────────────
        // L1 — Outer compass ring (R=240)
        //      5° minor ticks, major at 30°, cardinal at 90°.
        //      Degree labels 000/090/180/270 outside at R=256.
        //      Intercardinal NE/SE/SW/NW inside at R=226.
        // ──────────────────────────────────────────────────────────
        const l1 = document.createElementNS(NS, 'g');
        l1.appendChild(se('circle', { r: 240, fill: 'none', stroke: p.primaryWeak, 'stroke-width': 1 }));

        for (let deg = 0; deg < 360; deg += 5) {
            const cardinal = deg % 90 === 0;
            const major    = deg % 30 === 0;
            const a = (deg - 90) * Math.PI / 180;
            // Reference: cardinal r1=232,r2=248; major r1=234,r2=244; minor r1=237,r2=241
            const r1 = cardinal ? 232 : (major ? 234 : 237);
            const r2 = cardinal ? 248 : (major ? 244 : 241);
            l1.appendChild(se('line', {
                x1: Math.cos(a) * r1, y1: Math.sin(a) * r1,
                x2: Math.cos(a) * r2, y2: Math.sin(a) * r2,
                stroke: cardinal ? p.primary : (major ? p.primaryStrong : p.primaryMid),
                'stroke-width': cardinal ? 1.6 : (major ? 1 : 0.6),
            }));
        }

        // Cardinal degree labels outside ring (000 / 090 / 180 / 270)
        [[0, '000'], [90, '090'], [180, '180'], [270, '270']].forEach(([deg, txt]) => {
            const a = ((deg as number) - 90) * Math.PI / 180;
            l1.appendChild(st(txt as string, Math.cos(a) * 256, Math.sin(a) * 256, {
                fill: p.cardinal,
                'font-family': 'JetBrains Mono, monospace',
                'font-size': 8.5, 'letter-spacing': 2,
            }));
        });

        // Intercardinal abbreviations inside ring (NE / SE / SW / NW)
        [[45, 'NE'], [135, 'SE'], [225, 'SW'], [315, 'NW']].forEach(([deg, txt]) => {
            const a = ((deg as number) - 90) * Math.PI / 180;
            l1.appendChild(st(txt as string, Math.cos(a) * 226, Math.sin(a) * 226, {
                fill: p.intercardinal,
                'font-family': 'JetBrains Mono, monospace',
                'font-size': 7, 'letter-spacing': 1.5,
            }));
        });

        svg.appendChild(l1);

        // ──────────────────────────────────────────────────────────
        // L2 — Caliper ring (R=212): 3° ticks, major every 30°
        // ──────────────────────────────────────────────────────────
        const l2 = document.createElementNS(NS, 'g');
        l2.appendChild(se('circle', { r: 212, fill: 'none', stroke: p.primaryFaint, 'stroke-width': 0.8 }));
        for (let deg = 0; deg < 360; deg += 3) {
            const major = deg % 30 === 0;
            const a = (deg - 90) * Math.PI / 180;
            l2.appendChild(se('line', {
                x1: Math.cos(a) * 204,              y1: Math.sin(a) * 204,
                x2: Math.cos(a) * (major ? 212 : 208), y2: Math.sin(a) * (major ? 212 : 208),
                stroke: major ? p.primaryStrong : p.primaryMid,
                'stroke-width': major ? 0.9 : 0.5,
            }));
        }
        svg.appendChild(l2);

        // ──────────────────────────────────────────────────────────
        // L3 — Primary progress ring (R=180)
        // ──────────────────────────────────────────────────────────
        const l3 = document.createElementNS(NS, 'g');
        l3.appendChild(se('circle', { r: 180, fill: 'none', stroke: p.accentRedGhost, 'stroke-width': 6 }));

        // 60 micro-segment ticks
        for (let i = 0; i < 60; i++) {
            const a = (i / 60) * 360 * Math.PI / 180;
            l3.appendChild(se('line', {
                x1: Math.cos(a) * 173.5, y1: Math.sin(a) * 173.5,
                x2: Math.cos(a) * 175.5, y2: Math.sin(a) * 175.5,
                stroke: i % 5 === 0 ? p.primaryStrong : p.primaryMid,
                'stroke-width': 0.7,
            }));
        }

        // Milestone notches at 25/50/75/100%
        [[25, '25%'], [50, '50%'], [75, '75%'], [100, 'MAX']].forEach(([pct, lbl]) => {
            const a = ((pct as number) / 100 * 360 - 90) * Math.PI / 180;
            l3.appendChild(se('line', {
                x1: Math.cos(a) * 172, y1: Math.sin(a) * 172,
                x2: Math.cos(a) * 188, y2: Math.sin(a) * 188,
                stroke: p.primary, 'stroke-width': 1.4,
            }));
            l3.appendChild(st(lbl as string, Math.cos(a) * 196, Math.sin(a) * 196, {
                fill: lbl === 'MAX' ? p.accentRed : p.milestone,
                'font-family': 'JetBrains Mono, monospace', 'font-size': 7.5, 'letter-spacing': 1,
            }));
        });

        // Animated progress arc
        const l3Arc = se('circle', {
            r: 180, fill: 'none', stroke: p.accentRed, 'stroke-width': 6,
            'stroke-dasharray': `0 ${C_L3 + 10}`, 'stroke-linecap': 'butt',
            transform: 'rotate(-90)',
        });
        l3Arc.style.filter = `drop-shadow(0 0 10px ${p.accentRedGlow})`;
        l3.appendChild(l3Arc);
        l3ArcRef.current = l3Arc;

        // Progress head: dot + halo ring + crossline
        const l3Head = document.createElementNS(NS, 'g');
        l3Head.setAttribute('transform', 'rotate(-90) translate(180,0)');
        l3Head.appendChild(se('circle', { r: 4.2, fill: p.accentRed }));
        l3Head.appendChild(se('circle', { r: 9, fill: 'none', stroke: p.accentRed, 'stroke-opacity': 0.4, 'stroke-width': 1 }));
        l3Head.appendChild(se('line', { x1: -12, y1: 0, x2: 12, y2: 0, stroke: p.primary, 'stroke-width': 1 }));
        l3.appendChild(l3Head);
        l3HeadRef.current = l3Head;

        // Crosshair lines between R=180 and R=240 at cardinal axes
        [[-240, 0, -180, 0], [180, 0, 240, 0], [0, -240, 0, -180], [0, 180, 0, 240]].forEach(([x1, y1, x2, y2]) => {
            l3.appendChild(se('line', { x1, y1, x2, y2, stroke: p.primaryWeak, 'stroke-width': 0.8 }));
        });

        svg.appendChild(l3);

        // Radial pointer pin
        const pin = document.createElementNS(NS, 'g');
        pin.setAttribute('transform', 'rotate(-90)');
        pin.appendChild(se('line', { x1: 180, y1: 0, x2: 240, y2: 0, stroke: p.accentRed, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }));
        pin.appendChild(se('polygon', { points: '240,0 232,-4 232,4', fill: p.accentRed }));
        svg.appendChild(pin);
        pinRef.current = pin;

        // ──────────────────────────────────────────────────────────
        // L4 — Sub-task arc (R=152)
        // ──────────────────────────────────────────────────────────
        const l4 = document.createElementNS(NS, 'g');
        l4.appendChild(se('circle', { r: 152, fill: 'none', stroke: p.primaryFaint, 'stroke-width': 2 }));
        const l4Arc = se('circle', {
            r: 152, fill: 'none', stroke: p.accentBlue, 'stroke-width': 2,
            'stroke-dasharray': `0 ${C_L4 + 10}`, 'stroke-linecap': 'round',
            transform: 'rotate(-90)',
        });
        l4Arc.style.filter = `drop-shadow(0 0 6px ${p.accentBlueGlow})`;
        l4.appendChild(l4Arc);
        l4ArcRef.current = l4Arc;
        svg.appendChild(l4);

        // ──────────────────────────────────────────────────────────
        // L5 — Stage pill arcs (R=128)
        // ──────────────────────────────────────────────────────────
        const l5 = document.createElementNS(NS, 'g');
        const pills: { fill: SVGElement; label: SVGElement; len: number }[] = [];

        for (let i = 0; i < 6; i++) {
            const span = 360 / 6;
            const gap  = 8;
            const start = i * span + gap / 2;
            const end   = (i + 1) * span - gap / 2;
            const mid   = (start + end) / 2;
            const len   = (end - start) / 360 * (Math.PI * 2 * 128);
            const d     = arcPath(128, start, end);

            l5.appendChild(se('path', { d, fill: 'none', stroke: p.primaryWeak, 'stroke-width': 5, 'stroke-linecap': 'butt' }));

            const fill = se('path', { d, fill: 'none', stroke: p.accentBlue, 'stroke-width': 5, 'stroke-linecap': 'butt', 'stroke-dasharray': `0 ${len.toFixed(1)}`, opacity: 0 });
            l5.appendChild(fill);

            const sa = (start - 90) * Math.PI / 180;
            l5.appendChild(se('circle', {
                cx: Math.cos(sa) * 128, cy: Math.sin(sa) * 128,
                r: 1.6, fill: p.primary, opacity: 0.4,
            }));

            const ma = (mid - 90) * Math.PI / 180;
            const lbl = st(STAGE_TARGETS[i].key, Math.cos(ma) * 142, Math.sin(ma) * 142, {
                fill: p.stageKey,
                'font-family': 'JetBrains Mono, monospace',
                'font-size': 7.2, 'letter-spacing': 1.5,
            });
            l5.appendChild(lbl);

            l5.appendChild(st(String(i + 1).padStart(2, '0'), Math.cos(ma) * 117, Math.sin(ma) * 117, {
                fill: p.primary, opacity: 0.55,
                'font-family': 'JetBrains Mono, monospace',
                'font-size': 6, 'letter-spacing': 1,
            }));

            pills.push({ fill, label: lbl, len });
        }

        l5FillsRef.current = pills;
        svg.appendChild(l5);

        // ──────────────────────────────────────────────────────────
        // L6 — Orbit ring (R=104)
        // ──────────────────────────────────────────────────────────
        const l6 = document.createElementNS(NS, 'g');
        l6.appendChild(se('circle', { r: 104, fill: 'none', stroke: p.primaryWeak, 'stroke-width': 0.8, 'stroke-dasharray': '2 4' }));
        const orbit = document.createElementNS(NS, 'g');
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * 2 * Math.PI;
            const color = i === 0 ? p.accentRed : p.accentBlue;
            const sat = document.createElementNS(NS, 'g');
            sat.setAttribute('transform', `translate(${(Math.cos(a) * 104).toFixed(2)},${(Math.sin(a) * 104).toFixed(2)}) rotate(${(i / 6) * 360})`);
            sat.appendChild(se('line', { x1: -3, y1: 0, x2: 3, y2: 0, stroke: color, 'stroke-width': 1.4 }));
            sat.appendChild(se('circle', { r: 1.6, fill: color }));
            orbit.appendChild(sat);
        }
        l6.appendChild(orbit);
        l6OrbitRef.current = orbit;
        svg.appendChild(l6);

        // ──────────────────────────────────────────────────────────
        // L7 — Inner square reticle (144×144)
        // ──────────────────────────────────────────────────────────
        const l7 = document.createElementNS(NS, 'g');
        l7.appendChild(se('rect', { x: -72, y: -72, width: 144, height: 144, fill: 'none', stroke: p.primaryMid, 'stroke-width': 1 }));
        ['M -72 -64 L -72 -72 L -64 -72', 'M 72 -64 L 72 -72 L 64 -72',
         'M -72 64 L -72 72 L -64 72',    'M 72 64 L 72 72 L 64 72'].forEach(d => {
            l7.appendChild(se('path', { d, fill: 'none', stroke: p.primaryStrong, 'stroke-width': 1 }));
        });
        [[-72, 0, -58, 0], [58, 0, 72, 0], [0, -72, 0, -58], [0, 58, 0, 72]].forEach(([x1, y1, x2, y2]) => {
            l7.appendChild(se('line', { x1, y1, x2, y2, stroke: p.primaryStrong, 'stroke-width': 1 }));
        });
        svg.appendChild(l7);
    }, [p]);

    // ── Animation loop ───────────────────────────────────────────
    // Starts only once armed — t0 anchors to the moment the loading overlay
    // lifts, so the ref sees the full 0→100 sweep.
    useEffect(() => {
        if (!armed) return;
        t0Ref.current = Date.now();
        let ended = false;

        function tick() {
            const now = Date.now();
            const t     = Math.min(1, (now - t0Ref.current) / DURATION);
            const eased = 1 - Math.pow(1 - t, 3);

            // L3 arc + head + pin
            const arcDash = C_L3 * eased;
            l3ArcRef.current?.setAttribute('stroke-dasharray', `${arcDash.toFixed(1)} ${(C_L3 - arcDash + 10).toFixed(1)}`);
            l3HeadRef.current?.setAttribute('transform', `rotate(${(eased * 360 - 90).toFixed(2)}) translate(180,0)`);
            pinRef.current?.setAttribute('transform', `rotate(${(eased * 360 - 90).toFixed(2)})`);

            // Percentage counter
            if (pctRef.current) pctRef.current.textContent = String(Math.floor(eased * 100)).padStart(2, '0');

            // Stage index + local progress within current stage
            const stIdx = Math.min(5, Math.floor(eased * 6));
            const stLoc = eased * 6 - stIdx;
            const stage = STAGE_TARGETS[stIdx];

            // L4 sub-arc
            if (l4ArcRef.current) {
                const sub = C_L4 * stLoc;
                l4ArcRef.current.setAttribute('stroke-dasharray', `${sub.toFixed(1)} ${(C_L4 - sub + 10).toFixed(1)}`);
                l4ArcRef.current.setAttribute('stroke', stIdx === 5 ? p.accentRed : p.accentBlue);
            }

            // L5 pills
            l5FillsRef.current.forEach(({ fill, label, len }, i) => {
                if (i < stIdx) {
                    fill.setAttribute('stroke-dasharray', `${len.toFixed(1)} 0`);
                    fill.setAttribute('stroke', p.accentRed);
                    fill.setAttribute('opacity', '0.85');
                    label.setAttribute('fill', p.stageKeyDone);
                } else if (i === stIdx) {
                    const fl = len * stLoc;
                    fill.setAttribute('stroke-dasharray', `${fl.toFixed(1)} ${(len - fl).toFixed(1)}`);
                    fill.setAttribute('stroke', p.accentBlue);
                    fill.setAttribute('opacity', '1');
                    label.setAttribute('fill', p.stageKeyActive);
                } else {
                    fill.setAttribute('stroke-dasharray', `0 ${len.toFixed(1)}`);
                    fill.setAttribute('opacity', '0');
                    label.setAttribute('fill', p.stageKey);
                }
            });

            // L6 orbit
            l6OrbitRef.current?.setAttribute('transform', `rotate(${(-now / 22) % 360})`);

            // HUD text updates
            const draw = (0.84 + Math.sin(now / 180) * 0.05 + (stIdx >= 4 ? 0.2 : 0)).toFixed(2) + 'A';
            const temp = (42 + Math.sin(now / 300) * 0.6 + stIdx * 0.4).toFixed(1) + '°C';
            if (hudDrawRef.current) hudDrawRef.current.innerHTML =
                `DRAW <b style="color:${p.hudValue};font-weight:500">${draw}</b> · TEMP <b style="color:${p.hudValue};font-weight:500">${temp}</b>`;
            if (hudStgRef.current) hudStgRef.current.textContent = stage.hud;
            if (hudLinkRef.current) hudLinkRef.current.innerHTML =
                `LINK&nbsp;<b style="color:${p.accentBlue};font-weight:500">${stage.link}</b>`;
            if (stageNmRef.current) stageNmRef.current.textContent = stage.label;

            const subList = SUB_VARIANTS[stage.key] ?? [];
            const subI = Math.min(subList.length - 1, Math.floor(stLoc * subList.length));
            if (subStgRef.current) subStgRef.current.textContent = subList[subI] ?? '';

            // Completion
            if (t >= 1 && !ended) {
                ended = true;
                l3ArcRef.current?.setAttribute('stroke-dasharray', `${C_L3.toFixed(1)} 0`);
                if (l4ArcRef.current) {
                    l4ArcRef.current.setAttribute('stroke-dasharray', `${C_L4.toFixed(1)} 0`);
                    l4ArcRef.current.setAttribute('stroke', p.accentRed);
                }
                const dial = dialWrapRef.current;
                if (dial) {
                    dial.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    dial.style.opacity = '0';
                    dial.style.transform = 'scale(0.92)';
                }
                setTimeout(() => {
                    const end = endRef.current;
                    if (!end) return;
                    end.style.opacity = '1';
                    end.style.pointerEvents = 'auto';
                }, 350);
                return;
            }

            rafRef.current = requestAnimationFrame(tick);
        }

        rafRef.current = requestAnimationFrame(tick);
        ivRef.current = setInterval(() => { if (!ended) tick(); }, 33);

        return () => {
            cancelAnimationFrame(rafRef.current);
            if (ivRef.current) clearInterval(ivRef.current);
            if (autoRef.current) clearTimeout(autoRef.current);
        };
    }, [p, armed]);

    // tvCode — read or create
    const [tvCode] = useState<string>(() => {
        const saved = typeof localStorage !== 'undefined'
            ? localStorage.getItem('tv_kiosk_code')
            : null;
        if (saved) return saved;
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
        if (typeof localStorage !== 'undefined') localStorage.setItem('tv_kiosk_code', code);
        return code;
    });

    // Real QR code pointing to /cast?tv={tvCode} — colors swap with theme
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    useEffect(() => {
        QRCode.toDataURL(`https://theboxbybmsce.in/cast?tv=${tvCode.toUpperCase()}`, {
            width: 150, margin: 2,
            color: { dark: p.qrDarkPx, light: p.qrLightPx },
            errorCorrectionLevel: 'M',
        }).then(setQrDataUrl).catch(console.error);
    }, [tvCode, p.qrDarkPx, p.qrLightPx]);

    const daemonOk = isDaemonConnected;

    // ─────────────────────────────────────────────────────────────
    return (
        <div
            ref={stageRef}
            onClick={() => doExit()}
            style={{ position: 'fixed', inset: 0, background: p.pageBg, overflow: 'hidden', cursor: 'pointer', userSelect: 'none' }}
        >
            {/* Keyframe definitions */}
            <style>{`
                @keyframes ulIn {
                    0%   { transform: scaleX(0); transform-origin: left }
                    50%  { transform: scaleX(1); transform-origin: left }
                    51%  { transform-origin: right }
                    100% { transform: scaleX(1); transform-origin: right }
                }
                @keyframes ctaIn  { to { opacity: 1; transform: translateY(0) } }
                @keyframes keyBlink { 50% { background: ${p.enterKeyBlinkBg} } }
                @keyframes preBootDot {
                    0%, 100% { opacity: 0.15 }
                    50%      { opacity: 1 }
                }
            `}</style>

            {/* ── Pre-boot loading overlay ───────────────────────
                Shown from first paint until the system is ready to animate
                (fonts in + page painted). Deliberately minimal — the splash
                dial underneath builds while this is up, then takes over
                from 0%. Clicks are swallowed so a stray tap can't skip the
                splash before it has even been seen. */}
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'absolute', inset: 0, zIndex: 40,
                    background: p.pageBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: armed ? 0 : 1,
                    pointerEvents: armed ? 'none' : 'auto',
                    transition: 'opacity 400ms ease',
                }}
            >
                <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 2,
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                    letterSpacing: '0.42em', textTransform: 'uppercase',
                    color: p.primaryStrong,
                }}>
                    LOADING
                    {[0, 1, 2].map(i => (
                        <span key={i} style={{
                            animation: `preBootDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }}>.</span>
                    ))}
                </div>
            </div>

            {/* Background grid */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: `linear-gradient(${p.bgGrid} 1px,transparent 1px),linear-gradient(90deg,${p.bgGrid} 1px,transparent 1px)`,
                backgroundSize: '36px 36px',
                WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%,#000 30%,transparent 95%)',
                maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%,#000 30%,transparent 95%)',
            }} />

            {/* Vignette */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: p.vignette,
            }} />

            {/* Scanlines */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30,
                backgroundImage: `repeating-linear-gradient(to bottom,${p.scanline} 0px,${p.scanline} 1px,transparent 1px,transparent 3px)`,
                mixBlendMode: p.blendMode, opacity: 0.5,
            }} />

            {/* Corner brackets */}
            {([
                { top: 24,    left: 24,  borderRight: 'none', borderBottom: 'none' },
                { top: 24,    right: 24, borderLeft:  'none', borderBottom: 'none' },
                { bottom: 24, left: 24,  borderRight: 'none', borderTop:    'none' },
                { bottom: 24, right: 24, borderLeft:  'none', borderTop:    'none' },
            ] as const).map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 22, height: 22, border: `2px solid ${p.cornerBracket}`, pointerEvents: 'none', zIndex: 5, ...s }} />
            ))}

            {/* Top rail */}
            <div style={{
                position: 'absolute', top: 34, left: 48, right: 48, zIndex: 6,
                display: 'flex', alignItems: 'center', gap: 18, whiteSpace: 'nowrap',
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                letterSpacing: '0.32em', textTransform: 'uppercase', color: p.hudCaption, pointerEvents: 'none',
            }}>
                <div style={{ width: 6, height: 6, background: p.accentRed, flexShrink: 0 }} />
                <span style={{ color: p.primary, fontWeight: 700 }}>THE BOX</span>
                <span style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                    <span>·</span>
                    <span>SYS · INIT</span>
                </span>
                <div style={{ flex: 1, height: 1, background: p.railDivider }} />
                <span>OP_ID&nbsp;<span style={{ color: p.primary, fontWeight: 700 }}>{tvCode}</span></span>
                <span>v3.0_FIELD</span>
            </div>

            {/* Dial host — the height clamp keeps the full compass ring
                (incl. the 000/180 degree labels) visible between the top and
                bottom rails on short screens like the Pi's 1024×600 panel. */}
            <div ref={dialWrapRef} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '90px 48px' }}>
                <div style={{ position: 'relative', width: 'min(580px, 76vmin, calc(100dvh - 196px))', aspectRatio: '1' }}>

                    {/* SVG dial */}
                    <svg
                        ref={svgRef}
                        viewBox="-260 -260 520 520"
                        style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
                    />

                    {/* HUD: top-left */}
                    <div style={{
                        position: 'absolute', top: 6, left: 6,
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                        letterSpacing: '0.18em', textTransform: 'uppercase', color: p.hudCaption,
                        display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none',
                    }}>
                        <div style={{ width: 5, height: 5, background: p.accentRed, flexShrink: 0 }} />
                        <span>KERNEL <span style={{ color: p.hudValue, fontWeight: 500 }}>6.6.21-RT</span></span>
                    </div>

                    {/* HUD: top-right */}
                    <div ref={hudLinkRef} style={{
                        position: 'absolute', top: 6, right: 6, textAlign: 'right',
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                        letterSpacing: '0.18em', textTransform: 'uppercase', color: p.hudCaption,
                        pointerEvents: 'none',
                    }}>
                        LINK&nbsp;<b style={{ color: p.accentBlue, fontWeight: 500 }}>RPI4→SELF</b>
                    </div>

                    {/* HUD: bottom-left */}
                    <div ref={hudDrawRef} style={{
                        position: 'absolute', bottom: 6, left: 6,
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                        letterSpacing: '0.18em', textTransform: 'uppercase', color: p.hudCaption,
                        pointerEvents: 'none',
                    }}>
                        DRAW <b style={{ color: p.hudValue, fontWeight: 500 }}>0.84A</b> · TEMP <b style={{ color: p.hudValue, fontWeight: 500 }}>42.0°C</b>
                    </div>

                    {/* HUD: bottom-right */}
                    <div style={{
                        position: 'absolute', bottom: 6, right: 6, textAlign: 'right',
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                        letterSpacing: '0.18em', textTransform: 'uppercase',
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3,
                        pointerEvents: 'none',
                    }}>
                        <div ref={hudStgRef} style={{ color: p.accentRed, fontWeight: 700 }}>BOOTING…</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: daemonOk ? p.daemonOk : p.daemonOff }}>
                            <div style={{
                                width: 4, height: 4,
                                background: daemonOk ? p.daemonOk : p.daemonOff,
                                borderRadius: '50%',
                                boxShadow: daemonOk ? `0 0 0 2px ${isLight ? 'rgba(34,197,94,0.20)' : 'rgba(34,224,122,0.25)'}` : 'none',
                            }} />
                            <span style={{ fontSize: 8 }}>{daemonOk ? 'DAEMON OK' : 'DAEMON…'}</span>
                        </div>
                    </div>

                    {/* Centre readout */}
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                fontFamily: "'Archivo',sans-serif", fontStyle: 'italic', fontWeight: 900,
                                fontSize: 'clamp(48px,7.4vmin,84px)', color: p.primary,
                                lineHeight: 0.86, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums',
                            }}>
                                <span ref={pctRef}>00</span>
                                <small style={{ color: p.accentRed, fontSize: '0.42em', marginLeft: 3, verticalAlign: '0.35em' }}>%</small>
                            </div>
                            <div style={{ marginTop: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '0.42em', color: p.hudCaption, textTransform: 'uppercase' }}>
                                SYSTEM&nbsp;LOAD
                            </div>
                            <div ref={stageNmRef} style={{ marginTop: 5, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.34em', color: p.primary, textTransform: 'uppercase' }}>
                                KERNEL · INIT
                            </div>
                            <div ref={subStgRef} style={{ marginTop: 3, fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, letterSpacing: '0.28em', color: p.subTextAccent, fontVariantNumeric: 'tabular-nums' }}>
                                ▸ resolving /dev/ttyAMA0
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                END SCREEN (Phase 2)
                ═══════════════════════════════════════════════════════ */}
            <div
                ref={endRef}
                onClick={e => { e.stopPropagation(); doExit(); }}
                style={{
                    position: 'absolute', inset: 0, zIndex: 20,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 22, opacity: 0, pointerEvents: 'none', transition: 'opacity 0.5s ease',
                }}
            >
                {/* Wordmark */}
                <div style={{ position: 'relative' }}>
                    <div style={{
                        fontFamily: isLight ? "'Oswald',sans-serif" : "'Archivo',sans-serif",
                        fontStyle: isLight ? 'normal' : 'italic',
                        fontWeight: isLight ? 800 : 900,
                        fontSize: 'clamp(56px,11vw,140px)', lineHeight: 0.85,
                        letterSpacing: isLight ? '0.04em' : '-0.02em',
                        color: p.primary, textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>
                        THE&nbsp;BOX
                    </div>
                    {/* Red underline */}
                    <div style={{
                        position: 'absolute', left: '6%', right: '6%', bottom: -10, height: 5,
                        background: p.accentRedDeep, boxShadow: `0 0 24px ${p.accentRedGlow}`,
                        transformOrigin: 'left', animation: 'ulIn 1s cubic-bezier(0.2,0.8,0.2,1) 0.3s forwards',
                        transform: 'scaleX(0)',
                    }} />
                </div>

                {/* Subtitle */}
                <div style={{
                    display: 'flex', gap: 14, alignItems: 'center',
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                    letterSpacing: '0.4em', textTransform: 'uppercase', color: p.subtitleNeutral,
                }}>
                    <span>TABLE-TOP</span>
                    <div style={{ width: 5, height: 5, background: p.accentRedDeep, transform: 'rotate(45deg)', flexShrink: 0 }} />
                    <span style={{ color: p.subtitleStrong, letterSpacing: '0.36em' }}>REFEREE&nbsp;SCORING&nbsp;DEVICE</span>
                    <div style={{ width: 5, height: 5, background: p.accentRedDeep, transform: 'rotate(45deg)', flexShrink: 0 }} />
                    <span>BMSCE</span>
                </div>

                {/* ── CTA row ── */}
                <div style={{
                    marginTop: 32, display: 'flex', gap: 56, alignItems: 'center',
                    opacity: 0, transform: 'translateY(8px)',
                    animation: 'ctaIn 0.5s ease-out 1.4s forwards',
                }}>

                    {/* ── QR block ── */}
                    <div onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                        {/* Corner bracket accents */}
                        <div style={{ position: 'absolute', top: -10, left: -10, width: 20, height: 20, borderTop: `2px solid ${p.accentBlue}`, borderLeft: `2px solid ${p.accentBlue}`, zIndex: 2, pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', top: -10, right: -10, width: 20, height: 20, borderTop: `2px solid ${p.accentBlue}`, borderRight: `2px solid ${p.accentBlue}`, zIndex: 2, pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', bottom: -10, left: -10, width: 20, height: 20, borderBottom: `2px solid ${p.accentBlue}`, borderLeft: `2px solid ${p.accentBlue}`, zIndex: 2, pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', bottom: -10, right: -10, width: 20, height: 20, borderBottom: `2px solid ${p.accentBlue}`, borderRight: `2px solid ${p.accentBlue}`, zIndex: 2, pointerEvents: 'none' }} />

                        <div style={{ border: `1px solid ${p.qrPanelBorder}`, padding: 16, background: p.qrPanelBg, position: 'relative' }}>
                            <span style={{
                                position: 'absolute', top: 0, left: 10, transform: 'translateY(-50%)',
                                background: p.qrLabelBg, padding: '0 6px',
                                fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: '0.3em',
                                color: p.accentBlue, textTransform: 'uppercase',
                            }}>
                                CAST_LINK
                            </span>
                            {qrDataUrl ? (
                                <img
                                    src={qrDataUrl}
                                    width={150} height={150}
                                    style={{ display: 'block', imageRendering: 'pixelated' }}
                                    alt="Cast QR"
                                />
                            ) : (
                                <div style={{
                                    width: 150, height: 150,
                                    background: isLight ? 'rgba(59,130,246,0.06)' : 'rgba(29,107,255,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontFamily: "'JetBrains Mono',monospace",
                                    fontSize: 8, letterSpacing: '.2em', color: p.accentBlue,
                                    textTransform: 'uppercase',
                                }}>
                                    GENERATING…
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div style={{
                                fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                                letterSpacing: '0.3em', color: p.accentBlue, textTransform: 'uppercase', textAlign: 'center',
                            }}>
                                SCAN TO CAST A GAME
                            </div>
                            <div style={{
                                fontFamily: "'JetBrains Mono',monospace", fontSize: 7,
                                letterSpacing: '0.16em', color: p.qrUrlText, textAlign: 'center',
                            }}>
                                theboxbybmsce.in/cast?tv=<span style={{ color: p.qrUrlAccent }}>{tvCode.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── OR divider (vertical) ── */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                        alignSelf: 'stretch', paddingBottom: 30,
                    }}>
                        <div style={{ flex: 1, width: 1, background: p.orDivider }} />
                        <span style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: 9, letterSpacing: '0.3em', color: p.enterText,
                        }}>OR</span>
                        <div style={{ flex: 1, width: 1, background: p.orDivider }} />
                    </div>

                    {/* ── Enter instruction ── */}
                    <div
                        onClick={e => { e.stopPropagation(); doExit(); }}
                        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
                    >
                        <div style={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontWeight: 700, fontSize: 12, letterSpacing: '0.2em',
                            textTransform: 'uppercase', color: p.enterText,
                        }}>
                            PRESS ANY BUTTON
                        </div>

                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            border: `1px solid ${p.enterKeyBorder}`,
                            padding: '10px 28px',
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontWeight: 700,
                            fontSize: 14, letterSpacing: '0.22em', color: p.accentRedDeep,
                            boxShadow: p.enterKeyShadow,
                            animation: 'keyBlink 1.4s steps(2) infinite',
                        }}>
                            ⏎&nbsp;ENTER
                        </div>

                        <div style={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontWeight: 600, fontSize: 10, letterSpacing: '0.2em',
                            textTransform: 'uppercase', color: p.enterTextSecondary,
                        }}>
                            TO ENTER DASHBOARD
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom rail */}
            <div style={{
                position: 'absolute', bottom: 34, left: 48, right: 48, zIndex: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                letterSpacing: '0.32em', textTransform: 'uppercase', color: p.hudCaption, pointerEvents: 'none',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 6, height: 6, background: p.accentBlue, flexShrink: 0 }} />
                    <span>BMSCE&nbsp;·&nbsp;SPORTS DEPT &amp; ROBOTICS LAB</span>
                </div>
                <div style={{ flex: 1, height: 1, background: p.railDivider, margin: '0 18px' }} />
                <span>theboxbybmsce.in</span>
            </div>
        </div>
    );
};

export default SplashScreen;
