// src/components/stats/share/ShareComposer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Strava-style share composer: pick a template (player / game / shot art),
// a format (square / story) and which blocks to include, preview live, then
// download a PNG or native-share it. Pure-SVG cards → deterministic 1080px PNG.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import type { GameStatsData } from '../useGameStats';
import type { TeamSide } from '../types';
import { FORMAT_DIMS, type CardFormat } from './cards/shared';
import { buildPlayerCard, PLAYER_BLOCKS } from './cards/playerCard';
import { buildGameCard, GAME_BLOCKS } from './cards/gameCard';
import { buildShotArtCard, SHOTART_BLOCKS } from './cards/shotArtCard';
import { svgToPng, shareImage, downloadBlob } from './shareImage';
import { cx } from '../ui/cx';

type Template = 'player' | 'game' | 'shotart';

const slug = (s: string) => (s || 'thebox').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={cx(
      'px-3.5 py-2 rounded-full text-xs font-bold transition-colors',
      active ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
    )}
  >
    {children}
  </button>
);

interface Props {
  data: GameStatsData;
  initialTemplate?: Template;
  initialPlayerId?: string;
  onClose: () => void;
}

export const ShareComposer = ({ data, initialTemplate = 'player', initialPlayerId, onClose }: Props) => {
  const box = data.box!;
  const allPlayers = [...box.teamA.rows, ...box.teamB.rows].filter(r => !r.dnp);

  const [template, setTemplate] = useState<Template>(
    initialTemplate === 'player' && !initialPlayerId && allPlayers.length === 0 ? 'game' : initialTemplate
  );
  const [format, setFormat] = useState<CardFormat>('square');
  const [playerId, setPlayerId] = useState<string>(initialPlayerId ?? allPlayers[0]?.playerId ?? '');
  const [side, setSide] = useState<TeamSide>('A');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const blockDefs = template === 'player' ? PLAYER_BLOCKS : template === 'game' ? GAME_BLOCKS : SHOTART_BLOCKS;
  const [blocks, setBlocks] = useState<Set<string>>(new Set(blockDefs.map(b => b.id)));

  // When template changes, reset its default blocks.
  const onTemplate = (t: Template) => {
    setTemplate(t);
    const defs = t === 'player' ? PLAYER_BLOCKS : t === 'game' ? GAME_BLOCKS : SHOTART_BLOCKS;
    setBlocks(new Set(defs.map(b => b.id)));
  };

  const svg = useMemo(() => {
    try {
      if (template === 'player') return playerId ? buildPlayerCard(data, playerId, { format, blocks }) : '';
      if (template === 'game') return buildGameCard(data, { format, blocks });
      return buildShotArtCard(data, side, { format, blocks });
    } catch (e) {
      console.error('[ShareComposer] card build failed', e);
      return '';
    }
  }, [template, format, playerId, side, blocks, data]);

  const exportImage = async (mode: 'share' | 'download') => {
    if (!svg) return;
    setBusy(true);
    setStatus(null);
    try {
      const { w, h } = FORMAT_DIMS[format];
      const blob = await svgToPng(svg, w, h);
      const name = `${slug(data.gameData?.settings?.gameName ?? data.gameCode)}-${template}-${format}.png`;
      if (mode === 'download') {
        downloadBlob(blob, name);
        setStatus('Saved');
      } else {
        const res = await shareImage(blob, name, 'THE BOX');
        setStatus(res === 'shared' ? 'Shared' : res === 'downloaded' ? 'Saved' : null);
      }
    } catch (e) {
      console.error(e);
      setStatus('Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#F0EEE9] dark:bg-zinc-950 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-zinc-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Share</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800">✕</button>
        </div>

        <div className="flex flex-col md:flex-row min-h-0 flex-1">
          {/* Preview */}
          <div className="flex-1 bg-slate-200/50 dark:bg-black/40 p-5 flex items-center justify-center overflow-auto">
            {svg ? (
              <div
                className="[&>svg]:w-auto [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:max-h-[60vh] [&>svg]:rounded-xl [&>svg]:shadow-xl"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <div className="text-sm text-slate-500 dark:text-zinc-400 text-center py-16">Not available for this game.</div>
            )}
          </div>

          {/* Controls */}
          <div className="w-full md:w-72 flex-shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-zinc-800 p-4 space-y-5 overflow-y-auto">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2">Template</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={template === 'player'} onClick={() => onTemplate('player')}>Player</Chip>
                <Chip active={template === 'game'} onClick={() => onTemplate('game')}>Game</Chip>
                <Chip active={template === 'shotart'} onClick={() => onTemplate('shotart')}>Shot Art</Chip>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2">Format</p>
              <div className="flex gap-1.5">
                <Chip active={format === 'square'} onClick={() => setFormat('square')}>Square</Chip>
                <Chip active={format === 'story'} onClick={() => setFormat('story')}>Story</Chip>
              </div>
            </div>

            {template === 'player' && allPlayers.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2">Player</p>
                <select
                  value={playerId}
                  onChange={e => setPlayerId(e.target.value)}
                  aria-label="Choose player"
                  className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 outline-none"
                >
                  {allPlayers.map(p => <option key={p.playerId} value={p.playerId}>#{p.number} {p.name}</option>)}
                </select>
              </div>
            )}

            {template === 'shotart' && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2">Team</p>
                <div className="flex gap-1.5">
                  <Chip active={side === 'A'} onClick={() => setSide('A')}>{box.teamA.name}</Chip>
                  <Chip active={side === 'B'} onClick={() => setSide('B')}>{box.teamB.name}</Chip>
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2">Include</p>
              <div className="space-y-1.5">
                {blockDefs.map(b => (
                  <label key={b.id} className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={blocks.has(b.id)}
                      onChange={() => setBlocks(prev => {
                        const n = new Set(prev);
                        n.has(b.id) ? n.delete(b.id) : n.add(b.id);
                        return n;
                      })}
                      className="w-4 h-4 accent-red-600"
                    />
                    {b.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-1 space-y-2">
              <button
                onClick={() => exportImage('share')}
                disabled={busy || !svg}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
              >
                {busy ? 'Working…' : 'Share'}
              </button>
              <button
                onClick={() => exportImage('download')}
                disabled={busy || !svg}
                className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 disabled:opacity-50 text-slate-800 dark:text-zinc-100 text-sm font-bold transition-colors"
              >
                Download PNG
              </button>
              {status && <p className="text-center text-xs text-slate-500 dark:text-zinc-400">{status}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
