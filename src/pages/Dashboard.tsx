import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BasketballGame } from '../types';
import { logoutUser, subscribeToAuth } from '../services/authService';
import { subscribeToLiveGames, deleteGame } from '../services/gameService';
import type { User } from 'firebase/auth';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallPrompt } from '../components/InstallPrompt';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // --- STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [allGames, setAllGames] = useState<BasketballGame[]>([]);

  const [activeTab, setActiveTab] = useState<'my' | 'all'>('all');
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [activeModal, setActiveModal] = useState<'profile' | 'status' | 'history' | 'settings' | 'tablet' | 'provision' | 'confirmTournament' | null>(null);

  const [showInstallCard, setShowInstallCard] = useState(() => {
    return localStorage.getItem('box_dismiss_install') !== 'true';
  });

  const { isInstalled, prompt, triggerInstall } = usePWAInstall();

  // --- DERIVED STATE ---
  const myGames = user ? allGames.filter(g => g.hostId === user.uid) : [];
  const liveFeed = allGames;

  // --- EFFECTS ---
  useEffect(() => {
    const unsubAuth = subscribeToAuth((u) => {
      setUser(u);
      setLoading(false);
    });

    const unsubGames = subscribeToLiveGames((games) => {
      setAllGames(games);
    });

    return () => {
      unsubAuth();
      unsubGames();
    };
  }, []);

  // --- HANDLERS ---
  const handleInstall = async () => {
    const success = await triggerInstall();
    if (success) setShowInstallCard(false);
  };

  const handleDismiss = () => {
    setShowInstallCard(false);
    localStorage.setItem('box_dismiss_install', 'true');
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/');
  };

  const startNewGame = (sportId: string) => {
    setSelectedSport(sportId);
    setTimeout(() => {
      navigate('/setup', { state: { sport: sportId } });
    }, 600);
  };

  const goToTabletMode = (gameCode?: string) => {
    if (gameCode) {
      navigate(`/tablet/${gameCode}`);
    } else {
      setActiveModal('tablet');
    }
  };

  const handleDeleteGame = (code: string) => {
    if (window.confirm("Are you sure you want to delete this session? This cannot be undone.")) {
      deleteGame(code);
    }
  };

  const handleEnterTournament = () => {
    setActiveModal(null);
    navigate('/tournament');
  };

  const getInstallMessage = () => {
    if (prompt) return null;
    if (isInstalled) return "Device Provisioned";
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) return "iOS Restriction: Use Share Menu → Add to Home Screen";
    return "Browser Restriction: Open in Chrome/Edge";
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-black font-sans text-white transition-transform duration-300`}>
      {/* HEADER */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md p-6 flex justify-between items-center sticky top-0 z-20">
        <button onClick={() => setActiveModal('profile')} className="flex items-center gap-4 group hover:bg-zinc-800/50 p-2 -ml-2 rounded-lg transition-all">
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black italic text-sm shadow-lg overflow-hidden border-2 ${user ? 'border-red-600 bg-zinc-800' : 'border-zinc-600 bg-zinc-800'}`}>
              {user?.photoURL ? <img src={user.photoURL} alt="User" className="w-full h-full object-cover" /> : <span className="text-zinc-400">{user ? user.displayName?.[0] || 'U' : 'G'}</span>}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full animate-pulse"></div>
          </div>
          <div className="text-left text-white font-bold text-sm">
            {user ? (user.displayName || 'Operator') : 'Guest User'}
          </div>
        </button>
        <button onClick={() => setIsMenuOpen(true)} className="group p-2 space-y-1.5 cursor-pointer z-30 hover:bg-zinc-800 rounded transition-colors" aria-label="Open menu">
          <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
          <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
          <div className="w-4 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors ml-auto"></div>
        </button>
      </header>

      {/* SLIDE-OUT MENU */}
      <div className={`fixed top-0 right-0 w-[300px] h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Command Menu</h2>
            <button onClick={() => setIsMenuOpen(false)} className="text-2xl text-zinc-500 hover:text-white transition-colors">&times;</button>
          </div>
          <div className="space-y-1 flex-1 overflow-y-auto">
            <MenuItem label="Dashboard" icon="⊞" onClick={() => setIsMenuOpen(false)} active />
            <MenuItem label="Tournament Mode" icon="🏆" onClick={() => { setIsMenuOpen(false); setActiveModal('confirmTournament'); }} highlight subtitle="League Management" />

            <div className="pt-2 mt-2">
              <MenuItem label={isInstalled ? "Unit Provisioned" : "Provision Hardware"} icon={isInstalled ? "✅" : "📱"} onClick={() => { setIsMenuOpen(false); setActiveModal('provision'); }} highlight={!isInstalled} subtitle={isInstalled ? "Device Ready" : "Setup Referee Unit"} />
            </div>
            <MenuItem label="My Profile" icon="👤" onClick={() => { setIsMenuOpen(false); setActiveModal('profile'); }} disabled={!user} />
            <MenuItem label="Match History" icon="↺" onClick={() => { setIsMenuOpen(false); setActiveModal('history'); }} disabled={!user} />
            {myGames.length > 0 && (
              <div className="pt-4 mt-4 border-t border-zinc-900">
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-2 px-4 font-bold">Quick Actions</div>
                <MenuItem label="Tablet Controller" icon="🎮" onClick={() => { setIsMenuOpen(false); goToTabletMode(); }} highlight={true} subtitle={`Control ${myGames.length} active games`} badge={myGames.length} />
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

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        {showInstallCard && !isInstalled && (
          <div className="mb-8 animate-in slide-in-from-top-4 fade-in duration-500">
            <InstallPrompt isInstalled={isInstalled} hasPrompt={!!prompt} onInstall={handleInstall} onDismiss={handleDismiss} />
          </div>
        )}

        {/* 1. INITIALIZE NEW SESSION */}
        <section className="mb-12">
          <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-600 rounded-full"></span> Initialize New Session
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SportCard isSelected={selectedSport === 'basketball'} name="BASKETBALL" desc="FIBA / NBA Rules • Shot Clock" icon="🏀" onClick={() => startNewGame('basketball')} accent="red" />
            <SportCard isSelected={selectedSport === 'badminton'} name="BADMINTON" desc="BWF Rules • Sets & Points" icon="🏸" onClick={() => startNewGame('badminton')} accent="green" />
            <SportCard isSelected={selectedSport === 'volleyball'} name="VOLLEYBALL" desc="FIVB Rules • Rotation Track" icon="🏐" onClick={() => startNewGame('volleyball')} accent="yellow" />
            <SportCard isSelected={selectedSport === 'kabaddi'} name="KABADDI" desc="PKL Style • Raid Timer" icon="🤼" onClick={() => startNewGame('kabaddi')} accent="orange" />
            <SportCard isSelected={selectedSport === 'tabletennis'} name="TABLE TENNIS" desc="ITTF Rules • 11pt Sets" icon="🏓" onClick={() => startNewGame('tabletennis')} accent="blue" />
            <SportCard isSelected={selectedSport === 'general'} name="GENERAL" desc="Universal Scoreboard • Simple" icon="⏱" onClick={() => startNewGame('general')} accent="purple" />
          </div>
        </section>

        {/* 2. LIVE GAMES TABS */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-6 border-b border-zinc-800 pb-0 mb-6">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-4 text-xs font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === 'all' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              Active Feed
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                {liveFeed.length}
              </span>
              {activeTab === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
            </button>

            <button
              onClick={() => setActiveTab('my')}
              className={`pb-4 text-xs font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === 'my' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              My Games
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'my' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                {myGames.length}
              </span>
              {activeTab === 'my' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>}
            </button>
          </div>

          {(activeTab === 'my' ? myGames : liveFeed).length === 0 ? (
            <div className="border border-dashed border-zinc-800 p-12 text-center rounded-lg hover:bg-zinc-900/30 transition-colors">
              <div className="text-4xl mb-4 grayscale opacity-20">
                {activeTab === 'my' ? '📂' : '📡'}
              </div>
              <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest">
                {activeTab === 'my' ? 'You have no active games.' : 'No live games on server.'}
              </p>
              {activeTab === 'my' && (
                <button onClick={() => startNewGame('basketball')} className="mt-4 text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest">
                  + Create New
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(activeTab === 'my' ? myGames : liveFeed).map((g, index) => (
                // FIXED: Combined Key
                <div key={`${g.code}-${index}`} className={`bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm transition-all group relative overflow-hidden ${activeTab === 'my' ? 'hover:border-red-500' : 'hover:border-blue-500'}`}>
                  {/* Status Color Bar */}
                  <div className={`absolute top-0 left-0 w-1 h-full transition-all group-hover:w-2 ${activeTab === 'my' ? 'bg-red-600' : 'bg-blue-600'}`}></div>

                  {/* Delete Button (Only for My Games) */}
                  {activeTab === 'my' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteGame(g.code); }}
                      className="absolute top-2 right-2 p-2 bg-black/80 text-zinc-400 hover:text-red-500 hover:bg-zinc-900 rounded-full transition-all z-20 opacity-0 group-hover:opacity-100 backdrop-blur-sm border border-zinc-800"
                      title="Delete Session"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}

                  {/* Header */}
                  <div className="flex justify-between items-start mb-4 pl-2">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-black px-2 py-1 rounded">{g.sport || 'BASKETBALL'}</div>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${activeTab === 'my' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                  </div>

                  {/* Title & Code */}
                  <h3 className={`font-black italic text-xl text-white mb-1 transition-colors uppercase tracking-tight pl-2 ${activeTab === 'my' ? 'group-hover:text-red-400' : 'group-hover:text-blue-400'}`}>
                    {g.settings.gameName}
                  </h3>
                  <div className="text-xs font-mono text-zinc-400 mb-4 pl-2">ID: <span className="text-zinc-500">{g.code}</span></div>

                  {/* Score */}
                  <div className="flex items-center justify-between bg-black p-3 rounded border border-zinc-800 mb-3">
                    <div className="font-bold text-white text-lg" style={{ color: g.teamA.color }}>{g.teamA.score}</div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-widest">VS</div>
                    <div className="font-bold text-white text-lg" style={{ color: g.teamB.color }}>{g.teamB.score}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {activeTab === 'my' ? (
                      <>
                        <button onClick={() => navigate(`/host/${g.code}`)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors">
                          Console
                        </button>
                        <button onClick={() => goToTabletMode(g.code)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors">
                          Tablet
                        </button>
                      </>
                    ) : (
                      <button onClick={() => navigate(`/watch/${g.code}`)} className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-2">
                        <span>●</span> Watch Stream
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modals */}
      {activeModal === 'provision' && (
        <Modal title="Hardware Provisioning Checklist" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              {isInstalled ? "This device is fully provisioned as a Referee Unit." : "System pre-flight check required before installing dedicated firmware."}
            </p>
            <div className="bg-black p-4 border border-zinc-800 space-y-3">
              <StatusItem label="Secure Context (HTTPS)" status={window.location.protocol === 'https:' ? 'online' : 'offline'} />
              <StatusItem label="Local Storage" status={typeof localStorage !== 'undefined' ? 'online' : 'offline'} />
              <StatusItem label="Service Worker" status={'serviceWorker' in navigator ? 'online' : 'offline'} />
              <StatusItem label="Install Ready" status={prompt ? 'online' : (isInstalled ? 'online' : 'local')} />
            </div>
            {!isInstalled && (
              <div className="mt-6">
                {prompt ? (
                  <button onClick={() => { triggerInstall().then(s => s && setActiveModal(null)); }} className="w-full bg-green-600 hover:bg-green-500 text-black font-black py-4 uppercase tracking-widest text-xs transition-colors shadow-[0_0_20px_rgba(34,197,94,0.4)]">Install Firmware</button>
                ) : (
                  <div className="p-3 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-500 text-center uppercase tracking-wider font-bold">{getInstallMessage()}</div>
                )}
              </div>
            )}
            {isInstalled && <button onClick={() => setActiveModal(null)} className="w-full bg-zinc-800 text-white font-bold py-4 uppercase tracking-widest text-[10px] mt-4">Close</button>}
          </div>
        </Modal>
      )}

      {activeModal === 'confirmTournament' && (
        <Modal title="Enter Tournament Mode" onClose={() => setActiveModal(null)}>
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto border border-yellow-900/50">
              <span className="text-3xl">🏆</span>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed">
              You are about to switch to the <strong>Tournament Management Console</strong>.
              <br />This allows you to organize leagues, brackets, and manage multiple scorers.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-3 bg-transparent border border-zinc-700 text-zinc-400 hover:text-white font-bold uppercase tracking-widest text-xs rounded transition-colors">
                Cancel
              </button>
              <button onClick={handleEnterTournament} className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-xs rounded shadow-lg shadow-yellow-900/20 transition-colors">
                Enter
              </button>
            </div>
          </div>
        </Modal>
      )}

      {['profile', 'status', 'history', 'settings'].includes(activeModal || '') && (
        <Modal title={activeModal?.toUpperCase()} onClose={() => setActiveModal(null)}>
          <div className="text-center py-8">
            <div className="text-2xl mb-2">🚧</div>
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Feature under construction</p>
          </div>
        </Modal>
      )}
    </div>
  );
};

// --- HELPER COMPONENTS ---

const SportCard = ({ name, desc, icon, onClick, accent, isSelected }: any) => {
  const accentConfig: any = {
    red: { border: 'group-[.is-selected]:border-red-600', text: 'group-[.is-selected]:text-red-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]', hoverBorder: 'hover:border-red-600', hoverText: 'group-hover:text-red-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]' },
    blue: { border: 'group-[.is-selected]:border-blue-600', text: 'group-[.is-selected]:text-blue-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(37,99,235,0.8)]', hoverBorder: 'hover:border-blue-600', hoverText: 'group-hover:text-blue-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(37,99,235,0.8)]' },
    green: { border: 'group-[.is-selected]:border-green-600', text: 'group-[.is-selected]:text-green-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(22,163,74,0.8)]', hoverBorder: 'hover:border-green-600', hoverText: 'group-hover:text-green-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(22,163,74,0.8)]' },
    yellow: { border: 'group-[.is-selected]:border-yellow-600', text: 'group-[.is-selected]:text-yellow-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(202,138,4,0.8)]', hoverBorder: 'hover:border-yellow-600', hoverText: 'group-hover:text-yellow-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(202,138,4,0.8)]' },
    orange: { border: 'group-[.is-selected]:border-orange-600', text: 'group-[.is-selected]:text-orange-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(234,88,12,0.8)]', hoverBorder: 'hover:border-orange-600', hoverText: 'group-hover:text-orange-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(234,88,12,0.8)]' },
    purple: { border: 'group-[.is-selected]:border-purple-600', text: 'group-[.is-selected]:text-purple-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(147,51,234,0.8)]', hoverBorder: 'hover:border-purple-600', hoverText: 'group-hover:text-purple-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(147,51,234,0.8)]' },
  };
  const config = accentConfig[accent];

  const borderClasses = `${config.hoverBorder} ${config.border}`;
  const textClasses = `${config.hoverText} ${config.text}`;
  const glowClasses = `${config.hoverGlow} ${config.glow}`;

  const iconStateClass = `
    opacity-[0.04] grayscale 
    group-hover:grayscale-0 group-hover:opacity-40 group-hover:scale-125 group-hover:brightness-[1.8] group-hover:saturate-[1.5]
    group-[.is-selected]:grayscale-0 group-[.is-selected]:opacity-40 group-[.is-selected]:scale-125 group-[.is-selected]:brightness-[1.8] group-[.is-selected]:saturate-[1.5]
  `;

  return (
    <button
      onClick={onClick}
      className={`
        bg-zinc-900/40 border border-zinc-800 p-6 text-left group transition-all duration-300 relative overflow-hidden h-40 flex flex-col justify-between hover:shadow-lg 
        ${borderClasses} 
        ${isSelected ? 'is-selected shadow-lg scale-[1.02]' : ''}
      `}
    >
      <div className={`absolute -top-4 -right-4 text-[120px] transition-all duration-500 rotate-12 transform-gpu backface-hidden perspective-1000 ${iconStateClass} ${glowClasses}`}>
        {icon}
      </div>
      <div className="relative z-10">
        <h3 className={`text-xl font-black italic text-zinc-300 transition-colors uppercase tracking-tight ${textClasses}`}>{name}</h3>
        <p className="text-zinc-500 text-[10px] mt-1 uppercase tracking-widest font-bold leading-tight">{desc}</p>
      </div>
      <div className={`relative z-10 flex items-center gap-2 text-zinc-600 text-[10px] font-bold uppercase tracking-widest transition-colors ${isSelected ? 'text-white' : 'group-hover:text-white'} ${textClasses}`}>Initialize <span className="text-sm">→</span></div>
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
  const statusConfig = { online: { color: 'bg-green-500', text: 'Active', textColor: 'text-green-400' }, offline: { color: 'bg-red-500', text: 'Error', textColor: 'text-red-400' }, local: { color: 'bg-yellow-500', text: 'Pending', textColor: 'text-yellow-400' } };
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