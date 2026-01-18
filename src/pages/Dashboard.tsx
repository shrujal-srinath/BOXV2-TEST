import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import type { BasketballGame } from '../types';
import { logoutUser, subscribeToAuth } from '../services/authService';
import { getUserActiveGames } from '../services/gameService';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [myGames, setMyGames] = useState<BasketballGame[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Auth & Data Check
  useEffect(() => {
    const unsub = subscribeToAuth((u) => {
      if (!u) {
        navigate('/'); // Kick out if not logged in
      } else {
        setUser(u);
        getUserActiveGames(u.uid, setMyGames);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">AUTHENTICATING...</div>;

  return (
    <div className="min-h-screen bg-black font-sans text-white animate-in">
      
      {/* HEADER */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md p-6 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-600 flex items-center justify-center font-black italic rounded-sm shadow-[0_0_15px_rgba(220,38,38,0.5)]">
            OP
          </div>
          <div>
            <h1 className="text-xl font-black italic tracking-tighter leading-none">COMMAND CENTER</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Operator: {user?.displayName || user?.email}</p>
          </div>
        </div>
        <button onClick={() => logoutUser()} className="text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-widest border border-zinc-700 px-4 py-2 rounded-sm transition-colors">
          Log Out
        </button>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto p-6 md:p-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COL 1: NEW GAME (Sport Selection) */}
        <div className="lg:col-span-2 space-y-8">
          
          <section>
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-4">Initialize System</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Basketball Card */}
              <button 
                onClick={() => navigate('/setup')}
                className="bg-zinc-900 border border-zinc-800 hover:border-red-600 p-8 text-left group transition-all relative overflow-hidden h-48 flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 text-8xl grayscale group-hover:grayscale-0 transition-all">🏀</div>
                <div>
                  <h3 className="text-2xl font-black italic text-white group-hover:text-red-500 transition-colors">BASKETBALL</h3>
                  <p className="text-zinc-500 text-xs mt-1 uppercase tracking-widest">Standard FIBA/NBA Rule Set</p>
                </div>
                <div className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-500 group-hover:bg-red-600 group-hover:text-black group-hover:border-red-600 transition-all">
                  +
                </div>
              </button>

              {/* Coming Soon Cards */}
              <div className="bg-zinc-950 border border-zinc-900 p-8 flex flex-col justify-between opacity-50 cursor-not-allowed">
                <h3 className="text-xl font-black italic text-zinc-600">VOLLEYBALL</h3>
                <span className="text-[10px] border border-zinc-800 self-start px-2 py-1 uppercase text-zinc-600">Coming Soon</span>
              </div>
            </div>
          </section>

          {/* ACTIVE GAMES LIST */}
          <section>
             <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
               Active Sessions <span className="bg-green-500 text-black text-[9px] px-1.5 rounded font-black">{myGames.length}</span>
             </h2>
             
             {myGames.length === 0 ? (
               <div className="border border-dashed border-zinc-800 p-8 text-center text-zinc-600 text-sm font-mono uppercase">
                 No active games found. Start a new one above.
               </div>
             ) : (
               <div className="space-y-2">
                 {myGames.map(g => (
                   <div key={g.code} onClick={() => navigate(`/host/${g.code}`)} className="bg-black border border-zinc-800 p-4 flex items-center justify-between hover:border-green-500 cursor-pointer transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <div>
                          <div className="font-bold text-white group-hover:text-green-400 transition-colors">{g.settings.gameName}</div>
                          <div className="text-[10px] text-zinc-600 font-mono">CODE: {g.code}</div>
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="font-mono text-xl font-bold text-zinc-500 group-hover:text-white transition-colors">
                           {g.teamA.score} - {g.teamB.score}
                         </div>
                         <div className="text-[9px] text-zinc-700 uppercase">Current Score</div>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </section>
        </div>

        {/* COL 2: SYSTEM STATS / HISTORY (Placeholder) */}
        <div className="bg-zinc-900/30 border border-zinc-800 p-6 h-fit">
          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-6">Console Stats</h3>
          
          <div className="space-y-6">
             <div>
               <div className="text-3xl font-black italic text-white">{myGames.length}</div>
               <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Total Active Games</div>
             </div>
             <div>
               <div className="text-3xl font-black italic text-zinc-700">0</div>
               <div className="text-[10px] text-zinc-700 uppercase tracking-widest">Completed Archives</div>
             </div>
             
             <div className="pt-6 border-t border-zinc-800">
               <p className="text-[10px] text-zinc-600 leading-relaxed">
                 History and Export features are currently disabled in this version.
               </p>
             </div>
          </div>
        </div>

      </main>
    </div>
  );
};