// src/App.tsx
// COMPLETE FILE - Replace your entire src/App.tsx with this

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';

// PAGE IMPORTS
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { GameSetup } from './pages/GameSetup';
import { HostConsole } from './pages/HostConsole';
import { SpectatorView } from './pages/SpectatorView';
import { WallView } from './pages/WallView';
import { TabletController } from './pages/TabletController';
import { StandaloneTablet } from './pages/StandaloneTablet';

// TOURNAMENT MODULE IMPORTS
import { TournamentDashboard } from './pages/TournamentDashboard';
import { TournamentSetup } from './pages/TournamentSetup';
import { TournamentManager } from './pages/TournamentManager';
import { TournamentWallView } from './pages/TournamentWallView';

// COMPONENT - DEFAULT IMPORT (no curly braces)
import ProtectedHostRoute from './components/ProtectedHostRoute';

function App() {
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
          <Route path="/spectator/:gameCode" element={<SpectatorView />} />
          <Route path="/watch/:gameCode" element={<SpectatorView />} />
          <Route path="/wall" element={<WallView />} />

          {/* PROTECTED HOST ROUTES */}
          <Route
            path="/dashboard"
            element={<ProtectedHostRoute><Dashboard /></ProtectedHostRoute>}
          />
          <Route
            path="/setup"
            element={<ProtectedHostRoute><GameSetup /></ProtectedHostRoute>}
          />
          <Route
            path="/host/:gameCode"
            element={<ProtectedHostRoute><HostConsole /></ProtectedHostRoute>}
          />

          {/* TABLET ROUTES */}
          <Route path="/tablet" element={<TabletController />} />
          <Route path="/tablet/:gameCode" element={<StandaloneTablet />} />

          {/* TOURNAMENT MODULE ROUTES */}
          <Route
            path="/tournament"
            element={<ProtectedHostRoute><TournamentDashboard /></ProtectedHostRoute>}
          />
          <Route
            path="/tournament/setup"
            element={<ProtectedHostRoute><TournamentSetup /></ProtectedHostRoute>}
          />
          <Route
            path="/tournament/:id/manage"
            element={<ProtectedHostRoute><TournamentManager /></ProtectedHostRoute>}
          />

          {/* NEW - Tournament wall display */}
          <Route
            path="/wall/tournament/:tournamentId"
            element={<TournamentWallView />}
          />

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;