import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Page Imports
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { GameSetup } from './pages/GameSetup';
import { SpectatorView } from './pages/SpectatorView';
import { TabletController } from './pages/TabletController';

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

          {/* Host Console */}
          <Route path="/host/:gameCode" element={<Scoreboard />} />

          {/* Dedicated Offline Controller Route */}
          <Route path="/tablet/:gameCode" element={<TabletController />} />

          {/* Public Spectator Screen */}
          <Route path="/watch/:gameId" element={<SpectatorView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;