// src/components/refereebox/SplashScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — HUD / SCI-FI BOOT SEQUENCE
// Level: Pro Max UI/UX (Cyberpunk / FUI Aesthetic)
// Target: 1024x600 DSI Display (Raspberry Pi 4)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Activity, Database, Wifi, ShieldCheck, TerminalSquare } from 'lucide-react';

interface SplashScreenProps {
    isDaemonConnected: boolean;
    onComplete: () => void;
}

const BOOT_LOGS = [
    "INIT KERNEL 6.1.21-v8+ aarch64",
    "MOUNTING /boot/firmware [OK]",
    "LOADING I2C-BCM2835 DRIVER...",
    "DSI DISPLAY DETECTED: 1024x600@60Hz",
    "ALLOCATING FRAMEBUFFER...",
    "GPU: V3D 4.2 750MHz [ACTIVE]",
    "STARTING HARDWARE ABSTRACTION LAYER",
    "GPIO SUBSYSTEM: PINS 2-27 MAPPED",
    "INITIALIZING CLOCK ENGINE @ 100Hz",
    "BUZZER RELAY: PIN 18 [STANDBY]",
    "WEBSOCKET SERVER STARTING ON :3001",
    "CHECKING DAEMON INTEGRITY...",
    "MEM ALLOC: 0x00A4 0x1F2B 0x99C2",
    "SECURE ENCLAVE BYPASS [OK]",
    "AWAITING REFEREE AUTHENTICATION..."
];

const HEX_CHARS = "0123456789ABCDEF";
const generateHex = (length: number) => Array.from({ length }, () => HEX_CHARS[Math.floor(Math.random() * 16)]).join('');

