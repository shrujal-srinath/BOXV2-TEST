import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import type { PlayerProfile, PlayerTeam, PlayerSportStats, PlayerGameLog, PlayerLeaderboardRow } from '../types';
import {
  getMyProfile,
  getLeaderboard,
  getPlayerSportStats,
  getTeams,
  getGameLog,
  claimProfile,
  addTeam,
  removeTeam,
  subscribeToProfiles,
  searchProfiles,
} from '../services/playerService';
import { SPORT_REGISTRY } from '../sports/registry';

const SPORT_LABELS: Record<string, string> = Object.fromEntries(Object.entries(SPORT_REGISTRY).map(([id, m]) => [id, m.label]));
const SPORT_ICONS: Record<string, string>  = Object.fromEntries(Object.entries(SPORT_REGISTRY).map(([id, m]) => [id, m.icon as string]));

const TEAM_TYPE_LABELS: Record<string, string> = { college: 'College', club: 'Club', school: 'School', state: 'State', national: 'National', pickup: 'Pickup' };
const TEAM_TYPE_COLORS: Record<string, string> = {
  college: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/40',
  club:    'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200/50 dark:border-violet-800/40',
  school:  'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200/50 dark:border-green-800/40',
  state:   'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/40',
  national:'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200/50 dark:border-red-800/40',
  pickup:  'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200/50 dark:border-zinc-700/40',
};
const AVATAR_COLORS = ['bg-violet-600','bg-blue-600','bg-emerald-600','bg-orange-500','bg-rose-600','bg-cyan-600','bg-amber-500','bg-teal-600'];
const avatarColor = (name: string) => AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];

// ─── Slide definitions ────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 'leaderboard',
    label: 'Top Players',
    tag: 'Leaderboard',
    gradient: 'from-violet-600 via-violet-700 to-indigo-800',
    accent: '#7C3AED',
    dot: 'bg-violet-400',
  },
  {
    id: 'passport',
    label: 'My Passport',
    tag: 'Player Profile',
    gradient: 'from-slate-800 via-zinc-800 to-zinc-900',
    accent: '#6D28D9',
    dot: 'bg-zinc-400',
  },
  {
    id: 'stats',
    label: 'Recent Stats',
    tag: 'Game Stats',
    gradient: 'from-blue-700 via-blue-800 to-indigo-900',
    accent: '#1D4ED8',
    dot: 'bg-blue-400',
  },
  {
    id: 'heatmap',
    label: 'Activity Map',
    tag: 'Heatmap',
    gradient: 'from-orange-600 via-rose-700 to-red-800',
    accent: '#EA580C',
    dot: 'bg-orange-400',
  },
] as const;

type SlideId = typeof SLIDES[number]['id'];

// ─── Main carousel ────────────────────────────────────────────────────────────

interface Props { user: User | null }

