import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { GameSetup } from './pages/GameSetup';
import { SpectatorView } from './pages/SpectatorView';
import { TabletController } from './pages/TabletController';
import { StandaloneTablet } from './pages/StandaloneTablet';
import { HostConsole } from './pages/HostConsole';
import ProtectedHostRoute from './components/ProtectedHostRoute';
import { startAutoSync } from './services/syncService';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    startAutoSync();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-black text-white font-sans">
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/watch/:gameCode" element={<SpectatorView />} />

          {/* GAME CREATION ROUTE - Works for both signed-in and guest users */}
          <Route path="/setup" element={<GameSetup />} />

          {/* AUTHENTICATED ROUTES */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* HOST ROUTE - Works for both Firebase and localStorage games */}
          <Route
            path="/host/:gameCode"
            element={
              <ProtectedHostRoute>
                <HostConsole />
              </ProtectedHostRoute>
            }
          />

          {/* TABLET MODE (Optional secondary feature) */}
          <Route path="/tablet/standalone" element={<StandaloneTablet />} />
          <Route path="/tablet/:gameCode" element={<TabletController />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;