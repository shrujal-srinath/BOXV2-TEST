import { useState, useEffect } from 'react';

// GLOBAL CAPTURE: Listens immediately, even before React renders
// This fixes the "Race Condition" where the event fires before the component loads
let globalDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Stop the browser's mini-infobar
    globalDeferredPrompt = e; // Stash it globally
    console.log('💿 BOX-V2: PWA Install Event Captured Globally');
  });
}

export const usePWAInstall = () => {
  const [prompt, setPrompt] = useState<any>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already installed
    const checkStandalone = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };
    checkStandalone();

    // 2. Listen for the event (if it happens AFTER mount)
    const handler = (e: any) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setPrompt(e);
      console.log("💿 BOX-V2: PWA Event Caught in Hook");
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    // 3. Listen for successful install
    window.addEventListener('appinstalled', () => {
      console.log('✅ BOX-V2: App installed successfully');
      setIsInstalled(true);
      setPrompt(null);
      globalDeferredPrompt = null;
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const triggerInstall = async () => {
    if (!prompt) {
      console.error("❌ No install prompt available");
      return false;
    }

    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    
    if (outcome === 'accepted') {
      setPrompt(null);
      globalDeferredPrompt = null;
      return true;
    }
    return false;
  };

  return { isInstalled, prompt, triggerInstall };
};