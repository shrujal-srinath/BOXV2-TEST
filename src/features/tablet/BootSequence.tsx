// src/features/tablet/BootSequence.tsx
import React, { useState, useEffect } from 'react';

interface BootStep {
  msg: string;
  delay: number;
  type?: 'info' | 'success' | 'warning';
}

const BOOT_STEPS: BootStep[] = [
  { msg: '█ INITIALIZING BOX-V2 REFEREE OS...', delay: 500, type: 'info' },
  { msg: '█ CHECKING HARDWARE INTEGRITY... [OK]', delay: 400, type: 'success' },
  { msg: '█ LOADING BASKETBALL PROTOCOL v2.1.0', delay: 600, type: 'info' },
  { msg: '█ CALIBRATING TOUCH SENSORS... [OK]', delay: 500, type: 'success' },
  { msg: '█ INITIALIZING HAPTIC ENGINE', delay: 400, type: 'info' },
  { msg: '█ ESTABLISHING NETWORK CONNECTION', delay: 700, type: 'info' },
  { msg: '█ SYNCING WITH CLOUD SCOREBOARD... [OK]', delay: 600, type: 'success' },
  { msg: '█ LOADING OFFLINE CACHE', delay: 400, type: 'info' },
  { msg: '█ SECURITY CHECK PASSED', delay: 300, type: 'success' },
  { msg: '█ ALL SYSTEMS NOMINAL', delay: 400, type: 'success' },
  { msg: '', delay: 200 },
  { msg: '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%', delay: 600, type: 'success' },
  { msg: '', delay: 300 },
  { msg: '>> SYSTEM READY - AUTHORIZED DEVICE ONLY', delay: 400, type: 'warning' },
];

export const BootSequence: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [visibleSteps, setVisibleSteps] = useState<BootStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check if we've already booted this session
    const hasBooted = sessionStorage.getItem('BOX_V2_BOOTED');
    if (hasBooted) {
      onComplete();
      return;
    }

    if (currentIndex < BOOT_STEPS.length) {
      const step = BOOT_STEPS[currentIndex];
      const timer = setTimeout(() => {
        setVisibleSteps(prev => [...prev, step]);
        setCurrentIndex(prev => prev + 1);
        setProgress(((currentIndex + 1) / BOOT_STEPS.length) * 100);
      }, step.delay);

      return () => clearTimeout(timer);
    } else {
      // Boot complete
      const finalTimer = setTimeout(() => {
        sessionStorage.setItem('BOX_V2_BOOTED', 'true');
        onComplete();
      }, 800);
      return () => clearTimeout(finalTimer);
    }
  }, [currentIndex, onComplete]);

  const getStepColor = (type?: string) => {
    switch (type) {
      case 'success': return 'text-green-500';
      case 'warning': return 'text-amber-500';
      case 'info': return 'text-blue-400';
      default: return 'text-zinc-500';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* CRT Scanline Effect */}
      <div className="absolute inset-0 crt-overlay crt-flicker"></div>

      {/* Diagonal Grid Background */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            #3f3f46 0,
            #3f3f46 1px,
            transparent 0,
            transparent 50%
          )`,
          backgroundSize: '10px 10px'
        }}
      ></div>

      <div className="relative z-10 w-full max-w-3xl px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-16 h-1 bg-green-500"></div>
            <h1 className="text-5xl font-black italic tracking-tighter text-white">
              THE BOX
            </h1>
            <div className="w-16 h-1 bg-green-500"></div>
          </div>
          <p className="text-xs font-bold tracking-[0.3em] text-zinc-500 uppercase">
            Referee Control System v2.1.0
          </p>
        </div>

        {/* Boot Terminal */}
        <div className="bg-black border-4 border-zinc-800 p-8 shadow-2xl">
          <div className="space-y-1 font-mono text-sm mb-8 min-h-[320px]">
            {visibleSteps.map((step, idx) => (
              <div 
                key={idx}
                className={`${getStepColor(step.type)} transition-opacity duration-200`}
                style={{
                  textShadow: step.type === 'success' 
                    ? '0 0 8px currentColor' 
                    : step.type === 'warning'
                    ? '0 0 8px currentColor'
                    : 'none'
                }}
              >
                {step.msg}
              </div>
            ))}
            {currentIndex < BOOT_STEPS.length && (
              <div className="text-green-500 animate-pulse">▋</div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="gauge-meter">
            <div 
              className="gauge-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-between items-center text-xs font-bold text-zinc-600 uppercase tracking-widest">
            <span>BMSCE Sports Tech Division</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Warning Label */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-amber-500/10 border-2 border-amber-500/30 px-6 py-2">
            <p className="text-xs font-bold text-amber-500 tracking-widest uppercase">
              ⚠ Authorized Personnel Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};