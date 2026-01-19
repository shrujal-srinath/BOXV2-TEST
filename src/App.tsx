import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Page Imports
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { GameSetup } from './pages/GameSetup';
import { SpectatorView } from './pages/SpectatorView';

// Host Console Import (Using your Scoreboard component as the host interface)
import { Scoreboard } from './components/Scoreboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-black text-white font-sans">
        <Routes>
          {/* Public Entry Point */}
          <Route path="/" element={<LandingPage />} />

          {/* Private Operator Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Game Configuration (New Game Setup) */}
          <Route path="/setup" element={<GameSetup />} />

          {/* The Host's Control Screen (Protected or Free Mode) */}
          {/* Matches navigate('/host/${gameCode}') from GameSetup/Dashboard */}
          <Route path="/host/:gameCode" element={<Scoreboard />} />

          {/* Public Spectator Screen */}
          <Route path="/watch/:gameId" element={<SpectatorView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;