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

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { subscribeToAuth } from './services/authService';
import { HardwareProvider } from './contexts/HardwareContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SplashScreen } from './components/SplashScreen';

// ── Pages — all lazy-loaded so the initial bundle is tiny.
// On a cold Safari refresh this drops first-paint from ~3s to ~300ms because
// the browser only parses one route's chunk, not all 27.
// Default exports use lazy(() => import(...)) directly.
// Named exports use lazy(() => import(...).then(m => ({ default: m.Name }))).
const LandingPage         = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const HomePage            = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const WatchPage           = lazy(() => import('./pages/WatchPage').then(m => ({ default: m.WatchPage })));
const Dashboard           = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const GameSetup           = lazy(() => import('./pages/GameSetup').then(m => ({ default: m.GameSetup })));
const HostConsole         = lazy(() => import('./pages/HostConsole').then(m => ({ default: m.HostConsole })));
const SpectatorView       = lazy(() => import('./pages/SpectatorView').then(m => ({ default: m.SpectatorView })));
const ShotChartView       = lazy(() => import('./pages/ShotChartView').then(m => ({ default: m.ShotChartView })));
const TvKiosk             = lazy(() => import('./pages/TvKiosk').then(m => ({ default: m.TvKiosk })));
const WallView            = lazy(() => import('./pages/WallView').then(m => ({ default: m.WallView })));
const TournamentDashboard = lazy(() => import('./pages/TournamentDashboard').then(m => ({ default: m.TournamentDashboard })));
const TournamentSetup     = lazy(() => import('./pages/TournamentSetup').then(m => ({ default: m.TournamentSetup })));
const TournamentManager   = lazy(() => import('./pages/TournamentManager').then(m => ({ default: m.TournamentManager })));
const TournamentViewer    = lazy(() => import('./pages/TournamentViewer').then(m => ({ default: m.TournamentViewer })));
const TournamentWallView  = lazy(() => import('./pages/TournamentWallView').then(m => ({ default: m.TournamentWallView })));
const PlayerPassportPage  = lazy(() => import('./pages/PlayerPassportPage').then(m => ({ default: m.PlayerPassportPage })));
const VolunteerConsole    = lazy(() => import('./pages/VolunteerConsole').then(m => ({ default: m.VolunteerConsole })));
const RefereeScreen       = lazy(() => import('./pages/RefereeScreen'));
const ArenaView           = lazy(() => import('./pages/ArenaView'));
const CreateArenaPage     = lazy(() => import('./pages/CreateArenaPage'));
const PiLauncher          = lazy(() => import('./pages/PiLauncher'));
const PiConsole           = lazy(() => import('./pages/PiConsole'));
const PiReceiverSetup     = lazy(() => import('./pages/PiReceiverSetup'));
const PiDisplay           = lazy(() => import('./pages/PiDisplay'));
const PiLocalDisplay      = lazy(() => import('./pages/PiLocalDisplay'));
const UiAuditFixture      = lazy(() => import('./pages/UiAuditFixture'));
const CastSetupPage       = lazy(() => import('./pages/CastSetupPage'));
const CourtHexMapPage     = lazy(() => import('./pages/CourtHexMapPage'));
const LanControlPage      = lazy(() => import('./pages/LanControlPage'));

// Tablet PWA pages (no auth wrapper)
const StandaloneTablet    = lazy(() => import('./pages/StandaloneTablet').then(m => ({ default: m.StandaloneTablet })));
const TabletController    = lazy(() => import('./pages/TabletController').then(m => ({ default: m.TabletController })));

// ── Shared components ──────────────────────────────────────
import ProtectedHostRoute from './components/ProtectedHostRoute';

// Black fallback while a route chunk loads — never flashes white on kiosks.
const RouteFallback = () => (
  <div style={{ position: 'fixed', inset: 0, background: '#000' }} />
);

// Routes that have their own splash / are kiosk devices. We skip the website
// SplashScreen for these so the device boots straight into its own UI.
const KIOSK_PREFIXES = ['/referee', '/pi-launcher', '/pi-console', '/pi-receiver', '/pi-display', '/pi-local-display',
                        '/tablet', '/cast', '/tv', '/wall', '/watch/', '/t/', '/uiaudit'];
