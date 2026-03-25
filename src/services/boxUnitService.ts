// src/services/boxUnitService.ts
// ═══════════════════════════════════════════════════════════════
// THE BOX — Box Unit Service
//
// Manages the Pi hardware unit's identity and game assignment.
// Mirrors the tv_displays pattern exactly.
//
// Table: box_units
//   box_code    TEXT PK   — permanent 4-char device ID (e.g. "BX7K")
//   game_code   TEXT      — set by website when operator launches a game
//   status      TEXT      — 'waiting' | 'game_ready' | 'live'
//   last_seen   BIGINT    — Pi heartbeat (epoch ms)
//   created_at  TIMESTAMPTZ
//
// Flow:
//   1. Pi boots → registerBoxUnit(boxCode)
//   2. Pi shows QR → https://site.com/setup?box=BX7K
//   3. Operator configures + launches game on website
//   4. Website calls assignGameToBox(boxCode, gameCode)
//   5. Pi subscription fires → auto-load game
//
// SQL to run once in Supabase:
//   CREATE TABLE public.box_units (
//     box_code   TEXT PRIMARY KEY,
//     game_code  TEXT,
//     status     TEXT DEFAULT 'waiting',
//     last_seen  BIGINT DEFAULT 0,
//     created_at TIMESTAMPTZ DEFAULT NOW()
//   );
//   ALTER TABLE public.box_units ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "public_access" ON public.box_units FOR ALL USING (true) WITH CHECK (true);
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────

export type BoxStatus = 'waiting' | 'game_ready' | 'live';

export interface BoxUnit {
    box_code: string;
    game_code: string | null;
    status: BoxStatus;
    last_seen: number;
    created_at?: string;
}

// ─── Pi-Side ──────────────────────────────────────────────────

/**
 * Called once on OnlineSetup mount.
 * Registers the Pi's box code if new, or returns current state if existing.
 * Returns the current game_code so Pi can resume if already assigned.
 */
export const registerBoxUnit = async (
    boxCode: string
): Promise<{ game_code: string | null; status: BoxStatus }> => {
    const upper = boxCode.toUpperCase();

    const { data: existing } = await supabase
        .from('box_units')
        .select('game_code, status')
        .eq('box_code', upper)
        .maybeSingle();

    if (existing) {
        // Fire heartbeat in background
        supabase
            .from('box_units')
            .update({ last_seen: Date.now() })
            .eq('box_code', upper)
            .then(() => { });

        return {
            game_code: existing.game_code,
            status: existing.status as BoxStatus,
        };
    }

    // New device — register it
    const { error } = await supabase
        .from('box_units')
        .insert({
            box_code: upper,
            status: 'waiting',
            game_code: null,
            last_seen: Date.now(),
        });

    if (error) console.error('[BoxUnit] Register failed:', error.message);
    return { game_code: null, status: 'waiting' };
};

/**
 * Pi heartbeat — keeps the device visible as online.
 * Returns cleanup function.
 */
export const startBoxHeartbeat = (boxCode: string): (() => void) => {
    const upper = boxCode.toUpperCase();
    const send = () =>
        supabase
            .from('box_units')
            .update({ last_seen: Date.now() })
            .eq('box_code', upper)
            .then(() => { });

    send();
    const interval = setInterval(send, 8000);
    return () => clearInterval(interval);
};

/**
 * Pi subscribes to its own row via Postgres Changes (backup path).
 * Fires whenever the website assigns a game code.
 */
export const subscribeBoxUnit = (
    boxCode: string,
    onGameAssigned: (gameCode: string) => void,
    onReset: () => void,
): (() => void) => {
    const upper = boxCode.toUpperCase();

    const channel = supabase
        .channel(`box_unit_${upper}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'box_units',
                filter: `box_code=eq.${upper}`,
            },
            (payload) => {
                if (payload.eventType === 'DELETE') return;
                const row = payload.new as BoxUnit;
                if (row.game_code && row.status === 'game_ready') {
                    onGameAssigned(row.game_code);
                } else if (!row.game_code) {
                    onReset();
                }
            }
        )
        .subscribe((status, err) => {
            if (err) console.error(`[BoxUnit] Subscription error for ${upper}:`, err);
        });

    return () => { supabase.removeChannel(channel); };
};

/**
 * Pi subscribes to the fast broadcast path (~50ms).
 * Website fires this after DB write, same pattern as tv_displays.
 */
export const subscribeBoxSignal = (
    boxCode: string,
    onGameAssigned: (gameCode: string) => void,
    onReset: () => void,
): (() => void) => {
    const upper = boxCode.toUpperCase();

    const channel = supabase
        .channel(`box-signal:${upper}`)
        .on('broadcast', { event: 'game_assigned' }, (payload) => {
            const gameCode = payload?.payload?.game_code as string;
            if (gameCode) onGameAssigned(gameCode);
        })
        .on('broadcast', { event: 'reset' }, () => {
            onReset();
        })
        .subscribe((status, err) => {
            if (err) console.error(`[BoxUnit] Signal subscribe error for ${upper}:`, err);
        });

    return () => { supabase.removeChannel(channel); };
};

/**
 * Pi marks itself as live once game loads.
 */
export const markBoxLive = async (boxCode: string): Promise<void> => {
    await supabase
        .from('box_units')
        .update({ status: 'live' })
        .eq('box_code', boxCode.toUpperCase());
};

/**
 * Pi resets after game ends.
 */
export const resetBoxUnit = async (boxCode: string): Promise<void> => {
    await supabase
        .from('box_units')
        .update({ game_code: null, status: 'waiting' })
        .eq('box_code', boxCode.toUpperCase());
};

// ─── Website-Side ─────────────────────────────────────────────

/**
 * Called by GameSetup.tsx after a game is launched, when ?box= param is present.
 * Writes the game code into the box's row AND fires a broadcast for instant delivery.
 */
export const assignGameToBox = async (
    boxCode: string,
    gameCode: string
): Promise<{ success: boolean; message: string }> => {
    const upper = boxCode.toUpperCase();

    const { error } = await supabase
        .from('box_units')
        .update({
            game_code: gameCode.toUpperCase(),
            status: 'game_ready',
        })
        .eq('box_code', upper);

    if (error) {
        console.error('[BoxUnit] assignGameToBox failed:', error.message);
        return { success: false, message: error.message };
    }

    // Fast broadcast path — Pi gets this in ~50ms
    const channel = supabase.channel(`box-signal:${upper}`);
    await channel.subscribe();
    await channel.send({
        type: 'broadcast',
        event: 'game_assigned',
        payload: { game_code: gameCode.toUpperCase() },
    });
    supabase.removeChannel(channel);

    console.log(`[BoxUnit] Game ${gameCode} assigned to box ${upper}`);
    return { success: true, message: `Game assigned to BOX ${upper}` };
};

/**
 * Validate a box code exists and is online.
 */
export const validateBoxCode = async (
    boxCode: string
): Promise<{ valid: boolean; status?: BoxStatus }> => {
    const { data, error } = await supabase
        .from('box_units')
        .select('status, last_seen')
        .eq('box_code', boxCode.toUpperCase())
        .maybeSingle();

    if (error || !data) return { valid: false };

    // Consider online if heartbeat within last 30s
    const isOnline = Date.now() - data.last_seen < 30_000;
    return { valid: isOnline, status: data.status as BoxStatus };
};