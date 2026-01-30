import { useState, useEffect } from 'react';

// GLOBAL CAPTURE: Listens immediately, even before React renders
let globalDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    globalDeferredPrompt = e;
    console.log('💿 BOX-V2: PWA Install Event Captured Globally');
  });
}

export const usePWAInstall = () => {
  const [prompt, setPrompt] = useState<any>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already installed (Standalone Mode)
    const checkStandalone = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };
    
    checkStandalone();

    // 2. Listen for future events (if not captured globally yet)
    const handler = (e: any) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setPrompt(e);
      console.log("💿 BOX-V2: PWA Event Updated in Hook");
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    // 3. Check for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('✅ BOX-V2: App installed successfully');
      setIsInstalled(true);
      setPrompt(null);
      globalDeferredPrompt = null;
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const triggerInstall = async () => {
    if (!prompt) {
      console.error("❌ No install prompt available");
      return false;
    }

    // Show the install prompt
    prompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await prompt.userChoice;
    console.log(`User response to install: ${outcome}`);

    if (outcome === 'accepted') {
      setPrompt(null);
      globalDeferredPrompt = null;
      return true;
    }
    return false;
  };

  return { isInstalled, prompt, triggerInstall };
};