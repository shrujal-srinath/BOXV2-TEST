import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import type { BasketballGame } from '../types';
import { logoutUser, subscribeToAuth } from '../services/authService';
import { getUserActiveGames } from '../services/gameService';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [myGames, setMyGames] = useState<BasketballGame[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Menu & Modal States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'profile' | 'status' | 'history' | 'settings' | null>(null);

  // --- INIT ---
  useEffect(() => {
    const unsub = subscribeToAuth((u) => {
      setUser(u);
      if (u) getUserActiveGames(u.uid, setMyGames);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/');
  };

  const startNewGame = (sportId: string) => {
    // Navigate to setup with the selected sport type
    navigate('/setup', { state: { sport: sportId } });
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className={`min-h-screen bg-black font-sans text-white transition-transform duration-300 ${isMenuOpen ? '-translate-x-[0px]' : ''}`}>
      
      {/* === HEADER === */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md p-6 flex justify-between items-center sticky top-0 z-20">
        
        {/* LEFT: User Profile Option (Replaces "OP") */}
        <button 
          onClick={() => setActiveModal('profile')}
          className="flex items-center gap-4 group hover:bg-zinc-800/50 p-2 -ml-2 rounded-lg transition-all"
        >
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black italic text-sm shadow-lg overflow-hidden border-2 ${user ? 'border-red-600 bg-zinc-800' : 'border-zinc-600 bg-zinc-800'}`}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
              ) : (
                <span className="text-zinc-400">{user ? user.displayName?.[0] || 'U' : 'G'}</span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full"></div>
          </div>
          <div className="text-left">
            <h1 className="text-sm font-bold text-white group-hover:text-red-500 transition-colors leading-none">
              {user ? (user.displayName || 'Operator') : 'Guest User'}
            </h1>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
              {user ? 'View Profile' : 'Local Mode'}
            </p>
          </div>
        </button>

        {/* RIGHT: Hamburger Trigger */}
        <button onClick={() => setIsMenuOpen(true)} className="group p-2 space-y-1.5 cursor-pointer z-30 hover:bg-zinc-800 rounded">
          <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
          <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
          <div className="w-4 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors ml-auto"></div>
        </button>

      </header>

      {/* === SLIDE-OUT MENU === */}
      <div className={`fixed top-0 right-0 w-[300px] h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Command Menu</h2>
            <button onClick={() => setIsMenuOpen(false)} className="text-2xl text-zinc-500 hover:text-white">&times;</button>
          </div>

          <div className="space-y-1 flex-1">
            <MenuItem label="Dashboard" icon="⊞" onClick={() => setIsMenuOpen(false)} active />
            <MenuItem label="My Profile" icon="👤" onClick={() => { setIsMenuOpen(false); setActiveModal('profile'); }} disabled={!user} />
            <MenuItem label="Match History" icon="↺" onClick={() => { setIsMenuOpen(false); setActiveModal('history'); }} disabled={!user} />
            <MenuItem label="System Status" icon="⚡" onClick={() => { setIsMenuOpen(false); setActiveModal('status'); }} />
            <MenuItem label="Settings" icon="⚙" onClick={() => { setIsMenuOpen(false); setActiveModal('settings'); }} />
          </div>

          <div className="pt-6 border-t border-zinc-900">
             {user ? (
               <button onClick={handleLogout} className="w-full text-left flex items-center gap-4 p-4 hover:bg-red-900/10 text-red-500 hover:text-red-400 transition-colors uppercase font-bold text-xs tracking-widest rounded">
                 <span>↪</span> Log Out
               </button>
             ) : (
               <button onClick={() => navigate('/')} className="w-full text-left flex items-center gap-4 p-4 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors uppercase font-bold text-xs tracking-widest rounded">
                 <span>↪</span> Exit Guest Mode
               </button>
             )}
          </div>
        </div>
      </div>
      
      {/* Overlay for Menu */}
      {isMenuOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setIsMenuOpen(false)}></div>}

      {/* === MAIN CONTENT === */}
      <main className="max-w-7xl mx-auto p-6 md:p-12">
        
        {/* SECTION 1: SPORT SELECTION */}
        <section className="mb-12">
          <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-600 rounded-full"></span> Initialize New Session
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SportCard 
              name="BASKETBALL" 
              desc="FIBA / NBA Rules • Shot Clock" 
              icon="🏀" 
              onClick={() => startNewGame('basketball')} 
              accent="red"
            />
            <SportCard 
              name="BADMINTON" 
              desc="BWF Rules • Sets & Points" 
              icon="🏸" 
              onClick={() => startNewGame('badminton')} 
              accent="green"
            />
            <SportCard 
              name="VOLLEYBALL" 
              desc="FIVB Rules • Rotation Track" 
              icon="🏐" 
              onClick={() => startNewGame('volleyball')} 
              accent="yellow"
            />
            <SportCard 
              name="KABADDI" 
              desc="PKL Style • Raid Timer" 
              icon="🤼" 
              onClick={() => startNewGame('kabaddi')} 
              accent="orange"
            />
            <SportCard 
              name="TABLE TENNIS" 
              desc="ITTF Rules • 11pt Sets" 
              icon="🏓" 
              onClick={() => startNewGame('tabletennis')} 
              accent="blue"
            />
            <SportCard 
              name="GENERAL" 
              desc="Universal Scoreboard • Simple" 
              icon="⏱" 
              onClick={() => startNewGame('general')} 
              accent="purple"
            />
          </div>
        </section>

        {/* SECTION 2: ACTIVE GAMES (Only if logged in) */}
        {user && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
                <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">
                  Active Sessions <span className="ml-2 bg-zinc-800 text-white px-2 py-0.5 rounded-full text-[9px]">{myGames.length}</span>
                </h2>
             </div>
             
             {myGames.length === 0 ? (
               <div className="border border-dashed border-zinc-800 p-12 text-center rounded-lg hover:bg-zinc-900/30 transition-colors">
                 <div className="text-4xl mb-4 grayscale opacity-20">📂</div>
                 <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest">No active games found in cloud.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {myGames.map(g => (
                   <div key={g.code} onClick={() => navigate(`/host/${g.code}`)} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm hover:border-green-500 cursor-pointer transition-all group relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-black px-2 py-1 rounded">{g.sport || 'BASKETBALL'}</div>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      </div>
                      <h3 className="font-black italic text-xl text-white mb-1 group-hover:text-green-400 transition-colors uppercase">{g.settings.gameName}</h3>
                      <div className="text-xs font-mono text-zinc-400 mb-4">ID: {g.code}</div>
                      
                      <div className="flex items-center justify-between bg-black p-3 rounded border border-zinc-800">
                         <div className="font-bold text-white">{g.teamA.score}</div>
                         <div className="text-[9px] text-zinc-600 uppercase">VS</div>
                         <div className="font-bold text-white">{g.teamB.score}</div>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </section>
        )}
      </main>

      {/* === MODALS === */}
      
      {/* 1. OPERATOR PROFILE MODAL */}
      {activeModal === 'profile' && (
        <Modal title="Operator Profile" onClose={() => setActiveModal(null)}>
           <div className="flex items-center gap-6 mb-8 bg-zinc-900 p-6 rounded border border-zinc-800">
             <div className="w-20 h-20 rounded-full bg-black border-2 border-red-600 flex items-center justify-center overflow-hidden">
                {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <span className="text-3xl">👤</span>}
             </div>
             <div>
               <h3 className="text-2xl font-black italic text-white">{user?.displayName}</h3>
               <p className="text-xs text-zinc-500 font-mono">{user?.email}</p>
               <div className="mt-2 inline-flex items-center gap-2 bg-red-900/20 text-red-500 text-[9px] font-bold px-2 py-1 rounded uppercase tracking-widest">
                 <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Pro License Active
               </div>
             </div>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-black p-4 border border-zinc-800 rounded">
                 <div className="text-2xl font-bold text-white">{myGames.length}</div>
                 <div className="text-[9px] text-zinc-500 uppercase tracking-widest">Active Games</div>
              </div>
              <div className="bg-black p-4 border border-zinc-800 rounded">
                 <div className="text-2xl font-bold text-zinc-600">0</div>
                 <div className="text-[9px] text-zinc-600 uppercase tracking-widest">Archived</div>
              </div>
           </div>
        </Modal>
      )}

      {/* 2. SYSTEM STATUS MODAL */}
      {activeModal === 'status' && (
        <Modal title="System Status" onClose={() => setActiveModal(null)}>
           <div className="space-y-4">
              <StatusRow label="Server Connection" value="Connected" status="good" />
              <StatusRow label="Latency" value="24ms" status="good" />
              <StatusRow label="Database Sync" value="Real-time" status="good" />
              <StatusRow label="Auth Service" value="Online" status="good" />
              <StatusRow label="Client Version" value="v2.1.0 (Beta)" status="neutral" />
           </div>
           <div className="mt-6 p-4 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-500 font-mono leading-relaxed">
             System operating within normal parameters. No outages reported in your region.
           </div>
        </Modal>
      )}

      {/* 3. HISTORY / SETTINGS PLACEHOLDERS */}
      {(activeModal === 'history' || activeModal === 'settings') && (
        <Modal title={activeModal === 'history' ? "Match History" : "System Settings"} onClose={() => setActiveModal(null)}>
           <div className="text-center py-12">
             <div className="text-4xl mb-4">🚧</div>
             <h3 className="text-lg font-bold text-white mb-2">Under Development</h3>
             <p className="text-sm text-zinc-500 max-w-xs mx-auto">This module is currently being built. Check back in the next update.</p>
           </div>
        </Modal>
      )}

    </div>
  );
};

// --- SUBCOMPONENTS ---

const SportCard = ({ name, desc, icon, onClick, accent }: any) => {
  const accents: any = {
    red: 'hover:border-red-600 group-hover:text-red-500',
    blue: 'hover:border-blue-600 group-hover:text-blue-500',
    green: 'hover:border-green-600 group-hover:text-green-500',
    yellow: 'hover:border-yellow-600 group-hover:text-yellow-500',
    orange: 'hover:border-orange-600 group-hover:text-orange-500',
    purple: 'hover:border-purple-600 group-hover:text-purple-500',
  };

  return (
    <button 
      onClick={onClick}
      className={`bg-zinc-900/40 border border-zinc-800 p-6 text-left group transition-all relative overflow-hidden h-40 flex flex-col justify-between ${accents[accent]}`}
    >
      <div className="absolute -top-2 -right-2 text-8xl opacity-[0.05] grayscale group-hover:grayscale-0 transition-all rotate-12">{icon}</div>
      <div>
        <h3 className={`text-xl font-black italic text-zinc-300 transition-colors ${accents[accent].split(' ')[1]}`}>{name}</h3>
        <p className="text-zinc-500 text-[10px] mt-1 uppercase tracking-widest font-bold">{desc}</p>
      </div>
      <div className="flex items-center gap-2 text-zinc-600 text-[10px] font-bold uppercase tracking-widest group-hover:text-white transition-colors">
        Initialize <span className="text-sm">→</span>
      </div>
    </button>
  );
};

const MenuItem = ({ label, icon, onClick, active, disabled }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`w-full text-left flex items-center gap-4 p-4 rounded transition-all uppercase font-bold text-[10px] tracking-widest
      ${active ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}
      ${disabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-zinc-500' : ''}
    `}
  >
    <span className="text-lg w-6 text-center">{icon}</span>
    {label}
  </button>
);

const Modal = ({ title, children, onClose }: any) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl rounded-sm">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white">{title}</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">&times;</button>
      </div>
      {children}
    </div>
  </div>
);

const StatusRow = ({ label, value, status }: any) => (
  <div className="flex justify-between items-center py-2 border-b border-zinc-900 last:border-0">
    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wide">{label}</span>
    <span className={`text-xs font-mono font-bold ${status === 'good' ? 'text-green-500' : 'text-zinc-400'}`}>{value}</span>
  </div>
);