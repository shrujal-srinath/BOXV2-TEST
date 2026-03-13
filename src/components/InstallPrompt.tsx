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
      <div className="bg-gradient-to-br from-blue-950/40 to-black border-l-4 border-blue-600 bg-zinc-900/50 p-6 mb-8 relative rounded-sm shadow-xl">
        <button onClick={onDismiss} className="absolute top-4 right-4 text-zinc-600 hover:text-white"><X size={18}/></button>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center text-2xl">📱</div>
          <div>
            <h3 className="text-white font-black uppercase tracking-tight text-lg">Install App</h3>
            <p className="text-zinc-400 text-xs font-mono">Enable Full-Screen Referee Mode</p>
          </div>
        </div>
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all"
        >
          {isInstalling ? 'Installing...' : <><Download size={16} /> Install Firmware</>}
        </button>
      </div>
    );
  }

  // 3. If no prompt, but it is iOS/Safari, show "Manual Instructions"
  if (isIOS || isSafari) {
    return (
      <div className="bg-zinc-900/80 border-l-4 border-zinc-600 p-6 mb-8 relative rounded-sm">
        <button onClick={onDismiss} className="absolute top-4 right-4 text-zinc-600 hover:text-white"><X size={18}/></button>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-2xl">🍎</div>
          <div>
            <h3 className="text-white font-black uppercase tracking-tight text-lg">Install on iOS/Safari</h3>
            <p className="text-zinc-400 text-xs font-mono">Manual Setup Required</p>
          </div>
        </div>
        <div className="space-y-3 bg-black/40 p-4 rounded text-sm text-zinc-300">
          <div className="flex items-center gap-3">
            <span className="bg-zinc-700 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">1</span>
            <span>Tap the <strong className="text-blue-400"><Share size={12} className="inline mx-1"/> Share</strong> button below</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-zinc-700 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">2</span>
            <span>Scroll down and tap <strong className="text-white"><PlusSquare size={12} className="inline mx-1"/> Add to Home Screen</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Default: Browser not supported or already installed but not detected
  return null;
};