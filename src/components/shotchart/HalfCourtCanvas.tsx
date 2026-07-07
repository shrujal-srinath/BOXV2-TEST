// src/components/shotchart/HalfCourtCanvas.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Canvas Half-Court with Hex Grid
//
// Direct port of the zip's canvas-based court design into React.
// Dense honeycomb hex grid (each hex ~11cm radius) where every hex lights up
// on hover. Coach taps the most accurate hex to log shot location.
//
// Coordinate bridge:
//   App space:    x=[0,100], y=[0,94]  — y=0 at baseline, y=94 at half-court
//   Canvas space: pixel coords with PAD offset, y flipped (y=0 at half-court)
//
// Court standard: FIBA (15m × 14m half-court)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { classifyZone } from './courtZones';
import type { ShotZoneId } from './types/shotTypes';

// ── Public types ──────────────────────────────────────────────────────────────

export type CourtTheme = 'dark' | 'light' | 'wood';

export interface ShotDot {
    id: string;
    x: number; y: number;       // app coords [0-100, 0-94]
    made: boolean;
    points: 1 | 2 | 3;
    isLatest?: boolean;
}

export interface ZoneOverlay {
    zoneId: ShotZoneId;
    fgPct: number;
    fga: number;
    label: string;
}

export interface HalfCourtCanvasProps {
    shots?: ShotDot[];
    zoneOverlays?: ZoneOverlay[];
    onCourtTap?: (x: number, y: number) => void;
    interactive?: boolean;
    activeColor?: string;
    activeEdge?: 'A' | 'B' | null;
    pendingInfo?: { made: boolean; points: number } | null;
    courtTheme?: CourtTheme;
    hexOpacity?: number;        // 0–1, controls hex grid border visibility
    className?: string;
}

// ── FIBA court geometry (meters) ─────────────────────────────────────────────

const COURT_W_M = 15;
const COURT_H_M = 14;
const PX_PER_M  = 48;
const PAD        = 24;

const W  = COURT_W_M * PX_PER_M; // 720
const H  = COURT_H_M * PX_PER_M; // 672
const CW = W + PAD * 2;           // 768
const CH = H + PAD * 2;           // 720

// Basket in canvas-local coords (0,0 = top-left of court area, y increases downward)
// y=0 in canvas = half-court line  |  y=H in canvas = baseline
const BASKET_CX = W / 2;                          // 360
const BASKET_CY = H - 1.575 * PX_PER_M;          // ~596

// ── Coordinate conversion ─────────────────────────────────────────────────────
// App: x=[0,100] y=[0,94]  (0,0) = baseline corner, y grows toward half-court
// Canvas: pixel space, y=0 at top (half-court), y=H at bottom (baseline)

function appToCanvas(ax: number, ay: number): [number, number] {
    const cx = PAD + (ax / 100) * W;
    const cy = PAD + ((94 - ay) / 94) * H;
    return [cx, cy];
}

function canvasToApp(cx: number, cy: number): [number, number] {
    const ax = Math.max(0, Math.min(100, (cx - PAD) / W * 100));
    const ay = Math.max(0, Math.min(94, (1 - (cy - PAD) / H) * 94));
    return [ax, ay];
}

// ── Hex grid ─────────────────────────────────────────────────────────────────

const HEX_R   = 5.5;                            // hex radius px
const HEX_W   = Math.sqrt(3) * HEX_R;          // flat-to-flat width
const ROW_H   = HEX_R * 1.5;                   // row step (3/4 of full height)

// Pre-compute hex centres covering the court area
interface HexCenter { x: number; y: number }

function buildHexGrid(): HexCenter[] {
    const out: HexCenter[] = [];
    const cols = Math.ceil(W / HEX_W) + 2;
    const rows = Math.ceil(H / ROW_H) + 2;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = PAD + c * HEX_W + (r % 2 === 1 ? HEX_W / 2 : 0);
            const y = PAD + r * ROW_H;
            if (x >= PAD - HEX_R && x <= PAD + W + HEX_R &&
                y >= PAD - HEX_R && y <= PAD + H + HEX_R) {
                out.push({ x, y });
            }
        }
    }
    return out;
}

