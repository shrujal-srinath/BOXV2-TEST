import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToLiveGames } from '../services/gameService';
import type { BasketballGame } from '../types';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  
  // Animation States
  const [showSplash, setShowSplash] = useState(true);
  const [stage, setStage] = useState(0); 

  // Live Data State
  const [liveGames, setLiveGames] = useState<BasketballGame[]>([]);

  // 1. SPLASH SCREEN SEQUENCE
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 200);
    const t2 = setTimeout(() => setStage(2), 500);
    const t3 = setTimeout(() => setStage(3), 1400);
    const t4 = setTimeout(() => setStage(4), 3200);
    const t5 = setTimeout(() => setShowSplash(false), 3700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, []);

  // 2. LIVE GAMES LISTENER
  useEffect(() => {
    const unsubscribe = subscribeToLiveGames((games) => {
      setLiveGames(games);
    });
    return () => unsubscribe();
  }, []);

  // --- ACTIONS ---
  const handleLoginHost = () => {
    // Placeholder for Auth implementation
    alert("Pro Login Feature Coming Soon! (Will save stats to your account)");
  };

  const handleFreeHost = () => {
    navigate('/setup');
  };

  const handleWatch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (joinCode.length === 6) navigate(`/watch/${joinCode}`);
    else alert("Please enter a valid 6-digit Game ID");
  };

  // --- RENDER: SPLASH SCREEN ---
  if (showSplash) {
    return (
      <div className={`fixed inset-0 bg-black z-50 flex items-center justify-center transition-opacity duration-700 ${stage === 4 ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-80"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex flex-col md:flex-row items-center gap-0 md:gap-6 mb-2">
            {stage >= 2 && <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter text-white animate-slam leading-none">THE BOX</h1>}
            {stage >= 2 && <div className="hidden md:block w-1 h-20 bg-zinc-700 transform skew-x-12 animate-slam"></div>}
            {stage >= 2 && (
              <div className="flex flex-col justify-center items-center md:items-start animate-slam mt-2 md:mt-0" style={{ animationDelay: '0.1s' }}>
                <span className="text-zinc-500 text-[10px] font-bold tracking-[0.3em] uppercase mb-1">Powered By</span>
                <span className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-500 italic uppercase tracking-tighter leading-none">BMSCE</span>
              </div>
            )}
          </div>
          {stage >= 1 && <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-600 to-transparent animate-scan mb-6 mt-2"></div>}
          {stage >= 3 && <div className="animate-tracking text-center"><p className="text-zinc-300 text-xs md:text-sm font-mono font-bold tracking-[0.4em] uppercase">The Official College Sports App</p></div>}
        </div>
      </div>
    );
  }

  // --- RENDER: MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-black font-sans text-white p-4 md:p-8 flex flex-col animate-in relative overflow-hidden">
      
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-zinc-800 pb-4 mb-8 z-10">
        <div>
           <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter">BOX <span className="text-red-600">V2</span></h1>
           <p className="text-zinc-500 text-xs tracking-[0.3em] uppercase font-bold">Official Telemetry System</p>
        </div>
        <div className="hidden md:block text-right">
           <div className="text-zinc-600 text-[10px] font-mono">SERVER STATUS</div>
           <div className="text-green-500 text-xs font-bold tracking-widest flex items-center justify-end gap-2">
             <span className="block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> ONLINE
           </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 z-10 mb-20">
        
        {/* === SECTION 1 & 2: HOSTING (RED ZONE) === */}
        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* 1. SIGN IN (PRO) */}
          <div onClick={handleLoginHost} className="bg-zinc-900 border border-zinc-800 hover:border-red-600 hover:bg-zinc-800 transition-all p-6 flex flex-col justify-between cursor-pointer group rounded-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 opacity-50"><span className="text-4xl group-hover:scale-110 transition-transform block">🔐</span></div>
             <div>
               <h3 className="text-red-500 font-bold tracking-widest text-xs uppercase mb-1">Pro Access</h3>
               <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white group-hover:text-red-500 transition-colors">Sign In / Up</h2>
               <p className="text-zinc-500 text-xs mt-2 leading-relaxed">Save your game history, manage team rosters, and generate official reports.</p>
             </div>
             <div className="mt-4 flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
               Access Portal &rarr;
             </div>
          </div>

          {/* 2. FREE HOST (QUICK) */}
          <div onClick={handleFreeHost} className="bg-zinc-900 border border-zinc-800 hover:border-white hover:bg-zinc-800 transition-all p-6 flex flex-col justify-between cursor-pointer group rounded-sm">
             <div className="absolute top-0 right-0 p-2 opacity-50"><span className="text-4xl group-hover:scale-110 transition-transform block">⚡</span></div>
             <div>
               <h3 className="text-white font-bold tracking-widest text-xs uppercase mb-1">Instant Mode</h3>
               <h2 className="text-3xl font-black italic uppercase tracking-tighter text-zinc-400 group-hover:text-white transition-colors">Free Host</h2>
               <p className="text-zinc-500 text-xs mt-2 leading-relaxed">Start a game immediately without an account. Data is temporary.</p>
             </div>
             <div className="mt-4 flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
               Launch Console &rarr;
             </div>
          </div>

        </div>

        {/* === SECTION 3: WATCH (BLUE ZONE) === */}
        <div className="lg:col-span-5 bg-blue-950/20 border border-blue-900/50 p-6 md:p-8 flex flex-col justify-center relative overflow-hidden rounded-sm">
           {/* Decorative Grid */}
           <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#000033 1px, transparent 1px), linear-gradient(90deg, #000033 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
           
           <div className="relative z-10">
             <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white mb-6">Spectate</h2>
             
             <form onSubmit={handleWatch} className="flex flex-col gap-3">
               <input 
                 type="text" 
                 placeholder="ENTER GAME ID" 
                 maxLength={6}
                 value={joinCode}
                 onChange={(e) => setJoinCode(e.target.value)}
                 className="w-full bg-black border-2 border-blue-900 focus:border-blue-500 p-4 text-center text-3xl font-mono text-white placeholder-blue-900/50 outline-none transition-colors rounded-sm"
               />
               <button 
                 type="submit" 
                 className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-4 text-sm transition-all hover:translate-x-1"
               >
                 Connect to Live Feed &rarr;
               </button>
             </form>
           </div>
        </div>

      </div>

      {/* === SECTION 4: ONGOING GAMES (LIVE TICKER) === */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 z-50 h-16 flex items-center">
        <div className="bg-red-600 text-white h-full px-6 flex items-center justify-center font-black italic uppercase tracking-tighter text-xl shrink-0 z-20">
          LIVE
        </div>
        
        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          {/* SCROLLING CONTENT */}
          <div className="flex gap-8 px-4 animate-marquee whitespace-nowrap">
            {liveGames.length === 0 ? (
              <span className="text-zinc-500 text-sm font-mono tracking-widest uppercase">--- NO LIVE GAMES IN PROGRESS --- START A NEW GAME TO SEE IT HERE ---</span>
            ) : (
              liveGames.map((g) => (
                <div 
                  key={g.code} 
                  onClick={() => navigate(`/watch/${g.code}`)}
                  className="inline-flex items-center gap-4 bg-black/50 border border-zinc-800 px-4 py-2 rounded-sm hover:border-white cursor-pointer transition-colors"
                >
                  <span className="text-red-500 text-[10px] font-bold">● LIVE</span>
                  <div className="flex items-center gap-2 text-sm font-bold font-mono">
                    <span style={{color: g.teamA.color}}>{g.teamA.name}</span>
                    <span className="text-white text-lg">{g.teamA.score}</span>
                    <span className="text-zinc-600">-</span>
                    <span className="text-white text-lg">{g.teamB.score}</span>
                    <span style={{color: g.teamB.color}}>{g.teamB.name}</span>
                  </div>
                  <span className="text-zinc-500 text-[10px] border border-zinc-700 px-1 rounded">
                    {g.gameState.period <= 4 ? `Q${g.gameState.period}` : `OT${g.gameState.period-4}`}
                  </span>
                </div>
              ))
            )}
            {/* DUPLICATE FOR INFINITE SCROLL EFFECT (Optional, usually handled by CSS or enough items) */}
          </div>
        </div>
      </div>

    </div>
  );
};