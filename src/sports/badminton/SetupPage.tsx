// src/sports/badminton/SetupPage.tsx
// Badminton match configuration — 2-step setup flow.
// Design: matches GameSetup.tsx — centered card, zinc palette, rounded-2xl.

import React, { useState, useEffect } from 'react';
import { subscribeToAuth } from '../../services/authService';
import { initializeGenericGame } from '../../services/supabaseGameService';
import { SplashScreen } from '../../components/SplashScreen';
import type { SportSetupPageProps } from '../../core/types/Manifest';

const TEAM_COLORS = [
  '#DC2626', '#2563EB', '#16A34A', '#F59E0B',
  '#FFFFFF', '#9333EA', '#EA580C', '#000000',
];

type MatchType = 'singles' | 'doubles';
interface PlayerEntry { id: string; name: string; }
const makePlayer = (): PlayerEntry => ({ id: `p-${Date.now()}-${Math.random()}`, name: '' });

// ── Color Picker ──────────────────────────────────────────────────────────────

const ColorPalette = ({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) => (
  <div className="flex gap-3 mt-4 justify-between">
    {TEAM_COLORS.map(c => (
      <button
        key={c}
        type="button"
        aria-label={`Select color ${c}`}
        onClick={() => onSelect(c)}
        className={`w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
          ${selected === c ? 'scale-110 ring-2 ring-offset-2 ring-white ring-offset-black' : 'opacity-40 hover:opacity-100'}
        `}
        style={{ backgroundColor: c, border: c === '#000000' ? '1px solid #52525b' : 'none' }}
      />
    ))}
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

export const BadmintonSetupPage: React.FC<SportSetupPageProps> = ({ onLaunch, onBack }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [launching, setLaunching] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [launchedCode, setLaunchedCode] = useState('');

  // Step 1 — Rules
  const [matchTitle, setMatchTitle] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('singles');
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [pointsPerGame, setPointsPerGame] = useState(21);

  // Step 2 — Teams
  const [nameA, setNameA] = useState('');
  const [colorA, setColorA] = useState(TEAM_COLORS[0]);
  const [nameB, setNameB] = useState('');
  const [colorB, setColorB] = useState(TEAM_COLORS[1]);
  const [playersA, setPlayersA] = useState<PlayerEntry[]>([makePlayer()]);
  const [playersB, setPlayersB] = useState<PlayerEntry[]>([makePlayer()]);

  useEffect(() => {
    const unsub = subscribeToAuth(u => setUserId(u?.id ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    const slots = matchType === 'doubles' ? 2 : 1;
    const sync = (prev: PlayerEntry[]) => {
      const next = [...prev];
      while (next.length < slots) next.push(makePlayer());
      return next.slice(0, slots);
    };
    setPlayersA(sync);
    setPlayersB(sync);
  }, [matchType]);

  const launch = async () => {
    if (!userId) { alert('Not signed in.'); return; }
    setLaunching(true);
    setGameReady(false);
    try {
      const gamesToWin = bestOf === 3 ? 2 : 3;
      const code = await initializeGenericGame({
        gameName: matchTitle.trim() || 'BADMINTON MATCH',
        sportId: 'badminton',
        rules: { gamesToWin, pointsToWin: pointsPerGame },
        settings: { matchType, gamesToWin, pointsToWin: pointsPerGame },
        initialState: {
          gameRunning: false,
          scoreA: 0, scoreB: 0,
          gamesWonA: 0, gamesWonB: 0,
          currentGame: 1,
          serviceSide: 'A',
        },
        teamA: {
          name: nameA.trim() || (matchType === 'singles' ? 'PLAYER A' : 'SIDE A'),
          color: colorA,
          players: playersA.map((p, i) => ({
            id: p.id,
            name: p.name.trim().toUpperCase() || `PLAYER ${i + 1}`,
            number: `${i + 1}`,
            position: matchType === 'singles' ? 'S' : 'D',
            points: 0, fouls: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0,
            turnovers: 0, disqualified: false, fieldGoalsMade: 0, fieldGoalsAttempted: 0,
            threePointsMade: 0, threePointsAttempted: 0, freeThrowsMade: 0, freeThrowsAttempted: 0,
          })),
        },
        teamB: {
          name: nameB.trim() || (matchType === 'singles' ? 'PLAYER B' : 'SIDE B'),
          color: colorB,
          players: playersB.map((p, i) => ({
            id: p.id,
            name: p.name.trim().toUpperCase() || `PLAYER ${i + 1}`,
            number: `${i + 1}`,
            position: matchType === 'singles' ? 'S' : 'D',
            points: 0, fouls: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0,
            turnovers: 0, disqualified: false, fieldGoalsMade: 0, fieldGoalsAttempted: 0,
            threePointsMade: 0, threePointsAttempted: 0, freeThrowsMade: 0, freeThrowsAttempted: 0,
          })),
        },
        hostId: userId,
      });
      setLaunchedCode(code);
      setTimeout(() => setGameReady(true), 800);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
      setLaunching(false);
    }
  };

  if (launching) {
    return <SplashScreen isReady={gameReady} onComplete={() => onLaunch(launchedCode)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col h-[90vh] max-h-[800px] bg-zinc-900 border border-zinc-800 shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 flex justify-between items-center shrink-0 bg-zinc-950 border-b border-zinc-800">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all text-xl active:scale-95 cursor-pointer bg-zinc-900 border border-zinc-700 text-zinc-400 hover:bg-white hover:text-black hover:border-white"
              aria-label="Go back"
            >
              ←
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase italic leading-none text-white">
                Badminton Config
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mt-1">
                {step === 1 ? 'Step 1: Match Settings' : 'Step 2: Players & Teams'}
              </p>
            </div>
          </div>

          {step === 2 && (
            <button
              type="button"
              onClick={launch}
              disabled={!userId}
              className="px-8 py-3 rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
            >
              Launch Console →
            </button>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-black/20">

          {/* ── STEP 1: Match Settings ────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-6 max-w-2xl mx-auto">

              {/* Match title */}
              <section className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2 text-zinc-400">
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full" /> Match Details
                </h2>
                <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">
                  Match Title
                </label>
                <input
                  type="text"
                  value={matchTitle}
                  onChange={e => setMatchTitle(e.target.value)}
                  placeholder="E.G. MEN'S SINGLES FINAL"
                  className="w-full p-4 text-base font-bold outline-none rounded-lg transition-all uppercase bg-black border border-zinc-800 text-white placeholder-zinc-700 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                />
              </section>

              {/* Match type */}
              <section className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2 text-zinc-400">
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" /> Match Type
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { val: 'singles' as MatchType, icon: '🧍', label: 'Singles', sub: '1 player per side' },
                    { val: 'doubles' as MatchType, icon: '👥', label: 'Doubles', sub: '2 players per side' },
                  ]).map(({ val, icon, label, sub }) => (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={matchType === val}
                      onClick={() => setMatchType(val)}
                      className={`p-4 rounded-xl text-left border transition-all cursor-pointer active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white
                        ${matchType === val ? 'border-white bg-white/5' : 'border-zinc-800 hover:border-zinc-600'}
                      `}
                    >
                      <div className="text-2xl mb-2">{icon}</div>
                      <div className="text-sm font-black uppercase tracking-wider text-white">{label}</div>
                      <div className="text-[10px] text-zinc-500 mt-1">{sub}</div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Format & scoring */}
              <section className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2 text-zinc-400">
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" /> Format & Scoring
                </h2>

                <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-3 uppercase">Format</label>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {([
                    { val: 3 as const, label: 'Best of 3', sub: 'First to 2 games' },
                    { val: 5 as const, label: 'Best of 5', sub: 'First to 3 games' },
                  ]).map(({ val, label, sub }) => (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={bestOf === val}
                      onClick={() => setBestOf(val)}
                      className={`p-4 rounded-xl text-left border transition-all cursor-pointer active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white
                        ${bestOf === val ? 'border-white bg-white/5' : 'border-zinc-800 hover:border-zinc-600'}
                      `}
                    >
                      <div className="text-sm font-black uppercase tracking-wider text-white">{label}</div>
                      <div className="text-[10px] text-zinc-500 mt-1">{sub}</div>
                    </button>
                  ))}
                </div>

                <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-3 uppercase">Points Per Game</label>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {([21, 15, 11] as const).map(pts => (
                    <button
                      key={pts}
                      type="button"
                      aria-pressed={pointsPerGame === pts}
                      onClick={() => setPointsPerGame(pts)}
                      className={`p-4 rounded-xl text-center border transition-all cursor-pointer active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white
                        ${pointsPerGame === pts ? 'border-white bg-white/5' : 'border-zinc-800 hover:border-zinc-600'}
                      `}
                    >
                      <div className="text-2xl font-black text-white">{pts}</div>
                      {pts === 21 && <div className="text-[10px] text-zinc-500 mt-1">BWF Standard</div>}
                    </button>
                  ))}
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    <span className="text-zinc-400 font-bold">BWF Rules:</span>{' '}
                    Deuce at {pointsPerGame - 1}–{pointsPerGame - 1}. Win by 2 pts. Hard cap {pointsPerGame + 9}.
                    Service transfers when the receiving side wins the rally.
                  </p>
                </div>
              </section>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-sm shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                Next: Players & Teams →
              </button>
            </div>
          )}

          {/* ── STEP 2: Players & Teams ───────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(['A', 'B'] as const).map(side => {
                  const name = side === 'A' ? nameA : nameB;
                  const setName = side === 'A' ? setNameA : setNameB;
                  const color = side === 'A' ? colorA : colorB;
                  const setColor = side === 'A' ? setColorA : setColorB;
                  const players = side === 'A' ? playersA : playersB;
                  const setPlayers = side === 'A' ? setPlayersA : setPlayersB;

                  return (
                    <section key={side} className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 flex flex-col gap-5">
                      {/* Side header */}
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" style={{ background: color }} />
                        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Side {side}</h2>
                      </div>

                      {/* Name */}
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">
                          {matchType === 'singles' ? 'Player Name' : 'Team Name'}
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder={matchType === 'singles' ? `PLAYER ${side}` : `SIDE ${side}`}
                          className="w-full p-4 text-base font-bold outline-none rounded-lg transition-all uppercase bg-black border border-zinc-800 text-white placeholder-zinc-700 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                        />
                      </div>

                      {/* Color */}
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 tracking-widest block uppercase">Color</label>
                        <ColorPalette selected={color} onSelect={setColor} />
                      </div>

                      {/* Player names */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-zinc-500 tracking-widest block uppercase">
                          {matchType === 'singles' ? 'Full Name' : 'Player Names'}
                        </label>
                        {players.map((p, i) => (
                          <input
                            key={p.id}
                            type="text"
                            value={p.name}
                            onChange={e => {
                              const next = [...players];
                              next[i] = { ...next[i], name: e.target.value };
                              setPlayers(next);
                            }}
                            placeholder={`Player ${i + 1} name`}
                            className="w-full p-3 text-sm font-bold outline-none rounded-lg transition-all uppercase bg-black border border-zinc-800 text-white placeholder-zinc-700 focus:border-zinc-500"
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              {/* Match summary strip */}
              <div className="grid grid-cols-3 gap-px bg-zinc-800 rounded-xl overflow-hidden">
                {[
                  { label: 'Type', value: matchType === 'singles' ? 'Singles' : 'Doubles' },
                  { label: 'Format', value: `Best of ${bestOf}` },
                  { label: 'Points', value: `${pointsPerGame} pts` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-zinc-900 py-4 px-4 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
                    <p className="font-black text-white text-sm">{value}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold uppercase tracking-widest text-center transition-colors cursor-pointer py-2"
              >
                ← Back to Match Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