export const PlayerPassportSection: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [myProfile, setMyProfile]   = useState<PlayerProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerLeaderboardRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<PlayerProfile | null>(null);
  const [selectedTeams, setSelectedTeams]     = useState<PlayerTeam[]>([]);
  const [selectedStats, setSelectedStats]     = useState<PlayerSportStats[]>([]);
  const [selectedLog, setSelectedLog]         = useState<PlayerGameLog[]>([]);
  const [profiles, setProfiles]               = useState<PlayerProfile[]>([]);

  // Carousel state
  const [current, setCurrent]     = useState(0);
  const [exiting, setExiting]     = useState(false);
  const [incoming, setIncoming]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const TOTAL = SLIDES.length;
  const INTERVAL = 4500;

  const isGuest = !user || (user as any).is_anonymous;

  // Data load
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [board, list] = await Promise.all([
        getLeaderboard(undefined, 20),
        searchProfiles(undefined, undefined, 40),
      ]);
      setLeaderboard(board);
      setProfiles(list);
      if (user && !isGuest) setMyProfile(await getMyProfile(user.id));
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    const unsub = subscribeToProfiles(async (fresh) => {
      setProfiles(fresh);
      if (user && !isGuest) setMyProfile(await getMyProfile(user.id));
    });
    return unsub;
  }, [user, isGuest]);

  // Auto-advance
  const goTo = useCallback((idx: number) => {
    setExiting(true);
    setTimeout(() => {
      setCurrent(idx);
      setExiting(false);
      setIncoming(true);
      setTimeout(() => setIncoming(false), 350);
    }, 220);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(prev => {
        const next = (prev + 1) % TOTAL;
        setExiting(true);
        setTimeout(() => {
          setCurrent(next);
          setExiting(false);
          setIncoming(true);
          setTimeout(() => setIncoming(false), 350);
        }, 220);
        return prev; // hold until transition done
      });
    }, INTERVAL);
  }, [TOTAL]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleDot = (i: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    goTo(i);
    // Restart timer after manual interaction
    setTimeout(startTimer, INTERVAL);
  };

  const slide = SLIDES[current];

  const contentClass = `transition-all duration-300 ease-out ${
    exiting  ? 'opacity-0 translate-y-2 scale-[0.98]' :
    incoming ? 'opacity-0 -translate-y-2 scale-[0.98]' :
               'opacity-100 translate-y-0 scale-100'
  }`;

  // Score map
  const scoreMap = new Map<string, number>();
  leaderboard.forEach(r => scoreMap.set(r.player_id, (scoreMap.get(r.player_id) ?? 0) + r.total_score));

  return (
    <section className="mb-8">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800/60">
        <span className="w-2 h-2 bg-violet-600 rounded-full flex-shrink-0" />
        <span className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">Player Passport</span>
        <span className="ml-auto bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest">
          {profiles.length} Athletes
        </span>
      </div>

      {/* 2-column layout */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">

        {/* LEFT — carousel (2/3) */}
        <div className="lg:flex-[2] min-w-0">
          <div
            className={`relative rounded-2xl bg-gradient-to-br ${slide.gradient} overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-all duration-500 h-full`}
            style={{ minHeight: 260 }}
          >
            <div className="absolute inset-0 opacity-20 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 80% 20%, white, transparent 60%)' }} />
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />

            {/* Top bar */}
            <div className="relative flex items-center justify-between px-5 pt-5 pb-0 z-10">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60 border border-white/20 px-2.5 py-1 rounded-full backdrop-blur-sm">
                {slide.tag}
              </span>
              <div className="flex items-center gap-1.5">
                {SLIDES.map((_, i) => (
                  <button key={i} onClick={() => handleDot(i)}
                    className={`rounded-full transition-all duration-300 ${i === current ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'}`}
                  />
                ))}
              </div>
            </div>

            <div className={`relative z-10 px-5 py-4 ${contentClass}`}>
              {current === 0 && <LeaderboardSlide leaderboard={leaderboard} scoreMap={scoreMap} loading={loading} />}
              {current === 1 && <PassportSlide user={user} isGuest={isGuest} profile={myProfile} loading={loading} onRegister={() => navigate('/player/register?type=self')} onViewProfile={() => myProfile && openProfileModal(myProfile)} />}
              {current === 2 && <StatsSlide profile={selectedProfile} stats={selectedStats} log={selectedLog} profiles={profiles} onSelect={openProfileModal} scoreMap={scoreMap} />}
              {current === 3 && <HeatmapSlide />}
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          </div>
        </div>

        {/* RIGHT — leaderboard mini OR profile CTA (1/3) */}
        <div className="lg:flex-[1] min-w-0">
          {!isGuest && !myProfile ? (
            /* No profile yet — show CTA */
            <div
              onClick={() => navigate('/player/register?type=self')}
              className="h-full cursor-pointer bg-white dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800 shadow-md dark:border-dashed dark:border-violet-800/60 hover:shadow-lg dark:hover:border-violet-600 rounded-2xl p-5 flex flex-col items-center justify-center text-center transition-all group"
              style={{ minHeight: 200 }}
            >
              <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">🪪</div>
              <div className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Player Passport</div>
              <div className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight italic leading-tight mb-2">
                Add Your Profile
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-600 leading-relaxed mb-4">
                Get your stats tracked across every game you play.
              </p>
              <div className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-3 rounded-xl transition-colors">
                Register
              </div>
            </div>
          ) : (
            /* Has profile or guest — show mini leaderboard */
            <MiniLeaderboard leaderboard={leaderboard} scoreMap={scoreMap} loading={loading} onViewProfile={openProfileModal} profiles={profiles} />
          )}
        </div>
      </div>

      {/* Profile modal */}
      {selectedProfile && (
        <PlayerProfileModal
          profile={selectedProfile}
          teams={selectedTeams}
          stats={selectedStats}
          gameLog={selectedLog}
          currentUser={user}
          isMyProfile={user ? selectedProfile.auth_user_id === user.id : false}
          onClose={() => { setSelectedProfile(null); setSelectedTeams([]); setSelectedStats([]); setSelectedLog([]); }}
          onClaim={async () => {
            if (!user) return;
            const ok = await claimProfile(selectedProfile.id);
            if (ok) { setMyProfile(await getMyProfile(user.id)); setSelectedProfile(null); }
          }}
          onTeamAdded={async (team) => {
            const t = await addTeam(selectedProfile.id, team);
            if (t) setSelectedTeams(prev => [t, ...prev]);
          }}
          onTeamRemoved={async (id) => {
            await removeTeam(id);
            setSelectedTeams(prev => prev.filter(t => t.id !== id));
          }}
        />
      )}
    </section>
  );

  async function openProfileModal(p: PlayerProfile) {
    setSelectedProfile(p);
    const [teams, stats, log] = await Promise.all([getTeams(p.id), getPlayerSportStats(p.id), getGameLog(p.id, 5)]);
    setSelectedTeams(teams); setSelectedStats(stats); setSelectedLog(log);
  }
};

