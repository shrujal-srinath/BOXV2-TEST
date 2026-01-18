import React from 'react';
import type { Player } from '../types';

interface PlayerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  color: string;
  players: Player[];
  onSelectPlayer: (playerId: string) => void;
  actionLabel: string;
}

export const PlayerSelectModal: React.FC<PlayerSelectModalProps> = ({
  isOpen, onClose, teamName, color, players, onSelectPlayer, actionLabel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 w-full max-w-2xl shadow-2xl overflow-hidden border border-zinc-700">
        
        {/* Broadcast Header Style */}
        <div className="flex h-24">
          <div className="w-4 h-full" style={{ backgroundColor: color }}></div>
          <div className="flex-1 bg-white p-4 flex flex-col justify-center">
            <h3 className="text-zinc-500 text-xs font-bold tracking-[0.2em] uppercase">Attribution Required</h3>
            <div className="flex justify-between items-end">
              <h2 className="text-4xl font-black text-black italic uppercase tracking-tighter leading-none">
                {teamName}
              </h2>
              <div className="bg-black text-white px-4 py-1 text-lg font-bold uppercase tracking-widest">
                {actionLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Player Grid */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto bg-zinc-900">
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPlayer(p.id)}
              className="flex items-center gap-3 p-3 bg-black border border-zinc-800 hover:border-white hover:bg-zinc-800 transition-all group text-left"
            >
              <span className="text-3xl font-mono font-bold text-zinc-500 group-hover:text-white transition-colors" style={{ color: color }}>
                {p.number}
              </span>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-zinc-400 group-hover:text-white uppercase truncate">{p.name}</div>
                <div className="text-[10px] text-zinc-600 font-mono">{p.position}</div>
              </div>
            </button>
          ))}
          
          {players.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-800 text-zinc-600 text-xs uppercase tracking-widest">
              No Roster Data Available
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-black border-t border-zinc-800 flex justify-between gap-4">
          <button 
             onClick={() => onSelectPlayer('anonymous')}
             className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-widest border border-zinc-800"
          >
            Skip Player Attribution
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-3 text-red-500 hover:text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-950/30"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};