const HEX_CENTERS = buildHexGrid();

// Spatial hash for O(1) nearest-hex lookup
const CELL = HEX_R * 4;
const SPATIAL: Map<string, number[]> = new Map();
HEX_CENTERS.forEach((h, i) => {
    const key = `${Math.floor(h.x / CELL)},${Math.floor(h.y / CELL)}`;
    if (!SPATIAL.has(key)) SPATIAL.set(key, []);
    SPATIAL.get(key)!.push(i);
});

function findHex(mx: number, my: number): number {
    const gx = Math.floor(mx / CELL);
    const gy = Math.floor(my / CELL);
    let best = -1, bestD = HEX_R * 0.95;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const bucket = SPATIAL.get(`${gx + dx},${gy + dy}`);
            if (!bucket) continue;
            for (const i of bucket) {
                const d = Math.hypot(mx - HEX_CENTERS[i].x, my - HEX_CENTERS[i].y);
                if (d < bestD) { bestD = d; best = i; }
            }
        }
    }
    return best;
}

// ── Theme palette ─────────────────────────────────────────────────────────────

interface ThemeColors {
    courtBg: string;
    paintBg: string;
    line: string;
    lineW: number;
    rim: string;
    hexStroke: (opacity: number) => string;
    hexHoverMade: string;
    hexHoverMiss: string;
}

function getTheme(t: CourtTheme): ThemeColors {
    if (t === 'light') return {
        courtBg: '#E8E0D4', paintBg: '#D8CFC4',
        line: 'rgba(0,0,0,0.38)', lineW: 1.8,
        rim: 'rgba(200,60,30,0.75)',
        hexStroke: (o) => `rgba(0,0,0,${o * 0.45})`,
        hexHoverMade: 'rgba(34,197,94,0.35)',
        hexHoverMiss: 'rgba(239,68,68,0.35)',
    };
    if (t === 'wood') return {
        courtBg: '#B87840', paintBg: '#9A6030',
        line: 'rgba(255,255,255,0.48)', lineW: 1.8,
        rim: 'rgba(239,68,68,0.75)',
        hexStroke: (o) => `rgba(255,255,255,${o * 0.4})`,
        hexHoverMade: 'rgba(34,197,94,0.35)',
        hexHoverMiss: 'rgba(239,68,68,0.35)',
    };
    // dark (default)
    return {
        courtBg: '#080808', paintBg: '#0E0C08',
        line: 'rgba(255,255,255,0.45)', lineW: 1.8,
        rim: 'rgba(239,68,68,0.8)',
        hexStroke: (o) => `rgba(255,255,255,${o})`,
        hexHoverMade: 'rgba(34,197,94,0.35)',
        hexHoverMiss: 'rgba(239,68,68,0.35)',
    };
}

