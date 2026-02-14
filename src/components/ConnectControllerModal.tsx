// src/components/ConnectControllerModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { linkHandheldDevice, unlinkHandheldDevice, HW_SESSION_KEY } from '../services/handheldService';
import { useHardwareBridge } from '../hooks/useHardwareBridge';

interface ConnectControllerModalProps {
    userId: string;
    onClose: () => void;
    onSuccess: (code: string) => void;
}

type ModalPhase = 'input' | 'linking' | 'connected' | 'pending' | 'error';

export const ConnectControllerModal: React.FC<ConnectControllerModalProps> = ({
    userId,
    onClose,
    onSuccess,
}) => {
    const [phase, setPhase] = useState<ModalPhase>('input');
    const [digits, setDigits] = useState(['', '', '', '']);
    const [errorMsg, setErrorMsg] = useState('');
    const [linkedCode, setLinkedCode] = useState('');
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const linkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { isConnected, transport, latencyMs } = useHardwareBridge();

    // ── On mount: restore session only if we have a code AND confirmed live connection
    useEffect(() => {
        const existingCode = sessionStorage.getItem(HW_SESSION_KEY);
        if (existingCode && isConnected) {
            setLinkedCode(existingCode);
            setDigits(existingCode.split(''));
            setPhase('connected');
        }
    }, []); // intentionally empty — only runs on mount

    // ── While in 'linking' phase, watch for bridge confirmation
    useEffect(() => {
        if (phase === 'linking' && isConnected) {
            if (linkTimeoutRef.current) clearTimeout(linkTimeoutRef.current);
            setPhase('connected');
            onSuccess(linkedCode);
        }
    }, [isConnected, phase, linkedCode, onSuccess]);

    // ── If already connected and user re-opens modal, sync phase
    useEffect(() => {
        if (phase === 'pending' && isConnected) {
            setPhase('connected');
        }
    }, [isConnected, phase]);

    // ── Digit input handlers (UPDATED for Alphanumeric) ────────────────
    const handleDigitChange = (index: number, value: string) => {
        // Allow A-Z and 0-9 (Case insensitive check)
        if (!/^[a-zA-Z0-9]*$/.test(value)) return;

        const next = [...digits];
        // Take the last character typed and force Uppercase
        next[index] = value.slice(-1).toUpperCase();
        setDigits(next);

        // Auto-advance focus if value was entered
        if (value && index < 3) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        // Backspace handling
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        // Enter key to submit
        if (e.key === 'Enter') handleLink();
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        // Clean paste data: keep only alphanumeric, max 4 chars, force uppercase
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

    // ── Link action ──────────────────────────────────────────────
    const handleLink = async () => {
        const code = digits.join('');
        if (code.length !== 4) {
            setErrorMsg('Enter all 4 characters.');
            return;
        }

        setPhase('linking');
        setErrorMsg('');
        setLinkedCode(code);

        const result = await linkHandheldDevice(code, userId);

        if (!result.success) {
            setPhase('error');
            setErrorMsg(result.message);
            return;
        }

        // FIX: After 8 seconds with no heartbeat, go to 'pending' — NOT 'connected'.
        // 'pending' tells the user the code was accepted but the device hasn't responded yet.
        linkTimeoutRef.current = setTimeout(() => {
            setPhase(prev => {
                if (prev === 'linking') {
                    // Firestore linked but no live heartbeat yet
                    return 'pending';
                }
                return prev;
            });
        }, 8_000);
    };

    // ── Unlink ───────────────────────────────────────────────────
    const handleUnlink = async () => {
        if (linkTimeoutRef.current) clearTimeout(linkTimeoutRef.current);
        if (linkedCode) await unlinkHandheldDevice(linkedCode);
        setPhase('input');
        setDigits(['', '', '', '']);
        setLinkedCode('');
        setErrorMsg('');
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (linkTimeoutRef.current) clearTimeout(linkTimeoutRef.current);
        };
    }, []);

    // ── Transport badge ──────────────────────────────────────────
    const TransportBadge = () => {
        if (!isConnected) return null;
        const isWS = transport === 'websocket';
        return (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest
                ${isWS
                    ? 'bg-green-900/30 border border-green-700/50 text-green-400'
                    : 'bg-blue-900/30 border border-blue-700/50 text-blue-400'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isWS ? 'bg-green-400' : 'bg-blue-400'}`} />
                {isWS ? 'LOCAL WS' : 'CLOUD RTDB'}
                {latencyMs !== null && <span className="opacity-60 ml-1">{latencyMs}ms</span>}
            </div>
        );
    };

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                onClick={(phase === 'linking') ? undefined : onClose}
            />

            <div className="relative z-10 w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">

                {/* Top accent line */}
                <div className={`h-0.5 w-full ${phase === 'connected' ? 'bg-green-500' :
                    phase === 'pending' ? 'bg-amber-500 animate-pulse' :
                        phase === 'error' ? 'bg-red-500' :
                            phase === 'linking' ? 'bg-blue-500 animate-pulse' :
                                'bg-zinc-700'
                    }`} />

                <div className="p-8">

                    {/* ── HEADER ──────────────────────────────────── */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.25em] mb-1">
                                Hardware Controller
                            </p>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">
                                {phase === 'connected' ? 'Controller Online' :
                                    phase === 'pending' ? 'Waiting for Device...' :
                                        phase === 'linking' ? 'Establishing Link...' :
                                            phase === 'error' ? 'Link Failed' :
                                                'Connect Controller'}
                            </h2>
                        </div>
                        {phase !== 'linking' && (
                            <button
                                onClick={onClose}
                                className="text-zinc-600 hover:text-white transition-colors text-xl leading-none mt-0.5"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* ── PHASE: INPUT / ERROR ─────────────────────── */}
                    {(phase === 'input' || phase === 'error') && (
                        <div>
                            <p className="text-zinc-500 text-xs font-mono mb-6 leading-relaxed">
                                Power on your ESP32 controller. The 4-character pairing code will appear on its screen.
                            </p>

                            <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
                                {digits.map((d, i) => (
                                    <input
                                        key={i}
                                        ref={el => { inputRefs.current[i] = el; }}
                                        type="text"
                                        inputMode="text" /* CHANGED: was numeric */
                                        maxLength={1}
                                        value={d}
                                        onChange={e => handleDigitChange(i, e.target.value)}
                                        onKeyDown={e => handleKeyDown(i, e)}
                                        autoFocus={i === 0}
                                        className={`w-14 h-16 text-center text-3xl font-black font-mono rounded-lg border-2 bg-black text-white outline-none transition-all uppercase
                                            ${d ? 'border-white' : 'border-zinc-800 focus:border-zinc-500'}
                                            ${phase === 'error' ? 'border-red-800' : ''}
                                        `}
                                    />
                                ))}
                            </div>

                            {errorMsg && (
                                <p className="text-red-400 text-xs font-mono text-center mb-4">
                                    ⚠ {errorMsg}
                                </p>
                            )}

                            <button
                                onClick={handleLink}
                                disabled={digits.join('').length !== 4}
                                className="w-full py-3 bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Connect →
                            </button>
                        </div>
                    )}

                    {/* ── PHASE: LINKING ───────────────────────────── */}
                    {phase === 'linking' && (
                        <div className="text-center py-4">
                            <div className="relative w-16 h-16 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
                                <div className="absolute inset-2 rounded-full border-2 border-blue-500/40 animate-ping" style={{ animationDelay: '0.3s' }} />
                                <div className="absolute inset-4 rounded-full border-2 border-blue-500 animate-pulse" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-blue-400 text-xl font-black font-mono">{linkedCode}</span>
                                </div>
                            </div>
                            <p className="text-zinc-400 text-xs font-mono">
                                Searching for controller <span className="text-white font-bold">{linkedCode}</span>...
                            </p>
                            <p className="text-zinc-600 text-[10px] font-mono mt-2">
                                Make sure the controller is powered on and connected to WiFi
                            </p>
                        </div>
                    )}

                    {/* ── PHASE: PENDING ───────────────────────────── */}
                    {/* Linked in Firestore, but no heartbeat yet from device */}
                    {phase === 'pending' && (
                        <div className="text-center py-4">
                            <div className="w-12 h-12 mx-auto mb-6 rounded-full border-2 border-amber-500/40 flex items-center justify-center">
                                <span className="text-amber-400 text-lg font-black font-mono animate-pulse">{linkedCode}</span>
                            </div>
                            <p className="text-amber-400 text-xs font-mono mb-2">
                                Code accepted — waiting for device
                            </p>
                            <p className="text-zinc-600 text-[10px] font-mono leading-relaxed">
                                The controller will connect automatically once it boots and joins WiFi.
                            </p>
                            <button
                                onClick={handleUnlink}
                                className="mt-6 w-full py-2 border border-zinc-800 text-zinc-500 hover:border-red-800 hover:text-red-400 transition-colors text-xs font-bold uppercase tracking-widest rounded"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* ── PHASE: CONNECTED ─────────────────────────── */}
                    {phase === 'connected' && (
                        <div>
                            <div className="bg-black border border-zinc-800 rounded-lg p-4 mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Device ID</span>
                                    <span className="text-white font-black font-mono text-lg">{linkedCode}</span>
                                </div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Status</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                                        <span className={`text-xs font-bold ${isConnected ? 'text-green-400' : 'text-amber-400'}`}>
                                            {isConnected ? 'LIVE' : 'STANDBY'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Transport</span>
                                    <TransportBadge />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleUnlink}
                                    className="flex-1 py-3 border border-zinc-800 text-zinc-500 hover:border-red-800 hover:text-red-400 transition-colors text-xs font-bold uppercase tracking-widest rounded"
                                >
                                    Unlink
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-colors rounded"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};