import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Page Imports
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { GameSetup } from './pages/GameSetup';
import { SpectatorView } from './pages/SpectatorView';

// Import the Scoreboard (Host Console)
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

          {/* Game Configuration (New Game) */}
          <Route path="/setup" element={<GameSetup />} />

          {/* === THE MISSING LINK === */}
          {/* This tells the app what to show when you navigate to /host/... */}
          <Route path="/host/:gameCode" element={<Scoreboard />} />

          {/* Public Spectator Screen */}
          <Route path="/watch/:gameId" element={<SpectatorView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;