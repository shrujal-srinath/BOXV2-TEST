// src/components/SplashScreen.tsx
import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // 1. Mount Trigger (Start Animations)
    const mountTimer = setTimeout(() => setIsMounted(true), 50);

    // 2. Simulated Loading Progress (Smooth interpolation)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        // Non-linear loading for realism (fast start, slow finish)
        const increment = Math.max(1, (100 - prev) / 8);
        return prev + increment;
      });
    }, 50);

    // 3. Exit Sequence
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      // Wait for exit animation to finish before unmounting
      setTimeout(() => {
        sessionStorage.setItem('BOX_SPLASH_SHOWN', 'true');
        onComplete();
      }, 1200); // 1.2s exit transition
    }, 3500); // Total splash duration

    return () => {
      clearTimeout(mountTimer);
      clearTimeout(exitTimer);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  return (
    <div className={`splash-screen ${isExiting ? 'is-exiting' : ''}`}>

      {/* LAYER 1: CINEMATIC BACKGROUND */}
      <div className="splash-bg">
        <div className="splash-noise"></div>
        <div className="splash-vignette"></div>
        <div className="splash-grid"></div>
      </div>

      {/* LAYER 2: MAIN CONTENT */}
      <div className="splash-container">

        {/* HERO TITLE */}
        <div className="splash-hero">
          <h1 className={`hero-text ${isMounted ? 'animate-reveal' : ''}`}>
            THE BOX
          </h1>
          <div className={`hero-glow ${isMounted ? 'animate-glow' : ''}`}></div>
        </div>

        {/* BRANDS & CREDITS */}
        <div className="splash-credits">

          {/* Divider Line */}
          <div className={`separator-line ${isMounted ? 'animate-width' : ''}`}></div>

          {/* Primary Credit */}
          <div className={`credit-primary ${isMounted ? 'animate-slide-up delay-1' : ''}`}>
            <span className="label">POWERED BY</span>
            <span className="brand">BMSCE</span>
          </div>

          {/* Secondary Credit */}
          <div className={`credit-secondary ${isMounted ? 'animate-slide-up delay-2' : ''}`}>
            A PRODUCT OF THE BMSCE SPORTS DEPARTMENT
          </div>

        </div>
      </div>

      {/* LAYER 3: SYSTEM LOADER (Bottom Locked) */}
      <div className={`splash-loader ${isExiting ? 'fade-out' : ''}`}>
        <div className="loader-track">
          <div
            className="loader-bar"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="loader-meta">
          <span>SYSTEM INITIALIZED</span>
          <span className="loader-percent">{Math.round(progress)}%</span>
        </div>
      </div>

    </div>
  );
};