const isKioskPath = (path: string) =>
  KIOSK_PREFIXES.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p));

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
// RootRedirect is now auth-aware.
// Rendered inside App so it can receive userId + authLoading as props.
const RootRedirect: React.FC<{ userId: string | null; authLoading: boolean }> = ({ userId, authLoading }) => {
  if (isPWA) return <Navigate to="/tablet/standalone" replace />;
  if (authLoading) return (
    <div className="min-h-screen bg-[#F0EEE9] dark:bg-black flex items-center justify-center">
      <div className="animate-pulse text-slate-400 dark:text-zinc-600 font-mono text-xs uppercase tracking-widest">Loading...</div>
    </div>
  );
  return userId ? <HomePage /> : <LandingPage />;
};

// ─────────────────────────────────────────────────────────────
// Read cached Supabase session from localStorage synchronously so the root
// route never flickers on "Loading..." when the user is already signed in.
function getCachedUserId(): string | null {
  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!key) return null;
    const session = JSON.parse(localStorage.getItem(key) || '{}');
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function App() {
  const [userId, setUserId] = useState<string | null>(getCachedUserId);
  const [authLoading, setAuthLoading] = useState(() => getCachedUserId() === null);
  // Splash shows on cold load for the website only. Skip it for PWA mode and
  // any kiosk/device route — those have their own splash and stacking two of
  // them is the main reason cold refresh on /referee felt like ~3s on Safari.
  const [showSplash, setShowSplash] = useState(
    !isPWA && !isKioskPath(window.location.pathname)
  );

  useEffect(() => {
    const timeout = setTimeout(() => setAuthLoading(false), 3000);
    const unsub = subscribeToAuth((u) => {
      setUserId(u?.id || null);
      setAuthLoading(false);
      clearTimeout(timeout);
    });
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <ThemeProvider>
      <Router>
        <HardwareProvider userId={userId}>
          <div className="min-h-screen bg-[#F0EEE9] text-slate-900 dark:bg-black dark:text-white font-sans transition-colors duration-300">
            <Suspense fallback={<RouteFallback />}>
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
              <Route path="/" element={<RootRedirect userId={userId} authLoading={authLoading} />} />
              <Route path="/watch-live" element={<WatchPage />} />
              <Route path="/watch/:gameCode" element={<SpectatorView />} />
              <Route path="/game/:code/shots" element={<ShotChartView />} />
              <Route path="/tv" element={<TvKiosk />} />
              <Route path="/wall" element={<WallView />} />
              <Route path="/referee" element={<RefereeScreen />} />
              <Route path="/court-hex" element={<CourtHexMapPage />} />
              <Route path="/arena/:arenaCode" element={<ArenaView />} />
              <Route path="/pi-launcher" element={<PiLauncher />} />
              <Route path="/pi-console/:gameCode" element={<PiConsole />} />
              <Route path="/pi-receiver" element={<PiReceiverSetup />} />
              <Route path="/pi-display/:gameCode" element={<PiDisplay />} />
              <Route path="/pi-local-display" element={<PiLocalDisplay />} />
              <Route path="/uiaudit" element={<UiAuditFixture />} />
              <Route path="/uiaudit/:variant" element={<UiAuditFixture />} />
              <Route path="/cast" element={<CastSetupPage />} />
              <Route path="/lan-control/:gameCode" element={<LanControlPage />} />

              {/* ── Tournament PUBLIC viewer (shareable QR link, no auth) ── */}
              {/* /t/:id      → bracket/results/live scores for spectators   */}
              {/* /t/:id/volunteer → scorer console (PIN-gated, no auth)     */}
              <Route path="/t/:id" element={<TournamentViewer />} />
              <Route path="/t/:id/volunteer" element={<VolunteerConsole />} />
              <Route path="/t/:id/wall/:code" element={<TournamentWallView />} />

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

              <Route path="/player/register" element={
                <ProtectedHostRoute><PlayerPassportPage /></ProtectedHostRoute>
              } />

              <Route path="/arena/create" element={
                <ProtectedHostRoute><CreateArenaPage /></ProtectedHostRoute>
              } />

              {/* ══════════════════════════════════════════════
              FALLBACK
              ══════════════════════════════════════════════ */}
              <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
            </Suspense>
          </div>
        </HardwareProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;