// ─── Mini Leaderboard (right panel) ──────────────────────────────────────────

const MiniLeaderboard: React.FC<{
  leaderboard: PlayerLeaderboardRow[];
  scoreMap: Map<string, number>;
  loading: boolean;
  profiles: PlayerProfile[];
  onViewProfile: (p: PlayerProfile) => void;
}> = ({ leaderboard, scoreMap, loading, profiles, onViewProfile }) => {
  const [expanded, setExpanded] = useState(false);

  const aggregated = new Map<string, { name: string; sport_id: string; score: number; player_id: string }>();
  leaderboard.forEach(r => {
    const prev = aggregated.get(r.player_id);
    aggregated.set(r.player_id, { player_id: r.player_id, name: r.display_name || r.full_name, sport_id: r.sport_id, score: (prev?.score ?? 0) + r.total_score });
  });
  const sorted = Array.from(aggregated.values()).sort((a, b) => b.score - a.score);
  const visible = expanded ? sorted : sorted.slice(0, 5);
  const hiddenCount = sorted.length - 5;
  const MEDALS = ['🥇', '🥈', '🥉'];

  // Find profile for a player_id (to allow clicking into full modal)
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  return (
    <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🏆</span>
          <span className="text-[10px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-widest">Leaderboard</span>
        </div>
        <span className="text-[8px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
          {sorted.length} players
        </span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-3">
            {[1,2,3,4].map(i => <div key={i} className="h-9 bg-slate-100 dark:bg-zinc-800 rounded-xl animate-pulse" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-8 text-center px-4">
            <div className="text-2xl mb-2 opacity-20 grayscale">🏆</div>
            <p className="text-[9px] text-slate-400 dark:text-zinc-600 font-mono uppercase tracking-widest">No stats yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-zinc-800/50">
            {visible.map((row, i) => {
              const prof = profileMap.get(row.player_id);
              return (
                <button
                  key={row.player_id}
                  onClick={() => prof && onViewProfile(prof)}
                  disabled={!prof}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-violet-50 dark:hover:bg-zinc-800/60 transition-colors text-left group disabled:cursor-default"
                >
                  <div className="w-5 text-center flex-shrink-0">
                    {MEDALS[i]
                      ? <span className="text-sm leading-none">{MEDALS[i]}</span>
                      : <span className="text-[10px] font-black text-slate-300 dark:text-zinc-700">{i + 1}</span>
                    }
                  </div>
                  <div className={`w-7 h-7 ${avatarColor(row.name)} rounded-lg flex items-center justify-center text-white font-black text-[10px] flex-shrink-0`}>
                    {row.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {row.name}
                    </div>
                    <div className="text-[8px] text-slate-400 dark:text-zinc-600">{SPORT_ICONS[row.sport_id]} {SPORT_LABELS[row.sport_id]}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-black text-violet-600 dark:text-violet-400 tabular-nums leading-none">{row.score}</div>
                    <div className="text-[7px] text-slate-400 dark:text-zinc-600 uppercase font-bold">pts</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* View more / less */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full py-2.5 border-t border-slate-100 dark:border-zinc-800 text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-500 hover:bg-violet-50 dark:hover:bg-zinc-800/40 transition-colors"
        >
          {expanded ? 'Show Less ↑' : `View ${hiddenCount} More ↓`}
        </button>
      )}
    </div>
  );
};

// ─── Slide: Leaderboard ───────────────────────────────────────────────────────

const LeaderboardSlide: React.FC<{
  leaderboard: PlayerLeaderboardRow[];
  scoreMap: Map<string, number>;
  loading: boolean;
}> = ({ leaderboard, scoreMap, loading }) => {
  const aggregated = new Map<string, { name: string; sport_id: string; score: number; player_id: string }>();
  leaderboard.forEach(r => {
    const prev = aggregated.get(r.player_id);
    aggregated.set(r.player_id, { player_id: r.player_id, name: r.display_name || r.full_name, sport_id: r.sport_id, score: (prev?.score ?? 0) + r.total_score });
  });
  const sorted = Array.from(aggregated.values()).sort((a, b) => b.score - a.score).slice(0, 5);
  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <h3 className="text-white font-black italic text-2xl uppercase tracking-tight leading-tight mb-1">Top Athletes</h3>
      <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-4">All-time leaderboard</p>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-white/10 rounded-xl animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest">No stats yet — play games to populate</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((row, i) => (
            <div key={row.player_id} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/10">
              <span className="text-lg w-6 text-center flex-shrink-0">{MEDALS[i] ?? <span className="text-[11px] font-black text-white/40">{i + 1}</span>}</span>
              <div className={`w-7 h-7 ${avatarColor(row.name)} rounded-lg flex items-center justify-center text-white font-black text-[10px] flex-shrink-0 shadow-sm`}>
                {row.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-black text-[12px] uppercase tracking-tight truncate">{row.name}</div>
                <div className="text-white/40 text-[8px]">{SPORT_ICONS[row.sport_id]} {SPORT_LABELS[row.sport_id]}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-white font-black text-base tabular-nums leading-none">{row.score}</div>
                <div className="text-white/40 text-[8px] uppercase font-bold">pts</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Slide: Passport ──────────────────────────────────────────────────────────

const PassportSlide: React.FC<{
  user: User | null; isGuest: boolean; profile: PlayerProfile | null;
  loading: boolean; onRegister: () => void; onViewProfile: () => void;
}> = ({ user, isGuest, profile, loading, onRegister, onViewProfile }) => {
  if (loading) return (
    <div className="space-y-3">
      <div className="h-16 bg-white/10 rounded-2xl animate-pulse" />
      <div className="h-8 bg-white/10 rounded-xl animate-pulse w-2/3" />
    </div>
  );

  if (isGuest) return (
    <div className="py-2">
      <h3 className="text-white font-black italic text-2xl uppercase tracking-tight leading-tight mb-1">Your Passport</h3>
      <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-5">Player profile & stats</p>
      <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-4">
        <p className="text-white/70 text-xs leading-relaxed mb-3">Sign in to claim your Player Passport and have your stats tracked across every game.</p>
        <div className="text-[9px] font-black text-white/50 uppercase tracking-widest">Sign in to continue →</div>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="py-2">
      <h3 className="text-white font-black italic text-2xl uppercase tracking-tight leading-tight mb-1">Your Passport</h3>
      <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-5">Not registered yet</p>
      <button onClick={onRegister} className="w-full py-3 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all">
        + Register as a Player
      </button>
    </div>
  );

  const name = profile.display_name || profile.full_name;
  return (
    <div className="py-2">
      <div className="flex items-center gap-4 mb-4">
        {profile.profile_photo_url ? (
          <img src={profile.profile_photo_url} alt={name} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30 flex-shrink-0" />
        ) : (
          <div className={`w-14 h-14 ${avatarColor(profile.full_name)} rounded-2xl flex items-center justify-center text-white font-black text-xl border-2 border-white/20 flex-shrink-0 shadow-lg`}>
            {name[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-white font-black italic text-xl uppercase tracking-tight leading-tight truncate">{name}</div>
          <div className="text-white/50 text-[9px] font-mono mt-0.5">{profile.player_code}</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {profile.sport_ids.slice(0, 3).map(s => (
              <span key={s} className="text-[8px] font-bold uppercase tracking-widest bg-white/15 text-white/80 border border-white/20 px-2 py-0.5 rounded-full">
                {SPORT_ICONS[s]} {SPORT_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
      </div>
      {profile.college_name && (
        <div className="text-white/40 text-[10px] mb-3 flex items-center gap-1.5">
          <span>🏫</span><span className="truncate">{profile.college_name}</span>
        </div>
      )}
      <button onClick={onViewProfile} className="w-full py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
        View Full Passport →
      </button>
    </div>
  );
};

// ─── Slide: Stats ─────────────────────────────────────────────────────────────

const StatsSlide: React.FC<{
  profile: PlayerProfile | null;
  stats: PlayerSportStats[];
  log: PlayerGameLog[];
  profiles: PlayerProfile[];
  scoreMap: Map<string, number>;
  onSelect: (p: PlayerProfile) => void;
}> = ({ profile, stats, log, profiles, scoreMap, onSelect }) => {
  if (!profile) return (
    <div>
      <h3 className="text-white font-black italic text-2xl uppercase tracking-tight leading-tight mb-1">Player Stats</h3>
      <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-4">Tap a player to inspect</p>
      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
        {profiles.slice(0, 5).map(p => {
          const name = p.display_name || p.full_name;
          const pts = scoreMap.get(p.id) ?? 0;
          return (
            <button key={p.id} onClick={() => onSelect(p)}
              className="w-full flex items-center gap-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2 transition-all text-left">
              <div className={`w-7 h-7 ${avatarColor(p.full_name)} rounded-lg flex items-center justify-center text-white font-black text-[10px] flex-shrink-0`}>{name[0]?.toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-[11px] uppercase tracking-tight truncate">{name}</div>
                <div className="text-white/40 text-[8px]">{p.sport_ids.slice(0,2).map(s => SPORT_ICONS[s]).join(' ')}</div>
              </div>
              {pts > 0 && <span className="text-white font-black text-sm tabular-nums flex-shrink-0">{pts}<span className="text-white/40 text-[8px] ml-0.5">pt</span></span>}
              <span className="text-white/30 text-sm flex-shrink-0">›</span>
            </button>
          );
        })}
        {profiles.length === 0 && <p className="text-white/30 text-[10px] font-mono text-center py-4 uppercase tracking-widest">No athletes registered yet</p>}
      </div>
    </div>
  );

  const name = profile.display_name || profile.full_name;
  const totalGames = stats.reduce((s, r) => s + r.games_played, 0);
  const totalPts   = stats.reduce((s, r) => s + r.total_score, 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${avatarColor(profile.full_name)} rounded-xl flex items-center justify-center text-white font-black flex-shrink-0`}>{name[0]?.toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-black italic text-lg uppercase tracking-tight truncate">{name}</div>
          <div className="text-white/40 text-[9px] font-mono">{profile.player_code}</div>
        </div>
        <div className="flex gap-4 flex-shrink-0">
          {[{ v: totalGames, l: 'games' }, { v: totalPts, l: 'pts' }].map(({ v, l }) => (
            <div key={l} className="text-center">
              <div className="text-white font-black text-lg tabular-nums leading-none">{v}</div>
              <div className="text-white/40 text-[7px] uppercase tracking-widest">{l}</div>
            </div>
          ))}
        </div>
      </div>
      {stats.length > 0 ? (
        <div className="space-y-1.5">
          {stats.slice(0, 3).map(row => (
            <div key={row.id} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2">
              <span className="text-base">{SPORT_ICONS[row.sport_id]}</span>
              <div className="flex-1 text-white font-bold text-[10px] uppercase tracking-wide">{SPORT_LABELS[row.sport_id] || row.sport_id}</div>
              <span className="text-white/50 text-[9px] tabular-nums font-mono">{row.games_played}g</span>
              <span className="text-white font-black text-sm tabular-nums w-10 text-right">{row.total_score}<span className="text-white/40 text-[8px] ml-0.5">pt</span></span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center bg-white/10 rounded-xl">
          <p className="text-white/40 text-[9px] font-mono uppercase tracking-widest">No stats recorded yet</p>
        </div>
      )}
    </div>
  );
};

// ─── Slide: Heatmap ───────────────────────────────────────────────────────────

const HeatmapSlide: React.FC = () => {
  const weeks = 20; const days = 7;
  const grid = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: days }, (_, d) => {
      const s = ((w * 7 + d + 1) * 2654435761) >>> 0;
      const v = s % 100;
      return v > 75 ? (v > 90 ? 3 : v > 82 ? 2 : 1) : 0;
    })
  );
  const colors = ['bg-white/10', 'bg-orange-400/50', 'bg-orange-400/75', 'bg-orange-400'];

  return (
    <div>
      <h3 className="text-white font-black italic text-2xl uppercase tracking-tight leading-tight mb-1">Activity Map</h3>
      <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-4">Games played over time</p>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {grid.map((week, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {week.map((val, d) => (
              <div key={d} className={`w-3 h-3 rounded-[3px] ${colors[val]}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-white/30 text-[8px]">Less</span>
        {colors.map((c, i) => <div key={i} className={`w-2.5 h-2.5 rounded-sm ${c} border border-white/10`} />)}
        <span className="text-white/30 text-[8px]">More</span>
        <span className="ml-auto text-white/20 text-[8px] font-mono">Full data coming soon</span>
      </div>
    </div>
  );
};

// ─── Player Profile Modal ─────────────────────────────────────────────────────

interface TeamDraft { team_type: PlayerTeam['team_type']; team_name: string; jersey_number: string; position: string; role: PlayerTeam['role']; season_from: string; season_to: string; }
const emptyTeam = (): TeamDraft => ({ team_type: 'college', team_name: '', jersey_number: '', position: '', role: 'player', season_from: '', season_to: '' });
const inputCls = 'w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 focus:border-violet-400 dark:focus:border-violet-700 text-slate-900 dark:text-white text-xs px-3 py-2.5 rounded-lg focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 transition-colors';
const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
);

const PlayerProfileModal: React.FC<{
  profile: PlayerProfile; teams: PlayerTeam[]; stats: PlayerSportStats[]; gameLog: PlayerGameLog[];
  currentUser: User | null; isMyProfile: boolean;
  onClose: () => void; onClaim: () => void;
  onTeamAdded: (t: Omit<PlayerTeam, 'id' | 'player_id' | 'created_at'>) => void;
  onTeamRemoved: (id: string) => void;
}> = ({ profile, teams, stats, gameLog, currentUser, isMyProfile, onClose, onClaim, onTeamAdded, onTeamRemoved }) => {
  const [addingTeam, setAddingTeam] = useState(false);
  const [newTeam, setNewTeam] = useState<TeamDraft>(emptyTeam());

  const isGuest = !currentUser || (currentUser as any).is_anonymous;
  const canClaim = !isGuest && !profile.auth_user_id;
  const canManageTeams = isMyProfile || (!isGuest && currentUser?.id === profile.registered_by);
  const name = profile.display_name || profile.full_name;
  const totalGames = stats.reduce((s, r) => s + r.games_played, 0);
  const totalPts   = stats.reduce((s, r) => s + r.total_score, 0);
  const activeTeams = teams.filter(t => t.is_active);

  const submitNewTeam = () => {
    if (!newTeam.team_name.trim()) return;
    onTeamAdded({ team_type: newTeam.team_type, team_name: newTeam.team_name.trim(), jersey_number: newTeam.jersey_number.trim() || null, position: newTeam.position.trim() || null, role: newTeam.role, season_from: newTeam.season_from.trim() || null, season_to: newTeam.season_to.trim() || null, is_active: true });
    setAddingTeam(false); setNewTeam(emptyTeam());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-lg relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Hero */}
        <div className="bg-gradient-to-br from-violet-600 to-violet-900 p-6 relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 75% 50%, white, transparent 60%)' }} />
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl leading-none z-10">&times;</button>
          <div className="flex items-start gap-4 relative">
            {profile.profile_photo_url
              ? <img src={profile.profile_photo_url} alt={name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 flex-shrink-0" />
              : <div className={`w-16 h-16 ${avatarColor(profile.full_name)} rounded-2xl flex items-center justify-center text-white font-black text-2xl border-2 border-white/20 flex-shrink-0`}>{name[0]?.toUpperCase()}</div>
            }
            <div className="flex-1 min-w-0">
              <div className="font-black italic text-white text-xl uppercase tracking-tight leading-tight">{name}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] font-mono font-bold text-violet-200">{profile.player_code}</span>
                {profile.jersey_number && <span className="text-[10px] text-violet-300 font-mono">#{profile.jersey_number}</span>}
                {isMyProfile && <span className="text-[8px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">You</span>}
                {profile.is_verified && <span className="text-[8px] font-bold bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full uppercase tracking-widest">✓ Verified</span>}
              </div>
              {activeTeams.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {activeTeams.slice(0, 2).map(t => <span key={t.id} className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${TEAM_TYPE_COLORS[t.team_type]}`}>{TEAM_TYPE_LABELS[t.team_type]} · {t.team_name}</span>)}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-6 mt-4 relative">
            {[{ v: totalGames, l: 'Games' }, { v: totalPts, l: 'Points' }, { v: profile.sport_ids.length, l: 'Sports' }].map(({ v, l }) => (
              <div key={l} className="text-center">
                <div className="text-xl font-black text-white tabular-nums leading-none">{v}</div>
                <div className="text-[9px] text-violet-300 uppercase tracking-widest font-bold mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {(profile.college_name || profile.height_cm || profile.date_of_birth) && (
            <div className="grid grid-cols-2 gap-2.5">
              {profile.college_name && <InfoCard label="College" value={profile.college_name} />}
              {profile.usn && <InfoCard label="USN" value={profile.usn} mono />}
              {profile.college_roll_no && <InfoCard label="Roll No." value={profile.college_roll_no} mono />}
              {profile.date_of_birth && <InfoCard label="DOB" value={new Date(profile.date_of_birth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />}
              {profile.height_cm && <InfoCard label="Height" value={`${profile.height_cm} cm`} />}
              {profile.weight_kg && <InfoCard label="Weight" value={`${profile.weight_kg} kg`} />}
              {profile.primary_position && <InfoCard label="Position" value={profile.primary_position} />}
              {profile.dominant_hand && <InfoCard label="Hand" value={profile.dominant_hand.charAt(0).toUpperCase() + profile.dominant_hand.slice(1)} />}
            </div>
          )}
          {profile.bio && <div><div className="text-[9px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest mb-1.5">Bio</div><p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{profile.bio}</p></div>}
          {profile.sport_ids.length > 0 && (
            <div>
              <div className="text-[9px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest mb-2">Sports</div>
              <div className="flex flex-wrap gap-1.5">
                {profile.sport_ids.map(s => <span key={s} className="text-[9px] font-bold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border border-violet-200/50 dark:border-violet-800/40 px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">{SPORT_ICONS[s]} {SPORT_LABELS[s] || s}</span>)}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest">Teams</div>
              {canManageTeams && !addingTeam && <button onClick={() => setAddingTeam(true)} className="text-[9px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">+ Add Team</button>}
            </div>
            {teams.length === 0 && !addingTeam && <p className="text-[10px] text-slate-400 dark:text-zinc-600 font-mono">No teams on record.</p>}
            <div className="space-y-2">
              {teams.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${TEAM_TYPE_COLORS[t.team_type]}`}>{TEAM_TYPE_LABELS[t.team_type]}</span>
                      <span className="text-[11px] font-bold text-slate-900 dark:text-white">{t.team_name}</span>
                      {t.jersey_number && <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500">#{t.jersey_number}</span>}
                    </div>
                    <div className="text-[9px] text-slate-400 dark:text-zinc-600 mt-0.5">{[t.position, t.role?.replace('_',' '), t.season_from && `${t.season_from}${t.season_to ? ` → ${t.season_to}` : ' →'}`].filter(Boolean).join(' · ')}</div>
                  </div>
                  {canManageTeams && <button onClick={() => onTeamRemoved(t.id)} className="text-slate-300 hover:text-red-500 dark:text-zinc-700 dark:hover:text-red-400 text-lg leading-none ml-3 transition-colors">×</button>}
                </div>
              ))}
              {addingTeam && (
                <div className="bg-slate-50 dark:bg-zinc-900 border border-violet-200 dark:border-violet-900/40 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Type" required><select value={newTeam.team_type} onChange={e => setNewTeam(p => ({ ...p, team_type: e.target.value as any }))} className={inputCls}>{Object.entries(TEAM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                    <Field label="Team Name" required><input value={newTeam.team_name} onChange={e => setNewTeam(p => ({ ...p, team_name: e.target.value }))} placeholder="e.g. BMSCE Basketball" className={inputCls} autoFocus /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Jersey #"><input value={newTeam.jersey_number} onChange={e => setNewTeam(p => ({ ...p, jersey_number: e.target.value }))} placeholder="#23" className={`${inputCls} font-mono`} maxLength={4} /></Field>
                    <Field label="Season"><input value={newTeam.season_from} onChange={e => setNewTeam(p => ({ ...p, season_from: e.target.value }))} placeholder="2024-25" className={inputCls} /></Field>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setAddingTeam(false); setNewTeam(emptyTeam()); }} className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                    <button onClick={submitNewTeam} className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest text-white bg-violet-700 hover:bg-violet-600 rounded-lg transition-colors">Add Team</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {stats.length > 0 && (
            <div>
              <div className="text-[9px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest mb-2">Stats by Sport</div>
              <div className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-200 dark:border-zinc-800"><th className="text-left px-3 py-2 text-[9px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest">Sport</th><th className="text-right px-3 py-2 text-[9px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest">Games</th><th className="text-right px-3 py-2 text-[9px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest">Points</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">{stats.map(row => <tr key={row.id} className="hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"><td className="px-3 py-2.5 flex items-center gap-1.5 font-bold text-slate-700 dark:text-zinc-300 uppercase text-[10px] tracking-wide"><span>{SPORT_ICONS[row.sport_id]}</span>{SPORT_LABELS[row.sport_id] || row.sport_id}</td><td className="px-3 py-2.5 text-right font-mono font-bold text-slate-700 dark:text-zinc-300">{row.games_played}</td><td className="px-3 py-2.5 text-right font-mono font-black text-violet-600 dark:text-violet-400">{row.total_score}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          {gameLog.length > 0 && (
            <div>
              <div className="text-[9px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest mb-2">Recent Games</div>
              <div className="space-y-1.5">
                {gameLog.map(g => (
                  <div key={g.id} className="flex items-center justify-between bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{SPORT_ICONS[g.sport_id] || '🎮'}</span>
                      <div><div className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">{SPORT_LABELS[g.sport_id] || g.sport_id}</div><div className="text-[9px] font-mono text-slate-400 dark:text-zinc-600">{g.game_code} · {g.team_name ?? `Team ${g.team_side}`}</div></div>
                    </div>
                    <div className="text-right">
                      {g.score_contribution > 0 && <div className="text-sm font-black text-violet-600 dark:text-violet-400 tabular-nums">{g.score_contribution}<span className="text-[9px] text-slate-400 dark:text-zinc-600 ml-1 font-bold">pts</span></div>}
                      <div className="text-[8px] text-slate-400 dark:text-zinc-600">{new Date(g.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stats.length === 0 && <div className="py-5 text-center bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 rounded-lg"><p className="text-[10px] text-slate-400 dark:text-zinc-600 font-mono uppercase tracking-widest">No stats recorded yet.</p></div>}
          {canClaim
            ? <button onClick={onClaim} className="w-full py-3 bg-violet-700 hover:bg-violet-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_2px_8px_rgba(109,40,217,0.25)]">🪪 This Is Me — Claim Passport</button>
            : <button onClick={onClose} className="w-full py-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold uppercase tracking-widest rounded-xl transition-colors">Close</button>
          }
        </div>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 rounded-lg px-3 py-2.5">
    <div className="text-[8px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest mb-0.5">{label}</div>
    <div className={`text-[11px] font-bold text-slate-700 dark:text-zinc-300 truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>
);
