// src/pages/TvKiosk.tsx
// ═══════════════════════════════════════════════════════════════════════════
//  THE BOX  —  CASTING TERMINAL  v7   "IGNITION"
//  Built for 7360mm × 3200mm LED walls on Raspberry Pi 4
//
//  SPLASH — "BROADCAST IGNITION V8"
//    → Calibration: Red tracking grid + corner brackets + hex telemetry boot
//    → The Strike: Razor-thin red laser across centre → pulls back to exploding dot  
//    → The Monolith: Dot expands into massive red box. "THE" tracks left, "BOX" punches out
//    → Broadcast Wipe: Pulsing REC dot + subtitle → red flood → vanish → idle
//
//  IDLE — "ARENA"
//    Two-zone broadcast layout:
//    Left 65%:  THE BOX title + subtitle + code cards (bold tiles)
//    Right 35%: QR code with pulsing ring + scan label
//    Header bar + bottom telemetry bar
// ═══════════════════════════════════════════════════════════════════════════

import React, {
    useEffect, useState, useRef, useCallback, memo, useMemo,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    registerTvDisplay, startTvHeartbeat, subscribeTvDisplay,
    type TvDisplay,
} from '../services/tvDisplayService';
import { SpectatorView } from './SpectatorView';

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');

:root {
  --black:    #000000;
  --stone:    #1C1917;
  --stone-2:  #292524;
  --stone-3:  #44403C;
  --red:      #DC2626;
  --red-hi:   #ef4444;
  --gold:     #CA8A04;
  --gold-hi:  #EAB308;
  --green:    #22c55e;
  --white:    #FAFAF9;
  --expo:     cubic-bezier(0.16, 1, 0.3, 1);
  --snap:     cubic-bezier(0.33, 1, 0.68, 1);
  --slam:     cubic-bezier(0.22, 0.68, 0, 1.71);
}

/* ═══════════════════════════════════════
   SPLASH — "BROADCAST IGNITION V8"
═══════════════════════════════════════ */
:root {
  --v8-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --v8-snap: cubic-bezier(0.85, 0, 0.15, 1);
}

.v8-bg { 
  position: absolute; inset: 0; background: #050505; 
  overflow: hidden; z-index: 60; 
}

/* Background Grid & Vignette */
.v8-grid {
  position: absolute; inset: 0;
  background-image: 
    radial-gradient(circle at center, rgba(220,38,38,0.06) 0%, transparent 60%),
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 100% 100%, clamp(20px, 3vw, 50px) clamp(20px, 3vw, 50px), clamp(20px, 3vw, 50px) clamp(20px, 3vw, 50px);
  background-position: center; z-index: 1;
}

/* Hardware Scanlines Overlay */
.v8-scanlines {
  position: absolute; inset: 0; z-index: 50; pointer-events: none;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 3px, rgba(0,0,0,0.2) 4px);
}

/* Camera/Screen Corners */
.v8-corner { 
  position: absolute; width: clamp(30px, 5vw, 100px); height: clamp(30px, 5vw, 100px); 
  border: 2px solid var(--red); opacity: 0; z-index: 10; 
}
.v8-corner.tl { top: 4%; left: 3%; border-right: none; border-bottom: none; animation: v8-corner-in 0.8s var(--v8-expo) forwards; }
.v8-corner.tr { top: 4%; right: 3%; border-left: none; border-bottom: none; animation: v8-corner-in 0.8s 0.08s var(--v8-expo) forwards; }
.v8-corner.bl { bottom: 4%; left: 3%; border-right: none; border-top: none; animation: v8-corner-in 0.8s 0.12s var(--v8-expo) forwards; }
.v8-corner.br { bottom: 4%; right: 3%; border-left: none; border-top: none; animation: v8-corner-in 0.8s 0.18s var(--v8-expo) forwards; }

@keyframes v8-corner-in { 
  0% { opacity: 0; transform: scale(1.5); filter: drop-shadow(0 0 0 transparent); } 
  60% { opacity: 0.7; transform: scale(0.97); }
  100% { opacity: 0.5; transform: scale(1); filter: drop-shadow(0 0 6px rgba(220,38,38,0.3)); } 
}

/* The Horizontal Laser Strike */
.v8-strike-line {
  position: absolute; top: 50%; left: 0; right: 0; height: 2px;
  background: var(--red); box-shadow: 0 0 40px var(--red);
  transform-origin: center; transform: scaleX(0); opacity: 0; z-index: 20;
}
.v8-strike-line.animate { animation: v8-strike 0.8s var(--v8-snap) forwards; }
@keyframes v8-strike {
  0%   { transform: scaleX(0); opacity: 0; }
  15%  { transform: scaleX(0.6); opacity: 1; }
  25%  { transform: scaleX(1); opacity: 1; }
  50%  { transform: scaleX(1); opacity: 0.9; height: 2px; }
  55%  { opacity: 1; }
  100% { transform: scaleX(0); opacity: 0.8; height: clamp(6px,1vw,12px); box-shadow: 0 0 60px var(--red), 0 0 120px rgba(220,38,38,0.3); }
}

/* Main Text Center Stage */
.v8-center-group {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  display: flex; align-items: center; gap: clamp(16px, 2.5vw, 50px); z-index: 15;
}

