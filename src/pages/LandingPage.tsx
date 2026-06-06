// src/pages/LandingPage.tsx
// Shown to non-authenticated users at "/". Login + watch entry.
//
// Light mode: Courtside design system (cool neutral page bg, white card
// surfaces with hairline borders, asymmetric padding, Inter + Oswald,
// restrained brand red #E8112D). Dark mode: unchanged from legacy.
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
    <div className="min-h-screen bg-cs-bg dark:bg-black font-sans text-cs-text dark:text-white flex flex-col relative overflow-x-hidden animate-in">

      {/* HEADER */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-8 h-14 border-b-[0.5px] border-cs-border bg-cs-surface/95 dark:bg-black/85 dark:border-zinc-900 backdrop-blur-lg dark:shadow-none">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 flex items-center justify-center shadow-[0_0_14px_rgba(232,17,45,0.32)] dark:shadow-[0_0_14px_rgba(220,38,38,0.35)]"
            style={{ background: 'var(--cs-accent-primary)', clipPath: 'polygon(0 0, 100% 0, 100% 72%, 72% 100%, 0 100%)' }}
          >
            <span className="font-black text-white text-[13px] italic leading-none">B</span>
          </div>
          <div>
            <h1 className="font-display text-[16px] font-bold tracking-wordmark leading-none text-cs-text uppercase dark:text-white dark:font-black dark:italic dark:tracking-tighter dark:font-sans">THE BOX</h1>
            <p className="text-[9px] text-cs-text-3 dark:text-zinc-600 font-semibold uppercase tracking-[0.32em] leading-none mt-1">by BMSCE</p>
          </div>
        </div>

        {/* Center nav — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-2">
          <a href="#" onClick={e => { e.preventDefault(); document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="px-4 h-9 inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.073em] text-cs-text-2 hover:text-cs-text bg-cs-elevated hover:bg-cs-overlay transition-colors cs-pill dark:bg-transparent dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-white dark:rounded-sm">
            Watch Live
          </a>
          <button
            onClick={() => { setShowFreeHostWarning(true); }}
            className="px-4 h-9 inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.073em] text-cs-text-2 hover:text-cs-text bg-cs-elevated hover:bg-cs-overlay transition-colors cs-pill dark:bg-transparent dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-white dark:rounded-sm"
          >
            Free Host
          </button>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Server status pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 h-8 bg-cs-elevated text-cs-text-2 border-0 cs-pill dark:bg-emerald-950/30 dark:border dark:border-emerald-900/50 dark:rounded-full dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cs-success animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.6)] dark:bg-emerald-500 dark:shadow-[0_0_5px_#22c55e]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Online</span>
          </div>

          {/* Sign in with email */}
          <button
            onClick={() => setShowEmailModal(true)}
            disabled={isLoggingIn}
            className="hidden sm:inline-flex items-center gap-2 px-4 h-10 border-[0.5px] border-cs-border text-cs-text-2 hover:text-cs-text hover:bg-cs-elevated text-[11px] font-semibold uppercase tracking-[0.073em] transition-all cs-pill dark:border dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white dark:hover:bg-zinc-900 dark:rounded-sm dark:font-bold dark:tracking-widest"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Sign In
          </button>

          {/* Google sign in — primary CTA */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="inline-flex items-center gap-2 px-4 h-10 bg-cs-text hover:bg-cs-text-2 disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-[0.073em] transition-all cs-pill cursor-pointer shadow-cs-card dark:bg-white dark:hover:bg-zinc-200 dark:text-black dark:rounded-sm dark:font-black dark:tracking-widest dark:shadow-sm"
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
      <main className="flex-1 flex flex-col md:flex-row gap-5 p-4 md:p-8 max-w-7xl mx-auto w-full mb-20 z-10 relative">

        {/* LEFT: OPERATOR LOGIN */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex-1 bg-cs-surface border-[0.5px] border-cs-border shadow-cs-card cs-radius-card relative overflow-hidden flex flex-col justify-between dark:bg-zinc-900/40 dark:border-zinc-800 dark:rounded-sm dark:shadow-none" style={{ paddingTop: 14, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
            <div className="relative z-10 px-2 pt-2 pb-1">
              <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-cs-accent mb-3 flex items-center gap-2 dark:font-sans dark:text-red-600 dark:tracking-[0.2em] dark:font-bold">
                <span className="w-5 h-[2px] bg-cs-accent dark:bg-red-600" /> Pro Access
              </h2>
              <h3 className="text-3xl font-extrabold tracking-tight text-cs-text mb-3 dark:text-4xl dark:font-black dark:italic dark:uppercase dark:tracking-tighter dark:text-white">Operator Login</h3>
              <p className="text-cs-text-2 text-[14px] leading-relaxed max-w-sm mb-10 dark:text-zinc-400 dark:text-sm">
                Authenticate to access the dashboard. Save match data, manage rosters, and resume games.
              </p>
              <div className="mt-auto space-y-3 pb-1 relative z-20">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full bg-cs-text hover:bg-cs-text-2 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold uppercase tracking-[0.073em] text-[13px] flex items-center justify-center gap-3 transition-colors cursor-pointer cs-pill shadow-cs-card dark:bg-white dark:hover:bg-zinc-200 dark:text-black dark:font-black dark:tracking-widest dark:rounded-sm dark:py-3.5 dark:border dark:border-transparent"
                  style={{ height: 54 }}
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
                  className="w-full bg-transparent hover:bg-cs-elevated disabled:opacity-50 text-cs-text-2 hover:text-cs-text border-[0.5px] border-cs-border font-semibold uppercase tracking-[0.073em] text-[12px] transition-colors flex items-center justify-center gap-3 cursor-pointer cs-pill dark:border dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white dark:font-bold dark:tracking-widest dark:py-3.5 dark:rounded-sm"
                  style={{ height: 48 }}
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
            className="bg-cs-surface border-[0.5px] border-cs-border hover:border-cs-border-strong shadow-cs-card disabled:opacity-50 flex items-center justify-between group transition-all cursor-pointer relative z-10 cs-radius-card dark:bg-black dark:border dark:border-zinc-800 dark:hover:border-zinc-500 dark:rounded-sm dark:shadow-none"
            style={{ paddingTop: 14, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 }}
          >
            <div className="text-left">
              <div className="text-cs-text font-semibold text-[15px] group-hover:text-cs-accent transition-colors dark:text-zinc-200 dark:font-bold dark:text-lg dark:group-hover:text-red-500">Free Host Mode</div>
              <div className="text-[10px] text-cs-text-3 uppercase tracking-[0.12em] mt-0.5 font-semibold dark:text-zinc-600 dark:font-normal dark:tracking-widest">Quick Start • No Data Retention</div>
            </div>
            <div className="w-9 h-9 inline-flex items-center justify-center text-cs-text-3 group-hover:text-cs-accent group-hover:translate-x-0.5 transition-all text-xl bg-cs-elevated cs-pill dark:bg-transparent dark:text-zinc-600 dark:group-hover:text-white dark:rounded-none">&rarr;</div>
          </button>
        </div>

        {/* RIGHT: WATCH LIVE */}
        <div className="flex-1 bg-cs-surface border-[0.5px] border-cs-border shadow-cs-card cs-radius-card relative overflow-hidden group dark:bg-gradient-to-br dark:from-blue-950/20 dark:to-black dark:border dark:border-zinc-800 dark:rounded-sm dark:shadow-none flex flex-col" style={{ paddingTop: 14, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
          {/* Light: 4px info-blue left rail (Arena pattern). Dark: keep grid backdrop. */}
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-cs-info dark:hidden" />
          {/* Subtle accent-subtle wash behind input area (light only) */}
          <div className="absolute inset-0 bg-cs-accent-subtle/40 dark:hidden pointer-events-none" />

          {/* Dark grid overlay — kept verbatim */}
          <div className="absolute inset-0 hidden dark:block opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(#1e40af 1px, transparent 1px), linear-gradient(90deg, #1e40af 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative z-10 max-w-md mx-auto w-full px-2 pt-2 pb-1 flex-1 flex flex-col justify-center">
            <div className="font-display text-cs-info dark:text-blue-500 text-[11px] font-bold uppercase tracking-[0.3em] mb-3 flex items-center gap-2 dark:font-sans dark:text-xs dark:tracking-[0.2em]">
              <span className="w-2 h-2 bg-cs-info rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)] dark:bg-blue-500 dark:shadow-[0_0_8px_#3b82f6]" /> Spectator Access
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-cs-text mb-6 leading-tight dark:text-5xl dark:md:text-6xl dark:font-black dark:italic dark:uppercase dark:tracking-tighter dark:text-white">
              Watch<br /><span className="text-cs-info dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-blue-500 dark:to-white">Live Feed</span>
            </h2>
            <form onSubmit={handleWatchSubmit} className="flex flex-col gap-4">
              <div className="relative group/input">
                <div className="bg-cs-elevated cs-radius-md flex items-center group-focus-within/input:ring-2 group-focus-within/input:ring-cs-info/20 transition-all dark:bg-black/40 dark:backdrop-blur-sm dark:border-2 dark:border-zinc-700 dark:rounded-sm dark:p-1 dark:group-focus-within/input:border-blue-500 dark:group-focus-within/input:ring-0">
                  <div className="bg-cs-overlay/80 cs-radius-md flex items-center justify-center px-5 self-stretch dark:bg-zinc-800/50 dark:rounded-none dark:border-r dark:border-zinc-700">
                    <span className="font-display text-cs-text-3 text-2xl group-focus-within/input:text-cs-info transition-colors dark:font-sans dark:font-bold dark:text-xl dark:text-zinc-500 dark:group-focus-within/input:text-blue-500">#</span>
                  </div>
                  <input
                    type="text"
                    placeholder="GAME ID"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full bg-transparent text-center text-3xl text-cs-text placeholder-cs-text-3 outline-none font-extrabold tracking-[0.18em] uppercase dark:text-4xl dark:font-mono dark:text-white dark:placeholder-zinc-700 dark:font-bold dark:tracking-widest"
                    style={{ height: 52, fontFamily: 'Oswald, sans-serif', fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-cs-info hover:brightness-95 text-white font-bold uppercase tracking-[0.073em] text-[13px] cs-pill transition-all cursor-pointer shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_22px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 dark:bg-blue-700 dark:hover:bg-blue-600 dark:font-black dark:tracking-widest dark:text-sm dark:rounded-none dark:py-5 dark:shadow-[0_2px_12px_rgba(29,78,216,0.25)] dark:hover:shadow-[0_4px_20px_rgba(29,78,216,0.35)]"
                style={{ height: 54 }}
              >
                Connect Stream
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* FOOTER TICKER */}
      <div className="fixed bottom-0 w-full bg-cs-overlay border-t-[0.5px] border-cs-border h-12 flex items-center z-30 dark:bg-zinc-950 dark:border-t dark:border-zinc-900 dark:h-14">
        <div className="bg-cs-accent h-full px-5 flex items-center justify-center font-display font-bold text-[13px] tracking-[0.22em] uppercase shrink-0 text-white shadow-[0_0_20px_rgba(232,17,45,0.4)] relative z-10 dark:bg-red-600 dark:font-black dark:italic dark:text-lg dark:tracking-tighter dark:font-sans dark:px-6 dark:shadow-[0_0_20px_rgba(220,38,38,0.4)]">LIVE</div>
        <div className="flex-1 overflow-hidden relative flex items-center h-full group bg-cs-overlay dark:bg-black">
          <div className="flex gap-12 px-6 animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused]">
            {liveGames.length === 0 ? (
              <span className="text-cs-text-3 text-[11px] font-mono tracking-[0.22em] uppercase dark:text-zinc-700 dark:text-xs dark:tracking-widest">Waiting for active signals from server...</span>
            ) : (
              liveGames.map((g, idx) => (
                <button key={g.code || `live-${idx}`} onClick={() => setSelectedLiveGame(g)} className="flex items-center gap-3 hover:bg-cs-surface px-3 py-1.5 cs-pill transition-colors border-[0.5px] border-transparent hover:border-cs-border cursor-pointer dark:hover:bg-zinc-900 dark:rounded-sm dark:border dark:hover:border-zinc-800 dark:px-4">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cs-accent/50 opacity-75 dark:bg-red-400" /><span className="relative inline-flex rounded-full h-2 w-2 bg-cs-accent dark:bg-red-600" /></span>
                  <span className="text-[10px] font-bold text-cs-text-2 uppercase tracking-[0.12em] dark:text-zinc-500 dark:tracking-wider">{g.gameState?.period <= 4 ? `Q${g.gameState?.period}` : 'OT'}</span>
                  <span className="text-[13px] font-semibold text-cs-text dark:font-bold dark:text-sm dark:font-mono dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {g.teamA?.name || 'Home'}
                    <span className="font-display font-bold text-cs-accent mx-1.5 text-[15px] dark:font-sans dark:text-red-500 dark:text-lg" style={{ fontVariantNumeric: 'tabular-nums' }}>{g.teamA?.score ?? 0}</span>
                    <span className="text-cs-text-3 dark:text-zinc-500">-</span>
                    <span className="font-display font-bold text-cs-accent mx-1.5 text-[15px] dark:font-sans dark:text-red-500 dark:text-lg" style={{ fontVariantNumeric: 'tabular-nums' }}>{g.teamB?.score ?? 0}</span>
                    {g.teamB?.name || 'Away'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL: FREE HOST WARNING */}
      {showFreeHostWarning && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in dark:bg-black/90">
          <div className="bg-cs-overlay border-[0.5px] border-cs-border max-w-md w-full shadow-cs-elevated relative overflow-hidden cs-radius-card dark:bg-zinc-900 dark:border dark:border-red-900/50 dark:rounded-lg dark:shadow-2xl" style={{ paddingTop: 14, paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}>
            <div className="absolute top-0 left-0 w-full h-1 bg-cs-accent dark:bg-red-600" />
            <div className="absolute top-1 left-0 bottom-0 w-1 bg-cs-accent dark:hidden" />
            <div className="pl-2 pt-2">
              <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-cs-accent mb-2 dark:hidden">Warning</h3>
              <h3 className="text-xl font-extrabold tracking-tight text-cs-text mb-3 dark:text-2xl dark:font-black dark:italic dark:uppercase dark:text-white dark:tracking-normal">Data Loss Warning</h3>
              <p className="text-cs-text-2 text-[14px] leading-relaxed mb-7 dark:text-zinc-400 dark:text-sm">
                You are entering <strong className="text-cs-text font-semibold dark:text-white dark:font-bold">Free Host Mode</strong>. Game data will NOT be saved to an account. If you close this tab, the match state will be lost forever.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowFreeHostWarning(false)} disabled={isLoggingIn} className="flex-1 text-[12px] font-semibold uppercase tracking-[0.073em] text-cs-text-2 hover:text-cs-text transition-colors border-[0.5px] border-cs-border hover:bg-cs-elevated cs-pill cursor-pointer dark:py-3 dark:font-bold dark:text-xs dark:tracking-widest dark:text-zinc-500 dark:hover:text-white dark:border dark:border-transparent dark:hover:border-zinc-700 dark:rounded" style={{ height: 48 }}>
                  Go Back
                </button>
                <button onClick={handleGuestEntry} disabled={isLoggingIn} className="flex-1 bg-cs-accent hover:bg-cs-accent-pressed disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase tracking-[0.073em] text-[12px] cs-pill flex items-center justify-center gap-2 cursor-pointer dark:hover:bg-red-500 dark:py-3 dark:tracking-widest dark:rounded dark:disabled:bg-red-900 dark:disabled:text-red-400" style={{ height: 48 }}>
                  {isLoggingIn ? <><span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /><span>Processing...</span></> : 'Proceed Anyway'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELECTED LIVE GAME */}
      {selectedLiveGame && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in dark:bg-black/90">
          <div className="bg-cs-overlay border-[0.5px] border-cs-border max-w-md w-full shadow-cs-elevated relative cs-radius-card dark:bg-zinc-900 dark:border dark:border-red-900/50 dark:rounded-lg dark:shadow-2xl" style={{ paddingTop: 14, paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}>
            <div className="pl-2 pt-2">
              <h3 className="font-display text-cs-accent text-[11px] font-bold uppercase tracking-[0.3em] mb-2 dark:font-sans dark:text-xs dark:tracking-widest">Incoming Feed</h3>
              <h2 className="text-xl font-extrabold tracking-tight text-cs-text mb-1 dark:text-2xl dark:font-black dark:text-white dark:italic dark:uppercase">{selectedLiveGame.settings?.gameName || 'UNTITLED GAME'}</h2>
              <div className="bg-cs-elevated border-[0.5px] border-cs-border mb-7 mt-5 cs-radius-md dark:bg-black dark:border dark:border-zinc-800 dark:rounded-lg" style={{ padding: 20 }}>
                <div className="flex justify-between items-center text-[13px] font-semibold mb-2 dark:text-sm dark:font-bold dark:font-mono" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <span style={{ color: selectedLiveGame.teamA?.color || undefined }}>{selectedLiveGame.teamA?.name || 'Home'}</span>
                  <span className="text-cs-text-3 text-[10px] uppercase tracking-[0.22em] dark:text-zinc-600 dark:text-xs">VS</span>
                  <span style={{ color: selectedLiveGame.teamB?.color || undefined }}>{selectedLiveGame.teamB?.name || 'Away'}</span>
                </div>
                <div className="flex justify-between items-center text-cs-text dark:text-white" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 900, fontSize: 32, fontVariantNumeric: 'tabular-nums' }}>
                  <span>{selectedLiveGame.teamA?.score ?? 0}</span>
                  <span className="text-cs-text-3 text-lg dark:text-zinc-700">-</span>
                  <span>{selectedLiveGame.teamB?.score ?? 0}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSelectedLiveGame(null)} className="flex-1 text-[12px] font-semibold uppercase tracking-[0.073em] text-cs-text-2 hover:text-cs-text transition-colors border-[0.5px] border-cs-border hover:bg-cs-elevated cs-pill cursor-pointer dark:py-3 dark:font-bold dark:text-xs dark:tracking-widest dark:text-zinc-500 dark:hover:text-white dark:border dark:border-transparent dark:hover:border-zinc-700 dark:rounded" style={{ height: 48 }}>Cancel</button>
                <button onClick={() => navigate(`/watch/${selectedLiveGame.code}`)} className="flex-1 bg-cs-accent hover:bg-cs-accent-pressed text-white font-bold uppercase tracking-[0.073em] text-[12px] cs-pill cursor-pointer dark:hover:bg-red-500 dark:py-3 dark:tracking-widest dark:rounded" style={{ height: 48 }}>Connect</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL AUTH */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in dark:bg-black/90">
          <div className="bg-cs-overlay border-[0.5px] border-cs-border w-full max-w-sm relative shadow-cs-elevated cs-radius-card dark:bg-zinc-900 dark:border dark:border-zinc-700 dark:rounded-lg dark:shadow-2xl" style={{ paddingTop: 14, paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}>
            <button onClick={() => setShowEmailModal(false)} className="absolute top-3 right-3 w-9 h-9 inline-flex items-center justify-center text-cs-text-2 hover:text-cs-text hover:bg-cs-elevated cs-pill transition-colors cursor-pointer text-lg leading-none dark:text-zinc-500 dark:hover:text-white dark:hover:bg-transparent dark:rounded-none dark:top-4 dark:right-4 dark:w-auto dark:h-auto dark:text-xl">✕</button>
            <div className="pl-2 pt-2">
              <h2 className="text-xl font-extrabold tracking-tight text-cs-text mb-1 dark:text-2xl dark:font-black dark:italic dark:uppercase dark:text-white">{isRegistering ? 'Create Account' : 'Operator Login'}</h2>
              <p className="text-[11px] text-cs-text-3 uppercase tracking-[0.18em] mb-5 font-semibold dark:text-xs dark:font-normal dark:text-zinc-500 dark:tracking-widest">{isRegistering ? 'Join the Box Platform' : 'Access your console'}</p>
              {authError && <div className="bg-cs-accent-subtle border-[0.5px] border-cs-accent/30 text-cs-accent text-[12px] p-3 mb-4 cs-radius-sm dark:bg-red-900/20 dark:border dark:border-red-900/50 dark:text-red-400 dark:rounded-sm dark:text-xs">{authError}</div>}
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold text-cs-text-2 uppercase tracking-[0.12em] mb-1.5 dark:text-zinc-500 dark:font-bold dark:tracking-widest">Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-cs-elevated border-0 px-4 text-cs-text text-[14px] focus:ring-2 focus:ring-cs-info/20 outline-none transition-all cs-radius-md dark:bg-black dark:border dark:border-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-0 dark:rounded-sm dark:p-3 dark:text-sm" style={{ height: 52 }} placeholder="user@example.com" required />
                </div>
                <div className="mb-2">
                  <label className="block text-[10px] font-semibold text-cs-text-2 uppercase tracking-[0.12em] mb-1.5 dark:text-zinc-500 dark:font-bold dark:tracking-widest">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-cs-elevated border-0 px-4 text-cs-text text-[14px] focus:ring-2 focus:ring-cs-info/20 outline-none transition-all cs-radius-md dark:bg-black dark:border dark:border-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-0 dark:rounded-sm dark:p-3 dark:text-sm" style={{ height: 52 }} placeholder="••••••••" required minLength={6} />
                </div>
                <button type="submit" disabled={isLoggingIn} className="w-full bg-cs-text hover:bg-cs-text-2 disabled:opacity-50 text-white font-semibold uppercase tracking-[0.073em] text-[13px] mt-4 transition-colors cursor-pointer flex justify-center items-center gap-2 cs-pill dark:bg-white dark:hover:bg-zinc-200 dark:text-black dark:font-bold dark:tracking-widest dark:py-3 dark:rounded-sm" style={{ height: 54 }}>
                  {isLoggingIn && <span className="w-4 h-4 border-2 border-white/20 dark:border-black/20 border-t-white dark:border-t-black rounded-full animate-spin" />}
                  {isRegistering ? 'Create Account' : 'Sign In'}
                </button>
              </form>
              <div className="mt-7 pt-5 border-t-[0.5px] border-cs-border text-center dark:border-t dark:border-zinc-800">
                <button type="button" onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="text-[12px] text-cs-text-2 hover:text-cs-text transition-colors cursor-pointer font-semibold dark:text-zinc-500 dark:hover:text-white dark:text-xs dark:font-normal">
                  {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Register'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BACKGROUND DECOR — only in dark; light keeps the cool neutral clean */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] hidden dark:block dark:bg-blue-900/10 rounded-full blur-[100px] pointer-events-none z-0" />
    </div>
  );
};
