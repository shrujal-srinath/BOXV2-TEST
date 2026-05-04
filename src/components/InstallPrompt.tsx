import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

interface InstallPromptProps {
  isInstalled: boolean;
  hasPrompt: boolean;
  onInstall: () => Promise<void>;
  onDismiss?: () => void;
}

export const InstallPrompt: React.FC<InstallPromptProps> = ({ 
  isInstalled, 
  hasPrompt, 
  onInstall,
  onDismiss 
}) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // Detect iOS (iPhone/iPad)
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // Detect Safari (Desktop or Mobile)
    const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    setIsIOS(ios);
    setIsSafari(safari);
  }, []);

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await onInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  // 1. If already installed, hide everything
  if (isInstalled) return null;

  // 2. If we have a Chrome/Edge native prompt, show the "Magic Button"
  if (hasPrompt) {
    return (
      <div className="bg-white dark:bg-gradient-to-br dark:from-blue-950/40 dark:to-black border-l-4 border-red-600 dark:border-blue-600 p-6 mb-8 relative rounded-2xl [box-shadow:0_2px_8px_rgba(0,0,0,0.06),0_8px_20px_rgba(0,0,0,0.04)] dark:shadow-xl">
        <button onClick={onDismiss} className="absolute top-4 right-4 text-slate-400 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-white transition-colors"><X size={18}/></button>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-red-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-2xl">📱</div>
          <div>
            <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-tight text-lg">Install App</h3>
            <p className="text-slate-500 dark:text-zinc-400 text-xs font-mono">Enable Full-Screen Referee Mode</p>
          </div>
        </div>
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="w-full bg-red-600 hover:bg-red-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold py-3 rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all"
        >
          {isInstalling ? 'Installing...' : <><Download size={16} /> Install Firmware</>}
        </button>
      </div>
    );
  }

  // 3. If no prompt, but it is iOS/Safari, show "Manual Instructions"
  if (isIOS || isSafari) {
    return (
      <div className="bg-white dark:bg-zinc-900/80 border-l-4 border-slate-300 dark:border-zinc-600 p-6 mb-8 relative rounded-2xl [box-shadow:0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-none">
        <button onClick={onDismiss} className="absolute top-4 right-4 text-slate-400 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-white transition-colors"><X size={18}/></button>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-2xl">🍎</div>
          <div>
            <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-tight text-lg">Install on iOS/Safari</h3>
            <p className="text-slate-500 dark:text-zinc-400 text-xs font-mono">Manual Setup Required</p>
          </div>
        </div>
        <div className="space-y-3 bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-transparent p-4 rounded-xl text-sm text-slate-700 dark:text-zinc-300">
          <div className="flex items-center gap-3">
            <span className="bg-slate-200 dark:bg-zinc-700 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-slate-600 dark:text-white">1</span>
            <span>Tap the <strong className="text-red-600 dark:text-blue-400"><Share size={12} className="inline mx-1"/> Share</strong> button below</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-slate-200 dark:bg-zinc-700 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-slate-600 dark:text-white">2</span>
            <span>Scroll down and tap <strong className="text-slate-900 dark:text-white"><PlusSquare size={12} className="inline mx-1"/> Add to Home Screen</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Default: Browser not supported or already installed but not detected
  return null;
};