// ── Canvas drawing helpers ────────────────────────────────────────────────────

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (Math.PI / 3) * i;
        const px = cx + r * Math.cos(a);
        const py = cy + r * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function drawCourtLines(ctx: CanvasRenderingContext2D, tc: ThemeColors) {
    ctx.save();
    ctx.strokeStyle = tc.line;
    ctx.lineWidth = tc.lineW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cx = COURT_W_M / 2;   // 7.5m center
    const bly = COURT_H_M;      // baseline (bottom of court area)

    // Boundary
    ctx.beginPath();
    ctx.rect(PAD, PAD, W, H);
    ctx.stroke();

    // Half-court line + center semi-circle
    ctx.beginPath(); ctx.moveTo(PAD, PAD); ctx.lineTo(PAD + W, PAD); ctx.stroke();
    ctx.beginPath();
    ctx.arc(PAD + cx * PX_PER_M, PAD, 1.8 * PX_PER_M, 0, Math.PI);
    ctx.stroke();

    // Paint box (4.9m wide × 5.8m deep)
    const pL = cx - 2.45, pR = cx + 2.45;
    const pTop = bly - 5.8;
    ctx.beginPath();
    ctx.rect(PAD + pL * PX_PER_M, PAD + pTop * PX_PER_M, 4.9 * PX_PER_M, 5.8 * PX_PER_M);
    ctx.stroke();

    // FT circle (1.8m radius)
    ctx.beginPath();
    ctx.arc(PAD + cx * PX_PER_M, PAD + pTop * PX_PER_M, 1.8 * PX_PER_M, 0, Math.PI * 2);
    ctx.stroke();

    // Backboard (1.2m wide, at 1.2m from baseline)
    const bbY = bly - 1.2;
    ctx.lineWidth = tc.lineW + 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD + (cx - 0.6) * PX_PER_M, PAD + bbY * PX_PER_M);
    ctx.lineTo(PAD + (cx + 0.6) * PX_PER_M, PAD + bbY * PX_PER_M);
    ctx.stroke();
    ctx.lineWidth = tc.lineW;

    // Rim
    const rimY = bly - 1.575;
    ctx.strokeStyle = tc.rim;
    ctx.lineWidth = tc.lineW + 0.5;
    ctx.beginPath();
    ctx.arc(PAD + cx * PX_PER_M, PAD + rimY * PX_PER_M, 0.225 * PX_PER_M, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = tc.line;
    ctx.lineWidth = tc.lineW;

    // No-charge arc (1.25m, opens toward half-court)
    ctx.beginPath();
    ctx.arc(PAD + cx * PX_PER_M, PAD + rimY * PX_PER_M, 1.25 * PX_PER_M, Math.PI, 0, false);
    ctx.stroke();

    // 3pt line (FIBA: 6.75m arc, corner straights 0.9m from sideline)
    const tpR = 6.75 * PX_PER_M;
    const basketPX = PAD + cx * PX_PER_M;
    const basketPY = PAD + rimY * PX_PER_M;
    const cornerX = 0.9;
    const dxLeft  = (cornerX - cx) * PX_PER_M;        // negative
    const juncY   = Math.sqrt(tpR * tpR - dxLeft * dxLeft);
    const juncCanvasY = basketPY - juncY;

    const startAngle = Math.atan2(-juncY, dxLeft);
    const endAngle   = Math.atan2(-juncY, -dxLeft);

    ctx.beginPath();
    ctx.arc(basketPX, basketPY, tpR, startAngle, endAngle, false);
    ctx.stroke();

    const leftX  = PAD + cornerX * PX_PER_M;
    const rightX = PAD + (COURT_W_M - cornerX) * PX_PER_M;
    ctx.beginPath();
    ctx.moveTo(leftX,  PAD + H);
    ctx.lineTo(leftX,  juncCanvasY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightX, PAD + H);
    ctx.lineTo(rightX, juncCanvasY);
    ctx.stroke();

    // Lane marks (FIBA: 1.75m, 2.55m, 3.35m, 4.15m from baseline)
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = tc.line.replace(/[\d.]+\)$/, '0.2)');
    const laneMarks = [1.75, 2.55, 3.35, 4.15];
    laneMarks.forEach((d) => {
        const my = PAD + (bly - d) * PX_PER_M;
        const mLen = 8;
        ctx.beginPath();
        ctx.moveTo(PAD + pL * PX_PER_M - mLen / 2, my);
        ctx.lineTo(PAD + pL * PX_PER_M + mLen / 2, my);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(PAD + pR * PX_PER_M - mLen / 2, my);
        ctx.lineTo(PAD + pR * PX_PER_M + mLen / 2, my);
        ctx.stroke();
    });

    ctx.restore();
}