/* Typography: "THE" */
.v8-text-the {
  font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: clamp(80px, 15vw, 280px);
  line-height: 0.9; color: var(--white); text-shadow: 0 0 30px rgba(250,250,249,0.15);
  opacity: 0; transform: translateX(40px) scale(0.97); letter-spacing: 0.02em;
}
.v8-text-the.animate { animation: v8-the-in 0.6s 0.05s var(--v8-expo) forwards; }
@keyframes v8-the-in { to { opacity: 1; transform: translateX(0) scale(1); } }

/* The Expanding Red Monolith */
.v8-red-box {
  width: clamp(140px, 25vw, 480px); height: clamp(80px, 15vw, 280px);
  background: var(--red); display: flex; align-items: center; justify-content: center;
  transform-origin: left center; transform: translate3d(0,0,0) scaleX(0) scaleY(0.05); overflow: hidden;
  box-shadow: 0 0 clamp(40px, 8vw, 140px) rgba(220,38,38,0.5); border-radius: 2px;
  will-change: transform;
}
.v8-red-box.animate { animation: v8-box-grow 0.7s var(--v8-expo) forwards; }
.v8-red-box.flood { transform-origin: center center; animation: v8-flood 0.4s var(--v8-snap) forwards; }

@keyframes v8-box-grow {
  0% { transform: scaleX(0) scaleY(0.03); }
  35% { transform: scaleX(1.02) scaleY(0.03); }
  45% { transform: scaleX(1) scaleY(0.03); }
  100% { transform: scaleX(1) scaleY(1); }
}
@keyframes v8-flood {
  0%   { transform: scale(1, 1); opacity: 1; }
  50%  { transform: scale(30, 30); opacity: 1; }
  100% { transform: scale(50, 50); opacity: 1; }
}

/* ═══ RADIAL IMPLOSION — splash collapses to a singularity ═══ */

/* The splash container itself implodes via clip-path */
.v8-bg.implode {
  animation: v8-implode 0.9s cubic-bezier(0.4, 0, 0.9, 0.4) forwards;
}
@keyframes v8-implode {
  0%   { clip-path: circle(150% at 50% 50%); filter: brightness(1) saturate(1); }
  50%  { clip-path: circle(15% at 50% 50%); filter: brightness(1.2) saturate(1.3); }
  80%  { clip-path: circle(4% at 50% 50%); filter: brightness(2) saturate(1.6); }
  95%  { clip-path: circle(0.5% at 50% 50%); filter: brightness(4) saturate(2); }
  100% { clip-path: circle(0% at 50% 50%); filter: brightness(6) saturate(2); }
}

/* Energy ring that shrinks with the implosion */
.v8-ring {
  position: absolute; top: 50%; left: 50%;
  width: 200vmax; height: 200vmax;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: clamp(2px, 0.3vw, 5px) solid rgba(255,255,255,0.6);
  box-shadow:
    0 0 clamp(30px,5vw,80px) rgba(255,255,255,0.3),
    0 0 clamp(60px,10vw,160px) rgba(220,38,38,0.4),
    inset 0 0 clamp(30px,5vw,80px) rgba(220,38,38,0.2);
  pointer-events: none; z-index: 72;
  opacity: 0;
}
.v8-ring.shrink {
  animation: v8-ring-shrink 0.9s cubic-bezier(0.4, 0, 0.9, 0.4) forwards;
}
@keyframes v8-ring-shrink {
  0%   { width: 200vmax; height: 200vmax; opacity: 0.7; border-width: clamp(2px,0.3vw,4px); }
  50%  { width: 25vmax; height: 25vmax; opacity: 1; border-width: clamp(3px,0.5vw,6px); }
  80%  { width: 6vmax; height: 6vmax; opacity: 1; border-width: clamp(4px,0.6vw,8px); }
  95%  { width: 1vmax; height: 1vmax; opacity: 1; border-width: clamp(3px,0.4vw,6px); }
  100% { width: 0; height: 0; opacity: 0; border-width: 0; }
}

