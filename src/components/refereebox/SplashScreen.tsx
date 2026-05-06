// src/components/refereebox/SplashScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Pi Boot Dial v5  (pixel-matched to splash-a.html reference)
// Phase 1 (0–3000ms): Animated radial progress dial, 7 SVG layers
// Phase 2 (3350ms+):  Wordmark end screen, QR + Enter CTA
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';

interface SplashScreenProps {
    isDaemonConnected: boolean;
    onComplete: () => void;
}

// ── Constants ──────────────────────────────────────────────────

const DURATION = 3000;
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

// ── QR code builder ────────────────────────────────────────────

function buildQRCells(): React.ReactNode[] {
    const N = 25;
    let seed = 9942;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const cells: React.ReactNode[] = [];

    // Data cells (skip finder regions)
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            if ((x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9)) continue;
            if (rnd() > 0.55) {
                cells.push(<rect key={`d-${x}-${y}`} x={x} y={y} width={1} height={1} fill={rnd() > 0.92 ? '#1d6bff' : '#fff'} />);
            }
        }
    }

    // Finder patterns: white 7×7 → black 5×5 → white 3×3
    ([[0, 0], [N - 7, 0], [0, N - 7]] as [number, number][]).forEach(([fx, fy]) => {
        cells.push(
            <rect key={`fo-${fx}-${fy}`} x={fx}     y={fy}     width={7} height={7} fill="#fff" />,
            <rect key={`fi-${fx}-${fy}`} x={fx + 1} y={fy + 1} width={5} height={5} fill="#000" />,
            <rect key={`fc-${fx}-${fy}`} x={fx + 2} y={fy + 2} width={3} height={3} fill="#fff" />,
        );
    });

    // Accent cells
    cells.push(
        <rect key="acc-blue" x={N - 5} y={N - 5} width={3} height={3} fill="#1d6bff" />,
        <rect key="acc-red"  x={11}    y={11}     width={3} height={3} fill="#ef2b2d" />,
    );
    return cells;
}

// ── Component ──────────────────────────────────────────────────

