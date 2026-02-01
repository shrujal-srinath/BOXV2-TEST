import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import CreateGame from './pages/CreateGame';
import HostGameWrapper from './pages/HostGameWrapper';
import SpectatorView from './pages/SpectatorView';
import ProtectedHostRoute from './components/ProtectedHostRoute';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Dashboard (requires login) */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Create Game (requires login) */}
        <Route path="/create-game" element={<CreateGame />} />

        {/* Host Game - PROTECTED ROUTE (only game owner can access) */}
        <Route
          path="/host/:gameCode"
          element={
            <ProtectedHostRoute>
              <HostGameWrapper />
            </ProtectedHostRoute>
          }
        />

        {/* Watch Game (public - anyone with code can watch) */}
        <Route path="/watch/:gameCode" element={<SpectatorView />} />

        {/* Catch all - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;