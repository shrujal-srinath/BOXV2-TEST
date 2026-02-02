// src/pages/LandingPage.tsx - FIXED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BasketballGame } from '../types';
import { loginWithGoogle, loginWithEmail, registerWithEmail, subscribeToAuth } from '../services/authService';
import { subscribeToLiveGames } from '../services/gameService';
import { SplashScreen } from '../components/SplashScreen';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [liveGames, setLiveGames] = useState<BasketballGame[]>([]);
  const [joinCode, setJoinCode] = useState('');

  // UI & Animation
  const [showSplash, setShowSplash] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Modals
  const [selectedLiveGame, setSelectedLiveGame] = useState<BasketballGame | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Auth Form
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --- INITIALIZATION ---
  useEffect(() => {
    const unsubAuth = subscribeToAuth((u) => {
      if (u) {
        if (!showSplash) navigate('/dashboard');
        else setTimeout(() => navigate('/dashboard'), 3300);
      }
    });

    const unsubLive = subscribeToLiveGames(setLiveGames);

    return () => {
      unsubAuth();
      unsubLive();
    };
  }, [navigate, showSplash]);

  // --- HANDLERS ---
  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  const handleWatchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (joinCode.length === 6) navigate(`/watch/${joinCode}`);
    else alert("Please enter a valid 6-digit Game ID");
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) await registerWithEmail(email, password);
      else await loginWithEmail(email, password);
    } catch (err: any) {
      setAuthError(err.message.replace('Firebase: ', ''));
    }
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <div className="min-h-screen bg-black font-sans text-white flex flex-col relative overflow-hidden animate-in">

      {/* HEADER */}
      <header className="flex justify-between items-center p-6 border-b border-zinc-900 bg-black/80 backdrop-blur-md z-40 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.6)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-2xl font-black italic tracking-tighter leading-none text-white">THE BOX</h1>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.3em] leading-none mt-1">By BMSCE</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-3 py-1.5 rounded-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]"></div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Server Online</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-2 hover:bg-zinc-900 border border-zinc-800 rounded-sm transition-colors text-zinc-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                <div className="absolute right-0 mt-3 w-64 bg-zinc-950 border border-zinc-800 shadow-2xl z-50 animate-in slide-in-from-top-2">
                  <div className="p-4 border-b border-zinc-900">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">System Menu</p>
                  </div>

                  <button
                    onClick={() => { setShowEmailModal(true); setShowUserMenu(false); }}
                    className="flex items-center gap-3 w-full px-4 py-4 text-left hover:bg-zinc-900 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                    </div>
                    <span className="text-sm font-bold text-zinc-300">Operator Login</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col md:flex-row gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full mb-20">

        {/* LEFT: CREATE GAME */}
        <div className="flex-1 flex flex-col gap-6">

          {/* HOST GAME SECTION */}
          <div className="flex-1 bg-zinc-900/40 border border-zinc-800 p-8 rounded-sm relative overflow-hidden flex flex-col justify-between">
            <div className="relative z-10">
              <h2 className="text-red-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-4 h-[1px] bg-red-600"></span> Create Game
              </h2>
              <h3 className="text-4xl font-black italic uppercase tracking-tighter text-white mb-4">Start Hosting</h3>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mb-12">
                Create and manage basketball games with full control.
              </p>

              {/* UNIFIED BUTTONS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

                {/* SIGN IN (Recommended) */}
                <button
                  onClick={loginWithGoogle}
                  className="bg-zinc-900/80 hover:bg-zinc-800 border-2 border-red-600/30 hover:border-red-600 p-6 text-left group transition-all"
                >
                  <div className="text-4xl mb-3">🔐</div>
                  <div className="font-black text-lg text-white uppercase mb-2">Sign In</div>
                  <div className="text-xs text-zinc-500 leading-relaxed">
                    Save to cloud, access anywhere
                  </div>
                  <div className="mt-4 inline-block bg-red-600/10 text-red-500 text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                    Recommended
                  </div>
                </button>

                {/* GUEST MODE */}
                <button
                  onClick={() => navigate('/setup')}
                  className="bg-black hover:bg-zinc-900 border-2 border-zinc-700 hover:border-zinc-500 p-6 text-left group transition-all"
                >
                  <div className="text-4xl mb-3">⚡</div>
                  <div className="font-black text-lg text-white uppercase mb-2">Guest Mode</div>
                  <div className="text-xs text-zinc-500 leading-relaxed">
                    Quick start, no account needed
                  </div>
                  <div className="mt-4 inline-block bg-zinc-800 text-zinc-400 text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                    Local Only
                  </div>
                </button>

              </div>

              {/* Email Sign In */}
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="w-full bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 font-bold py-3.5 uppercase tracking-widest transition-colors flex items-center justify-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  Sign In with Email
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: WATCH GAME */}
        <div className="flex-1 bg-gradient-to-br from-blue-950/20 to-black border border-zinc-800 p-10 flex flex-col justify-center relative overflow-hidden rounded-sm group">
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'linear-gradient(#1e40af 1px, transparent 1px), linear-gradient(90deg, #1e40af 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}>
          </div>

          <div className="relative z-10 max-w-md mx-auto w-full">
            <div className="text-blue-500 text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]"></span> Spectator Access
            </div>
            <h2 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-white mb-8 leading-tight">
              Watch<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-white">Live Feed</span>
            </h2>

            <form onSubmit={handleWatchSubmit} className="flex flex-col gap-6">
              <div className="relative group/input">
                <div className="bg-black/40 backdrop-blur-sm border-2 border-zinc-700 group-focus-within/input:border-blue-500 transition-colors p-1 flex">
                  <div className="bg-zinc-800/50 flex items-center justify-center px-5 border-r border-zinc-700">
                    <span className="text-zinc-500 font-bold text-xl group-focus-within/input:text-blue-500 transition-colors">#</span>
                  </div>
                  <input
                    type="text"
                    placeholder="GAME ID"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full bg-transparent p-4 text-center text-4xl font-mono text-white placeholder-zinc-700 outline-none font-bold tracking-widest uppercase"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-700 hover:bg-blue-600 text-white font-black uppercase tracking-widest py-5 text-sm shadow-[0_0_20px_rgba(29,78,216,0.2)] hover:shadow-[0_0_30px_rgba(29,78,216,0.4)] transition-all hover:-translate-y-1"
              >
                Connect Stream
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-zinc-600">
              Works with both cloud and local games
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER TICKER */}
      <div className="fixed bottom-0 w-full bg-zinc-950 border-t border-zinc-900 h-14 flex items-center z-30">
        <div className="bg-red-600 h-full px-6 flex items-center justify-center font-black italic text-lg tracking-tighter shrink-0 shadow-[0_0_20px_rgba(220,38,38,0.4)] relative z-10">LIVE</div>
        <div className="flex-1 overflow-hidden relative flex items-center h-full group bg-black">
          <div className="flex gap-12 px-6 animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused]">
            {liveGames.length === 0 ? (
              <span className="text-zinc-700 text-xs font-mono tracking-widest uppercase">Waiting for active signals from server...</span>
            ) : (
              liveGames.map(g => (
                <button key={g.code} onClick={() => setSelectedLiveGame(g)} className="flex items-center gap-3 hover:bg-zinc-900 px-4 py-1.5 rounded-sm transition-colors border border-transparent hover:border-zinc-800">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span></span>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{g.gameState.period <= 4 ? `Q${g.gameState.period}` : 'OT'}</span>
                  <span className="text-sm font-bold font-mono text-white">{g.teamA.name} <span className="text-red-500 mx-1 text-lg">{g.teamA.score}</span> - <span className="text-red-500 mx-1 text-lg">{g.teamB.score}</span> {g.teamB.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL: SELECTED LIVE GAME */}
      {selectedLiveGame && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
          <div className="bg-zinc-900 border border-red-900/50 max-w-md w-full p-8 shadow-2xl relative">
            <h3 className="text-red-600 text-xs font-bold uppercase tracking-widest mb-2">Incoming Feed</h3>
            <h2 className="text-2xl font-black text-white italic uppercase mb-1">{selectedLiveGame.settings.gameName}</h2>
            <div className="bg-black border border-zinc-800 p-6 mb-8 mt-6">
              <div className="flex justify-between items-center text-sm font-bold font-mono mb-2">
                <span style={{ color: selectedLiveGame.teamA.color }}>{selectedLiveGame.teamA.name}</span>
                <span className="text-zinc-600 text-xs">VS</span>
                <span style={{ color: selectedLiveGame.teamB.color }}>{selectedLiveGame.teamB.name}</span>
              </div>
              <div className="flex justify-between items-center text-3xl text-white font-mono font-bold">
                <span>{selectedLiveGame.teamA.score}</span>
                <span className="text-zinc-700 text-lg">-</span>
                <span>{selectedLiveGame.teamB.score}</span>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setSelectedLiveGame(null)} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors border border-transparent hover:border-zinc-700">Cancel</button>
              <button onClick={() => navigate(`/watch/${selectedLiveGame.code}`)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 uppercase tracking-widest">Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL AUTH */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-sm p-8 relative shadow-2xl">
            <button onClick={() => setShowEmailModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">✕</button>
            <h2 className="text-2xl font-black italic uppercase text-white mb-1">{isRegistering ? 'Create Account' : 'Operator Login'}</h2>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-6">{isRegistering ? 'Join the Box Platform' : 'Access your console'}</p>
            {authError && <div className="bg-red-900/20 border border-red-900/50 text-red-400 text-xs p-3 mb-4 rounded-sm">{authError}</div>}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-white text-sm focus:border-white outline-none transition-colors" placeholder="user@example.com" required />
              </div>
              <div className="mb-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-white text-sm focus:border-white outline-none transition-colors" placeholder="••••••••" required minLength={6} />
              </div>
              <button type="submit" className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-3 uppercase tracking-widest mt-4 transition-colors">
                {isRegistering ? 'Create Account' : 'Sign In'}
              </button>
            </form>
            <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
              <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="text-xs text-zinc-500 hover:text-white transition-colors">
                {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Register'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};