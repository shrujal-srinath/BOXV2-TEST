import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, logoutUser, subscribeToAuth } from '../services/authService';
import { getUserActiveGames } from '../services/gameService';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [myGames, setMyGames] = useState<any[]>([]);

  useEffect(() => {
    const unsub = subscribeToAuth((currentUser) => {
      if (!currentUser) {
        navigate('/'); // Bounce back if not auth'd (even anon)
      } else {
        setUser(currentUser);
        // If pro user, fetch their history. Guest will just have [] for now unless you track sessions.
        if (!currentUser.isAnonymous) {
          const games = getUserActiveGames(currentUser.uid); // This needs to be async in real app
          setMyGames(games);
        }
      }
    });
    return () => unsub();
  }, [navigate]);

  const selectSport = (sport: string) => {
    navigate('/setup', { state: { sport } });
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-500">
            {user?.isAnonymous ? '👻' : user?.email?.[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-black italic tracking-tighter">DASHBOARD</h1>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              {user?.isAnonymous ? 'Guest Session' : 'Pro Account'}
            </div>
          </div>
        </div>
        <button onClick={() => logoutUser()} className="text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest">
          {user?.isAnonymous ? 'Exit Session' : 'Logout'}
        </button>
      </header>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto">
        <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-6">Select Sport</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <SportCard icon="🏀" label="Basketball" onClick={() => selectSport('basketball')} active />
          <SportCard icon="🏐" label="Volleyball" onClick={() => selectSport('volleyball')} />
          <SportCard icon="🏸" label="Badminton" onClick={() => selectSport('badminton')} />
          <SportCard icon="🏏" label="Cricket" onClick={() => selectSport('cricket')} />
        </div>

        {!user?.isAnonymous && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-6">Recent Matches</h2>
            {myGames.length === 0 ? (
              <div className="p-8 border border-dashed border-zinc-800 rounded-xl text-center text-zinc-600 text-xs uppercase tracking-widest">
                No match history found
              </div>
            ) : (
              <div className="grid gap-4">
                {myGames.map(g => (
                  <div key={g.code} onClick={() => navigate(`/host/${g.code}`)} className="bg-zinc-900 p-4 rounded border border-zinc-800 hover:border-white transition-colors cursor-pointer flex justify-between items-center">
                    <span className="font-bold">{g.code}</span>
                    <span className="text-zinc-500 text-xs">{new Date(g.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {user?.isAnonymous && (
          <div className="mt-8 bg-blue-900/20 border border-blue-900/50 p-6 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="text-blue-400 font-bold text-sm mb-1">Save your history</h3>
              <p className="text-blue-500/60 text-xs max-w-md">Guest sessions are temporary. Sign in to keep your match data forever.</p>
            </div>
            <button className="px-4 py-2 bg-blue-600 rounded text-xs font-black uppercase tracking-widest">Sign Up</button>
          </div>
        )}
      </main>
    </div>
  );
};

const SportCard = ({ icon, label, onClick, active }: any) => (
  <button
    onClick={onClick}
    disabled={!active}
    className={`aspect-square rounded-2xl border flex flex-col items-center justify-center gap-4 transition-all group ${active ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-600 hover:scale-[1.02]' : 'bg-black border-zinc-900 opacity-50 cursor-not-allowed'}`}
  >
    <div className="text-4xl grayscale group-hover:grayscale-0 transition-all duration-300">{icon}</div>
    <div className="text-xs font-black uppercase tracking-widest text-zinc-500 group-hover:text-white">{label}</div>
    {!active && <div className="text-[9px] text-zinc-700 font-mono">COMING SOON</div>}
  </button>
);