import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BasketballGame } from '../types';
import { logoutUser, subscribeToAuth } from '../services/authService';
import { getUserActiveGames } from '../services/gameService';
import type { User } from 'firebase/auth';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [myGames, setMyGames] = useState<BasketballGame[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Menu & Modal States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'profile' | 'status' | 'history' | 'settings' | 'tablet' | 'offlineInfo' | null>(null);

  // --- NEW: PWA INSTALL STATE ---
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // --- INIT ---
  useEffect(() => {
    const unsub = subscribeToAuth((u) => {
      setUser(u);
      if (u) getUserActiveGames(u.uid, setMyGames);
      setLoading(false);
    });

    // Listen for the installation prompt even on the Dashboard
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log("🚀 Dashboard: PWA Install Prompt Stashed");
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      unsub();
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  // --- HANDLERS ---
  const handleInstallClick = async () => {
    if (!installPrompt) {
      // Requirements not met - Show Diagnostics Pop-up
      setActiveModal('offlineInfo');
      setIsMenuOpen(false);
      return;
    }
    
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/');
  };

  const startNewGame = (sportId: string) => {
    navigate('/setup', { state: { sport: sportId } });
  };

  const goToTabletMode = (gameCode?: string) => {
    if (gameCode) {
      navigate(`/tablet/${gameCode}`);
    } else {
      setActiveModal('tablet');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-black font-sans text-white transition-transform duration-300`}>
      
      {/* === HEADER === */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md p-6 flex justify-between items-center sticky top-0 z-20">
        
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
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full animate-pulse"></div>
          </div>
          <div className="text-left text-white font-bold text-sm">
            {user ? (user.displayName || 'Operator') : 'Guest User'}
          </div>
        </button>

        <button 
          onClick={() => setIsMenuOpen(true)} 
          className="group p-2 space-y-1.5 cursor-pointer z-30 hover:bg-zinc-800 rounded transition-colors"
          aria-label="Open menu"
        >
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
            <button onClick={() => setIsMenuOpen(false)} className="text-2xl text-zinc-500 hover:text-white transition-colors">&times;</button>
          </div>

          <div className="space-y-1 flex-1 overflow-y-auto">
            <MenuItem label="Dashboard" icon="⊞" onClick={() => setIsMenuOpen(false)} active />

            <div className="pt-2 mt-2">
              <MenuItem 
                label="Go Offline" 
                icon="📱" 
                onClick={handleInstallClick} 
                highlight={!!installPrompt}
                subtitle={installPrompt ? "Dedicated Unit Ready" : "Diagnostics Required"}
              />
            </div>

            <MenuItem label="My Profile" icon="👤" onClick={() => { setIsMenuOpen(false); setActiveModal('profile'); }} disabled={!user} />
            <MenuItem label="Match History" icon="↺" onClick={() => { setIsMenuOpen(false); setActiveModal('history'); }} disabled={!user} />
            
            {myGames.length > 0 && (
              <div className="pt-4 mt-4 border-t border-zinc-900">
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-2 px-4 font-bold">Quick Actions</div>
                <MenuItem 
                  label="Tablet Controller" 
                  icon="🎮" 
                  onClick={() => { setIsMenuOpen(false); goToTabletMode(); }} 
                  highlight={true}
                  subtitle={`Control ${myGames.length} active games`}
                  badge={myGames.length}
                />
              </div>
            )}
            
            <div className="pt-4 mt-4 border-t border-zinc-900">
              <MenuItem label="System Status" icon="⚡" onClick={() => { setIsMenuOpen(false); setActiveModal('status'); }} />
              <MenuItem label="Settings" icon="⚙" onClick={() => { setIsMenuOpen(false); setActiveModal('settings'); }} />
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-900">
             <button onClick={handleLogout} className="w-full text-left flex items-center gap-4 p-4 hover:bg-red-900/10 text-red-500 transition-colors uppercase font-bold text-xs tracking-widest rounded">
               <span className="text-lg">↪</span> <span>Log Out</span>
             </button>
          </div>
        </div>
      </div>
      
      {isMenuOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setIsMenuOpen(false)}></div>}

      {/* === MAIN CONTENT === */}
      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <section className="mb-12">
          <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-600 rounded-full"></span> Initialize New Session
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SportCard name="BASKETBALL" desc="FIBA / NBA Rules • Shot Clock" icon="🏀" onClick={() => startNewGame('basketball')} accent="red" />
            <SportCard name="BADMINTON" desc="BWF Rules • Sets & Points" icon="🏸" onClick={() => startNewGame('badminton')} accent="green" />
            <SportCard name="VOLLEYBALL" desc="FIVB Rules • Rotation Track" icon="🏐" onClick={() => startNewGame('volleyball')} accent="yellow" />
            <SportCard name="KABADDI" desc="PKL Style • Raid Timer" icon="🤼" onClick={() => startNewGame('kabaddi')} accent="orange" />
            <SportCard name="TABLE TENNIS" desc="ITTF Rules • 11pt Sets" icon="🏓" onClick={() => startNewGame('tabletennis')} accent="blue" />
            <SportCard name="GENERAL" desc="Universal Scoreboard • Simple" icon="⏱" onClick={() => startNewGame('general')} accent="purple" />
          </div>
        </section>

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
                   <div key={g.code} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm hover:border-green-500 transition-all group relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-green-500 group-hover:w-2 transition-all"></div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-black px-2 py-1 rounded">{g.sport || 'BASKETBALL'}</div>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      </div>
                      <h3 className="font-black italic text-xl text-white mb-1 group-hover:text-green-400 transition-colors uppercase tracking-tight">{g.settings.gameName}</h3>
                      <div className="text-xs font-mono text-zinc-400 mb-4">ID: <span className="text-zinc-500">{g.code}</span></div>
                      
                      <div className="flex items-center justify-between bg-black p-3 rounded border border-zinc-800 mb-3">
                         <div className="font-bold text-white text-lg">{g.teamA.score}</div>
                         <div className="text-[9px] text-zinc-600 uppercase tracking-widest">VS</div>
                         <div className="font-bold text-white text-lg">{g.teamB.score}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/host/${g.code}`)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors">Console</button>
                        <button onClick={() => goToTabletMode(g.code)} className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors">Tablet</button>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </section>
        )}
      </main>

      {/* === MODALS === */}

      {/* Tablet Mode Selection Modal */}
      {activeModal === 'tablet' && (
        <Modal title="Tablet Controller" onClose={() => setActiveModal(null)}>
           <div className="mb-6">
             <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Select an active game to control in tablet mode.</p>
             <div className="space-y-2 max-h-96 overflow-y-auto">
               {myGames.map(g => (
                 <button key={g.code} onClick={() => goToTabletMode(g.code)} className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-blue-500 p-5 rounded text-left transition-all">
                   <h4 className="font-black text-lg text-white uppercase italic tracking-tight">{g.settings.gameName}</h4>
                   <div className="text-[10px] font-mono text-zinc-500">{g.code}</div>
                 </button>
               ))}
             </div>
           </div>
        </Modal>
      )}

      {/* Offline Diagnostics Modal */}
      {activeModal === 'offlineInfo' && (
        <Modal title="Offline Unit Diagnostics" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <p className="text-xs text-zinc-400 leading-relaxed">The browser is currently preventing the "Offline Unit" installation. Please check the following:</p>
            <div className="bg-black p-4 border border-zinc-800 space-y-3">
              <StatusItem label="Secure Context (HTTPS)" status={window.location.protocol === 'https:' ? 'online' : 'offline'} />
              <StatusItem label="Service Worker" status={'serviceWorker' in navigator ? 'online' : 'offline'} />
              <StatusItem label="Install Prompt" status={installPrompt ? 'online' : 'local'} />
            </div>
            <p className="text-[10px] text-zinc-600 italic">Note: If the app is already installed or your browser doesn't support PWAs, the handshake will stay in 'PENDING'.</p>
            <button onClick={() => setActiveModal(null)} className="w-full bg-white text-black font-black py-4 uppercase tracking-widest text-[10px] mt-4">Close Diagnostics</button>
          </div>
        </Modal>
      )}

      {/* Profile Modal */}
      {activeModal === 'profile' && (
        <Modal title="User Profile" onClose={() => setActiveModal(null)}>
          <div className="space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b border-zinc-800">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-red-600">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-zinc-400">{user?.displayName?.[0] || 'U'}</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{user?.displayName || 'Guest User'}</h3>
                <p className="text-xs text-zinc-500">{user?.email || 'No account'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <InfoRow label="Account Type" value={user ? 'Pro Access' : 'Guest Mode'} />
              <InfoRow label="Active Games" value={myGames.length.toString()} />
              <InfoRow label="User ID" value={user?.uid?.slice(0, 12) + '...' || 'N/A'} />
            </div>
          </div>
        </Modal>
      )}

      {/* Status Modal */}
      {activeModal === 'status' && (
        <Modal title="System Status" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <StatusItem label="Server Connection" status="online" />
            <StatusItem label="Firebase Database" status="online" />
            <StatusItem label="Authentication" status={user ? 'online' : 'local'} />
            <StatusItem label="Live Sync" status="online" />
          </div>
        </Modal>
      )}

      {/* History Modal */}
      {activeModal === 'history' && (
        <Modal title="Match History" onClose={() => setActiveModal(null)}>
          <div className="text-center py-12">
            <div className="text-5xl mb-4 opacity-20">📊</div>
            <p className="text-zinc-500 text-xs uppercase tracking-widest">Coming Soon</p>
            <p className="text-zinc-600 text-[10px] mt-2">Match history feature in development</p>
          </div>
        </Modal>
      )}

      {/* Settings Modal */}
      {activeModal === 'settings' && (
        <Modal title="Settings" onClose={() => setActiveModal(null)}>
          <div className="text-center py-12">
            <div className="text-5xl mb-4 opacity-20">⚙️</div>
            <p className="text-zinc-500 text-xs uppercase tracking-widest">Coming Soon</p>
            <p className="text-zinc-600 text-[10px] mt-2">Settings panel in development</p>
          </div>
        </Modal>
      )}
    </div>
  );
};

// --- HELPER COMPONENTS ---

const SportCard = ({ name, desc, icon, onClick, accent }: any) => {
  const accentConfig: any = {
    red: { border: 'hover:border-red-600', text: 'group-hover:text-red-500', glow: 'group-hover:drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]' },
    blue: { border: 'hover:border-blue-600', text: 'group-hover:text-blue-500', glow: 'group-hover:drop-shadow-[0_0_30px_rgba(37,99,235,0.8)]' },
    green: { border: 'hover:border-green-600', text: 'group-hover:text-green-500', glow: 'group-hover:drop-shadow-[0_0_30px_rgba(22,163,74,0.8)]' },
    yellow: { border: 'hover:border-yellow-600', text: 'group-hover:text-yellow-500', glow: 'group-hover:drop-shadow-[0_0_30px_rgba(202,138,4,0.8)]' },
    orange: { border: 'hover:border-orange-600', text: 'group-hover:text-orange-500', glow: 'group-hover:drop-shadow-[0_0_30px_rgba(234,88,12,0.8)]' },
    purple: { border: 'hover:border-purple-600', text: 'group-hover:text-purple-500', glow: 'group-hover:drop-shadow-[0_0_30px_rgba(147,51,234,0.8)]' },
  };
  const config = accentConfig[accent];
  return (
    <button onClick={onClick} className={`bg-zinc-900/40 border border-zinc-800 p-6 text-left group transition-all relative overflow-hidden h-40 flex flex-col justify-between ${config.border} hover:shadow-lg`}>
      <div className={`absolute -top-4 -right-4 text-[120px] opacity-[0.04] grayscale group-hover:grayscale-0 group-hover:opacity-40 group-hover:scale-125 transition-all duration-500 rotate-12 group-hover:brightness-[1.8] group-hover:saturate-[1.5] ${config.glow}`}>{icon}</div>
      <div>
        <h3 className={`text-xl font-black italic text-zinc-300 transition-colors uppercase tracking-tight ${config.text}`}>{name}</h3>
        <p className="text-zinc-500 text-[10px] mt-1 uppercase tracking-widest font-bold leading-tight">{desc}</p>
      </div>
      <div className={`flex items-center gap-2 text-zinc-600 text-[10px] font-bold uppercase tracking-widest group-hover:text-white transition-colors ${config.text}`}>Initialize <span className="text-sm">→</span></div>
    </button>
  );
};

const MenuItem = ({ label, icon, onClick, active, disabled, highlight, subtitle, badge }: any) => (
  <button onClick={onClick} disabled={disabled} className={`w-full text-left flex items-center justify-between p-4 rounded transition-all uppercase font-bold text-[10px] tracking-widest relative ${active ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'} ${disabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-zinc-500' : ''} ${highlight ? 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/30 hover:text-blue-300 border border-blue-900/50' : ''}`}>
    <div className="flex items-center gap-4 flex-1 min-w-0">
      <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="truncate">{label}</div>
        {subtitle && <div className="text-[8px] text-zinc-600 mt-0.5 normal-case tracking-normal truncate">{subtitle}</div>}
      </div>
    </div>
    {badge && <span className="ml-2 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold flex-shrink-0">{badge}</span>}
  </button>
);

const Modal = ({ title, children, onClose }: any) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl rounded-sm">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white">{title}</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-white text-2xl transition-colors leading-none">&times;</button>
      </div>
      {children}
    </div>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-2 border-b border-zinc-900">
    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{label}</span>
    <span className="text-sm text-white font-mono">{value}</span>
  </div>
);

const StatusItem = ({ label, status }: { label: string; status: 'online' | 'offline' | 'local' }) => {
  const statusConfig = { online: { color: 'bg-green-500', text: 'Online', textColor: 'text-green-400' }, offline: { color: 'bg-red-500', text: 'Offline', textColor: 'text-red-400' }, local: { color: 'bg-yellow-500', text: 'Pending', textColor: 'text-yellow-400' } };
  const config = statusConfig[status];
  return (
    <div className="flex justify-between items-center py-3 border-b border-zinc-900">
      <span className="text-xs text-zinc-400 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2">
        <div className="relative"><div className={`w-2 h-2 ${config.color} rounded-full`}></div><div className={`absolute inset-0 w-2 h-2 ${config.color} rounded-full animate-ping opacity-75`}></div></div>
        <span className={`text-xs font-bold uppercase tracking-widest ${config.textColor}`}>{config.text}</span>
      </div>
    </div>
  );
};