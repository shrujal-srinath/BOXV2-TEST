// src/pages/WatchPage.tsx
// Dedicated spectator page — enter a 6-digit code to watch a live game.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BasketballGame } from '../types';
import { subscribeToLiveGamesBySport } from '../services/sportEventService';

export const WatchPage: React.FC = () => {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [liveGames, setLiveGames] = useState<BasketballGame[]>([]);

  useEffect(() => {
    return subscribeToLiveGamesBySport(setLiveGames);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (joinCode.length === 6) navigate(`/watch/${joinCode}`);
    else alert('Please enter a valid 6-digit Game ID');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans text-slate-900 dark:text-white flex flex-col relative overflow-x-hidden">

      {/* ── HEADER ── */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-zinc-900 bg-white/85 dark:bg-black/80 backdrop-blur-md z-40 sticky top-0 shadow-sm dark:shadow-none">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 hover:opacity-70 transition-opacity cursor-pointer"
        >
          <svg className="w-7 h-7 text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <div>
            <h1 className="text-xl font-black italic tracking-tighter leading-none text-slate-900 dark:text-white">THE BOX</h1>
            <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-[0.3em] leading-none mt-0.5">By BMSCE</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 border border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600 px-4 py-2 transition-colors cursor-pointer text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-transparent hover:bg-slate-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
      </header>

      {/* ══════════════════════════════════════════
          MAIN — CODE ENTRY
      ══════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col lg:flex-row items-stretch mb-14">

        {/* LEFT — Code input panel */}
        <div className="flex-1 relative flex flex-col items-center justify-center px-8 py-16 overflow-hidden">
          {/* Light mode: clean white | Dark mode: blue radial gradient */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-white dark:hidden" />
            <div className="absolute inset-0 hidden dark:block" style={{ background: 'radial-gradient(circle at 40% 50%, #0c1a3a 0%, #000000 70%)' }} />
            <div
              className="absolute inset-0 opacity-[0.04] dark:opacity-20"
              style={{
                backgroundImage: 'linear-gradient(#1e40af 1px, transparent 1px), linear-gradient(90deg, #1e40af 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.04) 0%, transparent 70%)' }}
            />
          </div>

          <div className="relative z-10 w-full max-w-md animate-in">
            <div className="text-blue-600 dark:text-blue-500 text-[10px] font-bold uppercase tracking-[0.25em] mb-4 flex items-center gap-2 font-mono">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]" />
              Spectator Access
            </div>

            <h2 className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none mb-3"
              style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)' }}>
              Watch<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-slate-700 dark:from-blue-500 dark:to-white">Live Feed</span>
            </h2>

            <div className="w-12 h-0.5 mb-6" style={{ background: '#3b82f6', boxShadow: '0 0 8px #3b82f6' }} />

            <p className="text-slate-500 dark:text-zinc-500 text-sm mb-8 leading-relaxed">
              Enter the 6-digit Game ID shared by the host to connect to a live match stream.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="border-2 border-slate-300 dark:border-zinc-700 focus-within:border-blue-500 transition-colors p-1 flex bg-white dark:bg-transparent shadow-sm dark:shadow-none">
                <div className="bg-slate-100 dark:bg-zinc-800/50 flex items-center justify-center px-5 border-r border-slate-200 dark:border-zinc-700">
                  <span className="text-slate-400 dark:text-zinc-500 font-bold text-2xl font-mono">#</span>
                </div>
                <input
                  type="text"
                  placeholder="GAME ID"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  autoFocus
                  className="w-full bg-transparent p-4 text-center text-4xl font-mono text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-zinc-700 outline-none font-bold tracking-widest uppercase"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-700 hover:bg-blue-600 text-white font-black uppercase tracking-widest py-5 text-sm shadow-[0_2px_12px_rgba(29,78,216,0.25)] hover:shadow-[0_4px_20px_rgba(29,78,216,0.35)] transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                Connect to Stream
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT — Live games list */}
        <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-zinc-900 bg-white dark:bg-zinc-950/60 flex flex-col shadow-[-1px_0_0_0_rgba(226,232,240,1)] dark:shadow-none">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-900 flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
            </span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] font-mono">
              Active Games ({liveGames.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {liveGames.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                <div className="w-12 h-12 border border-slate-200 dark:border-zinc-800 flex items-center justify-center mb-4 bg-slate-50 dark:bg-transparent">
                  <svg className="w-5 h-5 text-slate-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </div>
                <p className="text-slate-400 dark:text-zinc-600 text-xs font-mono uppercase tracking-widest">No active games</p>
                <p className="text-slate-300 dark:text-zinc-700 text-[10px] mt-2">Enter a game code to connect</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-900">
                {liveGames.map((g, idx) => (
                  <button
                    key={g.code || `game-${idx}`}
                    onClick={() => navigate(`/watch/${g.code}`)}
                    className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest">
                        {g.gameState?.period <= 4 ? `Q${g.gameState?.period}` : 'OT'} • LIVE
                      </span>
                      <span className="text-[10px] font-mono text-slate-300 dark:text-zinc-700 group-hover:text-blue-500 transition-colors">#{g.code}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-300 truncate" style={{ color: g.teamA?.color || undefined }}>{g.teamA?.name || 'Home'}</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-300 truncate mt-0.5" style={{ color: g.teamB?.color || undefined }}>{g.teamB?.name || 'Away'}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-mono font-black text-slate-900 dark:text-white leading-none">
                          {g.teamA?.score ?? 0} <span className="text-slate-300 dark:text-zinc-700 text-lg">–</span> {g.teamB?.score ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-slate-300 dark:text-zinc-700 group-hover:text-blue-500 transition-colors">
                      <span className="text-[10px] font-mono uppercase tracking-widest">Watch</span>
                      <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── FOOTER TICKER — intentionally always dark (branded) ── */}
      <div className="fixed bottom-0 w-full bg-zinc-950 border-t border-zinc-900 h-14 flex items-center z-30">
        <div className="bg-blue-700 h-full px-6 flex items-center justify-center font-black italic text-lg tracking-tighter shrink-0 text-white">LIVE</div>
        <div className="flex-1 overflow-hidden flex items-center h-full group bg-black">
          <div className="flex gap-12 px-6 animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused]">
            {liveGames.length === 0 ? (
              <span className="text-zinc-700 text-xs font-mono tracking-widest uppercase">Waiting for active signals from server...</span>
            ) : (
              liveGames.map((g, idx) => (
                <button key={g.code || `ticker-${idx}`} onClick={() => navigate(`/watch/${g.code}`)} className="flex items-center gap-3 hover:bg-zinc-900 px-4 py-1.5 transition-colors border border-transparent hover:border-zinc-800 cursor-pointer">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" /></span>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{g.gameState?.period <= 4 ? `Q${g.gameState?.period}` : 'OT'}</span>
                  <span className="text-sm font-bold font-mono text-white">{g.teamA?.name || 'Home'} <span className="text-blue-400 mx-1">{g.teamA?.score ?? 0}</span> - <span className="text-blue-400 mx-1">{g.teamB?.score ?? 0}</span> {g.teamB?.name || 'Away'}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
