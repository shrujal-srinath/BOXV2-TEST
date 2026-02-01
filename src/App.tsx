// src/App.tsx
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { GameSetup } from './pages/GameSetup';
import { SpectatorView } from './pages/SpectatorView';
import { TabletController } from './pages/TabletController';
import { StandaloneTablet } from './pages/StandaloneTablet';
import { Scoreboard } from './components/Scoreboard';
import { startAutoSync } from './services/syncService';
import { useEffect } from 'react';

// Wrapper to pass params to Scoreboard
const HostGameWrapper = () => {
  const { gameCode } = useParams();
  // Determine if local or online based on code prefix
  const type = gameCode?.startsWith('LOCAL') ? 'local' : 'online';
  return <Scoreboard gameCode={gameCode || 'DEMO'} gameType={type} />;
};

function App() {
  useEffect(() => {
    startAutoSync();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-black text-white font-sans">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/setup" element={<GameSetup />} />

          {/* Fixed: Use wrapper to pass props */}
          <Route path="/host/:gameCode" element={<HostGameWrapper />} />

          <Route path="/tablet/standalone" element={<StandaloneTablet />} />
          <Route path="/tablet/:gameCode" element={<TabletController />} />
          <Route path="/watch/:gameCode" element={<SpectatorView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;