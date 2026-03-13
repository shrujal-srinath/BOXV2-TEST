// src/components/ScheduleManager.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — SCHEDULE MANAGER
//
// Used inside TournamentManager.
// Admin opens this panel from any published/draft division.
// Lets them assign court + time to each fixture in bulk.
//
// Key UX decisions:
//   - Show all non-BYE fixtures as a list (round-grouped)
//   - Inline edit: click time or court cell to edit
//   - Bulk assign: "Assign all Round 1 to Court 2" type helpers
//   - Saves instantly via updateFixtureData() on blur/enter
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { TournamentFixture, Tournament } from '../types';

interface ScheduleManagerProps {
    tournament: Tournament;
    divisionId: string;
    fixtures: TournamentFixture[];
    onClose: () => void;
}

// ─── Quick time input — shows a flat text box ──────────────────────────────
const InlineEdit: React.FC<{
    value: string;
    placeholder: string;
    onSave: (val: string) => void;
    className?: string;
}> = ({ value, placeholder, onSave, className }) => {
    const [editing, setEditing] = useState(false);
    const [local, setLocal] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setLocal(value); }, [value]);

    const save = () => {
        onSave(local.trim() || placeholder);
        setEditing(false);
    };

    if (editing) return (
        <input
            ref={inputRef}
            value={local}
            onChange={e => setLocal(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className={`bg-zinc-900 border border-yellow-600 rounded px-2 py-0.5 text-white text-xs font-bold focus:outline-none w-24 ${className}`}
            autoFocus
        />
    );

    return (
        <button
            onClick={() => setEditing(true)}
            className={`text-xs font-bold text-left truncate hover:text-yellow-400 transition-colors group ${className}
                ${value && value !== 'Pending' && value !== 'Unassigned' ? 'text-white' : 'text-zinc-600'}`}
        >
            {value && value !== 'Pending' && value !== 'Unassigned' ? value : (
                <span className="italic text-zinc-700 group-hover:text-yellow-600">{placeholder}</span>
            )}
        </button>
    );
};

// ─── Court Selector ─────────────────────────────────────────────────────────
const CourtSelect: React.FC<{
    value: string;
    courts: string[];
    onChange: (val: string) => void;
}> = ({ value, courts, onChange }) => (
    <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-white text-[10px] font-black uppercase tracking-widest rounded px-2 py-1 focus:outline-none focus:border-yellow-600 transition-colors cursor-pointer"
    >
        <option value="Unassigned">— Court —</option>
        {courts.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
);

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export const ScheduleManager: React.FC<ScheduleManagerProps> = ({
    tournament,
    divisionId,
    fixtures,
    onClose,
}) => {
    const [saving, setSaving] = useState<Set<string>>(new Set());

    // Derive court options from tournament config
    const division = tournament.divisions?.[divisionId];
    const sport = division?.sport;
    const courtCount = sport ? (tournament.sportConfig as any)?.[sport]?.courts ?? 1 : 1;
    const courts = Array.from({ length: courtCount }, (_, i) => `Court ${i + 1}`);

    const nonByeFixtures = fixtures.filter(f => !f.isBye);

    // Group by round
    const rounds: Record<number, TournamentFixture[]> = {};
    nonByeFixtures.forEach(f => {
        const r = f.round ?? 1;
        if (!rounds[r]) rounds[r] = [];
        rounds[r].push(f);
    });
    const roundNums = Object.keys(rounds).map(Number).sort((a, b) => a - b);
    const totalRounds = Math.max(...roundNums, 1);

    const getRoundLabel = (r: number) => {
        if (r === totalRounds) return 'Final';
        if (r === totalRounds - 1) return 'Semi-Finals';
        if (r === totalRounds - 2) return 'Quarter-Finals';
        return `Round ${r}`;
    };

    const updateField = useCallback(async (fixtureId: string, field: 'court' | 'time', value: string) => {
        setSaving(prev => new Set(prev).add(fixtureId));
        try {
            await supabase.from('tournament_fixtures').update({ [field]: value }).eq('id', fixtureId);
        } finally {
            setSaving(prev => { const s = new Set(prev); s.delete(fixtureId); return s; });
        }
    }, []);

    // Bulk assign: set all round-N fixtures to the same court
    const bulkAssignCourt = async (roundNum: number, court: string) => {
        const toUpdate = rounds[roundNum] ?? [];
        await Promise.all(toUpdate.map(f => updateField(f.id, 'court', court)));
    };

    // Quick-fill times: evenly space round fixtures from a start time
    const [bulkStartTime, setBulkStartTime] = useState('08:00');
    const [bulkInterval, setBulkInterval] = useState(45); // minutes between games

    const applyBulkSchedule = async () => {
        let currentMinutes = parseInt(bulkStartTime.split(':')[0]) * 60 + parseInt(bulkStartTime.split(':')[1]);

        for (const rNum of roundNums) {
            for (const fixture of rounds[rNum]) {
                const h = Math.floor(currentMinutes / 60) % 24;
                const m = currentMinutes % 60;
                const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                await updateField(fixture.id, 'time', timeStr);
                currentMinutes += bulkInterval;
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl my-4">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-900">
                    <div>
                        <h2 className="text-lg font-black italic uppercase tracking-tight text-white">Schedule Matches</h2>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                            Assign courts & times — click any cell to edit
                        </p>
                    </div>
                    <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors p-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Bulk schedule tool */}
                <div className="p-4 bg-zinc-900/40 border-b border-zinc-900">
                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Quick Schedule — Auto-fill all match times</div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Start</label>
                            <input
                                type="time"
                                value={bulkStartTime}
                                onChange={e => setBulkStartTime(e.target.value)}
                                className="bg-zinc-900 border border-zinc-800 text-white text-xs font-bold rounded px-2 py-1 focus:outline-none focus:border-yellow-600"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Interval</label>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setBulkInterval(Math.max(15, bulkInterval - 15))}
                                    className="w-6 h-6 bg-zinc-800 rounded text-white text-xs hover:bg-zinc-700 transition-colors font-bold">-</button>
                                <span className="text-white font-bold text-xs w-12 text-center">{bulkInterval}m</span>
                                <button onClick={() => setBulkInterval(Math.min(180, bulkInterval + 15))}
                                    className="w-6 h-6 bg-zinc-800 rounded text-white text-xs hover:bg-zinc-700 transition-colors font-bold">+</button>
                            </div>
                        </div>
                        <button
                            onClick={applyBulkSchedule}
                            className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase text-[10px] tracking-widest rounded-lg transition-all"
                        >
                            Apply to All
                        </button>
                    </div>
                </div>

                {/* Fixture table */}
                <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto">
                    {roundNums.map(rNum => (
                        <div key={rNum}>
                            {/* Round header + bulk court */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                    {getRoundLabel(rNum)} <span className="text-zinc-700">({rounds[rNum].length} matches)</span>
                                </div>
                                {courts.length > 1 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Assign all to:</span>
                                        <CourtSelect
                                            value="Unassigned"
                                            courts={courts}
                                            onChange={val => val !== 'Unassigned' && bulkAssignCourt(rNum, val)}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="bg-zinc-900/30 rounded-xl overflow-hidden">
                                {/* Table header */}
                                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 border-b border-zinc-900">
                                    <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-700">Matchup</div>
                                    <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-700">Court</div>
                                    <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-700">Time</div>
                                    <div className="w-8" />
                                </div>

                                {rounds[rNum].map((f, idx) => (
                                    <div
                                        key={f.id}
                                        className={`grid grid-cols-[1fr_auto_auto_auto] gap-0 items-center transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-zinc-900/20'} ${f.status === 'live' ? 'bg-green-950/10' : ''} ${f.status === 'completed' ? 'opacity-50' : ''}`}
                                    >
                                        {/* Matchup */}
                                        <div className="px-4 py-2.5">
                                            <div className="text-xs font-black text-white uppercase tracking-tight">
                                                {f.teamA === 'TBD' ? <span className="text-zinc-700 italic font-normal">TBD</span> : f.teamA}
                                            </div>
                                            <div className="text-[9px] text-zinc-600 font-bold my-0.5">vs</div>
                                            <div className="text-xs font-black text-white uppercase tracking-tight">
                                                {f.teamB === 'TBD' ? <span className="text-zinc-700 italic font-normal">TBD</span> :
                                                    f.teamB === 'BYE' ? <span className="text-zinc-700 italic font-normal">BYE</span> :
                                                        f.teamB}
                                            </div>
                                        </div>

                                        {/* Court */}
                                        <div className="px-4 py-2.5">
                                            {courts.length <= 1 ? (
                                                <span className="text-[10px] text-zinc-600 font-bold">Court 1</span>
                                            ) : (
                                                <CourtSelect
                                                    value={f.court}
                                                    courts={courts}
                                                    onChange={val => updateField(f.id, 'court', val)}
                                                />
                                            )}
                                        </div>

                                        {/* Time */}
                                        <div className="px-4 py-2.5 min-w-[80px]">
                                            <InlineEdit
                                                value={f.time}
                                                placeholder="+ time"
                                                onSave={val => updateField(f.id, 'time', val)}
                                            />
                                        </div>

                                        {/* Save indicator */}
                                        <div className="w-8 flex items-center justify-center">
                                            {saving.has(f.id) && (
                                                <span className="w-3 h-3 rounded-full border border-yellow-600/50 border-t-yellow-500 animate-spin" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-900 flex items-center justify-between">
                    <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Changes save instantly</div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};