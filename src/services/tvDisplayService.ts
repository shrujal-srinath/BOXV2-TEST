// src/services/tvDisplayService.ts
// ═══════════════════════════════════════════════════════════════
//  TV DISPLAY SERVICE — Full casting infrastructure
//  Pi-side: register, heartbeat, subscribe
//  Host-side: fetch all, cast, stop, subscribe to status
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
 * Upserts the TV row — creates if new, refreshes last_seen if exists.
 * Does NOT overwrite game_code or status if the row already exists and is casting.
 */
export const registerTvDisplay = async (tvCode: string): Promise<void> => {
    const upper = tvCode.toUpperCase();

    // Check existing state first — don't reset a mid-cast Pi on page refresh
    const { data: existing } = await supabase
        .from('tv_displays')
        .select('status, game_code')
        .eq('tv_code', upper)
        .single();

    const isMidCast = existing?.status === 'casting' && existing?.game_code;

    const { error } = await supabase
        .from('tv_displays')
        .upsert(
            {
                tv_code: upper,
                last_seen: Date.now(),
                // Only reset status if not mid-cast
                ...(isMidCast ? {} : { status: 'idle', game_code: null }),
            },
            { onConflict: 'tv_code', ignoreDuplicates: false }
        );

    if (error) console.error('[TvDisplay] Register failed:', error.message);
};

/**
 * Heartbeat — fires immediately then every 8 seconds.
 * Returns cleanup function.
 */
export const startTvHeartbeat = (tvCode: string): (() => void) => {
    const upper = tvCode.toUpperCase();
    const send = () =>
        supabase.from('tv_displays').update({ last_seen: Date.now() }).eq('tv_code', upper);

    send();
    const interval = setInterval(send, 8000);
    return () => clearInterval(interval);
};

/**
 * Pi subscribes to its own row.
 * React instantly when host casts or stops.
 */
export const subscribeTvDisplay = (
    tvCode: string,
    callback: (data: TvDisplay) => void
): (() => void) => {
    const upper = tvCode.toUpperCase();

    // Fetch current state immediately (catches casts that happened before subscribe)
    supabase
        .from('tv_displays')
        .select('*')
        .eq('tv_code', upper)
        .single()
        .then(({ data }) => { if (data) callback(data as TvDisplay); });

    const channel = supabase
        .channel(`tv_kiosk_${upper}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'tv_displays',
            filter: `tv_code=eq.${upper}`,
        }, payload => callback(payload.new as TvDisplay))
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

// ─── Host-Side ────────────────────────────────────────────────────────────────

/**
 * Fetch all registered TV displays.
 * Used by CastPanel to populate the screen list.
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
 * The Pi reacts instantly via Realtime subscription.
 */
export const castGameToTv = async (
    tvCode: string,
    gameCode: string
): Promise<{ success: boolean; message: string }> => {
    const upper = tvCode.toUpperCase();

    // Verify online first
    const { data } = await supabase
        .from('tv_displays')
        .select('last_seen')
        .eq('tv_code', upper)
        .single();

    if (!data || Date.now() - data.last_seen > 20000) {
        return { success: false, message: `Screen "${upper}" appears offline. Check Pi is powered on.` };
    }

    const { error } = await supabase
        .from('tv_displays')
        .update({ game_code: gameCode.toUpperCase(), status: 'casting' })
        .eq('tv_code', upper);

    if (error) return { success: false, message: 'Cast failed. Try again.' };
    return { success: true, message: `Casting to ${upper}` };
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
 * Useful when the game ends — call this from HostConsole on endGame.
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
 * Used by CastPanel for real-time card updates.
 */
export const subscribeTvStatus = (
    tvCode: string,
    callback: (data: TvDisplay) => void
): (() => void) => {
    const upper = tvCode.toUpperCase();
    const channel = supabase
        .channel(`tv_status_${upper}_${Date.now()}`)
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'tv_displays',
            filter: `tv_code=eq.${upper}`,
        }, payload => callback(payload.new as TvDisplay))
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

/**
 * Validate a TV code (used by CastModal legacy, kept for compatibility).
 */
export const validateTvCode = async (
    tvCode: string
): Promise<{ valid: boolean; message: string; display?: TvDisplay }> => {
    const { data, error } = await supabase
        .from('tv_displays')
        .select('*')
        .eq('tv_code', tvCode.toUpperCase())
        .single();

    if (error || !data) return { valid: false, message: `No screen found with code "${tvCode.toUpperCase()}".` };
    const display = data as TvDisplay;
    if (Date.now() - display.last_seen > 20000) return { valid: false, message: `Screen "${tvCode.toUpperCase()}" is offline.` };
    return { valid: true, message: 'Screen found.', display };
};