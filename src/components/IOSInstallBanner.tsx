// src/components/IOSInstallBanner.tsx
// ─────────────────────────────────────────────────────────────
// Shows ONLY on iOS Safari (iPad Air 2 target).
// Android/Chrome users see the normal beforeinstallprompt button.
// Website users never see this unless they're on the /tablet/* path
// or explicitly import it.
//
// USAGE — drop into StandaloneTablet.tsx or LandingPage:
//
//   import { IOSInstallBanner } from '../components/IOSInstallBanner';
//   ...
//   <IOSInstallBanner />          ← auto-hides when not needed
//
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { Share, X, Home, ChevronUp } from 'lucide-react';

// ── Detection helpers ─────────────────────────────────────

/** True when running on iOS (iPhone / iPad / iPod) */
const isIOS = (): boolean =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad Air 2 on iOS 13+ reports as "Macintosh" — catch it:
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** True when already installed / running as standalone PWA */
const isStandalone = (): boolean =>
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

/** True when running in Safari (not Chrome/Firefox on iOS) */
const isIOSSafari = (): boolean => {
    const ua = navigator.userAgent;
    return isIOS() && /safari/i.test(ua) && !/crios|fxios|opios|mercury/i.test(ua);
};

const DISMISSED_KEY = 'BOX_IOS_INSTALL_DISMISSED';

// ── Component ─────────────────────────────────────────────

export const IOSInstallBanner: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Only show if:
        //  1. Running on iOS Safari
        //  2. NOT already installed
        //  3. User hasn't permanently dismissed it
        const dismissed = sessionStorage.getItem(DISMISSED_KEY);
        if (isIOSSafari() && !isStandalone() && !dismissed) {
            // Small delay so it doesn't flash on first paint
            const t = setTimeout(() => setVisible(true), 1200);
            return () => clearTimeout(t);
        }
    }, []);

    const handleDismiss = () => {
        sessionStorage.setItem(DISMISSED_KEY, '1');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <>
            {/* Backdrop blur for bottom sheet feel */}
            <div className="fixed inset-0 z-40 pointer-events-none bg-black/30" />

            {/* Bottom sheet */}
            <div
                className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
                style={{ animation: 'slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1) both' }}
            >
                {/* ── SHEET ── */}
                <div
                    className="mx-3 mb-3 rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl"
                    style={{ background: 'linear-gradient(145deg, #111 0%, #0a0a0a 100%)' }}
                >
                    {/* drag handle */}
                    <div className="flex justify-center pt-3 pb-1">
                        <div className="w-10 h-1 rounded-full bg-zinc-700" />
                    </div>

                    {/* header */}
                    <div className="flex items-start justify-between px-5 pt-3 pb-4">
                        <div className="flex items-center gap-4">
                            {/* app icon mockup */}
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center border border-zinc-700 flex-none"
                                style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #000 100%)' }}
                            >
                                <span className="text-yellow-500 font-black text-xl tracking-tighter">TB</span>
                            </div>
                            <div>
                                <div className="text-white font-black text-base uppercase tracking-widest">The Box</div>
                                <div className="text-zinc-500 text-xs mt-0.5">Referee Console · Offline App</div>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="p-1.5 text-zinc-500 hover:text-white transition-colors mt-0.5"
                            aria-label="Dismiss"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* divider */}
                    <div className="h-px bg-zinc-800 mx-5" />

                    {/* install steps */}
                    <div className="px-5 py-4">
                        <p className="text-zinc-400 text-xs mb-4">
                            Install this app on your iPad for the full referee experience — works offline, no login required.
                        </p>

                        <div className="space-y-3">
                            <Step
                                number={1}
                                icon={<ChevronUp size={16} className="text-blue-400" />}
                                label={<>Tap the <strong className="text-white">Share</strong> button in Safari's toolbar</>}
                                hint="The box with an arrow pointing up"
                            />
                            <Step
                                number={2}
                                icon={<Home size={16} className="text-blue-400" />}
                                label={<>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong></>}
                                hint="You may need to scroll the share sheet"
                            />
                            <Step
                                number={3}
                                icon={<Share size={16} className="text-yellow-500" />}
                                label={<>Tap <strong className="text-white">"Add"</strong> in the top-right corner</>}
                                hint="The icon will appear on your home screen"
                            />
                        </div>
                    </div>

                    {/* visual share button indicator */}
                    <div className="px-5 pb-5">
                        <div
                            className="rounded-xl border border-zinc-800 p-3 flex items-center gap-3"
                            style={{ background: 'rgba(59,130,246,0.05)' }}
                        >
                            <div className="flex-none w-8 h-8 rounded-lg bg-blue-900/40 border border-blue-700/50 flex items-center justify-center">
                                <Share size={14} className="text-blue-400" />
                            </div>
                            <div>
                                <div className="text-zinc-400 text-[11px]">
                                    Look for this icon in your Safari toolbar
                                </div>
                                <div className="text-zinc-600 text-[10px] mt-0.5">
                                    Usually at the bottom of the screen on iPad
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* dismiss */}
                    <div className="px-5 pb-5">
                        <button
                            onClick={handleDismiss}
                            className="w-full py-3 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-colors"
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
        </>
    );
};

// ── Step sub-component ─────────────────────────────────────

interface StepProps {
    number: number;
    icon: React.ReactNode;
    label: React.ReactNode;
    hint: string;
}

const Step: React.FC<StepProps> = ({ number, icon, label, hint }) => (
    <div className="flex items-start gap-3">
        {/* step number */}
        <div className="flex-none w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mt-0.5">
            <span className="text-zinc-400 text-[10px] font-black">{number}</span>
        </div>

        {/* icon + text */}
        <div className="flex items-start gap-2.5 flex-1">
            <div className="flex-none mt-0.5">{icon}</div>
            <div>
                <div className="text-zinc-300 text-xs leading-snug">{label}</div>
                <div className="text-zinc-600 text-[10px] mt-0.5">{hint}</div>
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────
// SmallIOSHint — a lighter inline version for when you just
// want a single-line nudge inside an existing component
// (e.g. in StandaloneTablet's status bar area):
//
//   <SmallIOSHint />
//
// ─────────────────────────────────────────────────────────────

export const SmallIOSHint: React.FC = () => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isIOSSafari() && !isStandalone()) setShow(true);
    }, []);

    if (!show) return null;

    return (
        <div className="flex items-center gap-2 text-[10px] text-blue-400 font-mono uppercase tracking-wider">
            <Share size={10} />
            <span>Tap Share → Add to Home Screen for offline use</span>
        </div>
    );
};