/* Flash dot that explodes at the singularity point */
.v8-flash-dot {
  position: absolute; top: 50%; left: 50%;
  width: 0; height: 0; border-radius: 50%;
  background: #fff;
  transform: translate(-50%, -50%);
  z-index: 73; pointer-events: none;
  opacity: 0;
}
.v8-flash-dot.burst {
  animation: v8-dot-burst 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes v8-dot-burst {
  0%   { width: 0; height: 0; opacity: 1; box-shadow: 0 0 0 #fff; }
  25%  { width: clamp(24px,5vw,80px); height: clamp(24px,5vw,80px); opacity: 1;
         box-shadow: 0 0 clamp(50px,10vw,150px) #fff, 0 0 clamp(100px,20vw,300px) rgba(220,38,38,0.6); }
  60%  { opacity: 0.6; }
  100% { width: clamp(36px,6vw,100px); height: clamp(36px,6vw,100px); opacity: 0;
         box-shadow: 0 0 0 transparent; }
}

/* Typography: "BOX" inside Monolith */
.v8-text-box {
  font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: clamp(80px, 15vw, 280px);
  line-height: 0.9; color: #050505; letter-spacing: 0.02em;
  opacity: 0; transform: translateY(30px);
}
.v8-text-box.animate { animation: v8-box-text-in 0.5s 0.2s var(--v8-expo) forwards; }
@keyframes v8-box-text-in { to { opacity: 1; transform: translateY(0); } }

/* Subtitle & Pulse Indicator */
.v8-subtitle {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, calc(clamp(80px, 15vw, 280px) / 2 + clamp(20px, 3.5vw, 70px)));
  display: flex; align-items: center; gap: clamp(8px, 1vw, 20px);
  font-family: 'Barlow', sans-serif; font-weight: 600; font-size: clamp(10px, 1.5vw, 26px);
  letter-spacing: 0.45em; color: rgba(250,250,249,0.7); text-transform: uppercase;
  opacity: 0; z-index: 20; white-space: nowrap;
  will-change: transform, opacity;
}
.v8-subtitle.animate { animation: v8-sub-in 0.7s 0.4s var(--v8-expo) forwards; }
@keyframes v8-sub-in {
  0% { opacity: 0; transform: translate3d(-50%, calc(clamp(80px, 15vw, 280px) / 2 + clamp(20px, 3.5vw, 70px) + 20px), 0); }
  100% { opacity: 1; transform: translate3d(-50%, calc(clamp(80px, 15vw, 280px) / 2 + clamp(20px, 3.5vw, 70px)), 0); }
}

.v8-dot {
  width: clamp(6px, 0.8vw, 14px); height: clamp(6px, 0.8vw, 14px);
  background: var(--red); border-radius: 50%; box-shadow: 0 0 12px var(--red);
  animation: v8-pulse 1.5s infinite;
}
@keyframes v8-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }

/* Telemetry & Progress Block */
.v8-telemetry-block {
  position: absolute; z-index: 10; font-family: 'Barlow', monospace;
  font-size: clamp(8px, 0.9vw, 16px); color: rgba(250,250,249,0.3); line-height: 1.5;
  opacity: 0; animation: v8-fade 1s 0.5s forwards; letter-spacing: 0.1em;
}
.v8-tl-text { top: 6%; left: 5%; }
.v8-br-text { bottom: 6%; right: 5%; text-align: right; }
@keyframes v8-fade { to { opacity: 1; } }

.v8-progress-wrap {
  position: absolute; bottom: 0; left: 0; right: 0; height: clamp(2px, 0.3vw, 5px);
  background: rgba(255,255,255,0.05); z-index: 20;
}
.v8-progress-fill {
  height: 100%; background: var(--red); width: 0%; box-shadow: 0 0 15px var(--red);
}
.v8-progress-fill.animate { animation: v8-prog 3.8s linear forwards; }
@keyframes v8-prog { 0% { width: 0%; } 20% { width: 15%; } 50% { width: 60%; } 80% { width: 95%; } 100% { width: 100%; } }


/* ═══════════════════════════════════════
   IDLE — "ARENA"
═══════════════════════════════════════ */

/* Header slide down */
@keyframes id-header {
  from { opacity: 0; transform: translateY(-100%); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Content fade rise */
@keyframes id-rise {
  from { opacity: 0; transform: translate3d(0, clamp(12px,1.5vw,24px), 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}

/* Code card entrance */
@keyframes id-card-in {
  from { opacity: 0; transform: translateY(clamp(20px,2.5vw,40px)) scale(0.92); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* QR materialise */
@keyframes id-qr-in {
  from { opacity: 0; transform: scale(0.88) translate3d(0,0,0); } /* No blur */
  to   { opacity: 1; transform: scale(1) translate3d(0,0,0); }
}

/* QR ring pulse */
@keyframes id-qr-pulse {
  0%, 100% { box-shadow: 0 0 0 clamp(2px,0.3vw,4px) rgba(202,138,4,0.15); }
  50%      { box-shadow: 0 0 0 clamp(8px,1.2vw,18px) rgba(202,138,4,0.05); }
}

/* Bottom bar rise */
@keyframes id-bottom {
  from { opacity: 0; transform: translateY(100%); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Status dot pulse */
@keyframes dot-live {
  0%, 100% { opacity: 1; box-shadow: 0 0 clamp(6px,0.6vw,10px) var(--green); }
  50%      { opacity: 0.2; box-shadow: none; }
}
@keyframes dot-red {
  0%, 100% { opacity: 1; box-shadow: 0 0 clamp(6px,0.6vw,10px) var(--red); }
  50%      { opacity: 0.2; box-shadow: none; }
}

/* Clock flicker */
@keyframes clock-flicker {
  0%,100%{opacity:1} 94%{opacity:1} 94.4%{opacity:0.04} 94.8%{opacity:1}
  99%{opacity:0.03} 99.5%{opacity:1}
}

/* Offline banner pulse */
@keyframes offline-pulse {
  0%, 100% { background: rgba(220,38,38,0.06); }
  50%      { background: rgba(220,38,38,0.16); }
}

/* Particle drift */
@keyframes particle-drift {
  0%   { transform: translateY(0) translateX(0); opacity: 0; }
  10%  { opacity: 0.4; }
  90%  { opacity: 0.4; }
  100% { transform: translateY(clamp(-80px,-12vh,-200px)) translateX(clamp(20px,3vw,50px)); opacity: 0; }
}

/* Gold separator shimmer */
@keyframes sep-shimmer {
  0%   { top: -15%; opacity: 0; }
  8%   { opacity: 1; }
  92%  { opacity: 1; }
  100% { top: 115%; opacity: 0; }
}

/* Spinner rotation */
@keyframes qr-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

// ─── Live clock ───────────────────────────────────────────────────────────────
const LiveClock = memo(() => {
    const fmt = () => {
        const n = new Date();
        return [n.getHours(), n.getMinutes(), n.getSeconds()]
            .map(x => String(x).padStart(2, '0')).join(':');
    };
    const [t, setT] = useState(fmt);
    useEffect(() => { const id = setInterval(() => setT(fmt()), 1000); return () => clearInterval(id); }, []);
    return <>{t}</>;
});

// ═══════════════════════════════════════════════════════════════════════════════
//  V8 TELEMETRY SUB-COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const V8Telemetry = memo(({ position }: { position: 'tl' | 'br' }) => {
    const [lines, setLines] = useState<string[]>([]);

    useEffect(() => {
        const id = setInterval(() => {
            const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
            const ping = Math.floor(Math.random() * 999).toString().padStart(3, '0');
            setLines(prev => [`[${ping}] 0x${hex} OK`, ...prev].slice(0, 3));
        }, 120);
        return () => clearInterval(id);
    }, []);

    return (
        <div className={`v8-telemetry-block ${position === 'tl' ? 'v8-tl-text' : 'v8-br-text'}`}>
            <div style={{ color: 'var(--red)', fontWeight: 700, marginBottom: '6px' }}>
                {position === 'tl' ? 'SYSTEM.BOOT_SEQ // V8' : 'FRAME_SYNC // LOCKED'}
            </div>
            {lines.map((l, i) => (
                <div key={i} style={{ opacity: 1 - i * 0.35 }}>{l}</div>
            ))}
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SPLASH SCREEN — "BROADCAST IGNITION V8"
// ═══════════════════════════════════════════════════════════════════════════════
const SplashScreen = memo(({ onDone }: { onDone: () => void }) => {
    const [phase, setPhase] = useState(0);
    const aliveRef = useRef(true);

    useEffect(() => {
        aliveRef.current = true; // FIXES THE PREMATURE KILL BUG
        const alive = () => aliveRef.current;
        const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

        const run = async () => {
            // Phase 1: Grid + corners + telemetry + laser strike
            setPhase(1);
            await wait(800); if (!alive()) return;

            // Phase 2: Red monolith bursts from strike point
            setPhase(2);
            await wait(350); if (!alive()) return;

            // Phase 3: THE + BOX + subtitle animate in
            setPhase(3);
            await wait(2200); if (!alive()) return;

            // Phase 4: Red monolith floods from center
            setPhase(4);
            await wait(250); if (!alive()) return;

            // Phase 5: Radial implosion — splash collapses to singularity
            setPhase(5);
            await wait(950); if (!alive()) return;

            // Phase 6: Flash dot burst at center
            setPhase(6);
            await wait(400); if (!alive()) return;

            // Done — idle is fully visible
            onDone();
        };

        run();
        return () => { aliveRef.current = false; };
    }, [onDone]);

    if (phase >= 7) return null;

    const showStrike = phase >= 1 && phase < 4;
    const showGroup = phase >= 2 && phase < 5;
    const implode = phase >= 5;
    const flashDot = phase >= 6;

    return (
        <>
            <div className={`v8-bg ${implode ? 'implode' : ''}`}>
                {/* Ambient Background */}
                <div className="v8-grid" />
                <div className="v8-scanlines" />

                {/* Corner Framing */}
                <div className="v8-corner tl" />
                <div className="v8-corner tr" />
                <div className="v8-corner bl" />
                <div className="v8-corner br" />

                {/* Live Data Streams */}
                <V8Telemetry position="tl" />
                <V8Telemetry position="br" />

                {/* Bottom Boot Progress */}
                <div className="v8-progress-wrap">
                    <div className={`v8-progress-fill ${phase >= 1 ? 'animate' : ''}`} />
                </div>

                {/* Act 1: The Strike Line */}
                {showStrike && <div className="v8-strike-line animate" />}

                {/* Act 2/3: The Core Monolith Reveal */}
                {showGroup && (
                    <div className="v8-center-group">
                        {/* "THE" tracks in from the left */}
                        <div className={`v8-text-the ${phase >= 3 ? 'animate' : ''}`}>THE</div>

                        {/* Red block bursts to the right, swallowing the screen on Phase 4 */}
                        <div className={`v8-red-box animate ${phase >= 4 ? 'flood' : ''}`}>

                            {/* "BOX" cut out inside the red */}
                            <div className={`v8-text-box ${phase >= 3 ? 'animate' : ''}`}>BOX</div>
                        </div>
                    </div>
                )}

                {/* Subtitle Branding */}
                {showGroup && (
                    <div className={`v8-subtitle ${phase >= 3 ? 'animate' : ''}`}>
                        <div className="v8-dot" />
                        LIVE TOURNAMENT CASTING
                    </div>
                )}
            </div>

            {/* These render OUTSIDE v8-bg so they're not clipped by the implosion */}
            {/* Phase 5: Energy ring shrinks with the implosion */}
            <div className={`v8-ring ${implode ? 'shrink' : ''}`} />

            {/* Phase 6: Flash dot burst at singularity */}
            <div className={`v8-flash-dot ${flashDot ? 'burst' : ''}`} />
        </>
    );
});



const CodeCard = memo(({ char, index }: { char: string; index: number }) => (
    <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--stone)',
        borderRadius: 'clamp(8px,1vw,18px)',
        position: 'relative',
        overflow: 'hidden',
        aspectRatio: '0.78',
        maxHeight: 'clamp(120px,22vh,320px)',
        opacity: 0,
        animation: `id-card-in 0.6s ${0.3 + index * 0.1}s var(--expo) forwards`,
        border: '1px solid rgba(255,255,255,0.04)',
    }}>
        {/* Red bottom glow */}
        <div style={{
            position: 'absolute', bottom: 0, left: '15%', right: '15%',
            height: 'clamp(2px,0.25vw,4px)',
            background: 'linear-gradient(90deg, transparent, var(--red), transparent)',
            boxShadow: '0 0 clamp(10px,1.5vw,25px) rgba(220,38,38,0.4)',
            borderRadius: '2px',
        }} />

        {/* Index label */}
        <div style={{
            position: 'absolute',
            top: 'clamp(6px,0.8vw,14px)',
            left: 'clamp(8px,1vw,16px)',
            fontFamily: '"Barlow", sans-serif',
            fontWeight: 500,
            fontSize: 'clamp(6px,0.6vw,10px)',
            color: 'rgba(255,255,255,0.1)',
            letterSpacing: '0.2em',
        }}>
            0{index + 1}
        </div>

        {/* The character */}
        <div style={{
            fontFamily: '"Barlow Condensed", sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(48px,10vw,200px)',
            lineHeight: 1,
            color: 'var(--white)',
            userSelect: 'none',
            textShadow: '0 0 clamp(15px,2.5vw,50px) rgba(220,38,38,0.12)',
        }}>
            {char}
        </div>
    </div>
));

// ═══════════════════════════════════════════════════════════════════════════════
//  QR PANEL — simplified with pulsing ring
// ═══════════════════════════════════════════════════════════════════════════════
const QRPanel = memo(({ tvCode, castUrl }: { tvCode: string; castUrl: string }) => {
    const [loaded, setLoaded] = useState(false);
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&bgcolor=000000&color=FFFFFF&qzone=3&data=${encodeURIComponent(castUrl)}`;
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'thebox.app';

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            gap: 'clamp(12px,1.6vw,30px)',
            opacity: 0,
            animation: 'id-qr-in 0.9s 0.55s var(--expo) forwards',
        }}>
            {/* Label */}
            <div style={{
                fontFamily: '"Barlow", sans-serif',
                fontWeight: 500,
                fontSize: 'clamp(7px,0.7vw,12px)',
                letterSpacing: '0.5em',
                color: 'rgba(202,138,4,0.5)',
                textTransform: 'uppercase',
            }}>
                SCAN TO JOIN
            </div>

            {/* QR + pulsing ring */}
            <div style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {/* Pulsing ring */}
                <div style={{
                    position: 'absolute',
                    width: 'calc(100% + clamp(16px,2.5vw,40px))',
                    height: 'calc(100% + clamp(16px,2.5vw,40px))',
                    borderRadius: 'clamp(10px,1.3vw,22px)',
                    border: 'clamp(1px,0.12vw,2px) solid rgba(202,138,4,0.2)',
                    animation: 'id-qr-pulse 3s ease-in-out infinite',
                    pointerEvents: 'none',
                }} />

                {/* Loading spinner */}
                {!loaded && (
                    <div style={{
                        width: 'clamp(130px,18vh,300px)',
                        height: 'clamp(130px,18vh,300px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 'clamp(16px,1.8vw,28px)',
                            height: 'clamp(16px,1.8vw,28px)',
                            border: '2px solid rgba(202,138,4,0.2)',
                            borderTopColor: 'var(--gold)',
                            borderRadius: '50%',
                            animation: 'qr-spin 0.8s linear infinite',
                        }} />
                    </div>
                )}

                {/* QR image */}
                <img
                    src={qrSrc}
                    alt="Cast QR"
                    onLoad={() => setLoaded(true)}
                    style={{
                        display: loaded ? 'block' : 'none',
                        width: 'clamp(130px,18vh,300px)',
                        height: 'clamp(130px,18vh,300px)',
                        borderRadius: 'clamp(8px,1vw,18px)',
                        imageRendering: 'pixelated',
                    }}
                />
            </div>

            {/* URL */}
            <div style={{
                fontFamily: '"Barlow", sans-serif',
                fontWeight: 300,
                fontSize: 'clamp(6px,0.6vw,9px)',
                letterSpacing: '0.15em',
                color: 'rgba(255,255,255,0.12)',
                textAlign: 'center',
            }}>
                {hostname}/?cast={tvCode}
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PARTICLE FIELD — ambient floating dots
// ═══════════════════════════════════════════════════════════════════════════════
const ParticleField = memo(() => {
    const particles = useMemo(() =>
        Array.from({ length: 12 }, (_, i) => ({
            left: `${5 + (i * 8) % 90}%`,
            top: `${15 + (i * 13) % 70}%`,
            size: 1.5 + (i % 3) * 0.5,
            delay: i * 1.8,
            duration: 8 + (i % 5) * 3,
        })),
        []);

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
            {particles.map((p, i) => (
                <div key={i} style={{
                    position: 'absolute',
                    left: p.left,
                    top: p.top,
                    width: p.size,
                    height: p.size,
                    borderRadius: '50%',
                    background: 'rgba(202,138,4,0.25)',
                    animation: `particle-drift ${p.duration}s ${p.delay}s ease-in-out infinite`,
                }} />
            ))}
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  IDLE SCREEN — "ARENA"
// ═══════════════════════════════════════════════════════════════════════════════
const IdleScreen = memo(({
    tvCode, visible, registered, online,
}: {
    tvCode: string; visible: boolean; registered: boolean; online: boolean;
}) => {
    const castUrl = useMemo(() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://thebox.app';
        return `${origin}/?cast=${tvCode}`;
    }, [tvCode]);

    const codeChars = tvCode.split('').slice(0, 4);

    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: 'var(--black)',
            overflow: 'hidden',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.05s',
            pointerEvents: visible ? 'auto' : 'none',
        }}>
            {/* Ambient particles */}
            <ParticleField />

            {/* Subtle radial spotlight */}
            <div style={{
                position: 'absolute',
                left: '5%', top: '10%',
                width: '55%', height: '80%',
                background: 'radial-gradient(ellipse at 35% 40%, rgba(40,4,4,0.7) 0%, transparent 70%)',
                pointerEvents: 'none', zIndex: 0,
            }} />

            {/* ── HEADER BAR ── */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 'clamp(32px,3.8vw,64px)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center',
                padding: '0 clamp(22px,3vw,60px)',
                gap: 'clamp(10px,1.2vw,22px)',
                zIndex: 10,
                opacity: 0,
                animation: 'id-header 0.7s 0.08s var(--expo) forwards',
            }}>
                {/* Brand */}
                <span style={{
                    fontFamily: '"Barlow Condensed", sans-serif',
                    fontWeight: 700,
                    fontSize: 'clamp(13px,1.5vw,26px)',
                    letterSpacing: '0.15em',
                    color: 'rgba(250,250,249,0.7)',
                }}>THE BOX</span>

                <div style={{
                    width: 'clamp(3px,0.3vw,5px)', height: 'clamp(3px,0.3vw,5px)',
                    borderRadius: '50%', background: 'rgba(202,138,4,0.6)', flexShrink: 0,
                }} />

                <span style={{
                    fontFamily: '"Barlow", sans-serif',
                    fontWeight: 400,
                    fontSize: 'clamp(7px,0.65vw,10px)',
                    letterSpacing: '0.35em',
                    color: 'rgba(255,255,255,0.15)',
                    textTransform: 'uppercase',
                }}>Multi-Sport Scoring System</span>

                <div style={{ flex: 1 }} />

                {/* Status indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,0.6vw,10px)' }}>
                    <div style={{
                        width: 'clamp(5px,0.45vw,7px)', height: 'clamp(5px,0.45vw,7px)',
                        borderRadius: '50%',
                        background: !registered ? '#555' : online ? 'var(--green)' : 'var(--red-hi)',
                        animation: !registered ? 'none' : online ? 'dot-live 2.4s ease-in-out infinite' : 'dot-red 0.9s ease-in-out infinite',
                    }} />
                    <span style={{
                        fontFamily: '"Barlow", sans-serif',
                        fontWeight: 500,
                        fontSize: 'clamp(6px,0.58vw,9px)',
                        letterSpacing: '0.3em',
                        color: !registered
                            ? 'rgba(255,255,255,0.12)'
                            : online ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.55)',
                        textTransform: 'uppercase',
                    }}>
                        {!registered ? 'INITIALISING' : online ? 'READY' : 'OFFLINE'}
                    </span>
                </div>

                <div style={{ width: '1px', height: '40%', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

                {/* Clock */}
                <span style={{
                    fontFamily: '"Barlow", sans-serif',
                    fontWeight: 400,
                    fontSize: 'clamp(8px,0.8vw,13px)',
                    letterSpacing: '0.18em',
                    color: 'rgba(255,255,255,0.2)',
                    animation: 'clock-flicker 18s 9s linear infinite',
                    fontVariantNumeric: 'tabular-nums',
                }}>
                    <LiveClock />
                </span>
            </div>

            {/* ── TWO-ZONE CONTENT ── */}
            <div style={{
                position: 'absolute',
                top: 'clamp(32px,3.8vw,64px)',
                bottom: 'clamp(26px,3vw,50px)',
                left: 0, right: 0,
                display: 'flex',
                zIndex: 2,
            }}>
                {/* ═══ LEFT ZONE — brand + code cards ═══ */}
                <div style={{
                    flex: '0 0 65%',
                    display: 'flex', flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '0 clamp(28px,4.5vw,90px)',
                    gap: 'clamp(16px,2.5vw,50px)',
                }}>
                    {/* Title block */}
                    <div style={{
                        display: 'flex', flexDirection: 'column',
                        gap: 'clamp(6px,0.8vw,16px)',
                        opacity: 0,
                        animation: 'id-rise 0.8s 0.15s var(--expo) forwards',
                    }}>
                        <div style={{
                            fontFamily: '"Barlow Condensed", sans-serif',
                            fontWeight: 800,
                            fontSize: 'clamp(60px,14vw,280px)',
                            lineHeight: 0.88,
                            letterSpacing: '0.02em',
                            color: 'var(--white)',
                            userSelect: 'none',
                            textShadow: '0 0 clamp(20px,3vw,60px) rgba(220,38,38,0.15)',
                        }}>
                            THE <span style={{ color: 'var(--red)' }}>BOX</span>
                        </div>

                        {/* Gold underline */}
                        <div style={{
                            height: 'clamp(2px,0.22vw,3px)',
                            width: 'clamp(60px,10vw,200px)',
                            background: 'linear-gradient(90deg, var(--gold), transparent)',
                            borderRadius: '2px',
                        }} />

                        <div style={{
                            fontFamily: '"Barlow", sans-serif',
                            fontWeight: 400,
                            fontSize: 'clamp(9px,1.1vw,20px)',
                            letterSpacing: '0.4em',
                            color: 'rgba(250,250,249,0.22)',
                            textTransform: 'uppercase',
                        }}>
                            Live Tournament Casting
                        </div>
                    </div>

                    {/* Code section */}
                    <div style={{
                        display: 'flex', flexDirection: 'column',
                        gap: 'clamp(8px,1.2vw,22px)',
                    }}>
                        {/* Label */}
                        <div style={{
                            fontFamily: '"Barlow", sans-serif',
                            fontWeight: 500,
                            fontSize: 'clamp(7px,0.65vw,10px)',
                            letterSpacing: '0.45em',
                            color: 'rgba(202,138,4,0.4)',
                            textTransform: 'uppercase',
                            opacity: 0,
                            animation: 'id-rise 0.5s 0.5s var(--expo) forwards',
                        }}>
                            SCREEN CODE
                        </div>

                        {/* The 4 code cards */}
                        <div style={{
                            display: 'flex',
                            gap: 'clamp(8px,1.2vw,22px)',
                            maxWidth: 'clamp(300px,50vw,900px)',
                        }}>
                            {codeChars.map((ch, i) => (
                                <CodeCard key={i} char={ch} index={i} />
                            ))}
                        </div>

                        {/* Instruction */}
                        <div style={{
                            fontFamily: '"Barlow", sans-serif',
                            fontWeight: 300,
                            fontSize: 'clamp(7px,0.8vw,14px)',
                            letterSpacing: '0.25em',
                            color: 'rgba(250,250,249,0.14)',
                            textTransform: 'uppercase',
                            opacity: 0,
                            animation: 'id-rise 0.6s 0.8s var(--expo) forwards',
                        }}>
                            Enter code in host console · or scan QR →
                        </div>
                    </div>
                </div>

                {/* ═══ GOLD SEPARATOR ═══ */}
                <div style={{
                    flex: '0 0 1px',
                    position: 'relative',
                    background: 'rgba(202,138,4,0.12)',
                    overflow: 'visible',
                }}>
                    <div style={{
                        position: 'absolute',
                        left: '-1px', top: '-15%',
                        width: '3px',
                        height: 'clamp(30px,5vh,80px)',
                        background: 'linear-gradient(180deg, transparent, var(--gold), rgba(202,138,4,0.2), transparent)',
                        filter: 'blur(0.5px)',
                        animation: 'sep-shimmer 5s ease-in-out infinite 0.5s',
                    }} />
                </div>

                {/* ═══ RIGHT ZONE — QR ═══ */}
                <div style={{
                    flex: 1,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: 'clamp(16px,2.5vw,50px)',
                }}>
                    <QRPanel tvCode={tvCode} castUrl={castUrl} />
                </div>
            </div>

            {/* ── BOTTOM BAR ── */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 'clamp(26px,3vw,50px)',
                borderTop: '1px solid rgba(255,255,255,0.03)',
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center',
                padding: '0 clamp(20px,2.5vw,50px)',
                gap: 'clamp(14px,2vw,36px)',
                zIndex: 10,
                opacity: 0,
                animation: 'id-bottom 0.7s 1s var(--expo) forwards',
            }}>
                {/* LIVE badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(5px,0.55vw,9px)', flexShrink: 0 }}>
                    <div style={{
                        width: 'clamp(4px,0.3vw,5px)', height: 'clamp(4px,0.3vw,5px)',
                        borderRadius: '50%', background: 'var(--red)',
                        animation: 'dot-red 1.6s ease-in-out infinite',
                    }} />
                    <span style={{
                        fontFamily: '"Barlow", sans-serif', fontWeight: 600,
                        fontSize: 'clamp(6px,0.55vw,8px)', letterSpacing: '0.25em',
                        color: 'rgba(220,38,38,0.5)', textTransform: 'uppercase',
                    }}>LIVE</span>
                </div>

                <div style={{ width: '1px', height: '35%', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />

                <span style={{
                    fontFamily: '"Barlow", sans-serif', fontWeight: 300,
                    fontSize: 'clamp(6px,0.55vw,8px)', letterSpacing: '0.2em',
                    color: 'rgba(255,255,255,0.08)', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                    THE BOX · Pi4 Display · {tvCode}
                </span>

                <div style={{ flex: 1 }} />

                {online && registered && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(5px,0.55vw,9px)', flexShrink: 0 }}>
                        <div style={{
                            width: 'clamp(4px,0.3vw,5px)', height: 'clamp(4px,0.3vw,5px)',
                            borderRadius: '50%', background: 'var(--green)',
                            animation: 'dot-live 2s infinite',
                        }} />
                        <span style={{
                            fontFamily: '"Barlow", sans-serif', fontWeight: 400,
                            fontSize: 'clamp(6px,0.55vw,8px)', letterSpacing: '0.2em',
                            color: 'rgba(34,197,94,0.35)', textTransform: 'uppercase',
                        }}>NETWORK OK</span>
                    </div>
                )}
            </div>

            {/* ── OFFLINE BANNER ── */}
            {registered && !online && (
                <div style={{
                    position: 'absolute', top: 'clamp(32px,3.8vw,64px)', left: 0, right: 0,
                    padding: 'clamp(7px,0.8vw,14px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 'clamp(8px,1vw,16px)',
                    borderBottom: '1px solid rgba(220,38,38,0.15)',
                    animation: 'offline-pulse 1.4s ease-in-out infinite',
                    zIndex: 30,
                }}>
                    <div style={{
                        width: 'clamp(5px,0.5vw,7px)', height: 'clamp(5px,0.5vw,7px)',
                        borderRadius: '50%', background: 'var(--red-hi)',
                        animation: 'dot-red 0.9s infinite',
                    }} />
                    <span style={{
                        fontFamily: '"Barlow", sans-serif', fontWeight: 500,
                        fontSize: 'clamp(7px,0.7vw,11px)',
                        color: 'rgba(239,68,68,0.65)', letterSpacing: '0.3em', textTransform: 'uppercase',
                    }}>
                        NETWORK DISCONNECTED — ATTEMPTING RECONNECT
                    </span>
                </div>
            )}
        </div>
    );
});

// ─── TRANSITION WIPE ──────────────────────────────────────────────────────────
const WipeOverlay = memo(({ visible }: { visible: boolean }) => (
    <div style={{
        position: 'absolute', inset: 0, background: '#000', zIndex: 40,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: visible ? 'opacity 0s' : 'opacity 0.5s 0.2s',
    }} />
));

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export const TvKiosk: React.FC = () => {
    const [searchParams] = useSearchParams();

    // Auto-Provisioning: Generate a permanent unique code if none exists
    const [tvCode] = useState(() => {
        const urlCode = searchParams.get('code')?.toUpperCase();
        if (urlCode && urlCode.length === 4) {
            localStorage.setItem('tv_kiosk_code', urlCode);
            return urlCode;
        }

        const saved = localStorage.getItem('tv_kiosk_code');
        if (saved) return saved;

        // Generate a random 4-char code (omitting confusing chars like O/0, I/1)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let newCode = '';
        for (let i = 0; i < 4; i++) {
            newCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        localStorage.setItem('tv_kiosk_code', newCode);
        return newCode;
    });

    // ── Asset Preloading (Idea C) ──────────────────────────────────────────
    useEffect(() => {
        const preloadAssets = [
            '/sports/basketball.png',
            '/scanlines.svg',
            // Add any other heavy logos or custom sports textures here
        ];

        // Eagerly cache assets into the browser's disk memory so switching 
        // to SpectatorView doesn't cause a black flash while downloading.
        preloadAssets.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }, []);

    const [splashDone, setSplashDone] = useState(false);
    const [gameCode, setGameCode] = useState<string | null>(null);
    const [showGame, setShowGame] = useState(false);
    const [trans, setTrans] = useState(false);
    const [registered, setRegistered] = useState(false);
    const [online, setOnline] = useState(true);
    const prevGame = useRef<string | null>(null);
    const readyRef = useRef(false);

    const showGameRef = useRef(false);
    useEffect(() => {
        showGameRef.current = showGame;
    }, [showGame]);

    const handleUpdate = useCallback((nc: string | null) => {
        if (!readyRef.current) return;
        if (nc === prevGame.current) return;
        prevGame.current = nc;
        setOnline(true);

        if (nc && !showGameRef.current) {
            setTrans(true);
            setTimeout(() => { setGameCode(nc); setShowGame(true); setTrans(false); }, 500);
        } else if (!nc && showGameRef.current) {
            setTrans(true);
            setTimeout(() => { setShowGame(false); setGameCode(null); setTrans(false); }, 700);
        } else if (nc && showGameRef.current) {
            setTrans(true);
            setTimeout(() => { setGameCode(nc); setTrans(false); }, 350);
        }
    }, []);

    useEffect(() => {
        let stopHB: (() => void) | null = null;
        let unsub: (() => void) | null = null;
        let offT: ReturnType<typeof setTimeout>;

        const boot = async () => {
            try {
                // registerTvDisplay now returns current DB state instead of void.
                // If the host already cast before this page loaded, current.game_code
                // will be non-null and we jump straight to the game.
                const current = await registerTvDisplay(tvCode);
                setRegistered(true);
                setOnline(true);

                stopHB = startTvHeartbeat(tvCode);

                // Subscribe FIRST before setting readyRef=true.
                // This closes the window where a Realtime event could arrive
                // between ready=true and the subscription being attached.
                unsub = subscribeTvDisplay(tvCode, (d: TvDisplay) => {
                    setOnline(true);
                    clearTimeout(offT);
                    offT = setTimeout(() => setOnline(false), 25_000);
                    handleUpdate(d.game_code ?? null);
                });

                offT = setTimeout(() => setOnline(false), 25_000);

                // MUST set readyRef=true BEFORE calling handleUpdate —
                // handleUpdate guards on readyRef at the top.
                readyRef.current = true;

                // Process current DB state immediately.
                // Realtime only fires on CHANGES — if the cast was set before
                // this page loaded, no event will ever fire for it.
                handleUpdate(current.game_code ?? null);

            } catch (err) {
                console.warn('[TvKiosk] boot failed, retrying in 5s', err);
                setTimeout(boot, 5000);
            }
        };

        boot();

        return () => {
            readyRef.current = false;
            stopHB?.();
            unsub?.();
            clearTimeout(offT);
        };
    }, [tvCode]); // eslint-disable-line

    const handleSplashDone = useCallback(() => {
        setSplashDone(true);
    }, []);

    return (
        <>
            <style>{CSS}</style>
            <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>

                {!splashDone && <SplashScreen onDone={handleSplashDone} />}

                {/* Idle mounts as soon as splash done OR during splash phase 5+ (behind the wipe) */}
                <IdleScreen
                    tvCode={tvCode}
                    visible={splashDone && !showGame && !trans}
                    registered={registered}
                    online={online}
                />

                {gameCode && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 30,
                        opacity: showGame && !trans ? 1 : 0,
                        transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1)',
                    }}>
                        <SpectatorView gameCode={gameCode} />
                    </div>
                )}

                <WipeOverlay visible={trans} />
            </div>
        </>
    );
};

export default TvKiosk;