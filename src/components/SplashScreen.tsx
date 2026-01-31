// src/components/SplashScreen.tsx
import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Check if already shown this session
    const hasShown = sessionStorage.getItem('BOX_SPLASH_SHOWN');
    if (hasShown) {
      onComplete();
      return;
    }

    // Sequence for "The Box" Reference Style
    const timers = [
      setTimeout(() => setStage(1), 100),    // BG Init
      setTimeout(() => setStage(2), 500),    // Title Slam
      setTimeout(() => setStage(3), 1000),   // Divider Expand
      setTimeout(() => setStage(4), 1400),   // Brand Slide + Footer Fade
      setTimeout(() => setStage(5), 3500),   // Exit
      setTimeout(() => {
        sessionStorage.setItem('BOX_SPLASH_SHOWN', 'true');
        onComplete();
      }, 4100)
    ];

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [onComplete]);

  return (
    <div className={`splash-reference ${stage >= 5 ? 'splash-exit' : ''}`}>

      {/* Pure Black Background with Subtle Vignette */}
      <div className="splash-bg"></div>

      {/* Main Centered Lockup */}
      <div className="splash-lockup">

        {/* LEFT: THE BOX */}
        <div className={`splash-title-wrapper ${stage >= 2 ? 'stage-active' : ''}`}>
          <h1 className="splash-title">THE BOX</h1>
        </div>

        {/* DIVIDER */}
        <div className={`splash-divider ${stage >= 3 ? 'stage-active' : ''}`}></div>

        {/* RIGHT: POWERED BY BMSCE */}
        <div className={`splash-brand-col ${stage >= 4 ? 'stage-active' : ''}`}>
          <span className="splash-powered-label">POWERED BY</span>
          <span className="splash-brand-text">BMSCE</span>
        </div>

      </div>

      {/* FOOTER TAGLINE */}
      <div className={`splash-footer ${stage >= 4 ? 'stage-active' : ''}`}>
        THE OFFICIAL COLLEGE SPORTS APP
      </div>

    </div>
  );
};