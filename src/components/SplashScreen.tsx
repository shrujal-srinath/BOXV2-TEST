// src/components/SplashScreen.tsx
import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
}

const LOADING_STATES = [
  "INITIALIZING CORE...",
  "CONNECTING TO SERVER...",
  "LOADING ASSETS...",
  "SYSTEM READY"
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState(LOADING_STATES[0]);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // 1. Start Entrance Animation
    const mountTimer = setTimeout(() => setIsMounted(true), 100);

    // 2. Loading Simulation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        // Random speed variations for realism
        const increment = Math.random() * 2 + 0.5;
        return Math.min(prev + increment, 100);
      });
    }, 30);

    // 3. Cycle Text based on progress
    const textInterval = setInterval(() => {
      setProgress(p => {
        if (p < 30) setLoadingText(LOADING_STATES[0]);
        else if (p < 70) setLoadingText(LOADING_STATES[1]);
        else if (p < 90) setLoadingText(LOADING_STATES[2]);
        else setLoadingText(LOADING_STATES[3]);
        return p;
      });
    }, 100);

    // 4. Exit Sequence
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        sessionStorage.setItem('BOX_SPLASH_SHOWN', 'true');
        onComplete();
      }, 1000); // 1s exit
    }, 3800);

    return () => {
      clearTimeout(mountTimer);
      clearTimeout(exitTimer);
      clearInterval(progressInterval);
      clearInterval(textInterval);
    };
  }, [onComplete]);

  return (
    <div className={`splash-screen ${isExiting ? 'is-exiting' : ''}`}>

      {/* BACKGROUND */}
      <div className="splash-bg">
        <div className="bg-gradient"></div>
        <div className="bg-grid"></div>
        <div className="bg-noise"></div>
      </div>

      {/* CENTER CONTENT */}
      <div className="splash-content">

        {/* Main Logo with Shimmer */}
        <div className="logo-wrapper">
          <h1 className={`hero-logo ${isMounted ? 'reveal-logo' : ''}`}>
            THE BOX
          </h1>
          <div className={`logo-shine ${isMounted ? 'animate-shine' : ''}`}></div>
        </div>

        {/* Separator */}
        <div className={`separator ${isMounted ? 'expand-line' : ''}`}></div>

        {/* Credits */}
        <div className="credits-container">
          <div className={`credit-row ${isMounted ? 'fade-up delay-1' : ''}`}>
            <span className="credit-label">POWERED BY</span>
            <span className="credit-bold">BMSCE</span>
          </div>
          <div className={`credit-sub ${isMounted ? 'fade-up delay-2' : ''}`}>
            DEPARTMENT OF SPORTS
          </div>
        </div>

      </div>

      {/* FOOTER LOADER (Glass Style) */}
      <div className={`loader-container ${isExiting ? 'drop-down' : ''}`}>
        <div className="loader-info">
          <span className="status-text">{loadingText}</span>
          <span className="status-percent">{Math.round(progress)}%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          >
            <div className="progress-glow"></div>
          </div>
        </div>
      </div>

    </div>
  );
};