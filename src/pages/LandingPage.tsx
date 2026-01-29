import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BasketballGame } from '../types';
import { loginWithGoogle, loginWithEmail, registerWithEmail, subscribeToAuth } from '../services/authService';
import { subscribeToLiveGames } from '../services/gameService';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [liveGames, setLiveGames] = useState<BasketballGame[]>([]);
  const [joinCode, setJoinCode] = useState('');
  
  // UI & Animation
  const [showSplash, setShowSplash] = useState(true);
  const [stage, setStage] = useState(0); 
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInstallInfo, setShowInstallInfo] = useState(false);

  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Modals
  const [showFreeHostWarning, setShowFreeHostWarning] = useState(false);
  const [selectedLiveGame, setSelectedLiveGame] = useState<BasketballGame | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  // Auth Form
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Enhanced Splash Sequence with refined timing
    const t1 = setTimeout(() => setStage(1), 200);
    const t2 = setTimeout(() => setStage(2), 700);
    const t3 = setTimeout(() => setStage(3), 1500);
    const t4 = setTimeout(() => setStage(4), 3500);
    const t5 = setTimeout(() => setShowSplash(false), 4200);
    
    // 2. Auth Listener with REDIRECT TO DASHBOARD
    const unsubAuth = subscribeToAuth((u) => {
      if (u) {
        if (!showSplash) navigate('/dashboard');
        else setTimeout(() => navigate('/dashboard'), 4300);
      }
    });

    // 3. Live Games
    const unsubLive = subscribeToLiveGames(setLiveGames);

    // 4. PWA Install Listener
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log("🚀 PWA Install Prompt Stashed");
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => { 
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); 
      unsubAuth(); unsubLive(); 
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, [navigate, showSplash]);

  // --- HANDLERS ---
  const handleInstallClick = async () => {
    if (!installPrompt) {
      setShowInstallInfo(true);
      setShowUserMenu(false);
      return;
    }
    
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setShowUserMenu(false);
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
    try {
      if (isRegistering) await registerWithEmail(email, password);
      else await loginWithEmail(email, password);
    } catch (err: any) {
      setAuthError(err.message.replace('Firebase: ', ''));
    }
  };

  // --- RENDER: REFINED SPLASH SCREEN ---
  if (showSplash) {
    return (
      <div className={`fixed inset-0 bg-black z-50 flex items-center justify-center transition-opacity duration-1000 ${stage === 4 ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 via-black to-black"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_var(--tw-gradient-stops))] from-red-950/20 via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,_var(--tw-gradient-stops))] from-red-950/10 via-transparent to-transparent"></div>
        </div>
        
        <div 
          className="absolute inset-0 opacity-[0.15]" 
          style={{ 
            backgroundImage: 'radial-gradient(circle, #444 1px, transparent 1px)', 
            backgroundSize: '30px 30px',
            animation: stage >= 2 ? 'grid-pulse 3s ease-in-out infinite' : 'none'
          }}
        ></div>
        
        {stage >= 1 && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-[2px] h-full bg-gradient-to-b from-red-600/0 via-red-600/40 to-red-600/0 transform -skew-x-12 animate-beam-1 shadow-[0_0_30px_rgba(220,38,38,0.5)]"></div>
            <div className="absolute top-0 right-1/4 w-[2px] h-full bg-gradient-to-b from-red-600/0 via-red-600/30 to-red-600/0 transform skew-x-12 animate-beam-2 shadow-[0_0_30px_rgba(220,38,38,0.4)]"></div>
            <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gradient-to-b from-red-600/0 via-red-600/20 to-red-600/0 animate-beam-3 shadow-[0_0_20px_rgba(220,38,38,0.3)]"></div>
          </div>
        )}
        
        <div className="relative z-10 flex flex-col items-center px-6">
          <div className="flex flex-col md:flex-row items-center gap-0 md:gap-8 mb-8">
            {stage >= 2 && (
              <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter text-white animate-slam leading-none drop-shadow-2xl relative">
                THE BOX
                <span className="absolute inset-0 text-red-600 opacity-40 animate-glitch-1" aria-hidden="true">THE BOX</span>
                <span className="absolute inset-0 text-red-500 opacity-20 animate-glitch-2" aria-hidden="true">THE BOX</span>
                <span className="absolute inset-0 blur-2xl text-red-600 opacity-30 animate-pulse" aria-hidden="true">THE BOX</span>
              </h1>
            )}
            {stage >= 2 && (
              <div className="hidden md:block relative">
                <div className="w-[2px] h-32 bg-gradient-to-b from-transparent via-red-600 to-transparent transform skew-x-12 animate-slam shadow-[0_0_25px_rgba(220,38,38,0.9)]"></div>
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,1)]"></div>
                <div className="absolute top-3/4 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-[0_0_15px_rgba(248,113,113,1)]" style={{ animationDelay: '0.5s' }}></div>
              </div>
            )}
            {stage >= 2 && (
              <div className="flex flex-col justify-center items-center md:items-start animate-slam mt-4 md:mt-0" style={{ animationDelay: '0.15s' }}>
                <span className="text-zinc-500 text-[10px] font-bold tracking-[0.35em] uppercase mb-2 animate-pulse">Powered By</span>
                <span className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-red-500 to-red-600 italic uppercase tracking-tighter leading-none bg-[length:200%_100%] animate-gradient drop-shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                  BMSCE
                </span>
              </div>
            )}
          </div>
          
          {stage >= 1 && (
            <div className="relative w-full max-w-2xl mb-12 mt-6">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-red-600 to-transparent animate-scan shadow-[0_0_20px_rgba(220,38,38,0.9)]"></div>
              <div className="absolute top-0 left-0 w-3 h-3 bg-red-500 rounded-full animate-particle-1 shadow-[0_0_15px_rgba(239,68,68,1)] blur-[1px]"></div>
              <div className="absolute top-0 right-0 w-3 h-3 bg-red-400 rounded-full animate-particle-2 shadow-[0_0_15px_rgba(248,113,113,1)] blur-[1px]"></div>
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-red-300 rounded-full animate-particle-3 shadow-[0_0_10px_rgba(252,165,165,1)] blur-[1px]"></div>
            </div>
          )}
          
          {stage >= 3 && (
            <div className="animate-tracking text-center">
              <p className="text-zinc-400 text-sm md:text-base font-mono font-bold uppercase tracking-wide mb-3">
                The Official College Sports Platform
              </p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(34,197,94,1)]"></div>
                  <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
                </div>
                <span className="text-xs text-green-400 font-mono font-bold tracking-widest uppercase">System Online</span>
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes grid-pulse { 0%, 100% { opacity: 0.15; transform: scale(1); } 50% { opacity: 0.25; transform: scale(1.02); } }
          @keyframes beam-1 { 0%, 100% { opacity: 0; transform: translateY(-100%) skewX(-12deg); } 50% { opacity: 1; transform: translateY(100%) skewX(-12deg); } }
          @keyframes beam-2 { 0%, 100% { opacity: 0; transform: translateY(-100%) skewX(12deg); } 50% { opacity: 1; transform: translateY(100%) skewX(12deg); } }
          @keyframes beam-3 { 0%, 100% { opacity: 0; transform: translateY(-100%); } 50% { opacity: 1; transform: translateY(100%); } }
          @keyframes glitch-1 { 0%, 100% { transform: translate(0); clip-path: inset(0); } 20% { transform: translate(-3px, 2px); clip-path: inset(0 0 80% 0); } 40% { transform: translate(-3px, -2px); clip-path: inset(60% 0 0 0); } 60% { transform: translate(3px, 2px); clip-path: inset(30% 0 30% 0); } 80% { transform: translate(2px, -2px); clip-path: inset(0 0 50% 0); } }
          @keyframes glitch-2 { 0%, 100% { transform: translate(0); clip-path: inset(0); } 25% { transform: translate(2px, -2px); clip-path: inset(20% 0 60% 0); } 50% { transform: translate(-2px, 2px); clip-path: inset(50% 0 0 0); } 75% { transform: translate(2px, 2px); clip-path: inset(0 0 70% 0); } }
          @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          @keyframes particle-1 { 0% { transform: translate(0, 0) scale(1); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 0.8; } 100% { transform: translate(-250px, -60px) scale(0.3); opacity: 0; } }
          @keyframes particle-2 { 0% { transform: translate(0, 0) scale(1); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 0.8; } 100% { transform: translate(250px, -60px) scale(0.3); opacity: 0; } }
          @keyframes particle-3 { 0% { transform: translate(0, 0) scale(1); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 0.6; } 100% { transform: translate(0, -80px) scale(0.2); opacity: 0; } }
        `}</style>
      </div>
    );
  }

  // --- RENDER: MAIN LANDING PAGE ---
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
                  
                  {/* FORCED VISIBLE: GO OFFLINE BUTTON */}
                  <button 
                    onClick={handleInstallClick}
                    className="flex items-center gap-3 w-full px-4 py-4 text-left hover:bg-zinc-900 transition-colors group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${installPrompt ? 'bg-red-600/20 group-hover:bg-red-600' : 'bg-zinc-800'}`}>
                      <svg className={`w-4 h-4 ${installPrompt ? 'text-red-500 group-hover:text-white' : 'text-zinc-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black italic uppercase tracking-tight text-white">Go Offline</span>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase">
                        {installPrompt ? 'Dedicated Unit Ready' : 'Setup Required'}
                      </span>
                    </div>
                  </button>

                  <button 
                    onClick={() => { setShowEmailModal(true); setShowUserMenu(false); }}
                    className="flex items-center gap-3 w-full px-4 py-4 text-left hover:bg-zinc-900 transition-colors border-t border-zinc-900"
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
        
        {/* LEFT: PUBLIC HOSTING OPTIONS */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex-1 bg-zinc-900/40 border border-zinc-800 p-8 rounded-sm relative overflow-hidden flex flex-col justify-between">
            <div className="relative z-10">
              <h2 className="text-red-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-4 h-[1px] bg-red-600"></span> Pro Access
              </h2>
              <h3 className="text-4xl font-black italic uppercase tracking-tighter text-white mb-4">Operator Login</h3>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mb-12">
                Authenticate to access the dashboard. Save match data, manage rosters, and resume games.
              </p>
              
              <div className="mt-auto space-y-4 pb-2">
                <button onClick={loginWithGoogle} className="w-full bg-white hover:bg-zinc-200 text-black font-black py-3.5 uppercase tracking-widest flex items-center justify-center gap-3 transition-colors">
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4" alt="G" />
                  Sign In with Google
                </button>
                <button onClick={() => setShowEmailModal(true)} className="w-full bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 font-bold py-3.5 uppercase tracking-widest transition-colors flex items-center justify-center gap-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  Sign In with Email
                </button>
              </div>
            </div>
          </div>

          <button onClick={() => setShowFreeHostWarning(true)} className="bg-black border border-zinc-800 hover:border-zinc-500 p-5 flex items-center justify-between group transition-all">
            <div className="text-left">
              <div className="text-zinc-200 font-bold text-lg group-hover:text-red-500 transition-colors">Free Host Mode</div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5">Quick Start • No Data Retention</div>
            </div>
            <div className="w-8 h-8 flex items-center justify-center text-zinc-600 group-hover:text-white group-hover:translate-x-1 transition-all text-xl">&rarr;</div>
          </button>
        </div>

        {/* RIGHT: WATCH OPTIONS */}
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
               Watch<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-white">Live Feed</span>
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
                     onChange={(e) => setJoinCode(e.target.value)}
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
           </div>
        </div>
      </main>

      {/* FOOTER TICKER */}
      <div className="fixed bottom-0 w-full bg-zinc-950 border-t border-zinc-900 h-14 flex items-center z-30">
        <div className="bg-red-700 h-full px-6 flex items-center justify-center font-black italic text-lg tracking-tighter shrink-0 shadow-[0_0_20px_rgba(220,38,38,0.4)] relative z-10">LIVE</div>
        <div className="flex-1 overflow-hidden relative flex items-center h-full group bg-black">
           <div className="flex gap-12 px-6 animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused]">
             {liveGames.length === 0 ? (
               <span className="text-zinc-700 text-xs font-mono tracking-widest uppercase">Waiting for active signals from server...</span>
             ) : (
               liveGames.map(g => (
                 <button key={g.code} onClick={() => setSelectedLiveGame(g)} className="flex items-center gap-3 hover:bg-zinc-900 px-4 py-1.5 rounded-sm transition-colors border border-transparent hover:border-zinc-800">
                   <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>
                   <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{g.gameState.period <= 4 ? `Q${g.gameState.period}` : 'OT'}</span>
                   <span className="text-sm font-bold font-mono text-white">{g.teamA.name} <span className="text-red-500 mx-1 text-lg">{g.teamA.score}</span> - <span className="text-blue-500 mx-1 text-lg">{g.teamB.score}</span> {g.teamB.name}</span>
                 </button>
               ))
             )}
           </div>
        </div>
      </div>

      {/* DIAGNOSTIC MODAL */}
      {showInstallInfo && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
          <div className="bg-zinc-900 border border-zinc-800 max-w-md w-full p-8 shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-zinc-700"></div>
            <h3 className="text-2xl font-black italic uppercase text-white mb-2 tracking-tighter">Diagnostics: Offline Unit</h3>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              The "Go Offline" trigger is visible, but the browser hasn't activated the installation handshake yet.
            </p>
            <div className="bg-black border border-zinc-800 p-4 mb-8 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase">
                <span className="text-zinc-500">HTTPS Connection</span>
                <span className={window.location.protocol === 'https:' ? 'text-green-500' : 'text-red-500'}>
                  {window.location.protocol === 'https:' ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase">
                <span className="text-zinc-500">Service Worker</span>
                <span className={'serviceWorker' in navigator ? 'text-green-500' : 'text-red-500'}>
                  {'serviceWorker' in navigator ? 'READY' : 'FAIL'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase">
                <span className="text-zinc-500">Install State</span>
                <span className={installPrompt ? 'text-green-500' : 'text-amber-500'}>
                  {installPrompt ? 'READY TO SYNC' : 'PENDING BROWSER'}
                </span>
              </div>
            </div>
            <button onClick={() => setShowInstallInfo(false)} className="w-full bg-white text-black font-black py-4 uppercase tracking-widest text-sm hover:bg-zinc-200 transition-colors">Close Diagnostics</button>
          </div>
        </div>
      )}

      {/* ALL ORIGINAL MODALS */}
      {showFreeHostWarning && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
          <div className="bg-zinc-900 border border-red-900/50 max-w-md w-full p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
            <h3 className="text-2xl font-black italic uppercase text-white mb-3">Data Loss Warning</h3>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              You are entering <strong>Free Host Mode</strong>. Game data will NOT be saved to an account. If you close this tab, the match state will be lost forever.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setShowFreeHostWarning(false)} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors border border-transparent hover:border-zinc-700">Go Back</button>
              <button onClick={() => navigate('/dashboard')} className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-3 uppercase tracking-widest">Proceed Anyway</button>
            </div>
          </div>
        </div>
      )}

      {selectedLiveGame && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
          <div className="bg-zinc-900 border border-blue-900/50 max-w-md w-full p-8 shadow-2xl relative">
            <h3 className="text-blue-500 text-xs font-bold uppercase tracking-widest mb-2">Incoming Feed</h3>
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
              <button onClick={() => navigate(`/watch/${selectedLiveGame.code}`)} className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 uppercase tracking-widest">Connect</button>
            </div>
          </div>
        </div>
      )}

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