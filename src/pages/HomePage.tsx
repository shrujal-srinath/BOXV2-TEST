// src/pages/HomePage.tsx
// Shown to logged-in users at "/". Hero design, no auth forms.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BasketballGame } from '../types';
import { supabase } from '../services/supabase';
import { subscribeToLiveGames } from '../services/supabaseGameService';
import { subscribeToAuth } from '../services/authService';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [liveGames, setLiveGames] = useState<BasketballGame[]>([]);
  const [selectedLiveGame, setSelectedLiveGame] = useState<BasketballGame | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToAuth((u) => setUserEmail(u?.email ?? null));
    const unsubLive = subscribeToLiveGames(setLiveGames);
    return () => { unsub(); unsubLive(); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const scrollToFeatures = () => {
    document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans text-slate-900 dark:text-white flex flex-col relative overflow-x-hidden">

      {/* ── STICKY HEADER ── */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-zinc-900 bg-white/85 dark:bg-black/80 backdrop-blur-md z-40 sticky top-0 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3">
          <svg className="w-7 h-7 text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <div>
            <h1 className="text-xl font-black italic tracking-tighter leading-none text-slate-900 dark:text-white">THE BOX</h1>
            <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-[0.3em] leading-none mt-0.5">By BMSCE</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-950 px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Server Online</span>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="hidden md:flex items-center gap-2 border border-slate-300 dark:border-zinc-700 hover:border-slate-500 dark:hover:border-zinc-500 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 px-4 py-2 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">Dashboard</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-zinc-900 border border-slate-200 dark:border-zinc-800 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-600/20 border border-red-300 dark:border-red-600/40 flex items-center justify-center">
                <span className="text-red-600 dark:text-red-500 text-[10px] font-black">{userEmail?.[0]?.toUpperCase() ?? 'U'}</span>
              </div>
              <svg className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-xl dark:shadow-2xl z-50 animate-in">
                  {userEmail && (
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-900">
                      <p className="text-[10px] text-slate-400 dark:text-zinc-600 uppercase tracking-widest font-mono">Signed in as</p>
                      <p className="text-xs text-slate-700 dark:text-zinc-300 font-bold truncate mt-0.5">{userEmail}</p>
                    </div>
                  )}
                  <button onClick={() => { navigate('/dashboard'); setShowUserMenu(false); }} className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer">
                    <svg className="w-4 h-4 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Dashboard</span>
                  </button>
                  <button onClick={() => { navigate('/tournament'); setShowUserMenu(false); }} className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer">
                    <svg className="w-4 h-4 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Tournaments</span>
                  </button>
                  <div className="border-t border-slate-100 dark:border-zinc-900" />
                  <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    <span className="text-sm font-bold text-red-500">Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════ */}
      <section className="relative min-h-[calc(100vh-57px)] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Light mode: clean gradient | Dark mode: dramatic dark radial */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-100 to-slate-50 dark:hidden" />
          <div className="absolute inset-0 hidden dark:block" style={{ background: 'radial-gradient(circle at 50% 35%, #1a0505 0%, #000000 75%)' }} />
          <div
            className="absolute inset-0 opacity-[0.04] dark:opacity-[0.025]"
            style={{
              backgroundImage: 'linear-gradient(rgba(15,23,42,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.15) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              maskImage: 'radial-gradient(circle at center, black 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 75%)',
            }}
          />
        </div>

        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none z-0"
          style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.05) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-4xl animate-in">
          <div className="flex items-center gap-2 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-4 py-1.5 backdrop-blur-sm shadow-sm dark:shadow-none">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 shadow-[0_0_6px_#DC2626] animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-[0.25em] font-mono">BMSCE Department of Sports</span>
          </div>

          <h2
            className="font-black italic uppercase leading-none tracking-tighter select-none text-slate-900 dark:text-transparent"
            style={{
              fontSize: 'clamp(4rem, 14vw, 9rem)',
            }}
          >
            <span className="dark:hidden">THE BOX</span>
            <span
              className="hidden dark:inline"
              style={{
                background: 'linear-gradient(180deg, #FFFFFF 20%, #888888 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.08))',
              }}
            >
              THE BOX
            </span>
          </h2>

          <div className="w-16 h-0.5 bg-red-600" style={{ boxShadow: '0 0 10px #DC2626' }} />

          <p className="text-slate-500 dark:text-zinc-400 text-sm md:text-base font-mono tracking-widest uppercase max-w-md leading-relaxed">
            Real-time scoring. Tournament management.<br className="hidden md:block" /> Built for the court.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full max-w-sm sm:max-w-none sm:w-auto">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-black uppercase tracking-widest px-10 py-4 text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Host a Game
            </button>
            <button
              onClick={() => navigate('/watch-live')}
              className="border-2 border-red-600 text-red-600 hover:bg-red-600/10 font-black uppercase tracking-widest px-10 py-4 text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              style={{ boxShadow: '0 0 16px rgba(220,38,38,0.10)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              Watch Live
            </button>
          </div>
        </div>

        <button
          onClick={scrollToFeatures}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce-slow cursor-pointer text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors"
          aria-label="Scroll down"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 2 — FEATURE BADGES
      ══════════════════════════════════════════ */}
      <div id="features-section" className="border-y border-slate-200 dark:border-zinc-900 bg-white dark:bg-zinc-950/50">
        <div className="max-w-4xl mx-auto px-6 py-5 flex flex-wrap justify-center gap-3">
          {[
            { label: 'Real-Time Sync', dot: '#22c55e' },
            { label: 'Offline-First PWA', dot: '#3b82f6' },
            { label: 'Hardware Ready', dot: '#DC2626' },
            { label: 'Multi-Sport Engine', dot: '#a855f7' },
            { label: 'Tournament Brackets', dot: '#f59e0b' },
          ].map(({ label, dot }) => (
            <div key={label} className="flex items-center gap-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-4 py-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot, boxShadow: `0 0 5px ${dot}` }} />
              <span className="text-[10px] font-bold font-mono text-slate-500 dark:text-zinc-400 uppercase tracking-[0.18em]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SECTION 3 — QUICK ACTIONS
      ══════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-12 mb-20 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />,
            label: 'New Game',
            desc: 'Create and host a live basketball game',
            action: () => navigate('/setup'),
            accent: '#DC2626',
          },
          {
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
            label: 'Tournaments',
            desc: 'Manage brackets, fixtures and standings',
            action: () => navigate('/tournament'),
            accent: '#f59e0b',
          },
          {
            icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>,
            label: 'Watch Live',
            desc: 'Join a game as a spectator with a code',
            action: () => navigate('/watch-live'),
            accent: '#3b82f6',
          },
        ].map(({ icon, label, desc, action, accent }) => (
          <button
            key={label}
            onClick={action}
            className="flex flex-col gap-4 p-6 bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600 shadow-sm dark:shadow-none text-left transition-all group cursor-pointer hover:-translate-y-0.5"
          >
            <div className="w-10 h-10 flex items-center justify-center border border-slate-200 dark:border-zinc-800 group-hover:border-slate-300 dark:group-hover:border-zinc-600 transition-colors bg-slate-50 dark:bg-transparent" style={{ boxShadow: `0 0 12px ${accent}15` }}>
              <svg className="w-5 h-5" fill="none" stroke={accent} viewBox="0 0 24 24">{icon}</svg>
            </div>
            <div>
              <p className="font-black uppercase tracking-widest text-slate-900 dark:text-white text-sm mb-1">{label}</p>
              <p className="text-slate-500 dark:text-zinc-500 text-xs leading-relaxed">{desc}</p>
            </div>
            <div className="mt-auto flex items-center gap-1 text-slate-400 dark:text-zinc-600 group-hover:text-slate-700 dark:group-hover:text-zinc-400 transition-colors">
              <span className="text-[10px] font-bold font-mono uppercase tracking-widest">Open</span>
              <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </div>
          </button>
        ))}
      </div>

      {/* ── FOOTER TICKER — intentionally always dark (branded) ── */}
      <div className="fixed bottom-0 w-full bg-zinc-950 border-t border-zinc-900 h-14 flex items-center z-30">
        <div className="bg-red-600 h-full px-6 flex items-center justify-center font-black italic text-lg tracking-tighter shrink-0 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">LIVE</div>
        <div className="flex-1 overflow-hidden flex items-center h-full group bg-black">
          <div className="flex gap-12 px-6 animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused]">
            {liveGames.length === 0 ? (
              <span className="text-zinc-700 text-xs font-mono tracking-widest uppercase">Waiting for active signals from server...</span>
            ) : (
              liveGames.map((g, idx) => (
                <button key={g.code || `live-${idx}`} onClick={() => setSelectedLiveGame(g)} className="flex items-center gap-3 hover:bg-zinc-900 px-4 py-1.5 transition-colors border border-transparent hover:border-zinc-800 cursor-pointer">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" /></span>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{g.gameState?.period <= 4 ? `Q${g.gameState?.period}` : 'OT'}</span>
                  <span className="text-sm font-bold font-mono text-white">{g.teamA?.name || 'Home'} <span className="text-red-500 mx-1">{g.teamA?.score ?? 0}</span> - <span className="text-red-500 mx-1">{g.teamB?.score ?? 0}</span> {g.teamB?.name || 'Away'}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live Game Modal */}
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
    </div>
  );
};