// Zone overlay: draw coloured tinted regions on canvas
function drawZoneOverlay(
    ctx: CanvasRenderingContext2D,
    overlays: ZoneOverlay[],
) {
    for (const o of overlays) {
        if (o.fga < 1) continue;
        const pct = o.fgPct;
        const alpha = 0.18;
        const color = pct >= 55 ? `rgba(34,197,94,${alpha})` :
                      pct >= 45 ? `rgba(34,197,94,${alpha * 0.6})` :
                      pct >= 35 ? `rgba(250,204,21,${alpha})` :
                      pct >= 25 ? `rgba(239,68,68,${alpha * 0.6})` :
                                  `rgba(239,68,68,${alpha})`;
        const textColor = pct >= 55 ? '#22C55E' : pct >= 35 ? '#FBBF24' : '#EF4444';

        // Zone bounding boxes in app coordinates → convert to canvas
        const zoneBounds: Record<string, [number, number, number, number]> = {
            restricted:           [42, 6, 58, 20],
            paint_left:           [33.67, 0, 50, 38.67],
            paint_right:          [50, 0, 66.33, 38.67],
            mid_baseline_left:    [14, 0, 33.67, 24],
            mid_baseline_right:   [66.33, 0, 86, 24],
            mid_elbow_left:       [14, 24, 33.67, 38.67],
            mid_elbow_right:      [66.33, 24, 86, 38.67],
            mid_top:              [28.67, 38.67, 71.33, 52],
            three_corner_left:    [0, 0, 14, 19.93],
            three_corner_right:   [86, 0, 100, 19.93],
            three_wing_left:      [0, 19.93, 22, 50],
            three_wing_right:     [78, 19.93, 100, 50],
            three_top_left:       [10, 50, 38, 74],
            three_top_right:      [62, 50, 90, 74],
            three_top_center:     [34, 50, 66, 74],
        };

        const bb = zoneBounds[o.zoneId];
        if (!bb) continue;
        const [ax1, ay1, ax2, ay2] = bb;
        // Note: ay1 < ay2 in app space BUT canvas y is flipped
        // ay=0 (baseline) → canvas y high, ay=94 (half-court) → canvas y low
        const [cx1, cy2] = appToCanvas(ax1, ay1); // ay1 small → high canvas y
        const [cx2, cy1] = appToCanvas(ax2, ay2); // ay2 large → low canvas y
        const rw = cx2 - cx1, rh = cy2 - cy1;

        ctx.fillStyle = color;
        ctx.fillRect(cx1, cy1, rw, rh);

        // Zone label
        const midX = (cx1 + cx2) / 2;
        const midY = (cy1 + cy2) / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath();
        ctx.roundRect(midX - 18, midY - 8, 36, 16, 3);
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.font = 'bold 9px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pct}%`, midX, midY - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '7px "Barlow", sans-serif';
        ctx.fillText(`${o.fga} att`, midX, midY + 5);
    }
}

// Draw shot dots (app coords → canvas)
function drawShots(ctx: CanvasRenderingContext2D, shots: ShotDot[], liveMode: boolean) {
    for (const s of shots) {
        if (liveMode && !s.isLatest) continue;
        const [cx, cy] = appToCanvas(s.x, s.y);
        const r = s.points === 3 ? 5 : s.points === 1 ? 3 : 4;

        if (s.made) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(34,197,94,0.9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            if (s.points === 3) {
                ctx.beginPath();
                ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fill();
            }
        } else {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 1;
            const s2 = r * 0.4;
            ctx.beginPath();
            ctx.moveTo(cx - s2, cy - s2); ctx.lineTo(cx + s2, cy + s2);
            ctx.moveTo(cx + s2, cy - s2); ctx.lineTo(cx - s2, cy + s2);
            ctx.stroke();
        }
    }
}

