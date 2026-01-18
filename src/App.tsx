import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Page Imports
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { SetupPage } from './pages/SetupPage';
import { HostConsole } from './pages/HostConsole';
import { SpectatorView } from './pages/SpectatorView';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-black text-white font-sans">
        <Routes>
          {/* Public Entry Point */}
          <Route path="/" element={<LandingPage />} />

          {/* Private Operator Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Game Configuration (New Game) */}
          <Route path="/setup" element={<SetupPage />} />

          {/* The Host's Control Screen (Protected or Free Mode) */}
          <Route path="/host/:gameId" element={<HostConsole />} />

          {/* Public Spectator Screen */}
          <Route path="/watch/:gameId" element={<SpectatorView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;