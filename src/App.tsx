import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { GameSetup } from './pages/GameSetup';
import { HostConsole } from './pages/HostConsole';
import { SpectatorView } from './pages/SpectatorView';
import { WallView } from './pages/WallView';
import { TournamentDashboard } from './pages/TournamentDashboard';
import { TournamentSetup } from './pages/TournamentSetup';
import { TournamentManager } from './pages/TournamentManager';
import { TabletController } from './pages/TabletController';
import { StandaloneTablet } from './pages/StandaloneTablet';
import ProtectedHostRoute from './components/ProtectedHostRoute';
import { startAutoSync } from './services/syncService';

function App() {
  // Initialize Auto-Sync Service
  useEffect(() => {
    startAutoSync();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-black text-white font-sans">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/watch/:gameCode" element={<SpectatorView />} />
          <Route path="/wall" element={<WallView />} />

          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={
            <ProtectedHostRoute>
              <Dashboard />
            </ProtectedHostRoute>
          } />

          <Route path="/setup" element={
            <ProtectedHostRoute>
              <GameSetup />
            </ProtectedHostRoute>
          } />

          {/* Tournament Routes */}
          <Route path="/tournament" element={
            <ProtectedHostRoute>
              <TournamentDashboard />
            </ProtectedHostRoute>
          } />

          <Route path="/tournament/create" element={
            <ProtectedHostRoute>
              <TournamentSetup />
            </ProtectedHostRoute>
          } />

          <Route path="/tournament/:id/manage" element={
            <ProtectedHostRoute>
              <TournamentManager />
            </ProtectedHostRoute>
          } />

          {/* Host Console */}
          <Route path="/host/:gameCode" element={
            <ProtectedHostRoute>
              <HostConsole />
            </ProtectedHostRoute>
          } />

          {/* Tablet Controller Routes */}
          <Route path="/tablet/standalone" element={
            <ProtectedHostRoute>
              <StandaloneTablet />
            </ProtectedHostRoute>
          } />

          <Route path="/tablet/:gameCode" element={
            <ProtectedHostRoute>
              <TabletController />
            </ProtectedHostRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;