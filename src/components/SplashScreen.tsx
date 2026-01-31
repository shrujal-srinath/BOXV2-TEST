// src/components/SplashScreen.tsx
// ALTERNATIVE VERSION - Red Gradient Background
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

    // Buttery smooth sequence
    const timers = [
      setTimeout(() => setStage(1), 150),    // Logo reveal
      setTimeout(() => setStage(2), 1000),   // Text fade in
      setTimeout(() => setStage(3), 1800),   // Meta info
      setTimeout(() => setStage(4), 2600),   // Complete state
      setTimeout(() => {
        sessionStorage.setItem('BOX_SPLASH_SHOWN', 'true');
        onComplete();
      }, 3400)
    ];

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [onComplete]);

  return (
    <div className={`splash-premium ${stage === 4 ? 'splash-premium-exit' : ''}`}>
      
      {/* Gradient Background */}
      <div className="splash-premium-bg">
        <div className="splash-premium-gradient-1"></div>
        <div className="splash-premium-gradient-2"></div>
        <div className="splash-premium-overlay"></div>
      </div>

      {/* Main Container */}
      <div className="splash-premium-container">
        
        {/* Logo */}
        {stage >= 1 && (
          <div className="splash-premium-logo-section">
            <div className="splash-premium-logo">
              <div className="splash-premium-logo-outer">
                <div className="splash-premium-logo-middle">
                  <div className="splash-premium-logo-inner">
                    <div className="splash-premium-logo-core"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {stage >= 2 && (
          <div className="splash-premium-content">
            <h1 className="splash-premium-title">
              <span className="splash-premium-title-the">THE</span>
              <span className="splash-premium-title-box">BOX</span>
            </h1>
            <div className="splash-premium-line"></div>
          </div>
        )}

        {/* Footer */}
        {stage >= 3 && (
          <div className="splash-premium-footer">
            <p className="splash-premium-creator">Created by BMSCE</p>
            <p className="splash-premium-tagline">
              Research & Development • Sports Innovation
            </p>
          </div>
        )}
      </div>

      {/* Floating Elements */}
      <div className="splash-premium-orbs">
        <div className="splash-premium-orb splash-premium-orb-1"></div>
        <div className="splash-premium-orb splash-premium-orb-2"></div>
        <div className="splash-premium-orb splash-premium-orb-3"></div>
      </div>
    </div>
  );
};