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

    // Ultra-smooth sequence - ESPN broadcast style
    const timers = [
      setTimeout(() => setStage(1), 100),    // Background reveal
      setTimeout(() => setStage(2), 700),    // Logo fade in
      setTimeout(() => setStage(3), 1600),   // Main title
      setTimeout(() => setStage(4), 2400),   // Creator text
      setTimeout(() => setStage(5), 3200),   // Complete
      setTimeout(() => {
        sessionStorage.setItem('BOX_SPLASH_SHOWN', 'true');
        onComplete();
      }, 4000)
    ];

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [onComplete]);

  return (
    <div className={`splash-espn ${stage === 5 ? 'splash-espn-exit' : ''}`}>
      
      {/* Black Background with Red Glow */}
      <div className="splash-espn-bg">
        <div className="splash-espn-glow"></div>
        <div className="splash-espn-vignette"></div>
      </div>

      {/* Main Content */}
      <div className="splash-espn-container">
        
        {/* Logo Icon */}
        {stage >= 2 && (
          <div className="splash-espn-logo-wrapper">
            <div className="splash-espn-logo-glow-ring"></div>
            <div className="splash-espn-logo">
              <svg viewBox="0 0 100 100" className="splash-espn-svg">
                {/* Outer Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#redGradient)"
                  strokeWidth="2"
                  className="splash-espn-ring"
                />
                
                {/* Center Box */}
                <rect
                  x="30"
                  y="30"
                  width="40"
                  height="40"
                  fill="url(#redGradient)"
                  rx="4"
                  className="splash-espn-box"
                />
                
                {/* Inner Detail */}
                <rect
                  x="38"
                  y="38"
                  width="24"
                  height="24"
                  fill="#000000"
                  rx="2"
                  className="splash-espn-inner"
                />
                
                {/* Gradient Definition */}
                <defs>
                  <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#DC2626" />
                    <stop offset="50%" stopColor="#EF4444" />
                    <stop offset="100%" stopColor="#DC2626" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        )}

        {/* Main Title */}
        {stage >= 3 && (
          <div className="splash-espn-title-wrapper">
            <h1 className="splash-espn-title">
              <span className="splash-espn-title-the">THE</span>
              <span className="splash-espn-title-box">BOX</span>
            </h1>
            <div className="splash-espn-underline"></div>
          </div>
        )}

        {/* Creator & Meta */}
        {stage >= 4 && (
          <div className="splash-espn-meta">
            <div className="splash-espn-creator">
              <div className="splash-espn-line"></div>
              <span className="splash-espn-creator-text">CREATED BY BMSCE</span>
              <div className="splash-espn-line"></div>
            </div>
            <p className="splash-espn-tagline">
              Research & Development • Sports Innovation Department
            </p>
          </div>
        )}
      </div>

      {/* Subtle Scanline Effect */}
      <div className="splash-espn-scanline"></div>
    </div>
  );
};