// src/App.tsx (UPDATED)
/**
 * UPDATED ROUTING
 * Now includes standalone offline-first mode
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Page Imports
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { GameSetup } from './pages/GameSetup';
import { SpectatorView } from './pages/SpectatorView';
import { TabletController } from './pages/TabletController';
import { StandaloneTablet } from './pages/StandaloneTablet'; // NEW

// Import the Scoreboard (Host Console)
import { Scoreboard } from './components/Scoreboard';

// Initialize auto-sync on app load
import { startAutoSync } from './services/syncService';
import { useEffect } from 'react';

function App() {
  // Start background sync service
  useEffect(() => {
    startAutoSync();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-black text-white font-sans">
        <Routes>
          {/* Public Entry Point */}
          <Route path="/" element={<LandingPage />} />

          {/* Private Operator Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Game Configuration (New Game) */}
          <Route path="/setup" element={<GameSetup />} />

          {/* Host Console */}
          <Route path="/host/:gameCode" element={<Scoreboard />} />

          {/* 🆕 STANDALONE OFFLINE-FIRST MODE */}
          <Route path="/tablet/standalone" element={<StandaloneTablet />} />

          {/* Tablet Controller (Handles both local and cloud games) */}
          <Route path="/tablet/:gameCode" element={<TabletController />} />

          {/* Public Spectator Screen */}
          <Route path="/watch/:gameId" element={<SpectatorView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;