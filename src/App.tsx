// src/App.tsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { usePWAInstall } from './hooks/usePWAInstall';

// PAGE IMPORTS
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { GameSetup } from './pages/GameSetup';
import { HostConsole } from './pages/HostConsole';
import { SpectatorView } from './pages/SpectatorView';
import { WallView } from './pages/WallView';
import { TabletController } from './pages/TabletController';
import { StandaloneTablet } from './pages/StandaloneTablet';

// --- NEW TOURNAMENT MODULE IMPORTS ---
import { TournamentDashboard } from './pages/TournamentDashboard';
import { TournamentSetup } from './pages/TournamentSetup';
import { TournamentManager } from './pages/TournamentManager';

// COMPONENTS
import { ProtectedHostRoute } from './components/ProtectedHostRoute';
import { InstallPrompt } from './components/InstallPrompt';
import './App.css';

function App() {
  const { isInstallable, installPWA } = usePWAInstall();

  // Basic Auth Listener (Optional: for global state if needed)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) console.log("User logged in:", user.uid);
    });
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-black text-white">
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/spectator/:gameId" element={<SpectatorView />} />
          <Route path="/wall/:gameId" element={<WallView />} />

          {/* PROTECTED HOST ROUTES */}
          <Route path="/dashboard" element={<ProtectedHostRoute><Dashboard /></ProtectedHostRoute>} />
          <Route path="/setup" element={<ProtectedHostRoute><GameSetup /></ProtectedHostRoute>} />
          <Route path="/host/:gameCode" element={<ProtectedHostRoute><HostConsole /></ProtectedHostRoute>} />

          {/* TABLET ROUTES */}
          <Route path="/tablet" element={<TabletController />} />
          <Route path="/tablet/:gameCode" element={<StandaloneTablet />} />

          {/* --- TOURNAMENT MODULE ROUTES (NEW) --- */}

          {/* 1. The Hub: Lists all tournaments */}
          <Route path="/tournament" element={<ProtectedHostRoute><TournamentDashboard /></ProtectedHostRoute>} />

          {/* 2. The Wizard: Create a new event */}
          <Route path="/tournament/setup" element={<ProtectedHostRoute><TournamentSetup /></ProtectedHostRoute>} />

          {/* 3. The Brain: Manage a specific event (Bracket, Schedule, Lifecycle) */}
          <Route path="/tournament/:id/manage" element={<ProtectedHostRoute><TournamentManager /></ProtectedHostRoute>} />

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* PWA INSTALL PROMPT */}
        {isInstallable && <InstallPrompt onInstall={installPWA} />}
      </div>
    </Router>
  );
}

export default App;