// Edge glow strip for active team
function drawEdgeGlow(ctx: CanvasRenderingContext2D, side: 'A' | 'B', color: string, alpha: number) {
    const grad = ctx.createLinearGradient(
        side === 'A' ? PAD : PAD + W, 0,
        side === 'A' ? PAD + 24 : PAD + W - 24, 0,
    );
    grad.addColorStop(0, color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(
        side === 'A' ? PAD : PAD + W - 24, PAD,
        24, H,
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export const HalfCourtCanvas: React.FC<HalfCourtCanvasProps> = ({
    shots = [],
    zoneOverlays,
    onCourtTap,
    interactive = false,
    activeColor = '#FBBF24',
    activeEdge = null,
    pendingInfo,
    courtTheme = 'dark',
    hexOpacity = 0.18,
    className = '',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hoveredRef = useRef(-1);
    const shotsRef = useRef(shots);
    const zoneRef  = useRef(zoneOverlays);
    const themeRef = useRef(courtTheme);
    const hexOpRef = useRef(hexOpacity);
    const activeEdgeRef = useRef(activeEdge);
    const pendingRef = useRef(pendingInfo);
    const rafRef = useRef<number>(0);

    // Keep refs in sync with props
    shotsRef.current   = shots;
    zoneRef.current    = zoneOverlays;
    themeRef.current   = courtTheme;
    hexOpRef.current   = hexOpacity;
    activeEdgeRef.current = activeEdge;
    pendingRef.current = pendingInfo;

    // Tooltip state
    const [tip, setTip] = useState<{ x: number; y: number; dist: string; zone: string } | null>(null);

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const tc  = getTheme(themeRef.current);

        ctx.clearRect(0, 0, CW * dpr, CH * dpr);

        // ── Court surface ──
        ctx.fillStyle = tc.courtBg;
        ctx.fillRect(PAD, PAD, W, H);

        // Paint area tint
        const pL = (COURT_W_M / 2 - 2.45) * PX_PER_M;
        const pTop = (COURT_H_M - 5.8) * PX_PER_M;
        ctx.fillStyle = tc.paintBg;
        ctx.fillRect(PAD + pL, PAD + pTop, 4.9 * PX_PER_M, 5.8 * PX_PER_M);

        // ── Zone overlays (heat map) ──
        if (zoneRef.current?.length) {
            drawZoneOverlay(ctx, zoneRef.current);
        }

        // ── Hex grid ──
        const hexStroke = tc.hexStroke(hexOpRef.current);
        const hovered = hoveredRef.current;
        const mode = pendingRef.current?.made !== false ? 'made' : 'missed';

        for (let i = 0; i < HEX_CENTERS.length; i++) {
            const h = HEX_CENTERS[i];
            const isHov = i === hovered;

            hexPath(ctx, h.x, h.y, HEX_R - 0.5);

            if (isHov && interactive) {
                const col = mode === 'made' ? '34,197,94' : '239,68,68';
                ctx.fillStyle = `rgba(${col},0.28)`;
                ctx.fill();
                ctx.save();
                ctx.shadowColor = `rgba(${col},0.7)`;
                ctx.shadowBlur = 10;
                ctx.strokeStyle = `rgba(${col},0.7)`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.restore();
            } else {
                ctx.strokeStyle = hexStroke;
                ctx.lineWidth = 0.4;
                ctx.stroke();
            }
        }

        // ── Court lines (drawn on top of hex grid) ──
        drawCourtLines(ctx, tc);

        // ── Active edge glow ──
        if (activeEdgeRef.current) {
            // Simple colour strip along the active sideline
            const isA = activeEdgeRef.current === 'A';
            const grd = ctx.createLinearGradient(
                isA ? PAD : PAD + W, PAD,
                isA ? PAD + 20 : PAD + W - 20, PAD,
            );
            grd.addColorStop(0, activeColor + '28');
            grd.addColorStop(1, 'transparent');
            ctx.fillStyle = grd;
            ctx.fillRect(isA ? PAD : PAD + W - 20, PAD, 20, H);
        }

        // ── Shot dots ──
        drawShots(ctx, shotsRef.current, false);

    }, [interactive, activeColor]);

    // Setup canvas size once
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width  = CW * dpr;
        canvas.height = CH * dpr;
        canvas.style.width  = '100%';
        canvas.style.height = '100%';
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
    }, []);

    // Re-render whenever props change
    useEffect(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(render);
        return () => cancelAnimationFrame(rafRef.current);
    }, [render, shots, zoneOverlays, courtTheme, hexOpacity, activeEdge, pendingInfo]);

    // Mouse move → hover hex + tooltip
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = CW / rect.width;
        const scaleY = CH / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top)  * scaleY;
        const idx = findHex(mx, my);

        if (idx !== hoveredRef.current) {
            hoveredRef.current = idx;
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(render);
        }

        if (idx >= 0) {
            const h = HEX_CENTERS[idx];
            const [ax, ay] = canvasToApp(h.x, h.y);
            // Distance from basket in metres
            const dxM = (ax / 100 * COURT_W_M) - COURT_W_M / 2;
            const dyM = ay / 94 * COURT_H_M;
            const distM = Math.hypot(dxM, dyM - 1.575);
            const zone = classifyZone(ax, ay);
            const zoneLabels: Record<string, string> = {
                restricted: 'RESTRICTED', paint_left: 'PAINT', paint_right: 'PAINT',
                mid_baseline_left: '2PT MID', mid_baseline_right: '2PT MID',
                mid_elbow_left: 'ELBOW', mid_elbow_right: 'ELBOW', mid_top: 'MID TOP',
                three_corner_left: 'CORNER 3', three_corner_right: 'CORNER 3',
                three_wing_left: 'WING 3', three_wing_right: 'WING 3',
                three_top_left: 'TOP 3', three_top_right: 'TOP 3', three_top_center: 'TOP 3',
            };
            setTip({
                x: e.clientX, y: e.clientY,
                dist: `${distM.toFixed(2)}m / ${(distM * 3.281).toFixed(1)}ft`,
                zone: zoneLabels[zone] || zone,
            });
        } else {
            setTip(null);
        }
    }, [render]);

    const handleMouseLeave = useCallback(() => {
        hoveredRef.current = -1;
        setTip(null);
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(render);
    }, [render]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!interactive || !onCourtTap) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = CW / rect.width;
        const scaleY = CH / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top)  * scaleY;
        // Reject taps outside the court; otherwise store the EXACT tapped point.
        // (Previously snapped to the nearest hex centre, which lost precision and
        //  could even drop valid taps near hex-cell corners. The hex grid remains
        //  the live heat *preview* only — see render.)
        if (mx < PAD || mx > PAD + W || my < PAD || my > PAD + H) return;
        const [ax, ay] = canvasToApp(mx, my);
        onCourtTap(ax, ay);
    }, [interactive, onCourtTap]);

    return (
        <div className={`relative w-full h-full ${className}`} style={{ aspectRatio: `${CW}/${CH}` }}>
            <canvas
                ref={canvasRef}
                onMouseMove={interactive ? handleMouseMove : undefined}
                onMouseLeave={interactive ? handleMouseLeave : undefined}
                onClick={interactive ? handleClick : undefined}
                style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    cursor: interactive ? 'crosshair' : 'default',
                    borderRadius: 'inherit',
                }}
            />

            {/* Distance + zone tooltip */}
            {tip && interactive && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{ left: tip.x + 16, top: tip.y - 10 }}
                >
                    <div className="bg-black/90 border border-zinc-700 rounded px-2.5 py-1.5 text-[11px] font-mono text-white whitespace-nowrap shadow-xl">
                        <div className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">From basket</div>
                        <div className="font-bold tabular-nums">{tip.dist}</div>
                        <div className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
                            tip.zone.includes('3') ? 'text-amber-400' :
                            tip.zone === 'RESTRICTED' || tip.zone === 'PAINT' ? 'text-emerald-400' :
                            'text-blue-400'
                        }`}>{tip.zone}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HalfCourtCanvas;
