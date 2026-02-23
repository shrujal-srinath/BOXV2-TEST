// src/services/tvDisplayService.ts
//
// The "Chromecast" service layer.
// Manages TV display terminals — Pi Zero 2 devices plugged into screens.
//
// Architecture mirrors handheldService.ts exactly:
//   - tv_displays table in Supabase (not hardware_terminals)
//   - Pi has a permanent code (from URL param, set at flash time)
//   - Host "casts" a game by writing game_code to that row
//   - Pi subscribes to its own row — reacts instantly
//   - Heartbeat every 8s so dashboard can show which TVs are live

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

// ─── TV-Side: Registration & Heartbeat ───────────────────────────────────────

/**
 * Called once on TvKiosk mount.
 * Creates the row if it doesn't exist, or updates last_seen if it does.
 * The Pi's code comes from the URL param — stable across reboots.
 */
export const registerTvDisplay = async (tvCode: string): Promise<void> => {
    const { error } = await supabase
        .from('tv_displays')
        .upsert(
            {
                tv_code: tvCode.toUpperCase(),
                status: 'idle',
                last_seen: Date.now(),
            },
            { onConflict: 'tv_code', ignoreDuplicates: false }
        );

    if (error) {
        console.error('[TvDisplay] Registration failed:', error.message);
    }
};

/**
 * Sends a heartbeat every 8 seconds so the dashboard can show online status.
 * Returns a cleanup function to stop the interval.
 */
export const startTvHeartbeat = (tvCode: string): (() => void) => {
    const send = async () => {
        await supabase
            .from('tv_displays')
            .update({ last_seen: Date.now() })
            .eq('tv_code', tvCode.toUpperCase());
    };

    send(); // immediate first beat
    const interval = setInterval(send, 8000);
    return () => clearInterval(interval);
};

/**
 * Subscribe to this TV's row. Called by TvKiosk to react to cast/stop events.
 * Fires immediately with current state, then on every DB change.
 *
 * Returns unsubscribe function.
 */
export const subscribeTvDisplay = (
    tvCode: string,
    onUpdate: (display: TvDisplay) => void
): (() => void) => {
    const code = tvCode.toUpperCase();

    // Initial fetch
    supabase
        .from('tv_displays')
        .select('*')
        .eq('tv_code', code)
        .single()
        .then(({ data }) => {
            if (data) onUpdate(data as TvDisplay);
        });

    // Realtime subscription
    const channel = supabase
        .channel(`tv_display:${code}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'tv_displays',
                filter: `tv_code=eq.${code}`,
            },
            (payload) => {
                onUpdate(payload.new as TvDisplay);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

// ─── Host-Side: Cast Control ──────────────────────────────────────────────────

/**
 * Validates a TV code exists and is registered.
 * Call this before casting to give good error messages.
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
        return {
            valid: false,
            message: `No TV found with code "${tvCode.toUpperCase()}". Make sure the Pi is on and showing the holding screen.`,
        };
    }

    const display = data as TvDisplay;
    const isOnline = Date.now() - display.last_seen < 20000; // 20s threshold

    if (!isOnline) {
        return {
            valid: false,
            message: `TV "${tvCode.toUpperCase()}" is offline. Check the device is powered on.`,
        };
    }

    return { valid: true, message: 'TV found.', display };
};

/**
 * Cast a game to a TV.
 * Updates the tv_displays row — the Pi reacts instantly via Realtime.
 */
export const castGameToTv = async (
    tvCode: string,
    gameCode: string
): Promise<{ success: boolean; message: string }> => {
    const { error } = await supabase
        .from('tv_displays')
        .update({
            game_code: gameCode.toUpperCase(),
            status: 'casting',
        })
        .eq('tv_code', tvCode.toUpperCase());

    if (error) {
        return { success: false, message: 'Failed to cast. Please try again.' };
    }

    return { success: true, message: `Casting to ${tvCode.toUpperCase()}` };
};

/**
 * Stop casting — sends the Pi back to the idle holding screen.
 */
export const stopCastingToTv = async (
    tvCode: string
): Promise<void> => {
    await supabase
        .from('tv_displays')
        .update({
            game_code: null,
            status: 'idle',
        })
        .eq('tv_code', tvCode.toUpperCase());
};

/**
 * Subscribe to a TV's status from the host side.
 * Used by HostConsole to show live casting state.
 */
export const subscribeTvStatus = (
    tvCode: string,
    onUpdate: (display: TvDisplay) => void
): (() => void) => {
    return subscribeTvDisplay(tvCode, onUpdate);
};

// ─── Dashboard: List All TVs ──────────────────────────────────────────────────

/**
 * Fetch all registered TV displays.
 * Used by dashboard to show a "connected screens" panel.
 */
export const fetchAllTvDisplays = async (): Promise<TvDisplay[]> => {
    const { data, error } = await supabase
        .from('tv_displays')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as TvDisplay[];
};