// src/App.tsx
// ─────────────────────────────────────────────────────────────
// ROUTING STRATEGY
//
// Two completely separate worlds share the same codebase:
//
//  1. WEBSITE  — normal browser visit → LandingPage, Dashboard,
//               Tournament, etc. Protected by ProtectedHostRoute.
//
//  2. TABLET PWA — installed via "Add to Home Screen" on iPad Air 2
//               → launches directly into /tablet/standalone via
//               the manifest start_url. NO auth, NO Firebase needed.
//               Works 100% offline.
//
// The two worlds NEVER interfere:
//  - Website users never see a tablet page (no links to /tablet)
//  - Installed PWA users land on /tablet/standalone immediately
//  - The root "/" detects standalone mode and redirects if needed
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { subscribeToAuth } from './services/authService';
import { HardwareProvider } from './contexts/HardwareContext';
import { ThemeProvider } from './contexts/ThemeContext';

// ── Website pages ──────────────────────────────────────────
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { GameSetup } from './pages/GameSetup';
import { HostConsole } from './pages/HostConsole';
import { SpectatorView } from './pages/SpectatorView';
import { ShotChartView } from './pages/ShotChartView';
import { TvKiosk } from './pages/TvKiosk';
import { WallView } from './pages/WallView';
import { TournamentDashboard } from './pages/TournamentDashboard';
import { TournamentSetup } from './pages/TournamentSetup';
import { TournamentManager } from './pages/TournamentManager';
import { TournamentViewer } from './pages/TournamentViewer';
import { VolunteerConsole } from './pages/VolunteerConsole';
import RefereeScreen from './pages/RefereeScreen'; // <-- Added Referee Route
import ArenaView from './pages/ArenaView';         // <-- Added Arena Route

// ── Tablet PWA pages (NO auth wrapper — these must be public) ─
import { StandaloneTablet } from './pages/StandaloneTablet';
import { TabletController } from './pages/TabletController';

// ── Shared components ──────────────────────────────────────
import ProtectedHostRoute from './components/ProtectedHostRoute';

// ─────────────────────────────────────────────────────────────
// isPWA — true when the app was launched from the iOS/Android
// home screen (i.e. "Add to Home Screen" was used).
//
//   window.matchMedia('(display-mode: standalone)')  → Chrome / Android
//   window.navigator.standalone                      → iOS Safari (iPad Air 2)
//
// This is the ONLY signal we need. No login, no Firebase.
// ─────────────────────────────────────────────────────────────
const isPWA =
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true;

// ─────────────────────────────────────────────────────────────
// RootRedirect
// Visitors to "/" see the website normally.
// When the same URL is opened from the home screen icon,
// they get redirected to the tablet UI immediately.
// ─────────────────────────────────────────────────────────────
const RootRedirect: React.FC = () =>
  isPWA ? <Navigate to="/tablet/standalone" replace /> : <LandingPage />;

// ─────────────────────────────────────────────────────────────
function App() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToAuth((u) => setUserId(u?.id || null));
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <HardwareProvider userId={userId}>
          <div className="min-h-screen bg-gray-50 text-zinc-900 dark:bg-black dark:text-white font-sans transition-colors duration-300">
            <Routes>

              {/* ══════════════════════════════════════════════
              TABLET PWA ROUTES
              ── Completely public. No ProtectedHostRoute.
              ── Must stay this way: iPad Air 2 in a gym
                 with no internet must never hit an auth wall.
              ══════════════════════════════════════════════ */}
              <Route path="/tablet/standalone" element={<StandaloneTablet />} />
              <Route path="/tablet/:gameCode" element={<TabletController />} />

              {/* ══════════════════════════════════════════════
              WEBSITE — PUBLIC ROUTES
              ══════════════════════════════════════════════ */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="/watch/:gameCode" element={<SpectatorView />} />
              <Route path="/game/:code/shots" element={<ShotChartView />} />
              <Route path="/tv" element={<TvKiosk />} />
              <Route path="/wall" element={<WallView />} />
              <Route path="/referee" element={<RefereeScreen />} />
              <Route path="/arena" element={<ArenaView />} />

              {/* ── Tournament PUBLIC viewer (shareable QR link, no auth) ── */}
              {/* /t/:id      → bracket/results/live scores for spectators   */}
              {/* /t/:id/volunteer → scorer console (PIN-gated, no auth)     */}
              <Route path="/t/:id" element={<TournamentViewer />} />
              <Route path="/t/:id/volunteer" element={<VolunteerConsole />} />

              {/* ══════════════════════════════════════════════
              WEBSITE — PROTECTED ROUTES
              ══════════════════════════════════════════════ */}
              <Route path="/dashboard" element={
                <ProtectedHostRoute><Dashboard /></ProtectedHostRoute>
              } />

              <Route path="/setup" element={
                <ProtectedHostRoute><GameSetup /></ProtectedHostRoute>
              } />

              <Route path="/host/:gameCode" element={
                <ProtectedHostRoute><HostConsole /></ProtectedHostRoute>
              } />

              {/* Tournament admin routes */}
              <Route path="/tournament" element={
                <ProtectedHostRoute><TournamentDashboard /></ProtectedHostRoute>
              } />
              <Route path="/tournament/create" element={
                <ProtectedHostRoute><TournamentSetup /></ProtectedHostRoute>
              } />
              <Route path="/tournament/:id/manage" element={
                <ProtectedHostRoute><TournamentManager /></ProtectedHostRoute>
              } />

              {/* ══════════════════════════════════════════════
              FALLBACK
              ══════════════════════════════════════════════ */}
              <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
          </div>
        </HardwareProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;