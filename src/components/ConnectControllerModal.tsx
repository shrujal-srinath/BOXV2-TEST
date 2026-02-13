// src/components/ConnectControllerModal.tsx
import React, { useState } from 'react';
import { linkHandheldDevice } from '../services/handheldService';

interface ConnectControllerModalProps {
    userId: string;
    onClose: () => void;
    onSuccess: (code: string) => void;
}

export const ConnectControllerModal: React.FC<ConnectControllerModalProps> = ({ userId, onClose, onSuccess }) => {
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<'idle' | 'linking' | 'error' | 'success'>('idle');
    const [message, setMessage] = useState('');

    const handleLink = async () => {
        if (code.length !== 4) return;

        setStatus('linking');
        setMessage('Searching for controller...');

        const result = await linkHandheldDevice(code, userId);

        if (result.success) {
            setStatus('success');
            setMessage('Controller Connected!');
            setTimeout(() => {
                onSuccess(code);
                onClose();
            }, 1000);
        } else {
            setStatus('error');
            setMessage(result.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal Content */}
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-sm p-8 relative z-10 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                        <span className="text-3xl">🎮</span>
                    </div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Connect Handheld</h2>
                    <p className="text-zinc-500 text-xs mt-2 font-mono">
                        Enter the 4-digit code displayed on your<br />ESP Controller screen.
                    </p>
                </div>

                {/* Input */}
                <div className="mb-6">
                    <input
                        type="text"
                        maxLength={4}
                        value={code}
                        onChange={(e) => {
                            // Only allow numbers
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setCode(val);
                            setStatus('idle');
                        }}
                        placeholder="0 0 0 0"
                        className="w-full bg-black border-2 border-zinc-800 focus:border-blue-500 text-center text-4xl font-mono text-white py-4 rounded-lg outline-none tracking-[0.5em] transition-all placeholder:text-zinc-800"
                        autoFocus
                    />
                </div>

                {/* Status Message */}
                {status !== 'idle' && (
                    <div className={`mb-6 text-center text-xs font-bold uppercase tracking-widest p-2 rounded ${status === 'error' ? 'text-red-500 bg-red-900/10' :
                            status === 'success' ? 'text-green-500 bg-green-900/10' :
                                'text-blue-500 animate-pulse'
                        }`}>
                        {message}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold uppercase tracking-widest text-xs rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleLink}
                        disabled={code.length !== 4 || status === 'linking'}
                        className={`flex-1 py-4 font-black uppercase tracking-widest text-xs rounded transition-all shadow-lg ${code.length === 4
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                            }`}
                    >
                        {status === 'linking' ? 'Linking...' : 'Connect'}
                    </button>
                </div>

            </div>
        </div>
    );
};