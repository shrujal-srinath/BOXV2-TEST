// src/components/ConnectControllerModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useHardware } from '../contexts/HardwareContext';
import { useTheme } from '../contexts/ThemeContext';

interface ConnectControllerModalProps {
    userId: string;
    onClose: () => void;
    onSuccess: (code: string) => void;
}

type ModalPhase =
    | 'input'
    | 'searching'
    | 'found'
    | 'handshaking'
    | 'confirmed'
    | 'error';

// ─── Animated Icon Components ─────────────────────────────────────────────────

const SearchingRings = () => (
    <div className="relative w-20 h-20 mx-auto">
        {[0, 1, 2].map(i => (
            <div
                key={i}
                className="absolute inset-0 rounded-full border border-amber-500/40 animate-ping"
                style={{ animationDelay: `${i * 0.35}s`, animationDuration: '1.4s' }}
            />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/60 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
        </div>
    </div>
);

const HandshakingRings = ({ code }: { code: string }) => (
    <div className="relative w-20 h-20 mx-auto">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" style={{ animationDuration: '1s' }} />
        <div className="absolute inset-2 rounded-full border-2 border-blue-500/40 animate-ping" style={{ animationDelay: '0.25s', animationDuration: '1s' }} />
        <div className="absolute inset-4 rounded-full border-2 border-blue-500/60 animate-ping" style={{ animationDelay: '0.5s', animationDuration: '1s' }} />
        <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-blue-400 text-sm font-black font-mono tracking-widest">{code}</span>
        </div>
    </div>
);

const ConfirmedIcon = () => (
    <div className="relative w-20 h-20 mx-auto">
        <div className="absolute inset-0 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        </div>
        {/* Glow */}
        <div className="absolute inset-0 rounded-full bg-green-500/20 blur-md" />
    </div>
);

const FoundIcon = () => (
    <div className="relative w-20 h-20 mx-auto">
        <div className="absolute inset-0 rounded-full bg-[#F0EAE2] dark:bg-zinc-900 border-2 border-[#D4CCC3] dark:border-white/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#6B5D4D] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
        </div>
    </div>
);

// ─── Phase config ─────────────────────────────────────────────────────────────
const PHASE_META: Record<ModalPhase, { bar: string; title: string }> = {
    input: { bar: 'bg-zinc-700', title: 'Connect Controller' },
    searching: { bar: 'bg-amber-500 animate-pulse', title: 'Searching...' },
    found: { bar: 'bg-blue-500', title: 'Device Found' },
    handshaking: { bar: 'bg-blue-500 animate-pulse', title: 'Handshaking...' },
    confirmed: { bar: 'bg-green-500', title: 'Controller Paired' },
    error: { bar: 'bg-red-500', title: 'Pairing Failed' },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const ConnectControllerModal: React.FC<ConnectControllerModalProps> = ({
    userId,
    onClose,
    onSuccess,
}) => {
    const [phase, setPhase] = useState<ModalPhase>('input');
    const [digits, setDigits] = useState(['', '', '', '']);
    const [errorMsg, setErrorMsg] = useState('');
    const [pairedCode, setPairedCode] = useState('');
    const [deviceOnline, setDeviceOnline] = useState(false);
    const [lastSeen, setLastSeen] = useState(0);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const { pair, unpair: unpairDevice, isConnected: contextOnline, lastSeenAt: contextLastSeen, deviceId } = useHardware();
    const transport = contextOnline ? 'supabase' : 'none';

    // ── On mount: restore if already paired this session ─────────────────────
    useEffect(() => {
        if (deviceId) {
            setPairedCode(deviceId);
            setDigits(deviceId.split(''));
            setPhase('confirmed');
        }
    }, [deviceId]);

    useEffect(() => {
        setDeviceOnline(contextOnline);
        setLastSeen(contextLastSeen);
    }, [contextOnline, contextLastSeen]);

    // ── Digit input ───────────────────────────────────────────────────────────
    const handleDigitChange = (index: number, value: string) => {
        if (!/^[a-zA-Z0-9]*$/.test(value)) return;
        const next = [...digits];
        next[index] = value.slice(-1).toUpperCase();
        setDigits(next);
        if (value && index < 3) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Enter') handlePair();
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const pasted = e.clipboardData.getData('text')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 4)
            .toUpperCase();
        if (pasted.length === 4) {
            setDigits(pasted.split(''));
            inputRefs.current[3]?.focus();
        }
        e.preventDefault();
    };

    // ── Main pairing action ───────────────────────────────────────────────────
    const handlePair = async () => {
        const code = digits.join('');
        if (code.length !== 4) {
            setErrorMsg('Enter all 4 characters.');
            return;
        }

        setErrorMsg('');

        const result = await pair(code, userId, (handshakePhase) => {
            // Map internal phases to modal phases
            const map: Record<string, ModalPhase> = {
                searching: 'searching',
                found: 'found',
                handshaking: 'handshaking',
                confirmed: 'confirmed',
                timeout: 'error',
            };
            setPhase(map[handshakePhase] || 'searching');
        });

        if (!result.success) {
            setPhase('error');
            setErrorMsg(result.message);
            return;
        }

        setPairedCode(code);
        setPhase('confirmed');
        onSuccess(code);
    };

    // ── Unpair ────────────────────────────────────────────────────────────────
    const handleUnpair = async () => {
        if (pairedCode) await unpairDevice(userId);
        setPhase('input');
        setDigits(['', '', '', '']);
        setPairedCode('');
        setDeviceOnline(false);
        setErrorMsg('');
    };

    const { bar, title } = PHASE_META[phase];
    const code = digits.join('');
    const canPair = code.length === 4 && phase === 'input';
    const isTransitioning = ['searching', 'found', 'handshaking'].includes(phase);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[#2C2419]/30 dark:bg-black/90 backdrop-blur-sm"
                onClick={isTransitioning ? undefined : onClose}
            />

            <div className="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-950 border border-[#D4CCC3] dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">

                {/* Top accent bar */}
                <div className={`h-0.5 w-full transition-all duration-500 ${bar}`} />

                <div className="p-8">
                    {/* ── HEADER ── */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <p className="text-[#8B7355] dark:text-zinc-600 text-[10px] font-bold uppercase tracking-[0.25em] mb-1 font-mono">
                                Hardware Controller
                            </p>
                            <h2 className="text-xl font-black text-[#2C2419] dark:text-white uppercase tracking-tight leading-none">
                                {title}
                            </h2>
                        </div>
                        {!isTransitioning && (
                            <button
                                onClick={onClose}
                                className="text-[#B8AD9F] dark:text-zinc-600 hover:text-[#2C2419] dark:hover:text-white transition-colors text-xl leading-none mt-0.5 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#EDE5DA] dark:hover:bg-zinc-800"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* ── PHASE: INPUT / ERROR ── */}
                    {(phase === 'input' || phase === 'error') && (
                        <div>
                            <p className="text-[#8B7355] dark:text-zinc-500 text-xs font-mono mb-6 leading-relaxed">
                                Power on your ESP32 controller. The 4-character pairing code will appear on its screen.
                            </p>

                            <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
                                {digits.map((d, i) => (
                                    <input
                                        key={i}
                                        ref={el => { inputRefs.current[i] = el; }}
                                        type="text"
                                        inputMode="text"
                                        maxLength={1}
                                        value={d}
                                        onChange={e => handleDigitChange(i, e.target.value)}
                                        onKeyDown={e => handleKeyDown(i, e)}
                                        autoFocus={i === 0}
                                        className={`w-14 h-16 text-center text-3xl font-black font-mono rounded-lg border-2 bg-[#F0EAE2] dark:bg-black text-[#2C2419] dark:text-white outline-none transition-all uppercase
                                            ${d ? 'border-[#C45832] dark:border-white' : 'border-[#D4CCC3] dark:border-zinc-800 focus:border-[#C45832] dark:focus:border-zinc-500'}
                                            ${phase === 'error' ? 'border-red-500 dark:border-red-800' : ''}
                                        `}
                                    />
                                ))}
                            </div>

                            {errorMsg && (
                                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg px-4 py-3 mb-5">
                                    <p className="text-red-600 dark:text-red-400 text-xs font-mono leading-relaxed">
                                        ⚠ {errorMsg}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handlePair}
                                disabled={!canPair}
                                className="w-full py-3.5 bg-[#C45832] dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest hover:bg-[#A84828] dark:hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-lg"
                            >
                                Pair Controller →
                            </button>
                        </div>
                    )}

                    {/* ── PHASE: SEARCHING ── */}
                    {phase === 'searching' && (
                        <div className="text-center py-4">
                            <SearchingRings />
                            <p className="text-amber-600 dark:text-amber-400 text-sm font-bold mt-6 mb-1">Searching for device</p>
                            <p className="text-[#8B7355] dark:text-zinc-600 text-xs font-mono">Looking for controller <span className="text-[#2C2419] dark:text-white">{code}</span>...</p>
                        </div>
                    )}

                    {/* ── PHASE: FOUND ── */}
                    {phase === 'found' && (
                        <div className="text-center py-4">
                            <FoundIcon />
                            <p className="text-[#2C2419] dark:text-white text-sm font-bold mt-6 mb-1">Device Found</p>
                            <p className="text-[#8B7355] dark:text-zinc-500 text-xs font-mono">Initiating pairing handshake...</p>
                        </div>
                    )}

                    {/* ── PHASE: HANDSHAKING ── */}
                    {phase === 'handshaking' && (
                        <div className="text-center py-4">
                            <HandshakingRings code={code} />
                            <p className="text-blue-600 dark:text-blue-400 text-sm font-bold mt-6 mb-1">Waiting for confirmation</p>
                            <p className="text-[#8B7355] dark:text-zinc-500 text-xs font-mono">ESP32 is confirming the link...</p>
                            <p className="text-[#B8AD9F] dark:text-zinc-700 text-[10px] font-mono mt-2">Check your device display</p>
                        </div>
                    )}

                    {/* ── PHASE: CONFIRMED ── */}
                    {phase === 'confirmed' && (
                        <div>
                            <div className="flex flex-col items-center mb-6">
                                <ConfirmedIcon />
                                <p className="text-green-600 dark:text-green-400 text-sm font-bold mt-4 mb-1">Controller Paired</p>
                                <p className="text-[#8B7355] dark:text-zinc-500 text-xs font-mono">Device is ready</p>
                            </div>

                            {/* Device status card */}
                            <div className="bg-[#F0EAE2] dark:bg-black border border-[#D4CCC3] dark:border-zinc-800 rounded-xl p-4 mb-6 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[#8B7355] dark:text-zinc-600 text-[10px] font-mono uppercase tracking-widest">Device ID</span>
                                    <span className="text-[#2C2419] dark:text-white font-black font-mono text-base tracking-widest">{pairedCode}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-[#8B7355] dark:text-zinc-600 text-[10px] font-mono uppercase tracking-widest">Status</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${deviceOnline ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
                                        <span className={`text-xs font-bold font-mono ${deviceOnline ? 'text-green-400' : 'text-zinc-500'}`}>
                                            {deviceOnline ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-[#8B7355] dark:text-zinc-600 text-[10px] font-mono uppercase tracking-widest">Transport</span>
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest
                                        ${transport === 'supabase'
                                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 text-blue-600 dark:text-blue-400'
                                            : 'bg-[#EDE5DA] dark:bg-zinc-900 border border-[#D4CCC3] dark:border-zinc-700 text-[#8B7355] dark:text-zinc-500'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${transport === 'supabase' ? 'bg-blue-400 animate-pulse' : 'bg-zinc-600'}`} />
                                        {transport === 'supabase' ? 'CLOUD RTDB' : 'DISCONNECTED'}
                                    </div>
                                </div>

                                {lastSeen > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#8B7355] dark:text-zinc-600 text-[10px] font-mono uppercase tracking-widest">Last Seen</span>
                                        <span className="text-[#6B5D4D] dark:text-zinc-400 text-[10px] font-mono">
                                            {deviceOnline ? 'Just now' : `${Math.round((Date.now() - lastSeen) / 1000)}s ago`}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-[#EDE5DA] dark:bg-zinc-900 hover:bg-[#E8DFD3] dark:hover:bg-zinc-800 border border-[#D4CCC3] dark:border-zinc-700 text-[#2C2419] dark:text-white font-bold text-sm uppercase tracking-widest transition-colors rounded-lg"
                                >
                                    Done
                                </button>
                                <button
                                    onClick={handleUnpair}
                                    className="py-3 px-4 border border-[#D4CCC3] dark:border-zinc-800 hover:border-red-400 dark:hover:border-red-800 text-[#B8AD9F] dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors text-xs font-bold uppercase tracking-widest rounded-lg"
                                >
                                    Unpair
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};