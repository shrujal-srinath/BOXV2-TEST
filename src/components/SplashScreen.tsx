// src/components/SplashScreen.tsx
/**
 * PREMIUM SPLASH SCREEN
 * Professional, smooth loading animation for THE BOX
 * No jarring color changes, seamless transitions
 */

import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timings = [
      { stage: 1, delay: 300 },   // Logo fade in
      { stage: 2, delay: 800 },   // Text reveal
      { stage: 3, delay: 1400 },  // Subtitle
      { stage: 4, delay: 2000 },  // Progress bar
      { stage: 5, delay: 2800 },  // Final fade out
    ];

    const timeouts = timings.map(({ stage, delay }) =>
      setTimeout(() => setStage(stage), delay)
    );

    // Complete animation
    const completeTimeout = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(completeTimeout);
    };
  }, [onComplete]);

  return (
    <div className={`splash-screen ${stage >= 5 ? 'splash-fade-out' : ''}`}>
      {/* Animated Background */}
      <div className="splash-bg">
        <div className="splash-grid"></div>
        <div className="splash-gradient-orb splash-orb-1"></div>
        <div className="splash-gradient-orb splash-orb-2"></div>
        <div className="splash-gradient-orb splash-orb-3"></div>
      </div>

      {/* Main Content */}
      <div className="splash-content">
        {/* Logo Container */}
        <div className={`splash-logo-container ${stage >= 1 ? 'splash-logo-visible' : ''}`}>
          {/* Geometric Logo */}
          <div className="splash-logo">
            <svg viewBox="0 0 200 200" className="splash-logo-svg">
              {/* Outer Ring */}
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="url(#gradient1)"
                strokeWidth="2"
                className="splash-ring splash-ring-outer"
              />
              
              {/* Middle Ring */}
              <circle
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke="url(#gradient2)"
                strokeWidth="1.5"
                className="splash-ring splash-ring-middle"
              />
              
              {/* Inner Box */}
              <rect
                x="60"
                y="60"
                width="80"
                height="80"
                fill="none"
                stroke="url(#gradient3)"
                strokeWidth="3"
                className="splash-box"
              />
              
              {/* Center Glow */}
              <circle
                cx="100"
                cy="100"
                r="25"
                fill="url(#centerGlow)"
                className="splash-center-glow"
              />
              
              {/* Gradients */}
              <defs>
                <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
                <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#dbeafe" />
                  <stop offset="100%" stopColor="#93c5fd" />
                </linearGradient>
                <radialGradient id="centerGlow">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </div>

          {/* Pulsing Glow Effect */}
          <div className="splash-logo-glow"></div>
        </div>

        {/* Text Content */}
        <div className={`splash-text ${stage >= 2 ? 'splash-text-visible' : ''}`}>
          <h1 className="splash-title">
            <span className="splash-title-word">THE</span>
            <span className="splash-title-word splash-title-word-emphasis">BOX</span>
          </h1>
          
          <div className={`splash-subtitle ${stage >= 3 ? 'splash-subtitle-visible' : ''}`}>
            <div className="splash-divider"></div>
            <p className="splash-subtitle-text">Professional Sports Scoring Platform</p>
            <div className="splash-divider"></div>
          </div>

          <div className={`splash-footer ${stage >= 3 ? 'splash-footer-visible' : ''}`}>
            <span className="splash-powered">Powered by</span>
            <span className="splash-bmsce">BMSCE</span>
          </div>
        </div>

        {/* Loading Progress */}
        <div className={`splash-loading ${stage >= 4 ? 'splash-loading-visible' : ''}`}>
          <div className="splash-loading-track">
            <div className="splash-loading-bar"></div>
          </div>
          <div className="splash-loading-text">Initializing System...</div>
        </div>
      </div>

      {/* Particles */}
      <div className="splash-particles">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="splash-particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};