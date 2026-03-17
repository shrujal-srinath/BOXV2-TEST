// src/services/tvDisplayService.ts
// ═══════════════════════════════════════════════════════════════
//  TV DISPLAY SERVICE — Full casting infrastructure
//  Pi-side: register, heartbeat, subscribe
//  Host-side: fetch all, cast, stop, subscribe to status
//
//  ARCHITECTURE NOTE:
//  The tv_displays table is the signal bus between host and Pi.
//  Each row = one physical screen (Pi or laptop).
//  Host writes game_code + status → Pi reads via Realtime → shows game.
//
//  OWNERSHIP RULES:
//  - last_seen    → Pi owns this (heartbeat). Host may write it on CAST only
//                   (to avoid NOT NULL insert failure on new rows).
//  - game_code    → Host owns this. Pi never writes it.
//  - status       → Host owns this. Pi never writes it.
//  - tv_code      → Permanent. Set once on Pi boot. Never changes.
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TvStatus = 'idle' | 'casting' | 'offline';

export interface TvDisplay {
    tv_code: string;
    game_code: string | null;
    status: TvStatus;
    last_seen: number;
    created_at?: string;
}

// ─── Pi-Side ──────────────────────────────────────────────────────────────────

/**
 * Called once on TvKiosk mount.
 *
 * CRITICAL BEHAVIOUR:
 *   - If row ALREADY EXISTS → only update last_seen. NEVER touch game_code or status.
 *     This preserves any active cast that was set before this page loaded.
 *   - If row is NEW → insert with idle state.
 *
 * Returns current DB state so TvKiosk can immediately resume any active cast
 * without waiting for a Realtime event (which only fires on *changes*).
 */
export const registerTvDisplay = async (
    tvCode: string
): Promise<{ game_code: string | null; status: TvStatus }> => {
    const upper = tvCode.toUpperCase();

    // Check if the row already exists
    const { data: existing } = await supabase
        .from('tv_displays')
        .select('game_code, status')
        .eq('tv_code', upper)
        .maybeSingle();

    if (existing) {
        // Row exists — heartbeat-only update. Preserve cast state.
        await supabase
            .from('tv_displays')
            .update({ last_seen: Date.now() })
            .eq('tv_code', upper);
        return {
            game_code: existing.game_code,
            status: existing.status as TvStatus,
        };
    }

    // New screen — create with idle state
    const { error } = await supabase
        .from('tv_displays')
        .insert({
            tv_code: upper,
            status: 'idle',
            game_code: null,
            last_seen: Date.now(),
        });

    if (error) console.error('[TvDisplay] Register failed:', error.message);
    return { game_code: null, status: 'idle' };
};

/**
 * Heartbeat — fires immediately then every 8 seconds.
 * Returns cleanup function.
 */
export const startTvHeartbeat = (tvCode: string): (() => void) => {
    const upper = tvCode.toUpperCase();
    const send = () =>
        supabase
            .from('tv_displays')
            .update({ last_seen: Date.now() })
            .eq('tv_code', upper);

    send();
    const interval = setInterval(send, 8000);
    return () => clearInterval(interval);
};

/**
 * Pi subscribes to its own row.
 * Reacts instantly when host casts or stops.
 */
export const subscribeTvDisplay = (
    tvCode: string,
    callback: (data: TvDisplay) => void
): (() => void) => {
    const upper = tvCode.toUpperCase();

    const channel = supabase
        .channel(`tv_kiosk_${upper}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'tv_displays',
                filter: `tv_code=eq.${upper}`,
            },
            (payload) => callback(payload.new as TvDisplay)
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

// ─── Host-Side ────────────────────────────────────────────────────────────────

/**
 * Fetch all registered TV displays.
 * Used by CastModal to populate the screen list.
 */
export const fetchAllTvDisplays = async (): Promise<TvDisplay[]> => {
    const { data, error } = await supabase
        .from('tv_displays')
        .select('*')
        .order('last_seen', { ascending: false });

    if (error) {
        console.error('[TvDisplay] fetchAll failed:', error.message);
        return [];
    }
    return (data || []) as TvDisplay[];
};

/**
 * Cast a game to a TV.
 *
 * WHY last_seen is included here:
 *   The column is NOT NULL in the schema. If the TV code doesn't exist yet
 *   (host typed a code manually before the Pi booted), the upsert does an
 *   INSERT. Without last_seen the insert fails. The Pi will overwrite this
 *   value with its own clock on next heartbeat anyway (every 8s).
 *
 *   This is safe because registerTvDisplay() no longer resets game_code/status
 *   on boot — so the Pi booting after a host cast will correctly resume.
 */
export const castGameToTv = async (
    tvCode: string,
    gameCode: string
): Promise<{ success: boolean; message: string }> => {
    const upper = tvCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

    if (upper.length < 4) {
        return { success: false, message: 'Invalid screen code. Must be 4 characters.' };
    }

    const { error } = await supabase
        .from('tv_displays')
        .upsert(
            {
                tv_code: upper,
                game_code: gameCode.toUpperCase(),
                status: 'casting',
                last_seen: Date.now(), // Required for INSERT path (NOT NULL column)
            },
            { onConflict: 'tv_code', ignoreDuplicates: false }
        );

    if (error) {
        console.error('[TvDisplay] castGameToTv failed:', error.message);
        return { success: false, message: `Cast failed: ${error.message}` };
    }

    return { success: true, message: `Cast sent to ${upper}` };
};

/**
 * Stop casting — Pi returns to idle holding screen.
 */
export const stopCastingToTv = async (tvCode: string): Promise<void> => {
    await supabase
        .from('tv_displays')
        .update({ game_code: null, status: 'idle' })
        .eq('tv_code', tvCode.toUpperCase());
};

/**
 * Stop all active casts for a given game code.
 * Call this from HostConsole on game end AND on unmount.
 */
export const stopAllCastsForGame = async (gameCode: string): Promise<void> => {
    await supabase
        .from('tv_displays')
        .update({ game_code: null, status: 'idle' })
        .eq('game_code', gameCode.toUpperCase())
        .eq('status', 'casting');
};

/**
 * Subscribe to a single TV's status.
 * Used by CastModal for real-time card updates.
 */
export const subscribeTvStatus = (
    tvCode: string,
    callback: (data: TvDisplay) => void
): (() => void) => {
    const upper = tvCode.toUpperCase();
    const channel = supabase
        .channel(`tv_status_${upper}_${Date.now()}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'tv_displays',
                filter: `tv_code=eq.${upper}`,
            },
            (payload) => callback(payload.new as TvDisplay)
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

/**
 * Validate a TV code (one-time fetch).
 */
export const validateTvCode = async (
    tvCode: string
): Promise<{ valid: boolean; message: string; display?: TvDisplay }> => {
    const { data, error } = await supabase
        .from('tv_displays')
        .select('*')
        .eq('tv_code', tvCode.toUpperCase())
        .single();

    if (error || !data) {
        return { valid: false, message: `No screen found with code "${tvCode.toUpperCase()}".` };
    }

    const display = data as TvDisplay;
    if (Math.abs(Date.now() - display.last_seen) > 35_000) {
        return { valid: false, message: `Screen "${tvCode.toUpperCase()}" is offline.` };
    }

    return { valid: true, message: 'Screen found.', display };
};