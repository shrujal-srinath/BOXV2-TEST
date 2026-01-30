import React from 'react';
import { Smartphone, CheckCircle, Info, Download } from 'lucide-react';

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
  const [isInstalling, setIsInstalling] = React.useState(false);

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await onInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  // Don't show anything if already installed
  if (isInstalled) {
    return null;
  }

  // Show install prompt if available
  if (hasPrompt) {
    return (
      <div className="bg-gradient-to-br from-blue-950/30 to-blue-900/20 border border-blue-900/50 rounded-sm p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
        
        <div className="flex items-start gap-4 mb-4">
          <div className="text-3xl">📱</div>
          <div className="flex-1">
            <h3 className="text-white font-black uppercase tracking-tight text-lg mb-1">
              Install THE BOX
            </h3>
            <p className="text-zinc-400 text-xs uppercase tracking-wider">
              Get the best referee experience
            </p>
          </div>
          {onDismiss && (
            <button 
              onClick={onDismiss}
              className="text-zinc-600 hover:text-white transition-colors text-xl"
            >
              ×
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle size={14} className="text-green-500" />
            <span>Works Offline</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle size={14} className="text-green-500" />
            <span>Instant Loading</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle size={14} className="text-green-500" />
            <span>Full Screen</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle size={14} className="text-green-500" />
            <span>Home Screen Icon</span>
          </div>
        </div>

        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isInstalling ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Installing...
            </>
          ) : (
            <>
              <Download size={16} />
              Install Now
            </>
          )}
        </button>
      </div>
    );
  }

  // Show info if no prompt available
  return (
    <div className="bg-zinc-900/30 border border-zinc-800 rounded-sm p-4 mb-8 flex items-center gap-3">
      <Info size={18} className="text-zinc-600 flex-shrink-0" />
      <div className="text-xs text-zinc-500">
        <p className="font-bold uppercase tracking-wider mb-1">Installation Unavailable</p>
        <p className="text-zinc-600 text-[10px]">
          {/iPad|iPhone|iPod/.test(navigator.userAgent) 
            ? 'On iOS: Tap Share → Add to Home Screen' 
            : 'App already installed or browser not supported'}
        </p>
      </div>
    </div>
  );
};

export default InstallPrompt;