const SplashScreen: React.FC<SplashScreenProps> = ({ isDaemonConnected, onComplete }) => {

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
    const t0Ref        = useRef(Date.now());
    const rafRef       = useRef(0);
    const ivRef        = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Keyboard: Enter / Space proceed
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') doExit(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    // ── Build static SVG structure (7 layers, all imperative) ────
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        // ──────────────────────────────────────────────────────────
        // L1 — Outer compass ring (R=240)
        //      5° minor ticks, major at 30°, cardinal at 90°.
        //      Degree labels 000/090/180/270 outside at R=256.
        //      Intercardinal NE/SE/SW/NW inside at R=226.
        // ──────────────────────────────────────────────────────────
        const l1 = document.createElementNS(NS, 'g');
        l1.appendChild(se('circle', { r: 240, fill: 'none', stroke: 'rgba(255,255,255,0.10)', 'stroke-width': 1 }));

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
                stroke: cardinal ? '#fff' : (major ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)'),
                'stroke-width': cardinal ? 1.6 : (major ? 1 : 0.6),
            }));
        }

        // Cardinal degree labels outside ring (000 / 090 / 180 / 270)
        [[0, '000'], [90, '090'], [180, '180'], [270, '270']].forEach(([deg, txt]) => {
            const a = ((deg as number) - 90) * Math.PI / 180;
            l1.appendChild(st(txt as string, Math.cos(a) * 256, Math.sin(a) * 256, {
                fill: '#cfcfcf',
                'font-family': 'JetBrains Mono, monospace',
                'font-size': 8.5, 'letter-spacing': 2,
            }));
        });

        // Intercardinal abbreviations inside ring (NE / SE / SW / NW)
        [[45, 'NE'], [135, 'SE'], [225, 'SW'], [315, 'NW']].forEach(([deg, txt]) => {
            const a = ((deg as number) - 90) * Math.PI / 180;
            l1.appendChild(st(txt as string, Math.cos(a) * 226, Math.sin(a) * 226, {
                fill: '#7a7a7a',
                'font-family': 'JetBrains Mono, monospace',
                'font-size': 7, 'letter-spacing': 1.5,
            }));
        });

        svg.appendChild(l1);

        // ──────────────────────────────────────────────────────────
        // L2 — Caliper ring (R=212): 3° ticks, major every 30°
        // ──────────────────────────────────────────────────────────
        const l2 = document.createElementNS(NS, 'g');
        l2.appendChild(se('circle', { r: 212, fill: 'none', stroke: 'rgba(255,255,255,0.04)', 'stroke-width': 0.8 }));
        for (let deg = 0; deg < 360; deg += 3) {
            const major = deg % 30 === 0;
            const a = (deg - 90) * Math.PI / 180;
            l2.appendChild(se('line', {
                x1: Math.cos(a) * 204,              y1: Math.sin(a) * 204,
                x2: Math.cos(a) * (major ? 212 : 208), y2: Math.sin(a) * (major ? 212 : 208),
                stroke: major ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)',
                'stroke-width': major ? 0.9 : 0.5,
            }));
        }
        svg.appendChild(l2);

        // ──────────────────────────────────────────────────────────
        // L3 — Primary progress ring (R=180)
        //      Track · 60 micro-segs · milestone notches ·
        //      animated arc · head · pin · crosshairs
        // ──────────────────────────────────────────────────────────
        const l3 = document.createElementNS(NS, 'g');
        l3.appendChild(se('circle', { r: 180, fill: 'none', stroke: 'rgba(239,43,45,0.10)', 'stroke-width': 6 }));

        // 60 micro-segment ticks
        for (let i = 0; i < 60; i++) {
            const a = (i / 60) * 360 * Math.PI / 180;
            l3.appendChild(se('line', {
                x1: Math.cos(a) * 173.5, y1: Math.sin(a) * 173.5,
                x2: Math.cos(a) * 175.5, y2: Math.sin(a) * 175.5,
                stroke: i % 5 === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                'stroke-width': 0.7,
            }));
        }

        // Milestone notches at 25/50/75/100% (angle = fraction × 360 - 90)
        [[25, '25%'], [50, '50%'], [75, '75%'], [100, 'MAX']].forEach(([p, lbl]) => {
            const a = ((p as number) / 100 * 360 - 90) * Math.PI / 180;
            l3.appendChild(se('line', {
                x1: Math.cos(a) * 172, y1: Math.sin(a) * 172,
                x2: Math.cos(a) * 188, y2: Math.sin(a) * 188,
                stroke: '#fff', 'stroke-width': 1.4,
            }));
            l3.appendChild(st(lbl as string, Math.cos(a) * 196, Math.sin(a) * 196, {
                fill: lbl === 'MAX' ? '#ef2b2d' : '#909090',
                'font-family': 'JetBrains Mono, monospace', 'font-size': 7.5, 'letter-spacing': 1,
            }));
        });

        // Animated progress arc
        const l3Arc = se('circle', {
            r: 180, fill: 'none', stroke: '#ef2b2d', 'stroke-width': 6,
            'stroke-dasharray': `0 ${C_L3 + 10}`, 'stroke-linecap': 'butt',
            transform: 'rotate(-90)',
        });
        l3Arc.style.filter = 'drop-shadow(0 0 10px rgba(239,43,45,0.55))';
        l3.appendChild(l3Arc);
        l3ArcRef.current = l3Arc;

        // Progress head: dot + halo ring + crossline
        const l3Head = document.createElementNS(NS, 'g');
        l3Head.setAttribute('transform', 'rotate(-90) translate(180,0)');
        l3Head.appendChild(se('circle', { r: 4.2, fill: '#ef2b2d' }));
        l3Head.appendChild(se('circle', { r: 9, fill: 'none', stroke: '#ef2b2d', 'stroke-opacity': 0.4, 'stroke-width': 1 }));
        l3Head.appendChild(se('line', { x1: -12, y1: 0, x2: 12, y2: 0, stroke: '#fff', 'stroke-width': 1 }));
        l3.appendChild(l3Head);
        l3HeadRef.current = l3Head;

        // Crosshair lines between R=180 and R=240 at cardinal axes
        [[-240, 0, -180, 0], [180, 0, 240, 0], [0, -240, 0, -180], [0, 180, 0, 240]].forEach(([x1, y1, x2, y2]) => {
            l3.appendChild(se('line', { x1, y1, x2, y2, stroke: 'rgba(255,255,255,0.10)', 'stroke-width': 0.8 }));
        });

        svg.appendChild(l3);

        // Radial pointer pin — rendered OUTSIDE L3 group (on top)
        const pin = document.createElementNS(NS, 'g');
        pin.setAttribute('transform', 'rotate(-90)');
        pin.appendChild(se('line', { x1: 180, y1: 0, x2: 240, y2: 0, stroke: '#ef2b2d', 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }));
        pin.appendChild(se('polygon', { points: '240,0 232,-4 232,4', fill: '#ef2b2d' }));
        svg.appendChild(pin);
        pinRef.current = pin;

        // ──────────────────────────────────────────────────────────
        // L4 — Sub-task arc (R=152): fills once per stage, blue → red
        // ──────────────────────────────────────────────────────────
        const l4 = document.createElementNS(NS, 'g');
        l4.appendChild(se('circle', { r: 152, fill: 'none', stroke: 'rgba(255,255,255,0.06)', 'stroke-width': 2 }));
        const l4Arc = se('circle', {
            r: 152, fill: 'none', stroke: '#1d6bff', 'stroke-width': 2,
            'stroke-dasharray': `0 ${C_L4 + 10}`, 'stroke-linecap': 'round',
            transform: 'rotate(-90)',
        });
        l4Arc.style.filter = 'drop-shadow(0 0 6px rgba(29,107,255,0.45))';
        l4.appendChild(l4Arc);
        l4ArcRef.current = l4Arc;
        svg.appendChild(l4);

        // ──────────────────────────────────────────────────────────
        // L5 — Stage pill arcs (R=128): 6 × 52° arc + 8° gap
        //      Each has a separator dot at start angle.
        // ──────────────────────────────────────────────────────────
        const l5 = document.createElementNS(NS, 'g');
        const pills: { fill: SVGElement; label: SVGElement; len: number }[] = [];

        for (let i = 0; i < 6; i++) {
            const span = 360 / 6;   // 60°
            const gap  = 8;
            const start = i * span + gap / 2;  // e.g. 4° for i=0
            const end   = (i + 1) * span - gap / 2;  // e.g. 56° for i=0
            const mid   = (start + end) / 2;
            const len   = (end - start) / 360 * (Math.PI * 2 * 128);
            const d     = arcPath(128, start, end);

            // Track
            l5.appendChild(se('path', { d, fill: 'none', stroke: 'rgba(255,255,255,0.10)', 'stroke-width': 5, 'stroke-linecap': 'butt' }));

            // Active fill (starts at 0)
            const fill = se('path', { d, fill: 'none', stroke: '#1d6bff', 'stroke-width': 5, 'stroke-linecap': 'butt', 'stroke-dasharray': `0 ${len.toFixed(1)}`, opacity: 0 });
            l5.appendChild(fill);

            // Separator dot at start angle
            const sa = (start - 90) * Math.PI / 180;
            l5.appendChild(se('circle', {
                cx: Math.cos(sa) * 128, cy: Math.sin(sa) * 128,
                r: 1.6, fill: '#fff', opacity: 0.4,
            }));

            // Stage key label at R=142
            const ma = (mid - 90) * Math.PI / 180;
            const lbl = st(STAGE_TARGETS[i].key, Math.cos(ma) * 142, Math.sin(ma) * 142, {
                fill: '#666',
                'font-family': 'JetBrains Mono, monospace',
                'font-size': 7.2, 'letter-spacing': 1.5,
            });
            l5.appendChild(lbl);

            // Index number inside pill at R=117
            l5.appendChild(st(String(i + 1).padStart(2, '0'), Math.cos(ma) * 117, Math.sin(ma) * 117, {
                fill: '#fff', opacity: 0.55,
                'font-family': 'JetBrains Mono, monospace',
                'font-size': 6, 'letter-spacing': 1,
            }));

            pills.push({ fill, label: lbl, len });
        }

        l5FillsRef.current = pills;
        svg.appendChild(l5);

        // ──────────────────────────────────────────────────────────
        // L6 — Orbit ring (R=104): dashed, 6 satellite pips
        // ──────────────────────────────────────────────────────────
        const l6 = document.createElementNS(NS, 'g');
        l6.appendChild(se('circle', { r: 104, fill: 'none', stroke: 'rgba(255,255,255,0.08)', 'stroke-width': 0.8, 'stroke-dasharray': '2 4' }));
        const orbit = document.createElementNS(NS, 'g');
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * 2 * Math.PI;
            const color = i === 0 ? '#ef2b2d' : '#1d6bff';
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
        // L7 — Inner square reticle (144×144): corner ticks + crosshairs
        // ──────────────────────────────────────────────────────────
        const l7 = document.createElementNS(NS, 'g');
        l7.appendChild(se('rect', { x: -72, y: -72, width: 144, height: 144, fill: 'none', stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1 }));
        ['M -72 -64 L -72 -72 L -64 -72', 'M 72 -64 L 72 -72 L 64 -72',
         'M -72 64 L -72 72 L -64 72',    'M 72 64 L 72 72 L 64 72'].forEach(d => {
            l7.appendChild(se('path', { d, fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 1 }));
        });
        [[-72, 0, -58, 0], [58, 0, 72, 0], [0, -72, 0, -58], [0, 58, 0, 72]].forEach(([x1, y1, x2, y2]) => {
            l7.appendChild(se('line', { x1, y1, x2, y2, stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1 }));
        });
        svg.appendChild(l7);
    }, []);

    // ── Animation loop ───────────────────────────────────────────
    useEffect(() => {
        t0Ref.current = Date.now();
        let ended = false;

        function tick() {
            const now = Date.now();
            const t     = Math.min(1, (now - t0Ref.current) / DURATION);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic

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

            // L4 sub-arc: fills per stage; turns red on final stage
            if (l4ArcRef.current) {
                const sub = C_L4 * stLoc;
                l4ArcRef.current.setAttribute('stroke-dasharray', `${sub.toFixed(1)} ${(C_L4 - sub + 10).toFixed(1)}`);
                l4ArcRef.current.setAttribute('stroke', stIdx === 5 ? '#ef2b2d' : '#1d6bff');
            }

            // L5 pills
            l5FillsRef.current.forEach(({ fill, label, len }, i) => {
                if (i < stIdx) {
                    fill.setAttribute('stroke-dasharray', `${len.toFixed(1)} 0`);
                    fill.setAttribute('stroke', '#ef2b2d');
                    fill.setAttribute('opacity', '0.85');
                    label.setAttribute('fill', '#cfcfcf');
                } else if (i === stIdx) {
                    const fl = len * stLoc;
                    fill.setAttribute('stroke-dasharray', `${fl.toFixed(1)} ${(len - fl).toFixed(1)}`);
                    fill.setAttribute('stroke', '#1d6bff');
                    fill.setAttribute('opacity', '1');
                    label.setAttribute('fill', '#fff');
                } else {
                    fill.setAttribute('stroke-dasharray', `0 ${len.toFixed(1)}`);
                    fill.setAttribute('opacity', '0');
                    label.setAttribute('fill', '#555');
                }
            });

            // L6 orbit: slow CCW rotation
            l6OrbitRef.current?.setAttribute('transform', `rotate(${(-now / 22) % 360})`);

            // HUD text updates
            const draw = (0.84 + Math.sin(now / 180) * 0.05 + (stIdx >= 4 ? 0.2 : 0)).toFixed(2) + 'A';
            const temp = (42 + Math.sin(now / 300) * 0.6 + stIdx * 0.4).toFixed(1) + '°C';
            if (hudDrawRef.current) hudDrawRef.current.innerHTML =
                `DRAW <b style="color:#fff;font-weight:500">${draw}</b> · TEMP <b style="color:#fff;font-weight:500">${temp}</b>`;
            if (hudStgRef.current) hudStgRef.current.textContent = stage.hud;
            if (hudLinkRef.current) hudLinkRef.current.innerHTML =
                `LINK&nbsp;<b style="color:#1d6bff;font-weight:500">${stage.link}</b>`;
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
                    l4ArcRef.current.setAttribute('stroke', '#ef2b2d');
                }
                // Fade out dial
                const dial = dialWrapRef.current;
                if (dial) {
                    dial.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    dial.style.opacity = '0';
                    dial.style.transform = 'scale(0.92)';
                }
                // Reveal end screen
                setTimeout(() => {
                    const end = endRef.current;
                    if (!end) return;
                    end.style.opacity = '1';
                    end.style.pointerEvents = 'auto';
                    autoRef.current = setTimeout(() => doExit(), 6000);
                }, 350);
                return;
            }

            rafRef.current = requestAnimationFrame(tick);
        }

        rafRef.current = requestAnimationFrame(tick);
        // Unconditional setInterval fallback — fires even when rAF is throttled
        // (kiosk iframe, background tab, some Pi compositors)
        ivRef.current = setInterval(() => { if (!ended) tick(); }, 33);

        return () => {
            cancelAnimationFrame(rafRef.current);
            if (ivRef.current) clearInterval(ivRef.current);
            if (autoRef.current) clearTimeout(autoRef.current);
        };
    }, []);

    // Static data
    const boxCode  = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('THE_BOX_UNIT_CODE') ?? '9942A')
        : '9942A';
    const qrCells  = buildQRCells();
    const daemonOk = isDaemonConnected;

    // ─────────────────────────────────────────────────────────────
    return (
        <div
            ref={stageRef}
            onClick={() => doExit()}
            style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', cursor: 'pointer', userSelect: 'none' }}
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
                @keyframes keyBlink { 50% { background: rgba(239,43,45,0.15) } }
            `}</style>

            {/* Background grid */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
                backgroundSize: '36px 36px',
                WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%,#000 30%,transparent 95%)',
                maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%,#000 30%,transparent 95%)',
            }} />

            {/* Vignette */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse 100% 90% at 50% 50%,transparent 55%,rgba(0,0,0,0.85) 100%)',
            }} />

            {/* Scanlines */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30,
                backgroundImage: 'repeating-linear-gradient(to bottom,rgba(255,255,255,0.018) 0px,rgba(255,255,255,0.018) 1px,transparent 1px,transparent 3px)',
                mixBlendMode: 'overlay', opacity: 0.5,
            }} />

            {/* Corner brackets */}
            {([
                { top: 24,    left: 24,  borderRight: 'none', borderBottom: 'none' },
                { top: 24,    right: 24, borderLeft:  'none', borderBottom: 'none' },
                { bottom: 24, left: 24,  borderRight: 'none', borderTop:    'none' },
                { bottom: 24, right: 24, borderLeft:  'none', borderTop:    'none' },
            ] as const).map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 22, height: 22, border: '2px solid #ef2b2d', pointerEvents: 'none', zIndex: 5, ...s }} />
            ))}

            {/* Top rail */}
            <div style={{
                position: 'absolute', top: 34, left: 48, right: 48, zIndex: 6,
                display: 'flex', alignItems: 'center', gap: 18, whiteSpace: 'nowrap',
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                letterSpacing: '0.32em', textTransform: 'uppercase', color: '#6a6a6a', pointerEvents: 'none',
            }}>
                <div style={{ width: 6, height: 6, background: '#ef2b2d', flexShrink: 0 }} />
                <span style={{ color: '#fff', fontWeight: 700 }}>THE BOX</span>
                <span style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                    <span>·</span>
                    <span>SYS · INIT</span>
                </span>
                <div style={{ flex: 1, height: 1, background: '#262626' }} />
                <span>OP_ID&nbsp;<span style={{ color: '#fff', fontWeight: 700 }}>{boxCode}</span></span>
                <span>v3.0_FIELD</span>
            </div>

            {/* Dial host */}
            <div ref={dialWrapRef} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '90px 48px' }}>
                <div style={{ position: 'relative', width: 'min(580px, 76vmin)', aspectRatio: '1' }}>

                    {/* SVG dial — children appended imperatively in useEffect */}
                    <svg
                        ref={svgRef}
                        viewBox="-260 -260 520 520"
                        style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
                    />

                    {/* HUD: top-left — KERNEL + version */}
                    <div style={{
                        position: 'absolute', top: 6, left: 6,
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                        letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6a6a6a',
                        display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none',
                    }}>
                        <div style={{ width: 5, height: 5, background: '#ef2b2d', flexShrink: 0 }} />
                        <span>KERNEL <span style={{ color: '#fff', fontWeight: 500 }}>6.6.21-RT</span></span>
                    </div>

                    {/* HUD: top-right — LINK (animated) */}
                    <div ref={hudLinkRef} style={{
                        position: 'absolute', top: 6, right: 6, textAlign: 'right',
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                        letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6a6a6a',
                        pointerEvents: 'none',
                    }}>
                        LINK&nbsp;<b style={{ color: '#1d6bff', fontWeight: 500 }}>RPI4→SELF</b>
                    </div>

                    {/* HUD: bottom-left — DRAW + TEMP (animated) */}
                    <div ref={hudDrawRef} style={{
                        position: 'absolute', bottom: 6, left: 6,
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                        letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6a6a6a',
                        pointerEvents: 'none',
                    }}>
                        DRAW <b style={{ color: '#fff', fontWeight: 500 }}>0.84A</b> · TEMP <b style={{ color: '#fff', fontWeight: 500 }}>42.0°C</b>
                    </div>

                    {/* HUD: bottom-right — stage label (animated) + daemon indicator */}
                    <div style={{
                        position: 'absolute', bottom: 6, right: 6, textAlign: 'right',
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                        letterSpacing: '0.18em', textTransform: 'uppercase',
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3,
                        pointerEvents: 'none',
                    }}>
                        <div ref={hudStgRef} style={{ color: '#ef2b2d', fontWeight: 700 }}>BOOTING…</div>
                        {/* Daemon connectivity indicator — uses isDaemonConnected prop */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: daemonOk ? '#22e07a' : '#6a6a6a' }}>
                            <div style={{
                                width: 4, height: 4,
                                background: daemonOk ? '#22e07a' : '#6a6a6a',
                                borderRadius: '50%',
                                boxShadow: daemonOk ? '0 0 0 2px rgba(34,224,122,0.25)' : 'none',
                            }} />
                            <span style={{ fontSize: 8 }}>{daemonOk ? 'DAEMON OK' : 'DAEMON…'}</span>
                        </div>
                    </div>

                    {/* Centre readout */}
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                fontFamily: "'Archivo',sans-serif", fontStyle: 'italic', fontWeight: 900,
                                fontSize: 'clamp(48px,7.4vmin,84px)', color: '#fff',
                                lineHeight: 0.86, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums',
                            }}>
                                <span ref={pctRef}>00</span>
                                <small style={{ color: '#ef2b2d', fontSize: '0.42em', marginLeft: 3, verticalAlign: '0.35em' }}>%</small>
                            </div>
                            <div style={{ marginTop: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '0.42em', color: '#6a6a6a', textTransform: 'uppercase' }}>
                                SYSTEM&nbsp;LOAD
                            </div>
                            <div ref={stageNmRef} style={{ marginTop: 5, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.34em', color: '#fff', textTransform: 'uppercase' }}>
                                KERNEL · INIT
                            </div>
                            <div ref={subStgRef} style={{ marginTop: 3, fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, letterSpacing: '0.28em', color: '#1d6bff', fontVariantNumeric: 'tabular-nums' }}>
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
                        fontFamily: "'Archivo',sans-serif", fontStyle: 'italic', fontWeight: 900,
                        fontSize: 'clamp(56px,11vw,140px)', lineHeight: 0.85,
                        letterSpacing: '-0.02em', color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>
                        THE&nbsp;BOX
                    </div>
                    {/* Red underline — ulIn animation matches reference exactly */}
                    <div style={{
                        position: 'absolute', left: '6%', right: '6%', bottom: -10, height: 5,
                        background: '#ef2b2d', boxShadow: '0 0 24px rgba(239,43,45,0.4)',
                        transformOrigin: 'left', animation: 'ulIn 1s cubic-bezier(0.2,0.8,0.2,1) 0.3s forwards',
                        transform: 'scaleX(0)',
                    }} />
                </div>

                {/* Subtitle */}
                <div style={{
                    display: 'flex', gap: 14, alignItems: 'center',
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                    letterSpacing: '0.4em', textTransform: 'uppercase', color: '#6a6a6a',
                }}>
                    <span>TABLE-TOP</span>
                    <div style={{ width: 5, height: 5, background: '#ef2b2d', transform: 'rotate(45deg)', flexShrink: 0 }} />
                    <span style={{ color: '#fff', letterSpacing: '0.36em' }}>REFEREE&nbsp;SCORING&nbsp;DEVICE</span>
                    <div style={{ width: 5, height: 5, background: '#ef2b2d', transform: 'rotate(45deg)', flexShrink: 0 }} />
                    <span>BMSCE</span>
                </div>

                {/* CTA row */}
                <div style={{
                    marginTop: 24, display: 'flex', gap: 36, alignItems: 'center',
                    opacity: 0, transform: 'translateY(8px)',
                    animation: 'ctaIn 0.5s ease-out 1.4s forwards',
                }}>
                    {/* QR block */}
                    <div onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                        <div style={{ border: '1px solid #1d6bff', padding: 14, background: 'rgba(29,107,255,0.05)', position: 'relative' }}>
                            <span style={{
                                position: 'absolute', top: 0, left: 10, transform: 'translateY(-50%)',
                                background: '#000', padding: '0 6px',
                                fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: '0.3em',
                                color: '#1d6bff', textTransform: 'uppercase',
                            }}>
                                SETUP_KEY
                            </span>
                            <svg viewBox="0 0 25 25" width={120} height={120} style={{ display: 'block' }} shapeRendering="crispEdges">
                                <rect width={25} height={25} fill="#000" />
                                {qrCells}
                            </svg>
                        </div>
                        <div style={{
                            marginTop: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                            letterSpacing: '0.3em', color: '#1d6bff', textTransform: 'uppercase', textAlign: 'center',
                        }}>
                            SCAN&nbsp;TO&nbsp;SETUP
                        </div>
                    </div>

                    {/* OR divider */}
                    <div style={{ width: 1, alignSelf: 'stretch', background: '#262626', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{
                            position: 'absolute', background: '#000', padding: '4px 6px',
                            fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '0.3em', color: '#6a6a6a',
                        }}>
                            OR
                        </span>
                    </div>

                    {/* Enter button */}
                    <button
                        onClick={e => { e.stopPropagation(); doExit(); }}
                        style={{
                            border: '1px solid #ef2b2d', background: 'rgba(239,43,45,0.08)',
                            padding: '16px 22px', cursor: 'pointer',
                            fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                            letterSpacing: '0.32em', textTransform: 'uppercase', color: '#fff',
                            display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', minWidth: 160,
                        }}
                    >
                        <span style={{
                            border: '1px solid #ef2b2d', padding: '4px 10px',
                            fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                            letterSpacing: '0.2em', color: '#ef2b2d', fontWeight: 700,
                            boxShadow: 'inset 0 -2px 0 rgba(239,43,45,0.4)',
                            animation: 'keyBlink 1.4s steps(2) infinite',
                        }}>
                            ⏎ ENTER
                        </span>
                        <span>ENTER&nbsp;DASHBOARD</span>
                        <small style={{ color: '#6a6a6a', fontSize: 9, letterSpacing: '0.32em' }}>
                            OR PRESS ANY BUTTON
                        </small>
                    </button>
                </div>
            </div>

            {/* Bottom rail */}
            <div style={{
                position: 'absolute', bottom: 34, left: 48, right: 48, zIndex: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                letterSpacing: '0.32em', textTransform: 'uppercase', color: '#6a6a6a', pointerEvents: 'none',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 6, height: 6, background: '#1d6bff', flexShrink: 0 }} />
                    <span>BMSCE&nbsp;·&nbsp;SPORTS DEPT &amp; ROBOTICS LAB</span>
                </div>
                <div style={{ flex: 1, height: 1, background: '#262626', margin: '0 18px' }} />
                <span>theboxbybmsce.in</span>
            </div>
        </div>
    );
};

export default SplashScreen;
