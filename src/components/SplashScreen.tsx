import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
  isReady?: boolean; // Controls if we can finish the loading bar
}

const LOADING_STATES = [
  "INITIALIZING CORE...",
  "ESTABLISHING UPLINK...",
  "SYNCING GAME STATE...",
  "LAUNCHING CONSOLE..."
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  isReady = true
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState(LOADING_STATES[0]);
  const [isExiting, setIsExiting] = useState(false);

  // 1. Mount Animation
  useEffect(() => {
    const mountTimer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(mountTimer);
  }, []);

  // 2. Intelligent Progress Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        // If finished, stop
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }

        // STALL LOGIC: If system isn't ready, pause at 90%
        if (!isReady && prev >= 90) {
          return 90;
        }

        // ACCELERATION: If ready and stuck at 90%, zoom to finish
        if (isReady && prev >= 90) {
          return prev + 2;
        }

        // Normal Loading speed
        const increment = Math.random() * 2 + 0.5;
        return Math.min(prev + increment, isReady ? 100 : 90);
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isReady]);

  // 3. Reactive Text Updates
  useEffect(() => {
    if (progress < 30) setLoadingText(LOADING_STATES[0]);
    else if (progress < 60) setLoadingText(LOADING_STATES[1]);
    else if (progress < 90) setLoadingText(LOADING_STATES[2]);
    else setLoadingText(LOADING_STATES[3]);
  }, [progress]);

  // 4. Exit Trigger
  useEffect(() => {
    if (progress === 100 && !isExiting) {
      setIsExiting(true);
      // Wait for exit animation (1s) then navigate
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  }, [progress, isExiting, onComplete]);

  return (
    <div className={`splash-screen ${isExiting ? 'is-exiting' : ''}`}>
      <div className="splash-bg">
        <div className="bg-gradient"></div>
        <div className="bg-grid"></div>
        <div className="bg-noise"></div>
      </div>

      <div className="splash-content">
        <div className="logo-wrapper">
          <h1 className={`hero-logo ${isMounted ? 'reveal-logo' : ''}`}>THE BOX</h1>
          <div className={`logo-shine ${isMounted ? 'animate-shine' : ''}`}></div>
        </div>
        <div className={`separator ${isMounted ? 'expand-line' : ''}`}></div>
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

      <div className={`loader-container ${isExiting ? 'drop-down' : ''}`}>
        <div className="loader-info">
          <span className="status-text">{loadingText}</span>
          <span className="status-percent">{Math.round(progress)}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }}>
            <div className="progress-glow"></div>
          </div>
        </div>
      </div>
    </div>
  );
};