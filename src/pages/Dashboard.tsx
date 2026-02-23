// src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BasketballGame, Tournament } from '../types';
import { logoutUser, subscribeToAuth } from '../services/authService';
import { subscribeToLiveGames, deleteGame } from '../services/supabaseGameService';
import { subscribeToPublicTournaments } from '../services/tournamentService';
import type { User } from '@supabase/supabase-js';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallPrompt } from '../components/InstallPrompt';
import { ConnectControllerModal } from '../components/ConnectControllerModal';
import { useHardwareBridge } from '../hooks/useHardwareBridge';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // --- STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [allGames, setAllGames] = useState<BasketballGame[]>([]);
  const [liveTournaments, setLiveTournaments] = useState<Tournament[]>([]);

  const [activeTab, setActiveTab] = useState<'my' | 'all' | 'tournaments'>('all');
  const [isExpanded, setIsExpanded] = useState(false); // Controls "Show More"
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [activeModal, setActiveModal] = useState<'profile' | 'status' | 'history' | 'settings' | 'tablet' | 'provision' | 'confirmTournament' | 'connect_controller' | null>(null);

  // Track if controller is linked (checks session storage on load)
  const [controllerLinked, setControllerLinked] = useState(!!sessionStorage.getItem('BOX_HANDHELD_ID'));

  // --- HARDWARE BRIDGE STATUS ---
  const { isConnected, transport } = useHardwareBridge();

  const [showInstallCard, setShowInstallCard] = useState(() => {
    return localStorage.getItem('box_dismiss_install') !== 'true';
  });

  const { isInstalled, prompt, triggerInstall } = usePWAInstall();

  // --- DERIVED STATE ---
  const myGames = user ? allGames.filter(g => g.hostId === user.id) : [];
  const liveFeed = allGames;

  // --- RESET EXPANSION ON TAB CHANGE ---
  useEffect(() => {
    setIsExpanded(false);
  }, [activeTab]);

  // --- EFFECTS ---
  useEffect(() => {
    const unsubAuth = subscribeToAuth((u) => {
      setUser(u);
      setLoading(false);
    });

    const unsubGames = subscribeToLiveGames((games) => {
      setAllGames(games);
    });

    const unsubTournaments = subscribeToPublicTournaments((tournaments) => {
      setLiveTournaments(tournaments);
    });

    return () => {
      unsubAuth();
      unsubGames();
      unsubTournaments();
    };
  }, []);

  // Sync local state when connection changes
  useEffect(() => {
    setControllerLinked(isConnected || !!sessionStorage.getItem('BOX_HANDHELD_ID'));
  }, [isConnected]);

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

  // --- RENDER HELPERS ---
  const renderGameList = (games: BasketballGame[], isMyGames: boolean) => {
    // VISUAL LIMIT: 
    // - If "My Games": Show 6 games.
    // - If "Active Feed": Show 5 games (because slot #1 is the Watch Card) = 6 total items.
    // - If Expanded: Show all.

    const limit = isMyGames ? 6 : 5;
    const visibleGames = isExpanded ? games : games.slice(0, limit);
    const hiddenCount = Math.max(0, games.length - limit);

    if (games.length === 0 && !isMyGames) {
      // Empty Active Feed state handled in main return
      return null;
    }

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {/* SLOT 1 IN ACTIVE FEED: WATCH CARD */}
          {!isMyGames && (
            <WatchByCodeCard onWatch={(code) => navigate(`/watch/${code}`)} />
          )}

          {visibleGames.map((g, index) => (
            <div key={g.code || `game-${index}`} className={`bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm transition-all group relative overflow-hidden flex flex-col ${isMyGames ? 'hover:border-red-500' : 'hover:border-blue-500'}`}>
              {/* Status Color Bar */}
              <div className={`absolute top-0 left-0 w-1 h-full transition-all group-hover:w-2 ${isMyGames ? 'bg-red-600' : 'bg-blue-600'}`}></div>

              {/* Delete Button (Only for My Games) */}
              {isMyGames && (
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
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-black px-2 py-1 rounded">{g.sportId || g.sport || 'BASKETBALL'}</div>
                <div className={`w-2 h-2 rounded-full animate-pulse ${isMyGames ? 'bg-red-500' : 'bg-blue-500'}`}></div>
              </div>

              {/* Title & Code */}
              <h3 className={`font-black italic text-xl text-white mb-1 transition-colors uppercase tracking-tight pl-2 truncate ${isMyGames ? 'group-hover:text-red-400' : 'group-hover:text-blue-400'}`}>
                {g.settings?.gameName || 'UNTITLED GAME'}
              </h3>
              <div className="text-xs font-mono text-zinc-400 mb-4 pl-2">ID: <span className="text-zinc-500">{g.code || '----'}</span></div>

              {/* Score */}
              <div className="flex items-center justify-between bg-black p-3 rounded border border-zinc-800 mb-3 mt-auto">
                <div className="font-bold text-white text-lg" style={{ color: g.teamA?.color || '#DC2626' }}>{g.teamA?.score ?? 0}</div>
                <div className="text-[9px] text-zinc-600 uppercase tracking-widest">VS</div>
                <div className="font-bold text-white text-lg" style={{ color: g.teamB?.color || '#2563EB' }}>{g.teamB?.score ?? 0}</div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {isMyGames ? (
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

        {/* SHOW MORE BUTTON */}
        {!isExpanded && hiddenCount > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={() => setIsExpanded(true)}
              className="px-6 py-3 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all"
            >
              Show {hiddenCount} More Games ↓
            </button>
          </div>
        )}

        {isExpanded && (
          <div className="mt-8 text-center">
            <button
              onClick={() => setIsExpanded(false)}
              className="text-zinc-600 hover:text-zinc-400 text-[10px] font-bold uppercase tracking-widest"
            >
              Show Less ↑
            </button>
          </div>
        )}
      </>
    );
  };

  const renderTournamentList = (tournaments: Tournament[]) => {
    const limit = 6;
    const visibleTournaments = isExpanded ? tournaments : tournaments.slice(0, limit);
    const hiddenCount = Math.max(0, tournaments.length - limit);

    if (tournaments.length === 0) {
      return (
        <div className="border border-dashed border-zinc-800 p-12 text-center rounded-lg hover:bg-zinc-900/30 transition-colors">
          <div className="text-4xl mb-4 grayscale opacity-20">🏆</div>
          <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest">No active tournaments found.</p>
          <button onClick={handleEnterTournament} className="mt-4 text-xs font-bold text-yellow-500 hover:text-yellow-400 uppercase tracking-widest">
            + Create Tournament
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {visibleTournaments.map((t, index) => (
            <div key={t.id || `tourney-${index}`} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm transition-all group relative overflow-hidden hover:border-yellow-600 flex flex-col">
              <div className="absolute top-0 left-0 w-1 h-full transition-all group-hover:w-2 bg-yellow-600"></div>

              <div className="flex justify-between items-start mb-4 pl-2">
                <div className="text-[10px] font-bold text-black uppercase tracking-widest bg-yellow-600 px-2 py-1 rounded">TOURNAMENT</div>
                <div className="w-2 h-2 rounded-full animate-pulse bg-green-500"></div>
              </div>

              <h3 className="font-black italic text-xl text-white mb-1 transition-colors uppercase tracking-tight pl-2 group-hover:text-yellow-400 truncate">
                {t.name || 'UNTITLED'}
              </h3>
              <div className="text-xs font-mono text-zinc-400 mb-4 pl-2">Organizer: <span className="text-zinc-500">{t.organizer || 'Unknown'}</span></div>

              <div className="flex gap-2 mt-auto">
                <button onClick={() => navigate(t.adminId === user?.id ? `/tournament/${t.id}/manage` : `/tournament`)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors border border-zinc-700">
                  {t.adminId === user?.id ? 'Manage' : 'View Details'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* SHOW MORE BUTTON */}
        {!isExpanded && hiddenCount > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={() => setIsExpanded(true)}
              className="px-6 py-3 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-yellow-600 hover:text-yellow-400 text-xs font-bold uppercase tracking-widest rounded-full transition-all"
            >
              Show {hiddenCount} More Tournaments ↓
            </button>
          </div>
        )}
      </>
    )
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
              {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="User" className="w-full h-full object-cover" /> : <span className="text-zinc-400">{user ? (user.user_metadata?.full_name?.[0] || 'U') : 'G'}</span>}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full animate-pulse"></div>
          </div>
          <div className="text-left text-white font-bold text-sm">
            {user ? (user.user_metadata?.full_name || 'Operator') : 'Guest User'}
          </div>
        </button>

        {/* --- HARDWARE STATUS WIDGET --- */}
        <button
          onClick={() => setActiveModal('connect_controller')}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all mr-auto ml-4
            ${isConnected
              ? 'bg-green-950/30 border-green-800 text-green-500 hover:bg-green-900/50'
              : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-zinc-400 opacity-0 md:opacity-100'
            }
          `}
        >
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">
            {isConnected ? (transport === 'websocket' ? 'H/W: LAN' : 'H/W: CLOUD') : 'H/W: OFF'}
          </span>
          {isConnected && <span className="text-lg leading-none">🎮</span>}
        </button>
        {/* ----------------------------- */}

        <button onClick={() => setIsMenuOpen(true)} className="group p-2 space-y-1.5 cursor-pointer z-30 hover:bg-zinc-800 rounded transition-colors" aria-label="Open menu">
          <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
          <div className="w-6 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors"></div>
          <div className="w-4 h-0.5 bg-zinc-400 group-hover:bg-white transition-colors ml-auto"></div>
        </button>
      </header>

      {/* SLIDE-OUT MENU */}
      <div className={`fixed top-0 right-0 w-[320px] h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-8 border-b border-zinc-900 pb-4">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Command Menu</h2>
            <button onClick={() => setIsMenuOpen(false)} className="text-2xl text-zinc-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-900">&times;</button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {/* 1. NAVIGATION */}
            <div className="space-y-1 mb-6">
              <div className="text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-2 px-4">Navigation</div>
              <MenuItem label="Dashboard" icon="⊞" onClick={() => setIsMenuOpen(false)} active />
              <MenuItem label="Tournament Mode" icon="🏆" onClick={() => { setIsMenuOpen(false); setActiveModal('confirmTournament'); }} highlight subtitle="League Management" />
            </div>

            {/* 2. PERSONAL */}
            <div className="space-y-1 mb-6">
              <div className="text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-2 px-4">Personal</div>
              <MenuItem label="My Profile" icon="👤" onClick={() => { setIsMenuOpen(false); setActiveModal('profile'); }} disabled={!user} />
              <MenuItem label="Match History" icon="↺" onClick={() => { setIsMenuOpen(false); setActiveModal('history'); }} disabled={!user} />
            </div>

            {/* 3. HARDWARE */}
            <div className="space-y-1 mb-6">
              <div className="text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-2 px-4">Hardware</div>
              <MenuItem
                label={isConnected ? "Handheld Connected" : "Connect Handheld"}
                icon={isConnected ? "🎮" : "🔗"}
                onClick={() => { setIsMenuOpen(false); setActiveModal('connect_controller'); }}
                highlight={!isConnected}
                subtitle={isConnected ? "Device Online" : "Link ESP Controller"}
                badge={isConnected ? "ON" : undefined}
              />
              <MenuItem label={isInstalled ? "Unit Provisioned" : "Provision Hardware"} icon={isInstalled ? "✅" : "📱"} onClick={() => { setIsMenuOpen(false); setActiveModal('provision'); }} highlight={!isInstalled && !controllerLinked} subtitle={isInstalled ? "Device Ready" : "Setup Referee Unit"} />

              {myGames.length > 0 && (
                <MenuItem label="Tablet Controller" icon="📱" onClick={() => { setIsMenuOpen(false); goToTabletMode(); }} highlight={true} subtitle={`Control ${myGames.length} active games`} badge={myGames.length} />
              )}
            </div>

            {/* 4. SYSTEM */}
            <div className="space-y-1 mb-6">
              <div className="text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-2 px-4">System</div>
              <MenuItem label="System Status" icon="⚡" onClick={() => { setIsMenuOpen(false); setActiveModal('status'); }} />
              <MenuItem label="Settings" icon="⚙" onClick={() => { setIsMenuOpen(false); setActiveModal('settings'); }} />
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-900 mt-auto">
            <button onClick={handleLogout} className="w-full text-left flex items-center gap-4 p-4 hover:bg-red-900/10 text-red-500 transition-colors uppercase font-bold text-xs tracking-widest rounded group">
              <span className="text-lg group-hover:-translate-x-1 transition-transform">↪</span> <span>Log Out</span>
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

        {/* 2. LIVE GAMES & TOURNAMENTS TABS */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-6 border-b border-zinc-800 pb-0 mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-4 text-xs font-bold uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${activeTab === 'all' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              Active Feed
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                {liveFeed.length}
              </span>
              {activeTab === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
            </button>

            <button
              onClick={() => setActiveTab('my')}
              className={`pb-4 text-xs font-bold uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${activeTab === 'my' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              My Games
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'my' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                {myGames.length}
              </span>
              {activeTab === 'my' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></div>}
            </button>

            <button
              onClick={() => setActiveTab('tournaments')}
              className={`pb-4 text-xs font-bold uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${activeTab === 'tournaments' ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              Live Tournaments
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'tournaments' ? 'bg-yellow-600 text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                {liveTournaments.length}
              </span>
              {activeTab === 'tournaments' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500"></div>}
            </button>
          </div>

          {/* CONTENT AREA */}
          <div className="min-h-[200px]">
            {activeTab === 'tournaments'
              ? renderTournamentList(liveTournaments)
              : renderGameList(activeTab === 'my' ? myGames : liveFeed, activeTab === 'my')
            }
          </div>

        </section>
      </main>

      {/* Modals */}
      {activeModal === 'connect_controller' && user && (
        <ConnectControllerModal
          userId={user.id}
          onClose={() => setActiveModal(null)}
          onSuccess={(code) => {
            setControllerLinked(true);
            console.log(`Handheld Controller ${code} linked successfully`);
          }}
        />
      )}

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
                  // UPDATED: Manual Installation Instructions
                  <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <h4 className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-3">Manual Installation</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="bg-zinc-800 text-zinc-500 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0">1</span>
                        <p className="text-xs text-zinc-300 leading-tight pt-0.5">
                          Tap the <span className="font-bold text-blue-400">Share</span> button below
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="bg-zinc-800 text-zinc-500 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0">2</span>
                        <p className="text-xs text-zinc-300 leading-tight pt-0.5">
                          Scroll down and tap <span className="font-bold text-white">Add to Home Screen</span>
                        </p>
                      </div>
                    </div>
                  </div>
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

/**
 * WATCH BY CODE CARD - Lives in Slot #1 of Active Feed
 * REFINED: Matches Game Card visuals + Fluid Height
 */
const WatchByCodeCard = ({ onWatch }: { onWatch: (code: string) => void }) => {
  const [code, setCode] = useState('');

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm flex flex-col justify-between min-h-[220px] h-full shadow-none relative overflow-hidden group hover:border-blue-500 transition-all">
      {/* Visual Consistency Bar */}
      <div className="absolute top-0 left-0 w-1 h-full transition-all group-hover:w-2 bg-blue-600"></div>

      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full pointer-events-none"></div>

      <div className="relative z-10 pl-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-black px-2 py-1 rounded">SPECTATOR</div>
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
        </div>
        <h2 className="text-white font-black italic text-xl uppercase tracking-tight mb-4 group-hover:text-blue-400 transition-colors">Find a Game</h2>
      </div>

      <div className="relative z-10 space-y-2 mt-auto pl-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ENTER CODE"
          className="w-full bg-black/50 border border-zinc-700 text-white text-center font-mono font-bold text-sm py-2 rounded focus:outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-700 uppercase"
          maxLength={6}
        />
        <button
          disabled={code.length < 4}
          onClick={() => onWatch(code)}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-widest py-2 rounded transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]"
        >
          Watch Now
        </button>
      </div>
    </div>
  )
}

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
  <button onClick={onClick} disabled={disabled} className={`w-full text-left flex items-center justify-between p-4 rounded-sm transition-all uppercase font-bold text-[10px] tracking-widest relative ${active ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'} ${disabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-zinc-500' : ''} ${highlight ? 'bg-blue-900/10 text-blue-400 hover:bg-blue-900/20 hover:text-blue-300 border border-blue-900/30' : ''}`}>
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