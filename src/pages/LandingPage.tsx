// src/pages/LandingPage.tsx
// Shown to non-authenticated users at "/". Login + watch entry.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BasketballGame } from '../types';
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  loginAnonymously,
  subscribeToAuth
} from '../services/authService';
import { subscribeToLiveGames } from '../services/supabaseGameService';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const [liveGames, setLiveGames] = useState<BasketballGame[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showFreeHostWarning, setShowFreeHostWarning] = useState(false);
  const [selectedLiveGame, setSelectedLiveGame] = useState<BasketballGame | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubAuth = subscribeToAuth((u) => {
      if (u) navigate('/dashboard');
    });
    const unsubLive = subscribeToLiveGames(setLiveGames);
    return () => { unsubAuth(); unsubLive(); };
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch {
      alert("Google Login failed. Check console for details.");
      setIsLoggingIn(false);
    }
  };

  const handleGuestEntry = async () => {
    setIsLoggingIn(true);
    try {
      await loginAnonymously();
    } catch {
      alert("Could not start Guest Session");
      setIsLoggingIn(false);
    }
  };

  const handleWatchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (joinCode.length === 6) navigate(`/watch/${joinCode}`);
    else alert("Please enter a valid 6-digit Game ID");
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    try {
      if (isRegistering) await registerWithEmail(email, password);
      else await loginWithEmail(email, password);
    } catch (err: any) {
      setAuthError(err.message.replace('Firebase: ', ''));
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0EEE9] dark:bg-black font-sans text-slate-900 dark:text-white flex flex-col relative overflow-x-hidden animate-in">

      {/* HEADER */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-8 h-16 border-b border-slate-200 dark:border-zinc-900 bg-white/90 dark:bg-black/85 backdrop-blur-lg shadow-sm dark:shadow-none">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 flex items-center justify-center shadow-[0_0_14px_rgba(220,38,38,0.35)]"
            style={{ background: '#dc2626', clipPath: 'polygon(0 0, 100% 0, 100% 72%, 72% 100%, 0 100%)' }}
          >
            <span className="font-black text-white text-[13px] italic leading-none">B</span>
          </div>
          <div>
            <h1 className="text-[17px] font-black italic tracking-tighter leading-none text-slate-900 dark:text-white">THE BOX</h1>
            <p className="text-[8px] text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-[0.35em] leading-none mt-0.5">by BMSCE</p>
          </div>
        </div>

        {/* Center nav — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-1">
          <a href="#" onClick={e => { e.preventDefault(); document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors rounded-sm hover:bg-slate-100 dark:hover:bg-zinc-900">
            Watch Live
          </a>
          <span className="w-px h-4 bg-slate-200 dark:bg-zinc-800" />
          <button
            onClick={() => { setShowFreeHostWarning(true); }}
            className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors rounded-sm hover:bg-slate-100 dark:hover:bg-zinc-900"
          >
            Free Host
          </button>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Server status pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_#22c55e]" />
            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">Online</span>
          </div>

          {/* Sign in with email */}
          <button
            onClick={() => setShowEmailModal(true)}
            disabled={isLoggingIn}
            className="hidden sm:flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-500 dark:hover:border-zinc-500 hover:text-slate-900 dark:hover:text-white text-[11px] font-bold uppercase tracking-widest transition-all rounded-sm bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-900"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Sign In
          </button>

          {/* Google sign in — primary CTA */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-black text-[11px] font-black uppercase tracking-widest transition-all rounded-sm shadow-sm cursor-pointer"
          >
            {isLoggingIn
              ? <span className="w-3.5 h-3.5 border-2 border-white/20 dark:border-black/20 border-t-white dark:border-t-black rounded-full animate-spin" />
              : <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-3.5 h-3.5" alt="G" />
            }
            <span className="hidden sm:inline">{isLoggingIn ? 'Connecting…' : 'Google'}</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col md:flex-row gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full mb-20 z-10 relative">

        {/* LEFT: OPERATOR LOGIN */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex-1 bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 shadow-sm dark:shadow-none p-8 rounded-sm relative overflow-hidden flex flex-col justify-between">
            <div className="relative z-10">
              <h2 className="text-red-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-4 h-[1px] bg-red-600" /> Pro Access
              </h2>
              <h3 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white mb-4">Operator Login</h3>
              <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed max-w-sm mb-12">
                Authenticate to access the dashboard. Save match data, manage rosters, and resume games.
              </p>
              <div className="mt-auto space-y-4 pb-2 relative z-20">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-white dark:text-black font-black py-3.5 uppercase tracking-widest flex items-center justify-center gap-3 transition-colors cursor-pointer border border-slate-900 dark:border-transparent shadow-sm"
                >
                  {isLoggingIn
                    ? <span className="w-4 h-4 border-2 border-white/20 dark:border-black/20 border-t-white dark:border-t-black rounded-full animate-spin" />
                    : <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4" alt="G" />
                  }
                  {isLoggingIn ? 'Connecting...' : 'Sign In with Google'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailModal(true)}
                  disabled={isLoggingIn}
                  className="w-full bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-zinc-700 font-bold py-3.5 uppercase tracking-widest transition-colors flex items-center justify-center gap-3 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Sign In with Email
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowFreeHostWarning(true)}
            disabled={isLoggingIn}
            className="bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-500 disabled:opacity-50 p-5 flex items-center justify-between group transition-all cursor-pointer relative z-10 shadow-sm dark:shadow-none"
          >
            <div className="text-left">
              <div className="text-slate-700 dark:text-zinc-200 font-bold text-lg group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">Free Host Mode</div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-600 uppercase tracking-widest mt-0.5">Quick Start • No Data Retention</div>
            </div>
            <div className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-zinc-600 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-1 transition-all text-xl">&rarr;</div>
          </button>
        </div>

        {/* RIGHT: WATCH LIVE */}
        <div className="flex-1 bg-gradient-to-br from-blue-50 to-slate-50 dark:from-blue-950/20 dark:to-black border border-slate-200 dark:border-zinc-800 p-10 flex flex-col justify-center relative overflow-hidden rounded-sm group shadow-sm dark:shadow-none">
          <div className="absolute inset-0 opacity-[0.06] dark:opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(#1e40af 1px, transparent 1px), linear-gradient(90deg, #1e40af 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          <div className="relative z-10 max-w-md mx-auto w-full">
            <div className="text-blue-600 dark:text-blue-500 text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]" /> Spectator Access
            </div>
            <h2 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white mb-8 leading-tight">
              Watch<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-slate-800 dark:from-blue-500 dark:to-white">Live Feed</span>
            </h2>
            <form onSubmit={handleWatchSubmit} className="flex flex-col gap-6">
              <div className="relative group/input">
                <div className="bg-white dark:bg-black/40 backdrop-blur-sm border-2 border-slate-300 dark:border-zinc-700 group-focus-within/input:border-blue-500 transition-colors p-1 flex shadow-sm dark:shadow-none">
                  <div className="bg-slate-100 dark:bg-zinc-800/50 flex items-center justify-center px-5 border-r border-slate-200 dark:border-zinc-700">
                    <span className="text-slate-400 dark:text-zinc-500 font-bold text-xl group-focus-within/input:text-blue-500 transition-colors">#</span>
                  </div>
                  <input
                    type="text"
                    placeholder="GAME ID"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full bg-transparent p-4 text-center text-4xl font-mono text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-zinc-700 outline-none font-bold tracking-widest uppercase"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-700 hover:bg-blue-600 text-white font-black uppercase tracking-widest py-5 text-sm shadow-[0_2px_12px_rgba(29,78,216,0.25)] hover:shadow-[0_4px_20px_rgba(29,78,216,0.35)] transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                Connect Stream
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* FOOTER TICKER — intentionally always dark (branded element) */}
      <div className="fixed bottom-0 w-full bg-zinc-950 border-t border-zinc-900 h-14 flex items-center z-30">
        <div className="bg-red-600 h-full px-6 flex items-center justify-center font-black italic text-lg tracking-tighter shrink-0 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] relative z-10">LIVE</div>
        <div className="flex-1 overflow-hidden relative flex items-center h-full group bg-black">
          <div className="flex gap-12 px-6 animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused]">
            {liveGames.length === 0 ? (
              <span className="text-zinc-700 text-xs font-mono tracking-widest uppercase">Waiting for active signals from server...</span>
            ) : (
              liveGames.map((g, idx) => (
                <button key={g.code || `live-${idx}`} onClick={() => setSelectedLiveGame(g)} className="flex items-center gap-3 hover:bg-zinc-900 px-4 py-1.5 rounded-sm transition-colors border border-transparent hover:border-zinc-800 cursor-pointer">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" /></span>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{g.gameState?.period <= 4 ? `Q${g.gameState?.period}` : 'OT'}</span>
                  <span className="text-sm font-bold font-mono text-white">{g.teamA?.name || 'Home'} <span className="text-red-500 mx-1 text-lg">{g.teamA?.score ?? 0}</span> - <span className="text-red-500 mx-1 text-lg">{g.teamB?.score ?? 0}</span> {g.teamB?.name || 'Away'}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL: FREE HOST WARNING */}
      {showFreeHostWarning && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
          <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 max-w-md w-full p-8 shadow-xl dark:shadow-2xl relative overflow-hidden rounded-lg">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
            <h3 className="text-2xl font-black italic uppercase text-slate-900 dark:text-white mb-3">Data Loss Warning</h3>
            <p className="text-slate-500 dark:text-zinc-400 text-sm mb-8 leading-relaxed">
              You are entering <strong className="text-slate-900 dark:text-white">Free Host Mode</strong>. Game data will NOT be saved to an account. If you close this tab, the match state will be lost forever.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setShowFreeHostWarning(false)} disabled={isLoggingIn} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-zinc-700 rounded cursor-pointer">
                Go Back
              </button>
              <button onClick={handleGuestEntry} disabled={isLoggingIn} className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-400 disabled:cursor-not-allowed text-white font-bold py-3 uppercase tracking-widest rounded flex items-center justify-center gap-2 cursor-pointer">
                {isLoggingIn ? <><span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /><span>Processing...</span></> : 'Proceed Anyway'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELECTED LIVE GAME */}
      {selectedLiveGame && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-red-900/50 max-w-md w-full p-8 shadow-xl dark:shadow-2xl relative rounded-lg">
            <h3 className="text-red-600 text-xs font-bold uppercase tracking-widest mb-2">Incoming Feed</h3>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white italic uppercase mb-1">{selectedLiveGame.settings?.gameName || 'UNTITLED GAME'}</h2>
            <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 p-6 mb-8 mt-6 rounded-lg">
              <div className="flex justify-between items-center text-sm font-bold font-mono mb-2">
                <span style={{ color: selectedLiveGame.teamA?.color || undefined }}>{selectedLiveGame.teamA?.name || 'Home'}</span>
                <span className="text-slate-400 dark:text-zinc-600 text-xs">VS</span>
                <span style={{ color: selectedLiveGame.teamB?.color || undefined }}>{selectedLiveGame.teamB?.name || 'Away'}</span>
              </div>
              <div className="flex justify-between items-center text-3xl text-slate-900 dark:text-white font-mono font-bold">
                <span>{selectedLiveGame.teamA?.score ?? 0}</span>
                <span className="text-slate-300 dark:text-zinc-700 text-lg">-</span>
                <span>{selectedLiveGame.teamB?.score ?? 0}</span>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setSelectedLiveGame(null)} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-zinc-700 rounded cursor-pointer">Cancel</button>
              <button onClick={() => navigate(`/watch/${selectedLiveGame.code}`)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 uppercase tracking-widest rounded cursor-pointer">Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL AUTH */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 w-full max-w-sm p-8 relative shadow-xl dark:shadow-2xl rounded-lg">
            <button onClick={() => setShowEmailModal(false)} className="absolute top-4 right-4 text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-xl leading-none">✕</button>
            <h2 className="text-2xl font-black italic uppercase text-slate-900 dark:text-white mb-1">{isRegistering ? 'Create Account' : 'Operator Login'}</h2>
            <p className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-6">{isRegistering ? 'Join the Box Platform' : 'Access your console'}</p>
            {authError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs p-3 mb-4 rounded-sm">{authError}</div>}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 p-3 text-slate-900 dark:text-white text-sm focus:border-slate-900 dark:focus:border-white outline-none transition-colors rounded-sm" placeholder="user@example.com" required />
              </div>
              <div className="mb-2">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 p-3 text-slate-900 dark:text-white text-sm focus:border-slate-900 dark:focus:border-white outline-none transition-colors rounded-sm" placeholder="••••••••" required minLength={6} />
              </div>
              <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-black font-bold py-3 uppercase tracking-widest mt-4 transition-colors cursor-pointer flex justify-center items-center gap-2 rounded-sm">
                {isLoggingIn && <span className="w-4 h-4 border-2 border-white/20 dark:border-black/20 border-t-white dark:border-t-black rounded-full animate-spin" />}
                {isRegistering ? 'Create Account' : 'Sign In'}
              </button>
            </form>
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 text-center">
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Register'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BACKGROUND DECOR */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-100/60 dark:bg-blue-900/10 rounded-full blur-[100px] pointer-events-none z-0" />
    </div>
  );
};
