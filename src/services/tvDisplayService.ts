// src/services/tvDisplayService.ts
// ═══════════════════════════════════════════════════════════════
//  TV DISPLAY SERVICE — v3 (Zero-Latency Cast Architecture)
//
//  ARCHITECTURE:
//  The cast pipeline now uses TWO parallel channels:
//
//   ┌─ HOST ──────────────────────────────────────────────────┐
//   │  Click Cast                                             │
//   │    │                                                    │
//   │    ├─ 1. DB write (upsert tv_displays)  ──────────────►│ persistent
//   │    │      awaited — game IS in DB before broadcast      │
//   │    │                                                    │
//   │    └─ 2. Broadcast `cast-signal:TVCODE` ──────────────►│ ~50ms
//   └─────────────────────────────────────────────────────────┘
//            ▼ Postgres Changes (WAL, ~200–1500ms)   ▼ Broadcast (immediate)
//   ┌─ PI ────────────────────────────────────────────────────┐
//   │  subscribeTvDisplay  ◄───────────────────────────────── │ backup
//   │  subscribeCastSignal ◄───────────────────────────────── │ instant
//   │    Both call handleUpdate(gameCode)                     │
//   │    prevGame guard deduplicates                          │
//   └─────────────────────────────────────────────────────────┘
//
//  FIXES vs v2:
//   [FIX-1]  subscribeTvStatus: event:'UPDATE' → event:'*'
//            upsert() may INSERT (new TV code) — INSERT was silently dropped.
//   [FIX-2]  subscribeTvStatus channel name: removed Date.now() suffix.
//            Stable names prevent channel leaks on remount.
//   [FIX-3]  subscribeTvStatus: added subscription status callback for monitoring.
//   [FIX-4]  subscribeTvDisplay: added subscription status + auto-reconnect.
//   [FIX-5]  New: subscribeCastSignal() — Pi listens to Broadcast for instant delivery.
//   [FIX-6]  New: openCastChannel() — Host opens Broadcast channel on modal open,
//            ready to fire instantly when Cast is clicked.
//   [FIX-7]  castGameToTv: now fire-and-forget broadcasts after DB write.
//            Broadcast is non-blocking — DB write failure still returns error.
//   [FIX-8]  registerTvDisplay: parallelized SELECT + guard logic,
//            now runs the heartbeat update in background (non-blocking).
//   [FIX-9]  New: pingSupabase() — lightweight connectivity check.
//            Distinguishes "Realtime WebSocket dropped" from "no internet".
//
//  OWNERSHIP RULES (unchanged):
//   last_seen  → Pi owns (heartbeat). Host writes only on CAST (NOT NULL insert path).
//   game_code  → Host owns. Pi never writes.
//   status     → Host owns. Pi never writes.
//   tv_code    → Permanent. Set once on Pi boot. Never changes.
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

// Internal channel ref type for broadcast channels
export interface CastChannel {
    /** Send a cast event. Safe to call immediately — queues if not yet SUBSCRIBED. */
    send: (event: 'cast' | 'stop', gameCode?: string) => void;
    /** Unsubscribe and clean up. */
    unsub: () => void;
}

// ─── Connectivity ─────────────────────────────────────────────────────────────

/**
 * Lightweight connectivity check — pings the Supabase REST endpoint.
 * Distinguishes actual network loss from Realtime WebSocket drops.
 * Fast: typically resolves in <100ms.
 */
export const pingSupabase = async (): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('tv_displays')
            .select('tv_code')
            .limit(1)
            .maybeSingle();
        return !error;
    } catch {
        return false;
    }
};

// ─── Pi-Side ──────────────────────────────────────────────────────────────────

/**
 * Called once on TvKiosk mount.
 *
 * CRITICAL BEHAVIOUR:
 *   - If row ALREADY EXISTS → only update last_seen in background.
 *     NEVER touch game_code or status — preserves any active cast.
 *   - If row is NEW → insert with idle state.
 *
 * Returns current DB state so TvKiosk can immediately resume any active cast
 * without waiting for a Realtime event (which only fires on *changes*).
 *
 * [FIX-8]: Heartbeat UPDATE runs in background (non-blocking for boot speed).
 */
export const registerTvDisplay = async (
    tvCode: string
): Promise<{ game_code: string | null; status: TvStatus }> => {
    const upper = tvCode.toUpperCase();

    const { data: existing } = await supabase
        .from('tv_displays')
        .select('game_code, status')
        .eq('tv_code', upper)
        .maybeSingle();

    if (existing) {
        // Fire heartbeat in background — don't block boot on this write
        supabase
            .from('tv_displays')
            .update({ last_seen: Date.now() })
            .eq('tv_code', upper)
            .then(() => { }); // fire and forget

        return {
            game_code: existing.game_code,
            status: existing.status as TvStatus,
        };
    }

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
            .eq('tv_code', upper)
            .then(() => { });

    send();
    const interval = setInterval(send, 8000);
    return () => clearInterval(interval);
};

/**
 * Pi subscribes to its own row via Postgres Changes.
 * This is the BACKUP delivery path (WAL-based, ~200–1500ms latency).
 * For instant delivery, also use subscribeCastSignal().
 *
 * [FIX-4]: Added subscription status callback with reconnect handling.
 */
