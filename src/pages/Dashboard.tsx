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
import { useHardware } from '../contexts/HardwareContext';
import { useTheme } from '../contexts/ThemeContext';
import { SPORT_REGISTRY, CORE_SPORTS, EXTENDED_SPORTS } from '../sports/registry';
import type { SportDevStatus } from '../types';
import { PlayerPassportSection } from '../components/PlayerPassportSection';
import { ArenaSessionSection } from '../components/ArenaSessionSection';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme(); // <-- INITIALIZED THEME

  // --- STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [allGames, setAllGames] = useState<BasketballGame[]>([]);
  const [liveTournaments, setLiveTournaments] = useState<Tournament[]>([]);

  const [activeTab, setActiveTab] = useState<'my' | 'all' | 'tournaments'>('all');
  const [isExpanded, setIsExpanded] = useState(false); // Controls "Show More"
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showMoreSports, setShowMoreSports] = useState(false);

  const [activeModal, setActiveModal] = useState<'profile' | 'status' | 'history' | 'settings' | 'tablet' | 'provision' | 'confirmTournament' | 'connect_controller' | null>(null);

  // Track if controller is linked (checks session storage on load)
  const [controllerLinked, setControllerLinked] = useState(!!sessionStorage.getItem('BOX_HANDHELD_ID'));

  // --- HARDWARE BRIDGE STATUS ---
  const { isConnected } = useHardware();
  const transport = isConnected ? 'supabase' : 'none';

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

  // Body scroll lock for the side menu — position:fixed approach works on iOS Safari
  useEffect(() => {
    if (isMenuOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.dataset.scrollY = String(scrollY);
    } else {
      const scrollY = parseInt(document.body.dataset.scrollY || '0', 10);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      delete document.body.dataset.scrollY;
      window.scrollTo(0, scrollY);
    }
    return () => {
      const scrollY = parseInt(document.body.dataset.scrollY || '0', 10);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      delete document.body.dataset.scrollY;
      if (scrollY) window.scrollTo(0, scrollY);
    };
  }, [isMenuOpen]);

  // Reset side menu state if user switches tabs and comes back
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) setIsMenuOpen(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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
    const limit = isMyGames ? 6 : 5;
    const visibleGames = isExpanded ? games : games.slice(0, limit);
    const hiddenCount = Math.max(0, games.length - limit);

    if (games.length === 0 && !isMyGames) {
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
            <div key={g.code || `game-${index}`} className={`bg-cs-surface dark:bg-zinc-900/50 border-[0.5px] border-cs-border dark:border dark:border-zinc-800 cs-radius-card dark:rounded-2xl transition-all shadow-cs-card hover:shadow-cs-elevated dark:shadow-none dark:hover:[box-shadow:0_4px_12px_rgba(0,0,0,0.10),0_8px_24px_rgba(0,0,0,0.06)] dark:hover:border-zinc-700 group relative overflow-hidden flex flex-col`}>
              {/* Top accent bar */}
              <div className={`absolute top-0 inset-x-0 h-1 ${isMyGames ? 'bg-cs-accent dark:bg-red-600' : 'bg-cs-info dark:bg-red-600 dark:dark:bg-blue-600'}`} />

              {/* Delete Button (Only for My Games) */}
              {isMyGames && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteGame(g.code); }}
                  className="absolute top-3 right-3 w-9 h-9 inline-flex items-center justify-center bg-cs-elevated dark:bg-black/80 text-cs-text-3 dark:text-zinc-400 hover:text-cs-error hover:bg-cs-error/10 dark:hover:bg-zinc-900 cs-pill dark:rounded-lg transition-all z-20 opacity-0 group-hover:opacity-100 border-[0.5px] border-cs-border dark:border dark:border-zinc-800"
                  title="Delete Session"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}

              <div className="flex flex-col flex-1" style={{ paddingTop: 18, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0 bg-cs-accent dark:bg-red-500`} />
                    <span className="font-display text-[10px] font-bold text-cs-text-2 dark:text-zinc-400 uppercase tracking-[0.3em] dark:font-sans dark:text-[10px] dark:tracking-widest dark:font-semibold">{g.sport || 'Basketball'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-cs-text-3 dark:text-zinc-600 tabular-nums dark:text-[9px]">{g.code || '----'}</span>
                </div>

                {/* Title */}
                <h3 className="font-bold text-cs-text dark:text-white text-[15px] mb-4 truncate group-hover:text-cs-accent dark:group-hover:text-red-400 transition-colors dark:font-black dark:text-base">
                  {g.settings?.gameName || 'Untitled Game'}
                </h3>

                {/* Score — broadcast Oswald numerics */}
                <div className="flex items-center justify-between bg-cs-elevated dark:bg-black p-3 cs-radius-md dark:rounded-xl border-[0.5px] border-cs-border dark:border dark:border-zinc-800 mb-4 mt-auto">
                  <div className="text-center flex-1">
                    <div className="text-cs-text dark:text-white leading-none dark:text-5xl dark:font-black dark:font-sans" style={{ color: g.teamA?.color || undefined, fontFamily: 'Oswald, sans-serif', fontWeight: 900, fontSize: 36, fontVariantNumeric: 'tabular-nums' }}>{g.teamA?.score ?? 0}</div>
                    <div className="font-display text-[9px] text-cs-text-3 dark:text-zinc-600 font-bold uppercase tracking-[0.22em] mt-1.5 truncate max-w-[80px] dark:font-sans dark:font-semibold dark:tracking-normal">{g.teamA?.name || 'Home'}</div>
                  </div>
                  <div className="font-display text-[10px] text-cs-text-3 dark:text-zinc-700 font-bold tracking-[0.3em] px-2 dark:font-sans dark:font-black dark:tracking-normal">VS</div>
                  <div className="text-center flex-1">
                    <div className="text-cs-text dark:text-white leading-none dark:text-5xl dark:font-black dark:font-sans" style={{ color: g.teamB?.color || undefined, fontFamily: 'Oswald, sans-serif', fontWeight: 900, fontSize: 36, fontVariantNumeric: 'tabular-nums' }}>{g.teamB?.score ?? 0}</div>
                    <div className="font-display text-[9px] text-cs-text-3 dark:text-zinc-600 font-bold uppercase tracking-[0.22em] mt-1.5 truncate max-w-[80px] dark:font-sans dark:font-semibold dark:tracking-normal">{g.teamB?.name || 'Away'}</div>
                  </div>
                </div>

                {/* Game Stats link */}
                <button
                  onClick={() => navigate(`/game/${g.code}/stats`)}
                  className="w-full h-9 mb-2 inline-flex items-center justify-center gap-1.5 bg-cs-elevated hover:bg-cs-overlay dark:bg-zinc-800/60 dark:hover:bg-zinc-800 text-cs-text-2 dark:text-zinc-300 border-[0.5px] border-cs-border dark:border dark:border-zinc-700 text-[11px] font-semibold uppercase tracking-[0.073em] cs-pill dark:rounded-xl dark:tracking-normal dark:normal-case transition-colors duration-150 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6m4 6V5m4 14v-9" /></svg>
                  Game Stats →
                </button>

                {/* Actions */}
                <div className="flex gap-2">
                  {isMyGames ? (
                    <>
                      <button onClick={() => navigate(`/host/${g.code}`)} className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 bg-cs-accent hover:bg-cs-accent-pressed dark:bg-red-900/60 dark:hover:bg-red-900/90 text-white text-[12px] font-semibold uppercase tracking-[0.073em] cs-pill dark:rounded-xl dark:tracking-normal dark:normal-case transition-colors duration-150 cursor-pointer">
                        Console →
                      </button>
                      <button onClick={() => goToTabletMode(g.code)} className="flex-1 h-10 inline-flex items-center justify-center bg-cs-elevated hover:bg-cs-overlay dark:bg-zinc-800 dark:hover:bg-zinc-700 text-cs-text dark:text-zinc-300 border-[0.5px] border-cs-border dark:border dark:border-zinc-700 text-[12px] font-semibold uppercase tracking-[0.073em] cs-pill dark:rounded-xl dark:tracking-normal dark:normal-case transition-colors duration-150 cursor-pointer">
                        Tablet
                      </button>
                    </>
                  ) : (
                    <button onClick={() => navigate(`/watch/${g.code}`)} className="flex-1 h-10 inline-flex items-center justify-center gap-2 bg-cs-info hover:brightness-95 dark:bg-blue-900/80 dark:hover:bg-blue-800 text-white text-[12px] font-semibold uppercase tracking-[0.073em] cs-pill dark:rounded-xl dark:tracking-normal dark:normal-case transition-colors duration-150 cursor-pointer">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Watch Stream
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SHOW MORE BUTTON */}
        {!isExpanded && hiddenCount > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={() => setIsExpanded(true)}
              className="px-6 h-11 inline-flex items-center bg-cs-surface dark:bg-zinc-900 border-[0.5px] border-cs-border dark:border dark:border-zinc-700 hover:border-cs-border-strong dark:hover:border-zinc-500 text-cs-text-2 dark:text-zinc-400 hover:text-cs-text dark:hover:text-white shadow-cs-card dark:shadow-none text-[11px] font-semibold uppercase tracking-[0.073em] cs-pill dark:rounded-full dark:font-bold dark:text-xs dark:tracking-widest transition-all"
            >
              Show {hiddenCount} More Games ↓
            </button>
          </div>
        )}

        {isExpanded && (
          <div className="mt-8 text-center">
            <button
              onClick={() => setIsExpanded(false)}
              className="text-cs-text-2 dark:text-zinc-600 hover:text-cs-text dark:hover:text-zinc-400 text-[11px] font-semibold uppercase tracking-[0.073em] dark:text-[10px] dark:font-bold dark:tracking-widest"
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
        <div className="border border-dashed border-slate-200 dark:border-zinc-800 p-12 text-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900/30 transition-colors">
          <div className="text-4xl mb-4 grayscale opacity-20">🏆</div>
          <p className="text-slate-500 dark:text-zinc-600 text-xs font-mono uppercase tracking-widest">No active tournaments found.</p>
          <button onClick={handleEnterTournament} className="mt-4 text-xs font-bold text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 uppercase tracking-widest">
            + Create Tournament
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {visibleTournaments.map((t, index) => (
            <div key={t.id || `tourney-${index}`} className="bg-cs-surface dark:bg-zinc-900/50 border-[0.5px] border-cs-border dark:border dark:border-zinc-800 shadow-cs-card dark:shadow-none cs-radius-card dark:rounded-sm transition-all group relative overflow-hidden hover:shadow-cs-elevated dark:hover:border-yellow-600 flex flex-col" style={{ paddingTop: 14, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
              <div className="absolute top-0 left-0 w-1 h-full transition-all group-hover:w-1.5 bg-cs-warning dark:bg-yellow-600"></div>

              <div className="flex justify-between items-start mb-4 pl-2">
                <div className="font-display text-[10px] font-bold text-cs-warning uppercase tracking-[0.3em] bg-cs-warning/10 border-[0.5px] border-cs-warning/30 px-2 py-1 cs-radius-sm dark:font-sans dark:font-bold dark:tracking-widest dark:text-black dark:bg-yellow-600 dark:border-0 dark:rounded">TOURNAMENT</div>
                <div className="w-2 h-2 rounded-full animate-pulse bg-cs-success dark:bg-green-500"></div>
              </div>

              <h3 className="font-bold text-[20px] text-cs-text mb-1 transition-colors tracking-tight pl-2 group-hover:text-cs-warning truncate dark:font-black dark:italic dark:text-xl dark:text-white dark:uppercase dark:group-hover:text-yellow-400">
                {t.name || 'UNTITLED'}
              </h3>
              <div className="text-[12px] text-cs-text-2 mb-4 pl-2 dark:text-xs dark:font-mono dark:text-zinc-400">Organizer: <span className="text-cs-text dark:text-zinc-500 font-semibold dark:font-normal">{t.organizer || 'Unknown'}</span></div>

              <div className="flex gap-2 mt-auto">
                <button onClick={() => navigate(t.adminId === user?.id ? `/tournament/${t.id}/manage` : `/tournament`)} className="flex-1 h-10 inline-flex items-center justify-center bg-cs-elevated hover:bg-cs-overlay dark:bg-zinc-800 dark:hover:bg-zinc-700 text-cs-text dark:text-white text-[12px] font-semibold uppercase tracking-[0.073em] cs-pill dark:rounded dark:font-bold dark:tracking-widest transition-colors border-[0.5px] border-cs-border dark:border dark:border-zinc-700 dark:shadow-none">
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
              className="px-6 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-500 text-yellow-700 dark:text-yellow-600 hover:text-yellow-800 dark:hover:text-yellow-400 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none text-xs font-bold uppercase tracking-widest rounded-full transition-all"
            >
              Show {hiddenCount} More Tournaments ↓
            </button>
          </div>
        )}
      </>
    )
  };


  if (loading) return (
    <div className="min-h-screen bg-cs-bg dark:bg-black flex items-center justify-center transition-colors duration-300">
      <div className="w-8 h-8 border-2 border-cs-accent dark:border-red-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-cs-bg dark:bg-black font-sans text-cs-text dark:text-white transition-colors duration-300`}>
      {/* HEADER */}
      <header className="bg-cs-surface dark:bg-zinc-900/50 border-b-[0.5px] border-cs-border dark:border-b dark:border-zinc-800 px-6 h-14 flex justify-between items-center sticky top-0 z-20 dark:shadow-none">
        {/* Left: wordmark + avatar */}
        <div className="flex items-center gap-4">
          {/* THE BOX wordmark */}
          <div className="hidden sm:flex items-center gap-2.5 pr-4 border-r-[0.5px] border-cs-border dark:border-r dark:border-zinc-800 mr-1">
            <svg className="w-6 h-6 text-cs-accent dark:text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span className="font-display text-[15px] font-bold tracking-wordmark text-cs-text uppercase leading-none dark:font-sans dark:font-black dark:tracking-tight dark:text-white dark:normal-case">THE BOX</span>
          </div>

          <button onClick={() => setShowProfilePanel(true)} className="flex items-center gap-3 group hover:bg-cs-elevated dark:hover:bg-zinc-800/50 p-1.5 -ml-1.5 rounded-xl transition-all cursor-pointer" title="Open profile">
            <div className="relative flex-shrink-0">
              <div className={`w-[42px] h-[42px] rounded-full flex items-center justify-center font-black text-sm overflow-hidden border-[1.5px] transition-all group-hover:border-cs-accent dark:group-hover:border-red-700 dark:rounded-xl dark:w-9 dark:h-9 dark:shadow-sm dark:border-2 ${user ? 'border-cs-border dark:border-zinc-700 bg-cs-elevated dark:bg-zinc-800' : 'border-cs-border dark:border-zinc-700 bg-cs-elevated dark:bg-zinc-800'}`}>
                {user?.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} alt="User" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-cs-accent to-cs-accent-pressed dark:from-red-600 dark:to-red-900 flex items-center justify-center text-white text-sm font-black">
                      {user ? (user.user_metadata?.full_name?.[0]?.toUpperCase() || 'U') : 'G'}
                    </div>
                }
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-cs-success dark:bg-green-500 border-2 border-cs-surface dark:border-black rounded-full" />
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-cs-text dark:text-white font-semibold text-[14px] leading-none dark:font-bold dark:text-sm">
                {user ? (user.user_metadata?.full_name?.split(' ')[0] || 'Operator') : 'Guest'}
              </div>
              <div className="text-[10px] text-cs-text-3 dark:text-zinc-600 uppercase tracking-[0.12em] font-semibold mt-1 dark:text-[9px] dark:tracking-widest">
                {user && !(user as any).is_anonymous ? (user.app_metadata?.provider === 'google' ? 'Google' : 'Email') : 'Guest Session'}
              </div>
            </div>
          </button>
        </div>

        {/* Center: H/W status chip — pill */}
        <button
          onClick={() => setActiveModal('connect_controller')}
          className={`
            inline-flex items-center gap-1.5 px-3 h-8 cs-pill border-[0.5px] transition-all mr-auto ml-4
            ${isConnected
              ? 'bg-cs-success/10 border-cs-success/30 text-cs-success hover:bg-cs-success/15 dark:bg-green-950/30 dark:border-green-800 dark:text-green-500 dark:hover:bg-green-900/50 dark:rounded-full'
              : 'bg-cs-elevated border-cs-border text-cs-text-2 hover:bg-cs-overlay dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600 dark:hover:text-zinc-400 dark:rounded-full opacity-0 md:opacity-100'
            }
          `}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-cs-success dark:bg-green-500 animate-pulse' : 'bg-cs-text-3 dark:bg-zinc-600'}`} />
          <span className="text-[11px] font-semibold tracking-[0.073em] uppercase hidden md:inline dark:text-[10px] dark:tracking-wide dark:normal-case">
            {isConnected ? (transport === 'supabase' ? 'Cloud' : 'LAN') : 'Offline'}
          </span>
          {isConnected && <span className="text-sm leading-none">🎮</span>}
        </button>

        <button onClick={() => setIsMenuOpen(true)} className="group w-11 h-11 inline-flex flex-col items-end justify-center gap-1.5 cursor-pointer z-[55] hover:bg-cs-elevated dark:hover:bg-zinc-800 rounded-xl transition-colors dark:p-2 dark:rounded-lg dark:w-auto dark:h-auto dark:space-y-1.5 dark:items-stretch dark:justify-start" aria-label="Open menu">
          <div className="w-5 h-0.5 bg-cs-text-2 dark:bg-zinc-400 group-hover:bg-cs-text dark:group-hover:bg-white transition-colors"></div>
          <div className="w-5 h-0.5 bg-cs-text-2 dark:bg-zinc-400 group-hover:bg-cs-text dark:group-hover:bg-white transition-colors"></div>
          <div className="w-3 h-0.5 bg-cs-text-2 dark:bg-zinc-400 group-hover:bg-cs-text dark:group-hover:bg-white transition-colors ml-auto"></div>
        </button>
      </header>

      {/* SLIDE-OUT MENU BACKDROP */}
      <div
        className={`fixed inset-0 bg-slate-900/30 dark:bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onPointerDown={(e) => { e.stopPropagation(); setIsMenuOpen(false); }}
      />

      {/* SLIDE-OUT MENU PANEL */}
      <div
        className={`fixed top-0 right-0 w-[320px] h-full bg-cs-overlay/95 backdrop-blur-xl dark:bg-zinc-950 dark:backdrop-blur-none border-l-[0.5px] border-cs-border dark:border-l dark:border-zinc-800 shadow-cs-elevated dark:shadow-2xl z-50 isolate transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ willChange: 'transform' }}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-8 border-b-[0.5px] border-cs-border dark:border-b dark:border-zinc-900 pb-4">
            <h2 className="font-display text-[11px] font-bold text-cs-text-2 uppercase tracking-[0.3em] dark:font-sans dark:text-xs dark:tracking-widest">Command Menu</h2>
            <button onClick={() => setIsMenuOpen(false)} className="text-2xl text-cs-text-3 hover:text-cs-text dark:hover:text-white transition-colors w-9 h-9 inline-flex items-center justify-center cs-pill hover:bg-cs-elevated dark:hover:bg-zinc-900 dark:rounded dark:w-8 dark:h-8">&times;</button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {/* 1. NAVIGATE */}
            <div className="space-y-0.5 mb-6">
              <div className="font-display text-[11px] font-bold text-cs-text-3 dark:text-zinc-700 uppercase tracking-[0.3em] mb-2 px-4 dark:font-sans dark:text-[9px] dark:tracking-widest dark:font-black">Navigate</div>
              <MenuItem label="Dashboard" icon="⊞" onClick={() => setIsMenuOpen(false)} active />
            </div>

            {/* 2. EVENTS */}
            <div className="space-y-0.5 mb-6">
              <div className="font-display text-[11px] font-bold text-cs-text-3 dark:text-zinc-700 uppercase tracking-[0.3em] mb-2 px-4 dark:font-sans dark:text-[9px] dark:tracking-widest dark:font-black">Events</div>
              <MenuItem
                label="Tournament Mode"
                icon="🏆"
                onClick={() => { setIsMenuOpen(false); setActiveModal('confirmTournament'); }}
                highlight
                subtitle="League & Bracket Management"
              />
            </div>

            {/* 3. HARDWARE */}
            <div className="space-y-0.5">
              <div className="font-display text-[11px] font-bold text-cs-text-3 dark:text-zinc-700 uppercase tracking-[0.3em] mb-2 px-4 dark:font-sans dark:text-[9px] dark:tracking-widest dark:font-black">Hardware</div>
              <MenuItem
                label={isConnected ? "Handheld Connected" : "Connect Handheld"}
                icon={isConnected ? "🎮" : "🔗"}
                onClick={() => { setIsMenuOpen(false); setActiveModal('connect_controller'); }}
                subtitle={isConnected ? "Device Online" : "Link ESP Controller"}
                badge={isConnected ? "ON" : undefined}
              />
              <MenuItem
                label={isInstalled ? "Unit Provisioned" : "Provision Hardware"}
                icon={isInstalled ? "✅" : "📱"}
                onClick={() => { setIsMenuOpen(false); setActiveModal('provision'); }}
                subtitle={isInstalled ? "Device Ready" : "Setup Referee Unit"}
              />
              {myGames.length > 0 && (
                <MenuItem
                  label="Tablet Controller"
                  icon="📲"
                  onClick={() => { setIsMenuOpen(false); goToTabletMode(); }}
                  subtitle={`${myGames.length} active game${myGames.length !== 1 ? 's' : ''}`}
                  badge={myGames.length}
                />
              )}
              <MenuItem
                label="TV Kiosk"
                icon="📺"
                onClick={() => { setIsMenuOpen(false); window.open('/tv', '_blank'); }}
                subtitle="Launch display screen"
              />
              <MenuItem
                label="Referee Box"
                icon="🖥️"
                onClick={() => { setIsMenuOpen(false); window.open('/referee', '_blank'); }}
                subtitle="Launch Pi touchscreen"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-zinc-900 mt-auto">
            <button onClick={handleLogout} className="w-full text-left flex items-center gap-4 p-4 hover:bg-cs-error/10 dark:hover:bg-red-900/10 text-cs-error dark:text-red-500 transition-colors uppercase font-semibold text-[12px] tracking-[0.073em] cs-radius-md dark:rounded dark:font-bold dark:text-xs dark:tracking-widest group">
              <span className="text-lg group-hover:-translate-x-1 transition-transform">↪</span> <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 md:px-10 pt-8 pb-10">
        {showInstallCard && !isInstalled && (
          <div className="mb-8 animate-in slide-in-from-top-4 fade-in duration-500">
            <InstallPrompt isInstalled={isInstalled} hasPrompt={!!prompt} onInstall={handleInstall} onDismiss={handleDismiss} />
          </div>
        )}

        {/* 1. START A GAME */}
        <section className="mb-10">
          <h2 className="font-display text-[12px] font-bold text-cs-text-2 dark:text-zinc-200 uppercase tracking-[0.3em] mb-2 dark:font-sans dark:text-base dark:tracking-normal dark:border-l-4 dark:border-red-600 dark:pl-3 dark:mb-5">
            Start a Game
          </h2>
          <div className="w-7 h-[2px] bg-cs-accent mb-6 dark:hidden" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CORE_SPORTS.map((id) => {
              const m = SPORT_REGISTRY[id];
              return (
                <SportCard
                  key={id}
                  isSelected={selectedSport === id}
                  name={m.label.toUpperCase()}
                  desc={m.description}
                  icon={m.icon}
                  devStatus={m.devStatus}
                  accent={accentFromManifest(m.accent)}
                  theme={theme}
                  onClick={() => startNewGame(id)}
                />
              );
            })}
          </div>

          {/* More Sports collapsible */}
          <div className="mt-5">
            <button
              onClick={() => setShowMoreSports(v => !v)}
              className="inline-flex items-center gap-2 h-9 px-3 cs-pill bg-cs-elevated hover:bg-cs-overlay text-cs-text-2 hover:text-cs-text text-[11px] font-semibold uppercase tracking-[0.073em] transition-colors group dark:bg-transparent dark:rounded-none dark:px-0 dark:h-auto dark:font-semibold dark:text-xs dark:tracking-normal dark:uppercase-none dark:normal-case dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-transparent"
            >
              <span className={`transition-transform duration-300 ${showMoreSports ? 'rotate-90' : ''}`}>▶</span>
              {showMoreSports ? 'Hide Extended Sports' : 'More Sports'}
              <span className="bg-cs-surface dark:bg-zinc-800 text-cs-text-2 dark:text-zinc-500 px-2 py-0.5 cs-radius-sm dark:rounded-full text-[10px] font-bold tabular-nums dark:text-[9px] dark:font-normal">
                {EXTENDED_SPORTS.length}
              </span>
            </button>

            {showMoreSports && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in slide-in-from-top-2 fade-in duration-300">
                {EXTENDED_SPORTS.map((id) => {
                  const m = SPORT_REGISTRY[id];
                  return (
                    <SportCard
                      key={id}
                      isSelected={selectedSport === id}
                      name={m.label.toUpperCase()}
                      desc={m.description}
                      icon={m.icon}
                      devStatus={m.devStatus}
                      accent={accentFromManifest(m.accent)}
                      theme={theme}
                      onClick={() => startNewGame(id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 2. ARENA SESSION */}
        <ArenaSessionSection user={user} />

        {/* 3. PLAYER PASSPORT */}
        <PlayerPassportSection user={user} />

        {/* 3. LIVE GAMES & TOURNAMENTS TABS */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="font-display text-[12px] font-bold text-cs-text-2 dark:text-zinc-200 uppercase tracking-[0.3em] mb-2 dark:font-sans dark:text-base dark:tracking-normal dark:border-l-4 dark:border-red-600 dark:pl-3 dark:mb-5">
            Live Feed
          </h2>
          <div className="w-7 h-[2px] bg-cs-accent mb-6 dark:hidden" />
          <div className="flex items-center gap-2 mb-6 overflow-x-auto dark:gap-0 dark:border-b dark:border-zinc-800">
            <button
              onClick={() => setActiveTab('all')}
              className={`inline-flex items-center gap-2 h-9 px-3.5 text-[11px] font-semibold uppercase tracking-[0.073em] transition-all whitespace-nowrap cs-pill dark:pb-3.5 dark:mr-6 dark:px-0 dark:h-auto dark:text-xs dark:font-bold dark:tracking-[0.18em] dark:rounded-none dark:-mb-px dark:border-b-2 dark:bg-transparent ${activeTab === 'all' ? 'bg-cs-accent-subtle text-cs-accent dark:text-white dark:border-white dark:bg-transparent' : 'bg-cs-elevated text-cs-text-2 hover:bg-cs-overlay hover:text-cs-text dark:text-zinc-600 dark:border-transparent dark:hover:text-zinc-400 dark:bg-transparent'}`}
            >
              Active Feed
              <span className={`px-2 py-0.5 cs-radius-sm text-[10px] font-bold tabular-nums dark:rounded-full dark:text-[9px] dark:font-normal ${activeTab === 'all' ? 'bg-cs-accent text-white' : 'bg-cs-surface text-cs-text-2 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                {liveFeed.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('my')}
              className={`inline-flex items-center gap-2 h-9 px-3.5 text-[11px] font-semibold uppercase tracking-[0.073em] transition-all whitespace-nowrap cs-pill dark:pb-3.5 dark:mr-6 dark:px-0 dark:h-auto dark:text-xs dark:font-bold dark:tracking-[0.18em] dark:rounded-none dark:-mb-px dark:border-b-2 dark:bg-transparent ${activeTab === 'my' ? 'bg-cs-accent-subtle text-cs-accent dark:text-white dark:border-white dark:bg-transparent' : 'bg-cs-elevated text-cs-text-2 hover:bg-cs-overlay hover:text-cs-text dark:text-zinc-600 dark:border-transparent dark:hover:text-zinc-400 dark:bg-transparent'}`}
            >
              My Games
              <span className={`px-2 py-0.5 cs-radius-sm text-[10px] font-bold tabular-nums dark:rounded-full dark:text-[9px] dark:font-normal ${activeTab === 'my' ? 'bg-cs-accent text-white' : 'bg-cs-surface text-cs-text-2 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                {myGames.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('tournaments')}
              className={`inline-flex items-center gap-2 h-9 px-3.5 text-[11px] font-semibold uppercase tracking-[0.073em] transition-all whitespace-nowrap cs-pill dark:pb-3.5 dark:px-0 dark:h-auto dark:text-xs dark:font-bold dark:tracking-[0.18em] dark:rounded-none dark:-mb-px dark:border-b-2 dark:bg-transparent ${activeTab === 'tournaments' ? 'bg-cs-warning/10 text-cs-warning dark:text-yellow-400 dark:border-yellow-400 dark:bg-transparent' : 'bg-cs-elevated text-cs-text-2 hover:bg-cs-overlay hover:text-cs-text dark:text-zinc-600 dark:border-transparent dark:hover:text-zinc-400 dark:bg-transparent'}`}
            >
              Tournaments
              <span className={`px-2 py-0.5 cs-radius-sm text-[10px] font-bold tabular-nums dark:rounded-full dark:text-[9px] dark:font-normal ${activeTab === 'tournaments' ? 'bg-cs-warning text-white' : 'bg-cs-surface text-cs-text-2 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                {liveTournaments.length}
              </span>
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

      {/* PROFILE PANEL */}
      {showProfilePanel && (
        <ProfilePanel
          user={user}
          theme={theme}
          toggleTheme={toggleTheme}
          myGamesCount={myGames.length}
          onClose={() => setShowProfilePanel(false)}
          onLogout={handleLogout}
          onOpenModal={(m) => {
            setShowProfilePanel(false);
            setActiveModal(m as any);
          }}
        />
      )}

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
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
              {isInstalled ? "This device is fully provisioned as a Referee Unit." : "System pre-flight check required before installing dedicated firmware."}
            </p>
            <div className="bg-slate-100 dark:bg-black p-4 border border-slate-200 dark:border-zinc-800 space-y-3 rounded">
              <StatusItem label="Secure Context (HTTPS)" status={window.location.protocol === 'https:' ? 'online' : 'offline'} />
              <StatusItem label="Local Storage" status={typeof localStorage !== 'undefined' ? 'online' : 'offline'} />
              <StatusItem label="Service Worker" status={'serviceWorker' in navigator ? 'online' : 'offline'} />
              <StatusItem label="Install Ready" status={prompt ? 'online' : (isInstalled ? 'online' : 'local')} />
            </div>
            {!isInstalled && (
              <div className="mt-6">
                {prompt ? (
                  <button onClick={() => { triggerInstall().then(s => s && setActiveModal(null)); }} className="w-full bg-green-600 hover:bg-green-500 text-white dark:text-black font-black py-4 uppercase tracking-widest text-xs transition-colors shadow-[0_0_20px_rgba(34,197,94,0.3)] dark:shadow-[0_0_20px_rgba(34,197,94,0.4)]">Install Firmware</button>
                ) : (
                  <div className="mt-4 p-4 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
                    <h4 className="text-slate-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-3">Manual Installation</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-500 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0">1</span>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-tight pt-0.5">
                          Tap the <span className="font-bold text-blue-600 dark:text-blue-400">Share</span> button below
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-500 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0">2</span>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-tight pt-0.5">
                          Scroll down and tap <span className="font-bold text-zinc-900 dark:text-white">Add to Home Screen</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {isInstalled && <button onClick={() => setActiveModal(null)} className="w-full bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 font-bold py-4 uppercase tracking-widest text-[10px] mt-4 transition-colors">Close</button>}
          </div>
        </Modal>
      )}

      {activeModal === 'confirmTournament' && (
        <Modal title="Enter Tournament Mode" onClose={() => setActiveModal(null)}>
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto border border-yellow-300 dark:border-yellow-900/50 shadow-sm dark:shadow-none">
              <span className="text-3xl">🏆</span>
            </div>
            <p className="text-slate-600 dark:text-zinc-400 text-xs leading-relaxed">
              You are about to switch to the <strong className="text-slate-900 dark:text-white">Tournament Management Console</strong>.
              <br />This allows you to organize leagues, brackets, and manage multiple scorers.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-3 bg-transparent border border-slate-200 dark:border-zinc-700 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white font-bold uppercase tracking-widest text-xs rounded transition-colors">
                Cancel
              </button>
              <button onClick={handleEnterTournament} className="flex-1 py-3 bg-yellow-700 hover:bg-yellow-800 dark:bg-yellow-600 dark:hover:bg-yellow-500 text-white dark:text-black font-black uppercase tracking-widest text-xs rounded shadow-lg shadow-yellow-700/20 dark:shadow-yellow-900/20 transition-colors">
                Enter
              </button>
            </div>
          </div>
        </Modal>
      )}

      {(activeModal === 'status' || activeModal === 'history' || activeModal === 'settings') && (
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
  const [focused, setFocused] = useState(false);

  return (
    <div className="bg-cs-surface dark:bg-zinc-900/50 border-[0.5px] border-cs-border dark:border dark:border-zinc-800 cs-radius-card dark:rounded-xl flex flex-col justify-between min-h-[220px] h-full shadow-cs-card dark:shadow-none relative overflow-hidden group hover:shadow-cs-elevated dark:hover:border-blue-700/60 transition-all duration-300" style={{ paddingTop: 14, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 w-1 h-full transition-all duration-300 group-hover:w-[3px] bg-cs-info dark:bg-blue-700" />

      {/* Background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cs-accent-subtle dark:bg-blue-500/5 blur-3xl rounded-full pointer-events-none transition-all duration-500 group-hover:w-40 group-hover:h-40" />

      <div className="relative z-10 pl-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="font-display text-[10px] font-bold text-cs-info uppercase tracking-[0.3em] bg-cs-info/10 border-[0.5px] border-cs-info/30 px-2 py-1 cs-pill dark:font-sans dark:font-bold dark:text-blue-400 dark:tracking-widest dark:bg-blue-900/20 dark:border dark:border-blue-900/40 dark:rounded-full">Spectator</div>
          <span className="w-2 h-2 bg-cs-info dark:bg-blue-500 rounded-full animate-pulse" />
        </div>
        <h2 className="text-cs-text font-bold text-[20px] tracking-tight mb-1 group-hover:text-cs-info transition-colors dark:text-white dark:font-black dark:italic dark:text-xl dark:uppercase dark:group-hover:text-blue-400">Find a Game</h2>
        <p className="font-display text-[10px] text-cs-text-3 uppercase tracking-[0.3em] font-bold mb-4 dark:font-sans dark:text-zinc-600 dark:tracking-widest">Enter 6-digit code</p>
      </div>

      <div className="relative z-10 space-y-2 mt-auto pl-2">
        <div className={`relative flex cs-radius-md dark:rounded-lg overflow-hidden transition-all duration-200 ${focused ? 'ring-2 ring-cs-info/20 dark:border-2 dark:border-blue-500 dark:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] dark:ring-0' : 'dark:border-2 dark:border-zinc-700'} bg-cs-elevated dark:bg-transparent`}>
          <div className="bg-cs-overlay/70 dark:bg-zinc-800 px-3 flex items-center dark:border-r dark:border-zinc-700">
            <span className={`font-display text-base font-bold transition-colors dark:font-sans dark:text-sm ${focused ? 'text-cs-info dark:text-blue-400' : 'text-cs-text-3 dark:text-zinc-500'}`}>#</span>
          </div>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="GAME ID"
            className="flex-1 bg-transparent text-cs-text dark:text-white text-center font-bold pr-3 focus:outline-none placeholder:text-cs-text-3 dark:placeholder:text-zinc-600 uppercase tabular-nums dark:font-mono dark:text-sm dark:py-2.5"
            style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, height: 44, letterSpacing: '0.18em' }}
            maxLength={6}
          />
        </div>
        <button
          disabled={code.length < 4}
          onClick={() => onWatch(code)}
          className="w-full h-11 inline-flex items-center justify-center bg-cs-info hover:brightness-95 dark:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold uppercase tracking-[0.073em] cs-pill dark:rounded-lg dark:tracking-widest dark:font-bold dark:py-2.5 transition-all hover:-translate-y-px active:translate-y-0"
        >
          Watch Stream
        </button>
      </div>
    </div>
  )
}

// Maps a Tailwind bg class from the manifest to the legacy accent key used by SportCard
function accentFromManifest(bgClass: string): string {
  if (bgClass.includes('orange')) return 'orange';
  if (bgClass.includes('green')) return 'green';
  if (bgClass.includes('yellow') || bgClass.includes('amber')) return 'yellow';
  if (bgClass.includes('red') || bgClass.includes('rose')) return 'red';
  if (bgClass.includes('blue') || bgClass.includes('cyan') || bgClass.includes('sky')) return 'blue';
  if (bgClass.includes('purple') || bgClass.includes('violet') || bgClass.includes('indigo')) return 'purple';
  if (bgClass.includes('pink')) return 'pink';
  if (bgClass.includes('lime') || bgClass.includes('emerald') || bgClass.includes('teal')) return 'teal';
  if (bgClass.includes('stone') || bgClass.includes('zinc')) return 'zinc';
  return 'zinc';
}

const DEV_STATUS_BADGE: Record<SportDevStatus, { label: string; classes: string } | null> = {
  live: null,
  beta: { label: 'BETA', classes: 'bg-blue-500/10 text-blue-500 border border-blue-500/20' },
  'under-development': { label: 'SOON', classes: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' },
};

const LIGHT_ACCENT_BORDERS: Record<string, string> = {
  red:    'border-l-red-500',
  orange: 'border-l-orange-500',
  teal:   'border-l-teal-500',
  green:  'border-l-emerald-500',
  yellow: 'border-l-amber-500',
  blue:   'border-l-blue-500',
  purple: 'border-l-violet-500',
  pink:   'border-l-pink-500',
  zinc:   'border-l-slate-400',
};

const SportCard = ({ name, desc, icon, onClick, accent, isSelected, theme, devStatus }: any) => {
  if (theme === 'light') {
    const accentBorder = LIGHT_ACCENT_BORDERS[accent] || 'border-l-slate-400';
    const devCfg = devStatus ? DEV_STATUS_BADGE[devStatus as SportDevStatus] : null;
    const devLightTone =
      devCfg?.label === 'BETA'
        ? 'bg-cs-info/10 text-cs-info border-[0.5px] border-cs-info/30'
        : devCfg?.label === 'SOON'
          ? 'bg-cs-warning/10 text-cs-warning border-[0.5px] border-cs-warning/30'
          : 'bg-cs-elevated text-cs-text-2 border-[0.5px] border-cs-border';
    return (
      <button
        onClick={onClick}
        className={`
          bg-cs-surface border-[0.5px] border-cs-border border-l-[3px] ${accentBorder}
          text-left group transition-all duration-200 relative overflow-hidden
          h-44 cs-radius-card flex flex-col justify-between
          shadow-cs-card hover:shadow-cs-elevated hover:-translate-y-px
          ${isSelected ? 'ring-2 ring-cs-accent/25' : ''}
        `}
        style={{ paddingTop: 14, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}
      >
        {/* Ghost emoji watermark */}
        <div className="absolute bottom-2 right-3 text-[80px] opacity-[0.05] select-none pointer-events-none rotate-12 leading-none grayscale group-hover:opacity-[0.09] transition-opacity">
          {icon}
        </div>

        <div className="relative z-10 flex items-start justify-between gap-2">
          <div>
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-cs-text-3 mb-1.5">Sport</div>
            <h3 className="text-[18px] font-bold text-cs-text leading-tight tracking-tight">{name}</h3>
          </div>
          {devCfg && (
            <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 cs-pill mt-1 ${devLightTone}`}>
              {devCfg.label}
            </span>
          )}
        </div>

        <div className="relative z-10 flex flex-col gap-2.5">
          <p className="text-cs-text-2 text-[12px] leading-snug max-w-[80%]">{desc}</p>
          <span className="self-start px-3.5 h-9 inline-flex items-center bg-cs-accent text-white text-[11px] font-semibold uppercase tracking-[0.073em] cs-pill transition-colors group-hover:bg-cs-accent-pressed shadow-cs-card">
            Start Game →
          </span>
        </div>
      </button>
    );
  }

  // ── Dark mode (original) ──────────────────────────────────────────────────
  const accentConfig: any = {
    red: { border: 'group-[.is-selected]:border-red-600', text: 'group-[.is-selected]:text-red-600 dark:group-[.is-selected]:text-red-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(220,38,38,0.3)] dark:group-[.is-selected]:drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]', hoverBorder: 'hover:border-red-600', hoverText: 'group-hover:text-red-600 dark:group-hover:text-red-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(220,38,38,0.3)] dark:group-hover:drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]' },
    blue: { border: 'group-[.is-selected]:border-blue-600', text: 'group-[.is-selected]:text-blue-600 dark:group-[.is-selected]:text-blue-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(37,99,235,0.3)] dark:group-[.is-selected]:drop-shadow-[0_0_30px_rgba(37,99,235,0.8)]', hoverBorder: 'hover:border-blue-600', hoverText: 'group-hover:text-blue-600 dark:group-hover:text-blue-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(37,99,235,0.3)] dark:group-hover:drop-shadow-[0_0_30px_rgba(37,99,235,0.8)]' },
    green: { border: 'group-[.is-selected]:border-green-600', text: 'group-[.is-selected]:text-green-600 dark:group-[.is-selected]:text-green-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(22,163,74,0.3)] dark:group-[.is-selected]:drop-shadow-[0_0_30px_rgba(22,163,74,0.8)]', hoverBorder: 'hover:border-green-600', hoverText: 'group-hover:text-green-600 dark:group-hover:text-green-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(22,163,74,0.3)] dark:group-hover:drop-shadow-[0_0_30px_rgba(22,163,74,0.8)]' },
    yellow: { border: 'group-[.is-selected]:border-yellow-600', text: 'group-[.is-selected]:text-yellow-600 dark:group-[.is-selected]:text-yellow-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(202,138,4,0.3)] dark:group-[.is-selected]:drop-shadow-[0_0_30px_rgba(202,138,4,0.8)]', hoverBorder: 'hover:border-yellow-600', hoverText: 'group-hover:text-yellow-600 dark:group-hover:text-yellow-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(202,138,4,0.3)] dark:group-hover:drop-shadow-[0_0_30px_rgba(202,138,4,0.8)]' },
    orange: { border: 'group-[.is-selected]:border-orange-600', text: 'group-[.is-selected]:text-orange-600 dark:group-[.is-selected]:text-orange-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(234,88,12,0.3)] dark:group-[.is-selected]:drop-shadow-[0_0_30px_rgba(234,88,12,0.8)]', hoverBorder: 'hover:border-orange-600', hoverText: 'group-hover:text-orange-600 dark:group-hover:text-orange-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(234,88,12,0.3)] dark:group-hover:drop-shadow-[0_0_30px_rgba(234,88,12,0.8)]' },
    purple: { border: 'group-[.is-selected]:border-purple-600', text: 'group-[.is-selected]:text-purple-600 dark:group-[.is-selected]:text-purple-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(147,51,234,0.3)] dark:group-[.is-selected]:drop-shadow-[0_0_30px_rgba(147,51,234,0.8)]', hoverBorder: 'hover:border-purple-600', hoverText: 'group-hover:text-purple-600 dark:group-hover:text-purple-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(147,51,234,0.3)] dark:group-hover:drop-shadow-[0_0_30px_rgba(147,51,234,0.8)]' },
    pink: { border: 'group-[.is-selected]:border-pink-600', text: 'group-[.is-selected]:text-pink-600 dark:group-[.is-selected]:text-pink-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(219,39,119,0.3)] dark:group-[.is-selected]:drop-shadow-[0_0_30px_rgba(219,39,119,0.8)]', hoverBorder: 'hover:border-pink-600', hoverText: 'group-hover:text-pink-600 dark:group-hover:text-pink-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(219,39,119,0.3)] dark:group-hover:drop-shadow-[0_0_30px_rgba(219,39,119,0.8)]' },
    teal: { border: 'group-[.is-selected]:border-teal-600', text: 'group-[.is-selected]:text-teal-600 dark:group-[.is-selected]:text-teal-500', glow: 'group-[.is-selected]:drop-shadow-[0_0_30px_rgba(13,148,136,0.3)] dark:group-[.is-selected]:drop-shadow-[0_0_30px_rgba(13,148,136,0.8)]', hoverBorder: 'hover:border-teal-600', hoverText: 'group-hover:text-teal-600 dark:group-hover:text-teal-500', hoverGlow: 'group-hover:drop-shadow-[0_0_30px_rgba(13,148,136,0.3)] dark:group-hover:drop-shadow-[0_0_30px_rgba(13,148,136,0.8)]' },
    zinc: { border: 'group-[.is-selected]:border-zinc-500', text: 'group-[.is-selected]:text-zinc-400 dark:group-[.is-selected]:text-zinc-300', glow: 'group-[.is-selected]:drop-shadow-[0_0_20px_rgba(161,161,170,0.2)]', hoverBorder: 'hover:border-zinc-500', hoverText: 'group-hover:text-zinc-400 dark:group-hover:text-zinc-300', hoverGlow: 'group-hover:drop-shadow-[0_0_20px_rgba(161,161,170,0.2)]' },
  };
  const config = accentConfig[accent] || accentConfig.red;
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
        dark:bg-zinc-900/40 border border-zinc-800 p-6 text-left group transition-all duration-300 relative overflow-hidden h-40 flex flex-col justify-between
        ${borderClasses}
        ${isSelected ? `is-selected shadow-lg scale-[1.02]` : ''}
      `}
    >
      <div className={`absolute -top-4 -right-4 text-[120px] transition-all duration-500 rotate-12 transform-gpu backface-hidden perspective-1000 ${iconStateClass} ${glowClasses}`}>
        {icon}
      </div>
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h3 className={`text-xl font-black italic dark:text-zinc-300 transition-colors uppercase tracking-tight ${textClasses}`}>{name}</h3>
          {devStatus && DEV_STATUS_BADGE[devStatus as SportDevStatus] && (
            <span className={`shrink-0 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full mt-1 ${DEV_STATUS_BADGE[devStatus as SportDevStatus]!.classes}`}>
              {DEV_STATUS_BADGE[devStatus as SportDevStatus]!.label}
            </span>
          )}
        </div>
        <p className="dark:text-zinc-500 text-[10px] mt-1 uppercase tracking-widest font-bold leading-tight">{desc}</p>
      </div>
      <div className={`relative z-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${isSelected ? 'dark:text-white' : 'dark:text-zinc-500 dark:group-hover:text-white'} ${textClasses}`}>Initialize <span className="text-sm">→</span></div>
    </button>
  );
};

const MenuItem = ({ label, icon, onClick, active, disabled, highlight, subtitle, badge }: any) => (
  <button onClick={onClick} disabled={disabled} className={`w-full text-left flex items-center justify-between p-3 cs-radius-md dark:rounded-lg transition-all uppercase font-semibold text-[11px] tracking-[0.073em] dark:font-bold dark:text-[10px] dark:tracking-widest relative ${active ? 'bg-cs-accent-subtle text-cs-accent border-l-[3px] border-cs-accent dark:bg-zinc-800 dark:text-white dark:border-l-0' : 'text-cs-text-2 hover:text-cs-text hover:bg-cs-elevated dark:text-zinc-500 dark:hover:text-white dark:hover:bg-zinc-900'} ${disabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''} ${highlight ? 'bg-cs-warning/10 text-cs-warning hover:bg-cs-warning/15 border-[0.5px] border-cs-warning/30 dark:bg-yellow-900/10 dark:text-yellow-400 dark:hover:bg-yellow-900/20 dark:hover:text-yellow-300 dark:border dark:border-yellow-900/30' : ''}`}>
    <div className="flex items-center gap-4 flex-1 min-w-0">
      <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="truncate">{label}</div>
        {subtitle && <div className="text-[10px] text-cs-text-3 dark:text-zinc-500 mt-0.5 normal-case tracking-normal truncate font-normal dark:text-[8px]">{subtitle}</div>}
      </div>
    </div>
    {badge && <span className="ml-2 bg-cs-accent dark:bg-red-600 text-white text-[10px] px-2 py-0.5 cs-radius-sm dark:rounded-full font-bold flex-shrink-0 dark:shadow-none">{badge}</span>}
  </button>
);

const Modal = ({ title, children, onClose }: any) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/30 dark:bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
    <div className="bg-cs-overlay dark:bg-zinc-950 border-[0.5px] border-cs-border dark:border dark:border-zinc-800 w-full max-w-md relative z-10 animate-in zoom-in-95 duration-200 shadow-cs-elevated dark:shadow-2xl cs-radius-card dark:rounded-lg" style={{ paddingTop: 14, paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}>
      <div className="flex justify-between items-center mb-6 border-b-[0.5px] border-cs-border dark:border-b dark:border-zinc-800 pb-4">
        <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.3em] text-cs-text dark:font-sans dark:text-sm dark:tracking-widest dark:text-white">{title}</h3>
        <button onClick={onClose} className="text-cs-text-3 hover:text-cs-text dark:hover:text-white text-2xl transition-colors leading-none w-9 h-9 inline-flex items-center justify-center cs-pill hover:bg-cs-elevated dark:hover:bg-transparent dark:rounded-none dark:w-auto dark:h-auto">&times;</button>
      </div>
      {children}
    </div>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-zinc-900">
    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{label}</span>
    <span className="text-sm text-slate-900 dark:text-white font-mono">{value}</span>
  </div>
);

const StatusItem = ({ label, status }: { label: string; status: 'online' | 'offline' | 'local' }) => {
  const statusConfig = {
    online:  { color: 'bg-cs-success dark:bg-green-500',  text: 'Active',  textColor: 'text-cs-success dark:text-green-400' },
    offline: { color: 'bg-cs-error dark:bg-red-500',      text: 'Error',   textColor: 'text-cs-error dark:text-red-400' },
    local:   { color: 'bg-cs-warning dark:bg-yellow-500', text: 'Pending', textColor: 'text-cs-warning dark:text-yellow-400' }
  };
  const config = statusConfig[status];
  return (
    <div className="flex justify-between items-center py-3 border-b-[0.5px] border-cs-border dark:border-b dark:border-zinc-900 last:border-b-0">
      <span className="text-[12px] text-cs-text-2 dark:text-zinc-400 uppercase tracking-[0.073em] font-semibold dark:font-normal dark:text-xs dark:tracking-wider">{label}</span>
      <div className="flex items-center gap-2">
        <div className="relative"><div className={`w-2 h-2 ${config.color} rounded-full`}></div><div className={`absolute inset-0 w-2 h-2 ${config.color} rounded-full animate-ping opacity-75`}></div></div>
        <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${config.textColor} dark:text-xs dark:tracking-widest`}>{config.text}</span>
      </div>
    </div>
  );
};

// ─── PROFILE PANEL ────────────────────────────────────────────────────────────

const ProfileMenuItem: React.FC<{
  icon: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, sublabel, onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full flex items-center gap-3 px-3 py-3 cs-radius-md dark:rounded-xl hover:bg-cs-elevated dark:hover:bg-zinc-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed group"
  >
    <span className="text-base w-5 text-center text-cs-text-2 dark:text-zinc-500 group-hover:text-cs-accent dark:group-hover:text-zinc-300 transition-colors">{icon}</span>
    <div className="flex-1 text-left">
      <div className="text-[12px] font-semibold text-cs-text dark:text-zinc-400 uppercase tracking-[0.073em] group-hover:text-cs-text dark:group-hover:text-white transition-colors dark:text-[11px] dark:font-bold dark:tracking-widest">{label}</div>
      {sublabel && <div className="text-[11px] text-cs-text-3 dark:text-zinc-600 normal-case font-normal mt-0.5 dark:text-[9px]">{sublabel}</div>}
    </div>
    <span className="text-cs-text-3 dark:text-zinc-700 group-hover:text-cs-text-2 dark:group-hover:text-zinc-500 transition-colors text-sm">›</span>
  </button>
);

const ProfilePanel: React.FC<{
  user: User | null;
  theme: string;
  toggleTheme: () => void;
  myGamesCount: number;
  onClose: () => void;
  onLogout: () => void;
  onOpenModal: (m: string) => void;
}> = ({ user, theme, toggleTheme, myGamesCount, onClose, onLogout, onOpenModal }) => {
  const provider = user?.app_metadata?.provider;
  const isAnon = !user || (user as any).is_anonymous;
  const accountType = isAnon ? 'Guest' : provider === 'google' ? 'Google' : 'Email';

  const accountBadgeClass = {
    Guest:  'bg-cs-warning/10 text-cs-warning border-[0.5px] border-cs-warning/30 dark:bg-amber-900/20 dark:text-amber-400 dark:border dark:border-amber-900/40',
    Google: 'bg-cs-info/10 text-cs-info border-[0.5px] border-cs-info/30 dark:bg-sky-900/20 dark:text-sky-400 dark:border dark:border-sky-900/40',
    Email:  'bg-cs-elevated text-cs-text-2 border-[0.5px] border-cs-border dark:bg-zinc-800 dark:text-zinc-400 dark:border dark:border-zinc-700',
  }[accountType];

  const displayName = user?.user_metadata?.full_name || (user && !isAnon ? 'Operator' : 'Guest User');
  const initials = displayName[0]?.toUpperCase() || 'G';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/25 dark:bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 left-0 h-full w-[300px] bg-cs-overlay/95 backdrop-blur-xl dark:bg-zinc-950 dark:backdrop-blur-none border-r-[0.5px] border-cs-border dark:border-r dark:border-zinc-800 shadow-cs-elevated dark:shadow-[8px_0_40px_rgba(0,0,0,0.6)] z-50 flex flex-col animate-in slide-in-from-left duration-200">

        {/* ── PROFILE HEADER ── */}
        <div className="bg-cs-surface dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 border-b-[0.5px] border-cs-border dark:border-b dark:border-zinc-800">
          {/* Top bar: account type + close */}
          <div className="flex justify-between items-center px-5 pt-5 pb-3">
            <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 cs-pill dark:font-bold dark:tracking-widest dark:rounded-full ${accountBadgeClass}`}>
              {accountType}
            </span>
            <button
              onClick={onClose}
              className="w-9 h-9 inline-flex items-center justify-center cs-pill dark:rounded-full dark:w-8 dark:h-8 text-cs-text-3 hover:text-cs-text hover:bg-cs-elevated dark:text-zinc-600 dark:hover:text-white dark:hover:bg-zinc-800 transition-all text-xl leading-none"
              aria-label="Close profile"
            >
              ×
            </button>
          </div>

          {/* Avatar + name */}
          <div className="flex flex-col items-center pb-5">
            <div className="relative mb-3">
              <div className="w-[68px] h-[68px] rounded-full overflow-hidden border-[3px] border-cs-surface dark:border-zinc-900 dark:rounded-2xl shadow-cs-elevated dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                {user?.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-cs-accent to-cs-accent-pressed dark:from-red-600 dark:to-red-900 flex items-center justify-center text-white text-2xl font-black select-none">
                      {initials}
                    </div>
                }
              </div>
              <div className="absolute -bottom-1 -right-1 w-[18px] h-[18px] bg-cs-success dark:bg-green-500 border-2 border-cs-surface dark:border-zinc-950 rounded-full shadow-sm" />
            </div>

            <h2 className="text-[16px] font-bold text-cs-text dark:text-white tracking-tight px-4 text-center dark:font-black dark:text-[15px]">{displayName}</h2>
            {user?.email && (
              <p className="text-[12px] text-cs-text-2 dark:text-zinc-500 mt-1 px-6 truncate max-w-full text-center dark:text-[11px]">{user.email}</p>
            )}
          </div>

          {/* Stats strip — Oswald broadcast numerics in light, original in dark */}
          <div className="flex border-t-[0.5px] border-cs-border dark:border-t dark:border-zinc-800">
            <div className="flex-1 py-3 text-center border-r-[0.5px] border-cs-border dark:border-r dark:border-zinc-800">
              <div className="text-cs-accent dark:text-red-500 leading-none dark:text-[22px] dark:font-black dark:font-sans" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 800, fontSize: 26, fontVariantNumeric: 'tabular-nums' }}>{myGamesCount}</div>
              <div className="font-display text-[10px] text-cs-text-3 dark:text-zinc-600 uppercase tracking-[0.22em] font-bold mt-1.5 dark:font-sans dark:text-[9px] dark:tracking-widest">Active Games</div>
            </div>
            <div className="flex-1 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 bg-cs-success dark:bg-green-500 rounded-full animate-pulse shadow-[0_0_4px_rgba(34,197,94,0.5)] dark:shadow-[0_0_4px_#22c55e]" />
                <span className="font-display text-[12px] font-bold text-cs-success dark:text-green-500 leading-none uppercase tracking-[0.22em] dark:font-sans dark:font-black dark:tracking-normal dark:text-[11px]">Live</span>
              </div>
              <div className="font-display text-[10px] text-cs-text-3 dark:text-zinc-600 uppercase tracking-[0.22em] font-bold dark:font-sans dark:text-[9px] dark:tracking-widest">Server</div>
            </div>
          </div>
        </div>

        {/* ── MENU ITEMS ── */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="font-display text-[11px] font-bold text-cs-text-3 dark:text-zinc-700 uppercase tracking-[0.3em] mb-3 px-2 dark:font-sans dark:text-[9px] dark:tracking-widest dark:font-black">Account</p>
          <div className="space-y-0.5 mb-5">
            <ProfileMenuItem
              icon="↺"
              label="Match History"
              sublabel={isAnon ? 'Sign in to access' : 'View past games'}
              onClick={() => { onClose(); onOpenModal('history'); }}
              disabled={isAnon}
            />
            <ProfileMenuItem
              icon="⚙"
              label="Settings"
              sublabel="App preferences"
              onClick={() => { onClose(); onOpenModal('settings'); }}
            />
            <ProfileMenuItem
              icon="⚡"
              label="System Status"
              sublabel="Check service health"
              onClick={() => { onClose(); onOpenModal('status'); }}
            />
          </div>

          <p className="font-display text-[11px] font-bold text-cs-text-3 dark:text-zinc-700 uppercase tracking-[0.3em] mb-3 px-2 dark:font-sans dark:text-[9px] dark:tracking-widest dark:font-black">Preferences</p>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-3 cs-radius-md dark:rounded-xl bg-cs-surface dark:bg-zinc-900 border-[0.5px] border-cs-border dark:border dark:border-zinc-800 hover:border-cs-accent dark:hover:border-zinc-600 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-base w-5 text-center">{theme === 'dark' ? '🌙' : '☀️'}</span>
              <div className="text-left">
                <div className="text-[11px] font-semibold text-cs-text dark:text-white uppercase tracking-[0.073em] dark:font-bold dark:tracking-wider">Appearance</div>
                <div className="text-[11px] text-cs-text-2 dark:text-zinc-500 normal-case font-normal mt-0.5 dark:text-[10px]">
                  {theme === 'dark' ? 'Dark mode active' : 'Light mode active'}
                </div>
              </div>
            </div>
            {/* Toggle pill */}
            <div className={`relative w-10 h-[22px] rounded-full transition-all duration-300 flex-shrink-0 ${theme === 'dark' ? 'bg-zinc-700' : 'bg-cs-accent'}`}>
              <div className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${theme === 'dark' ? 'left-[3px]' : 'left-[19px]'}`} />
            </div>
          </button>
        </div>

        {/* ── FOOTER ── */}
        <div className="p-4 border-t-[0.5px] border-cs-border dark:border-t dark:border-zinc-900">
          <button
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-2 h-12 cs-pill dark:rounded-xl text-cs-error dark:text-red-500 hover:bg-cs-error/10 dark:hover:bg-red-950/30 font-semibold text-[12px] uppercase tracking-[0.073em] transition-all border-[0.5px] border-transparent hover:border-cs-error/30 dark:border dark:hover:border-red-900/30 dark:font-bold dark:text-xs dark:tracking-widest"
          >
            <span>↪</span> Sign Out
          </button>
        </div>
      </div>
    </>
  );
};