const SplashScreen: React.FC<SplashScreenProps> = ({ isDaemonConnected, onComplete }) => {
    const [bootPhase, setBootPhase] = useState(0); // 0: Grid, 1: Logs, 2: Logo, 3: Awaiting Daemon, 4: Launch
    const [logs, setLogs] = useState<string[]>([]);
    const [hexDump, setHexDump] = useState<string[]>(Array(8).fill('0x00000000'));
    const [cpuLoad, setCpuLoad] = useState([20, 45, 12, 80, 50, 30, 90, 10]);
    const [progress, setProgress] = useState(0);

    const logEndRef = useRef<HTMLDivElement>(null);

    // Phase Controller
    useEffect(() => {
        setTimeout(() => setBootPhase(1), 400); // Start logs
        setTimeout(() => setBootPhase(2), 1200); // Glitch logo in
        setTimeout(() => setBootPhase(3), 2500); // Progress finished, wait for daemon
    }, []);

    // Daemon Handshake Controller
    useEffect(() => {
        if (bootPhase >= 3 && isDaemonConnected) {
            setBootPhase(4);
            setTimeout(() => onComplete(), 1200); // Flash and transition
        }
    }, [bootPhase, isDaemonConnected, onComplete]);

    // Boot Log Generator
    useEffect(() => {
        if (bootPhase < 1 || bootPhase >= 4) return;
        let i = 0;
        const interval = setInterval(() => {
            if (i < BOOT_LOGS.length) {
                setLogs(prev => [...prev.slice(-14), `[${(new Date().getTime() % 10000).toString().padStart(4, '0')}] ${BOOT_LOGS[i]}`]);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 120);
        return () => clearInterval(interval);
    }, [bootPhase]);

    // Telemetry Simulators
    useEffect(() => {
        if (bootPhase === 4) return;

        // Hex Dump
        const hexInterval = setInterval(() => {
            setHexDump(prev => [...prev.slice(-7), `0x${generateHex(8)}  0x${generateHex(8)}`]);
        }, 80);

        // CPU Chart
        const cpuInterval = setInterval(() => {
            setCpuLoad(prev => [...prev.slice(-19), Math.floor(Math.random() * 100)]);
        }, 150);

        return () => {
            clearInterval(hexInterval);
            clearInterval(cpuInterval);
        };
    }, [bootPhase]);

    // Progress Bar
    useEffect(() => {
        if (bootPhase >= 2 && progress < 100) {
            const pInt = setInterval(() => {
                setProgress(p => Math.min(p + (Math.random() * 12), 100));
            }, 50);
            return () => clearInterval(pInt);
        }
    }, [bootPhase, progress]);

    // Auto-scroll logs
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [logs]);

    return (
        <>
            <style>{`
        .fui-bg { background-color: #050505; }
        .fui-grid {
          background-image: 
            linear-gradient(rgba(0, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          background-position: center center;
        }
        .fui-crosshair {
          background: 
            linear-gradient(to right, #00f3ff 2px, transparent 2px) 0 0,
            linear-gradient(to right, #00f3ff 2px, transparent 2px) 100% 0,
            linear-gradient(to left, #00f3ff 2px, transparent 2px) 0 100%,
            linear-gradient(to left, #00f3ff 2px, transparent 2px) 100% 100%,
            linear-gradient(to bottom, #00f3ff 2px, transparent 2px) 0 0,
            linear-gradient(to bottom, #00f3ff 2px, transparent 2px) 100% 0,
            linear-gradient(to top, #00f3ff 2px, transparent 2px) 0 100%,
            linear-gradient(to top, #00f3ff 2px, transparent 2px) 100% 100%;
          background-repeat: no-repeat;
          background-size: 10px 10px;
        }
        .fui-clip-angled {
          clip-path: polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px));
        }
        .fui-clip-angled-reverse {
          clip-path: polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px);
        }
        .text-glow { text-shadow: 0 0 10px rgba(0, 243, 255, 0.6); }
        .text-glow-red { text-shadow: 0 0 10px rgba(255, 0, 60, 0.6); }
        .text-glow-green { text-shadow: 0 0 10px rgba(0, 255, 102, 0.6); }
        .box-glow { box-shadow: 0 0 15px rgba(0, 243, 255, 0.2), inset 0 0 20px rgba(0, 243, 255, 0.1); }
        
        @keyframes crt-scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(600px); }
        }
        .scanline {
          width: 100%; height: 100px;
          background: linear-gradient(to bottom, transparent, rgba(0, 243, 255, 0.1) 50%, transparent);
          position: absolute; top: 0; left: 0;
          animation: crt-scan 3s linear infinite;
          pointer-events: none; z-index: 50;
        }
        
        @keyframes glitch-anim {
          0% { clip-path: inset(10% 0 80% 0); transform: translate(-2px, 1px); }
          20% { clip-path: inset(80% 0 10% 0); transform: translate(2px, -1px); }
          40% { clip-path: inset(40% 0 30% 0); transform: translate(-1px, 2px); }
          60% { clip-path: inset(90% 0 5% 0); transform: translate(1px, -2px); }
          80% { clip-path: inset(20% 0 60% 0); transform: translate(-2px, 1px); }
          100% { clip-path: inset(50% 0 30% 0); transform: translate(2px, -1px); }
        }
        .glitch-text::before, .glitch-text::after {
          content: attr(data-text); position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        }
        .glitch-text::before {
          left: 3px; text-shadow: -2px 0 #ff003c;
          animation: glitch-anim 2s infinite linear alternate-reverse;
          background: transparent;
        }
        .glitch-text::after {
          left: -3px; text-shadow: -2px 0 #00f3ff;
          animation: glitch-anim 3s infinite linear alternate-reverse;
          background: transparent;
        }

        @keyframes radar-spin { 100% { transform: rotate(360deg); } }
        .animate-radar { animation: radar-spin 8s linear infinite; }
        .animate-radar-reverse { animation: radar-spin 12s linear infinite reverse; }
        
        @keyframes pulse-opacity { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-flicker { animation: pulse-opacity 0.1s infinite; }
        .animate-breathe { animation: pulse-opacity 2s ease-in-out infinite; }
      `}</style>

            <div className="w-[1024px] h-[600px] fui-bg text-[#00f3ff] font-mono overflow-hidden relative select-none flex items-center justify-center border-[4px] border-[#00f3ff]/20">

                {/* Environment Layers */}
                <div className="absolute inset-0 fui-grid opacity-30"></div>
                <div className="absolute inset-0 bg-gradient-to-radial from-transparent via-transparent to-black/80 z-10"></div>
                <div className="scanline"></div>

                {/* Global Corner Bracket Crosshairs */}
                <div className="absolute top-4 left-4 w-12 h-12 fui-crosshair opacity-70"></div>
                <div className="absolute top-4 right-4 w-12 h-12 fui-crosshair opacity-70 rotate-90"></div>
                <div className="absolute bottom-4 left-4 w-12 h-12 fui-crosshair opacity-70 -rotate-90"></div>
                <div className="absolute bottom-4 right-4 w-12 h-12 fui-crosshair opacity-70 rotate-180"></div>

                {/* ========================================================= */}
                {/* LEFT PANEL: TERMINAL LOGS & HEX DUMP                        */}
                {/* ========================================================= */}
                <div className={`absolute left-6 top-6 bottom-6 w-[280px] flex flex-col gap-4 transition-opacity duration-700 z-20 ${bootPhase >= 1 ? 'opacity-100' : 'opacity-0'}`}>

                    {/* Hex Dump Module */}
                    <div className="h-1/3 border border-[#00f3ff]/30 bg-black/40 fui-clip-angled p-3 flex flex-col relative box-glow">
                        <div className="text-[10px] tracking-widest text-[#00f3ff]/60 mb-2 flex items-center gap-2 border-b border-[#00f3ff]/20 pb-1">
                            <Database size={12} /> MEMORY_DUMP // BASE_ADDR
                        </div>
                        <div className="flex-1 overflow-hidden text-[10px] text-[#00f3ff]/50 leading-tight">
                            {hexDump.map((hex, i) => <div key={i}>{hex}</div>)}
                        </div>
                        {/* Blinking indicator */}
                        <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-[#00f3ff] animate-pulse"></div>
                    </div>

                    {/* Terminal Module */}
                    <div className="flex-1 border border-[#00f3ff]/30 bg-black/40 fui-clip-angled p-3 flex flex-col relative box-glow">
                        <div className="text-[10px] tracking-widest text-[#00f3ff]/60 mb-2 flex items-center gap-2 border-b border-[#00f3ff]/20 pb-1">
                            <TerminalSquare size={12} /> SYSLOG // DAEMON_INIT
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col justify-end text-[10px] leading-[1.4]">
                            {logs.map((log, i) => (
                                <div key={i} className="animate-in slide-in-from-bottom-2 fade-in duration-100">
                                    <span className="text-[#00f3ff]/40 mr-2">&gt;</span>
                                    {log.includes("[OK]") || log.includes("[ACTIVE]") ? (
                                        <span className="text-[#00ff66] text-glow-green">{log}</span>
                                    ) : log.includes("AWAITING") ? (
                                        <span className="text-[#ff003c] text-glow-red animate-pulse">{log}</span>
                                    ) : (
                                        <span className="text-[#00f3ff]/80">{log}</span>
                                    )}
                                </div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* RIGHT PANEL: TELEMETRY & STATUS                           */}
                {/* ========================================================= */}
                <div className={`absolute right-6 top-6 bottom-6 w-[280px] flex flex-col gap-4 transition-opacity duration-700 z-20 ${bootPhase >= 1 ? 'opacity-100' : 'opacity-0'}`}>

                    {/* Top Block: System Specs */}
                    <div className="h-24 border-l-2 border-r-2 border-[#00f3ff]/40 flex flex-col justify-center px-4 bg-gradient-to-r from-transparent via-[#00f3ff]/5 to-transparent">
                        <div className="text-[10px] text-[#00f3ff]/50 tracking-widest">SYS.ARCH: ARM64 CORTEX-A72</div>
                        <div className="text-[10px] text-[#00f3ff]/50 tracking-widest">NET.ADDR: 192.168.WLAN0</div>
                        <div className="text-[10px] text-[#00f3ff]/50 tracking-widest">VER.BLD : BOX-OS-V2.0.4</div>
                    </div>

                    {/* CPU Telemetry Module */}
                    <div className="h-1/3 border border-[#00f3ff]/30 bg-black/40 fui-clip-angled-reverse p-3 flex flex-col relative box-glow mt-4">
                        <div className="text-[10px] tracking-widest text-[#00f3ff]/60 mb-2 flex items-center gap-2 border-b border-[#00f3ff]/20 pb-1">
                            <Activity size={12} /> CORE_TELEMETRY // LIVE
                        </div>
                        <div className="flex-1 flex items-end gap-[2px] pt-2">
                            {cpuLoad.map((val, i) => (
                                <div key={i} className="flex-1 bg-[#00f3ff]/20 relative">
                                    <div
                                        className={`absolute bottom-0 w-full transition-all duration-150 ${val > 80 ? 'bg-[#ff003c] text-glow-red' : 'bg-[#00f3ff]'}`}
                                        style={{ height: `${val}%` }}
                                    ></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Network / Daemon Status Module */}
                    <div className="flex-1 border border-[#00f3ff]/30 bg-black/40 fui-clip-angled-reverse p-4 flex flex-col justify-between relative box-glow">
                        <div>
                            <div className="text-[10px] tracking-widest text-[#00f3ff]/60 mb-4 flex items-center gap-2 border-b border-[#00f3ff]/20 pb-1">
                                <Wifi size={12} /> DAEMON_UPLINK
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs">LOCAL_SERVER</span>
                                    <span className="text-[#00ff66] text-[10px] text-glow-green">ONLINE</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs">SOCKET_PORT</span>
                                    <span className="text-[#00f3ff] text-[10px]">3001</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs">HANDSHAKE</span>
                                    {isDaemonConnected ? (
                                        <span className="text-[#00ff66] text-[10px] text-glow-green">VERIFIED</span>
                                    ) : (
                                        <span className="text-[#ff003c] text-[10px] animate-pulse">PENDING</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Giant Status Box */}
                        <div className={`mt-4 w-full h-12 border flex items-center justify-center font-bold tracking-widest text-sm transition-all duration-300 ${isDaemonConnected ? 'border-[#00ff66] text-[#00ff66] bg-[#00ff66]/10 box-glow' : 'border-[#ff003c] text-[#ff003c] bg-[#ff003c]/10'}`}>
                            {isDaemonConnected ? (
                                <div className="flex items-center gap-2"><ShieldCheck size={16} /> SYNC SECURED</div>
                            ) : (
                                <div className="flex items-center gap-2 animate-breathe">AWAITING CONNECTION</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* CENTERPIECE: LOGO & PROGRESS RINGS                        */}
                {/* ========================================================= */}
                <div className={`relative flex flex-col items-center justify-center transition-all duration-1000 z-30 ${bootPhase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>

                    {/* Animated SVG Radar Rings */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                        <svg width="400" height="400" viewBox="0 0 400 400" className="animate-radar">
                            <circle cx="200" cy="200" r="180" fill="none" stroke="#00f3ff" strokeWidth="1" strokeDasharray="4 8" />
                            <path d="M 200 20 L 200 380 M 20 200 L 380 200" stroke="#00f3ff" strokeWidth="0.5" opacity="0.5" />
                        </svg>
                        <svg width="450" height="450" viewBox="0 0 450 450" className="absolute animate-radar-reverse">
                            <circle cx="225" cy="225" r="210" fill="none" stroke="#00f3ff" strokeWidth="2" strokeDasharray="60 40 10 40" />
                        </svg>
                    </div>

                    {/* Glitch Logo */}
                    <div className={`relative font-sans font-black italic tracking-tighter text-8xl leading-none text-white text-glow z-10 ${bootPhase === 2 ? 'glitch-text' : ''}`} data-text="THE BOX">
                        THE BOX
                    </div>

                    <div className="font-mono text-sm tracking-[0.4em] text-[#00f3ff] mt-2 bg-black/50 px-4 py-1 border-x-2 border-[#00f3ff] backdrop-blur-sm">
                        REFEREE CONSOLE v2.0
                    </div>

                    {/* Progress Bar Container */}
                    <div className="w-[300px] mt-12 relative">
                        <div className="flex justify-between text-[10px] text-[#00f3ff]/60 mb-2 tracking-widest">
                            <span>INITIALIZATION</span>
                            <span>{Math.floor(progress)}%</span>
                        </div>
                        {/* The Bar */}
                        <div className="w-full h-1 bg-[#00f3ff]/20 relative overflow-hidden">
                            <div
                                className="absolute top-0 left-0 h-full bg-[#00f3ff] box-glow transition-all duration-100 ease-out"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        {/* Geometric accents below bar */}
                        <div className="flex justify-between mt-1">
                            <div className="w-2 h-2 border-l border-b border-[#00f3ff]/40"></div>
                            <div className="w-2 h-2 border-r border-b border-[#00f3ff]/40"></div>
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* WHITE FLASH OVERLAY ON COMPLETION                         */}
                {/* ========================================================= */}
                <div className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-[800ms] ${bootPhase === 4 ? 'opacity-100 scale-105' : 'opacity-0 scale-100'}`}></div>

            </div>
        </>
    );
};

export default SplashScreen;