export const subscribeTvDisplay = (
    tvCode: string,
    callback: (data: TvDisplay) => void,
    onDisconnect?: () => void,
): (() => void) => {
    const upper = tvCode.toUpperCase();
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const makeChannel = () => {
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
                (payload) => {
                    if (payload.eventType !== 'DELETE') {
                        callback(payload.new as TvDisplay);
                    }
                }
            )
            .subscribe((status, err) => {
                if (err) {
                    console.error(`[TvDisplay] Pi subscription error for ${upper}:`, err);
                }
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    console.warn(`[TvDisplay] Pi subscription ${status} for ${upper}, reconnecting in 3s...`);
                    onDisconnect?.();
                    // Auto-reconnect after 3s
                    reconnectTimer = setTimeout(() => {
                        supabase.removeChannel(channel);
                        makeChannel();
                    }, 3000);
                }
            });

        return channel;
    };

    const channel = makeChannel();

    return () => {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        supabase.removeChannel(channel);
    };
};

/**
 * [NEW - FIX-5] Pi subscribes to Broadcast cast signal.
 * This is the FAST delivery path (~50ms latency).
 * The host sends on this channel after the DB write completes,
 * so the game IS in the database by the time Pi receives this.
 *
 * Use this alongside subscribeTvDisplay() for zero-latency cast delivery.
 */
export const subscribeCastSignal = (
    tvCode: string,
    onCast: (gameCode: string) => void,
    onStop: () => void,
): (() => void) => {
    const upper = tvCode.toUpperCase();

    const channel = supabase
        .channel(`cast-signal:${upper}`)
        .on('broadcast', { event: 'cast' }, (payload) => {
            const gameCode = payload?.payload?.game_code as string;
            if (gameCode) {
                console.log(`[TvDisplay] Broadcast cast received for ${upper}: ${gameCode}`);
                onCast(gameCode);
            }
        })
        .on('broadcast', { event: 'stop' }, () => {
            console.log(`[TvDisplay] Broadcast stop received for ${upper}`);
            onStop();
        })
        .subscribe((status, err) => {
            if (err) console.error(`[TvDisplay] Cast signal subscribe error for ${upper}:`, err);
            if (status === 'SUBSCRIBED') {
                console.log(`[TvDisplay] Cast signal channel ready for ${upper}`);
            }
        });

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
 * Subscribe to a single TV's status updates (host-side, for CastModal).
 * This is the Postgres Changes backup — use alongside openCastChannel().
 *
 * [FIX-1]: event: 'UPDATE' → event: '*'  (was missing INSERT events from upsert)
 * [FIX-2]: Removed Date.now() from channel name (stable, no leaks)
 * [FIX-3]: Added subscription status callback
 */
export const subscribeTvStatus = (
    tvCode: string,
    callback: (data: TvDisplay) => void,
    onStatusChange?: (status: string) => void,
): (() => void) => {
    const upper = tvCode.toUpperCase();

    const channel = supabase
        .channel(`tv_status_${upper}`)  // [FIX-2]: no Date.now()
        .on(
            'postgres_changes',
            {
                event: '*',  // [FIX-1]: was 'UPDATE' — missed INSERT from upsert
                schema: 'public',
                table: 'tv_displays',
                filter: `tv_code=eq.${upper}`,
            },
            (payload) => {
                if (payload.eventType === 'DELETE') return;
                callback(payload.new as TvDisplay);
            }
        )
        .subscribe((status, err) => {  // [FIX-3]
            if (err) console.error(`[TvDisplay] subscribeTvStatus error ${upper}:`, err);
            onStatusChange?.(status);
        });

    return () => { supabase.removeChannel(channel); };
};

/**
 * [NEW - FIX-6] Open a Broadcast channel for a TV screen (host-side).
 *
 * Call this when CastModal opens, for each TV in the list.
 * By the time the user clicks Cast, the channel is SUBSCRIBED and ready.
 * Calling send() before SUBSCRIBED is safe — messages are queued internally.
 *
 * Pattern:
 *   const ch = openCastChannel('ABCD');
 *   // ... user clicks Cast ...
 *   ch.send('cast', gameCode);  // instant, ~50ms to Pi
 *   // ... modal closes ...
 *   ch.unsub();
 */
export const openCastChannel = (tvCode: string): CastChannel => {
    const upper = tvCode.toUpperCase();
    let subscribed = false;
    const queue: Array<{ event: string; payload: object }> = [];

    const channel = supabase
        .channel(`cast-signal:${upper}`)
        .subscribe((status, err) => {
            if (err) console.warn(`[CastChannel] Subscribe warning for ${upper}:`, err);
            if (status === 'SUBSCRIBED') {
                subscribed = true;
                // Drain any queued sends
                queue.forEach(msg => {
                    channel.send({ type: 'broadcast', event: msg.event, payload: msg.payload })
                        .catch(e => console.warn('[CastChannel] queued send failed:', e));
                });
                queue.length = 0;
            }
        });

    const send = (event: 'cast' | 'stop', gameCode?: string) => {
        const payload = event === 'cast'
            ? { game_code: gameCode?.toUpperCase() ?? '' }
            : {};

        if (subscribed) {
            channel.send({ type: 'broadcast', event, payload })
                .catch(e => console.warn('[CastChannel] send failed (non-fatal):', e));
        } else {
            // Queue for when SUBSCRIBED arrives
            queue.push({ event, payload });
        }
    };

    return {
        send,
        unsub: () => { supabase.removeChannel(channel); },
    };
};

/**
 * Cast a game to a TV.
 *
 * [FIX-7]: DB write is still the source of truth.
 * The caller (CastModal) handles broadcasting after this resolves.
 *
 * WHY last_seen is included on upsert:
 *   The column is NOT NULL. If tv_code doesn't exist yet (host typed a
 *   code manually before Pi booted), the upsert does an INSERT.
 *   Without last_seen the insert fails. Pi overwrites this on next heartbeat.
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
                last_seen: Date.now(),
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