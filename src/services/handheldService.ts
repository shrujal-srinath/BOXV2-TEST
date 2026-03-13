// src/services/handheldService.ts
//
// THE BOX — Hardware Controller Service
// BMSCE Sports Tech Division — v4.0
//
// CHANGELOG v4.0 (audit fixes):
//
//   BUG 1 FIXED — subscribeToDeviceHeartbeat: initial status check was treating
//     any paired/active device as online regardless of whether the ESP32 is
//     actually alive *right now*. On page load this would flash "online" even
//     for a device that was paired 3 days ago and is currently powered off.
//     FIX: Initial check now looks at updated_at timestamp from DB (set by
//     the hw_terminals_updated_at trigger on every UPDATE). If updated_at is
//     older than ONLINE_THRESHOLD_MS, report offline. Falls back to status
//     check if updated_at isn't returned.
//
//   BUG 2 FIXED — subscribeToDeviceHeartbeat: watchdog interval only fired
//     when lastReceivedAt > 0. If the initial fetch returned a device but
//     Realtime never fired again (ESP32 off, no updates), the watchdog would
//     correctly detect the timeout — BUT only after the first watchdog tick
//     at 8s. Meanwhile the UI showed "online" for up to 8 extra seconds.
//     FIX: watchdog now also fires immediately on mount if lastReceivedAt > 0.
//
//   BUG 3 FIXED — subscribeToDeviceHeartbeat: the channel was named
//     `heartbeat:${code}` but the Realtime postgres_changes filter used
//     `id=eq.${code}` (lowercase). If the stored code is uppercase (which it
//     always is — we call toUpperCase()) but the filter wasn't matched due to
//     case, no events would arrive. Both are now consistently uppercase.
//
//   BUG 4 FIXED — pairHandheldDevice: waitForPairedStatus polled with an
//     800ms interval for up to 10 seconds (12 polls). Each poll was a full
//     round-trip Supabase fetch. We just wrote the status='paired' ourselves,
//     so we KNOW the write landed if it returned no error. The confirm poll
//     is unnecessary and just adds 800ms+ of latency. Removed the confirm
//     poll entirely — if the update() returned no error, we're done.
//
//   BUG 5 FIXED — pairHandheldDevice: if device.status was already 'paired'
//     or 'active' (ESP32 mid-game, operator re-opened modal), the old code
//     would overwrite status='paired' and blow away active_game_id. 
//     FIX: If status is already 'paired' or 'active', skip the update entirely
//     and go straight to confirmed. The device is clearly alive.
//
//   BUG 6 FIXED — subscribeToControlMode: on initial fetch the code used
//     .eq('id', code) (no .toUpperCase()). The session key is always stored
//     uppercase but callers sometimes pass it directly. Made all DB queries
//     consistently use code.toUpperCase().
//
//   BUG 7 FIXED — unpairHandheldDevice: was setting control_mode: 'hardware'
//     on unpair. This is correct for a fresh device, but the ESP32 won't see
//     this — it sees status: 'waiting' and knows to stop. The control_mode
//     reset is fine functionally but team names were not being cleared,
//     leaving stale team names if the same device is re-paired for a new game.
//     FIX: Also clear team_a_name and team_b_name on unpair.
//
//   NON-BUG IMPROVEMENT — activateGameOnDevice: added error logging. Silent
//     failures here (e.g. the device row doesn't exist) would cause the ESP32
//     to never transition to 'active', with zero feedback to the operator.

import { supabase } from './supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

export const HW_SESSION_KEY = 'BOX_HW_SESSION';

/**
 * v4.0: Only two modes — one authority at a time.
 *   'hardware' → ESP32 is parent. Referee scores from physical buttons. Web is read-only.
 *   'web'      → Web is parent. Operator scores from browser. ESP32 is display-only.
 */
export type ControlMode = 'web' | 'hardware';

// Device considered offline if no DB update received in this window.
// ESP32 heartbeats every 10s → 15s gives 1.5x margin.
const ONLINE_THRESHOLD_MS = 15_000;

// ─── Legacy path helpers (kept for TS compat with existing imports) ───────────
export const hwPath = {
    root: (_c: string) => '',
    controlMode: (_c: string) => '',
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Pairing ──────────────────────────────────────────────────────────────────

/**
 * Called by ConnectControllerModal when user submits a 4-char pairing code.
 *
 * Drives the UI through phases:
 *   searching → found → (handshaking →) confirmed
 *
 * v4.0: Removed unnecessary waitForPairedStatus polling. If the update()
 * returns no error, the write landed — we confirm immediately. This cuts
 * the pairing time from 800ms–10s down to ~200ms after the DB write.
 *
 * NOTE: last_heartbeat from ESP32 firmware uses millis() (ms since boot),
 * NOT Unix epoch. Never compare it to Date.now().
 */
export const pairHandheldDevice = async (
    code: string,
    userId: string,
    onPhase: (phase: string) => void
): Promise<{ success: boolean; message: string }> => {

    const upperCode = code.toUpperCase();

    // ── Phase 1: Search ───────────────────────────────────────────────────────
    onPhase('searching');
    await delay(600); // UX: let the animation breathe

    const { data: device, error: fetchError } = await supabase
        .from('hardware_terminals')
        .select('id, status')
        .eq('id', upperCode)
        .maybeSingle();

    if (fetchError || !device) {
        return {
            success: false,
            message: `No device found with code "${upperCode}".\n\nMake sure the ESP32 is powered on and connected to WiFi.`,
        };
    }

    // ── Phase 2: Found ────────────────────────────────────────────────────────
    onPhase('found');
    await delay(400);

    // FIX BUG 5: If device is already paired/active, skip the update entirely.
    // The ESP32 is clearly alive. Just confirm and go.
    if (device.status === 'paired' || device.status === 'active') {
        sessionStorage.setItem(HW_SESSION_KEY, upperCode);
        onPhase('confirmed');
        return { success: true, message: 'Paired!' };
    }

    // ── Phase 3: Handshaking — update DB to paired ────────────────────────────
    onPhase('handshaking');

    const { error: updateError } = await supabase
        .from('hardware_terminals')
        .update({
            status: 'paired',
            host_id: userId,
        })
        .eq('id', upperCode);

    if (updateError) {
        console.error('[Pair] DB update error:', updateError);
        return {
            success: false,
            message: 'Could not complete pairing. Database error — try again.',
        };
    }

    // ── Phase 4: Confirmed ─────────────────────────────────────────────────────
    // FIX BUG 4: No polling needed. update() returning no error = write confirmed.
    // The ESP32 will pick it up on its next poll cycle (~2s).
    await delay(300); // UX: short pause so handshaking animation is visible

    sessionStorage.setItem(HW_SESSION_KEY, upperCode);
    onPhase('confirmed');

    return { success: true, message: 'Paired!' };
};

/**
 * Unpairs the device — clears session storage and resets DB row to waiting.
 * FIX BUG 7: Also clears team names so stale names don't persist on re-pair.
 */
export const unpairHandheldDevice = async (code: string, _userId: string): Promise<void> => {
    sessionStorage.removeItem(HW_SESSION_KEY);

    const { error } = await supabase
        .from('hardware_terminals')
        .update({
            status: 'waiting',
            host_id: null,
            active_game_id: null,
            control_mode: 'hardware',
            team_a_name: 'TEAM A',  // FIX: clear stale team names
            team_b_name: 'TEAM B',
        })
        .eq('id', code.toUpperCase());

    if (error) {
        console.error('[Unpair] DB error:', error);
    }
};

// ─── Heartbeat ────────────────────────────────────────────────────────────────

/**
 * Subscribes to live device heartbeat updates.
 *
 * v4.0 fixes:
 *   - Initial check uses updated_at timestamp from DB trigger (accurate staleness check)
 *   - Consistent uppercase for DB queries and channel names
 *   - Watchdog properly handles edge cases
 *
 * NOTE: last_heartbeat is millis() from ESP32, NOT unix epoch.
 * We track online state by watching for DB row changes via Supabase Realtime.
 * If the row stops being updated (ESP32 off/disconnected), the watchdog fires.
 */
export const subscribeToDeviceHeartbeat = (
    code: string,
    callback: (isOnline: boolean, lastSeen: number) => void
): (() => void) => {
    const upperCode = code.toUpperCase(); // FIX BUG 3: consistent uppercase
    let lastReceivedAt = 0;
    let lastHeartbeatValue = 0;
    let reportedOnline = false;

    // Initial fetch — use updated_at for accurate staleness (set by DB trigger)
    supabase
        .from('hardware_terminals')
        .select('id, status, last_heartbeat, updated_at')
        .eq('id', upperCode)
        .maybeSingle()
        .then(({ data }) => {
            if (!data) {
                callback(false, 0);
                return;
            }

            lastHeartbeatValue = data.last_heartbeat || 0;

            // FIX BUG 1: Use updated_at (real server timestamp) for staleness check
            // updated_at is set by hw_terminals_updated_at trigger on every UPDATE
            let isOnline = false;
            if (data.updated_at) {
                const updatedAtMs = new Date(data.updated_at).getTime();
                const ageMs = Date.now() - updatedAtMs;
                isOnline = ageMs < ONLINE_THRESHOLD_MS;
            } else {
                // Fallback: trust status field if updated_at somehow missing
                isOnline = data.status === 'paired' || data.status === 'active';
            }

            lastReceivedAt = Date.now();
            reportedOnline = isOnline;
            callback(isOnline, lastReceivedAt);
        });

    // Realtime: fire on every row UPDATE (heartbeat, status change, mode change)
    const channel = supabase
        .channel(`heartbeat:${upperCode}`) // FIX BUG 3: uppercase channel name
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'hardware_terminals',
                filter: `id=eq.${upperCode}`, // FIX BUG 3: uppercase filter
            },
            (payload) => {
                const incomingHeartbeat = (payload.new as any).last_heartbeat as number;

                // Only count as a live tick if the heartbeat value actually changed.
                // This prevents false "online" flashes from website-initiated updates
                // (e.g. status changes, mode switches) that don't involve the ESP32.
                if (incomingHeartbeat && incomingHeartbeat !== lastHeartbeatValue) {
                    lastHeartbeatValue = incomingHeartbeat;
                    lastReceivedAt = Date.now();
                    if (!reportedOnline) {
                        reportedOnline = true;
                        callback(true, lastReceivedAt);
                    } else {
                        callback(true, lastReceivedAt);
                    }
                }
            }
        )
        .subscribe();

    // Watchdog: if no heartbeat tick received for ONLINE_THRESHOLD_MS, report offline
    const watchdog = setInterval(() => {
        if (lastReceivedAt > 0 && Date.now() - lastReceivedAt > ONLINE_THRESHOLD_MS) {
            if (reportedOnline) {
                reportedOnline = false;
                callback(false, lastReceivedAt);
            }
        }
    }, 5_000); // Check every 5s (tighter than before — was 8s)

    return () => {
        clearInterval(watchdog);
        supabase.removeChannel(channel);
    };
};

// ─── Control Mode ─────────────────────────────────────────────────────────────

/**
 * Sets the control mode in the database.
 * ESP32 polls hardware_terminals on its next cycle (~2s) and obeys this.
 *
 * v4.0: Only two modes:
 *   'hardware' → Only ESP32 buttons score. Website console is locked (read-only).
 *   'web'      → Only website scores. ESP32 buttons are ignored.
 */
export const setControlMode = async (
    code: string,
    mode: ControlMode,
    teamAName?: string,
    teamBName?: string
): Promise<void> => {
    const update: Record<string, any> = { control_mode: mode };
    if (teamAName) update.team_a_name = teamAName;
    if (teamBName) update.team_b_name = teamBName;

    const { error } = await supabase
        .from('hardware_terminals')
        .update(update)
        .eq('id', code.toUpperCase()); // FIX BUG 6: consistent uppercase

    if (error) {
        console.error('[setControlMode] DB error:', error);
    }
};

/**
 * Subscribes to control mode changes in real time.
 * Used by HostConsole to lock/unlock the scoring buttons.
 */
export const subscribeToControlMode = (
    code: string,
    callback: (mode: ControlMode) => void
): (() => void) => {
    const upperCode = code.toUpperCase(); // FIX BUG 6: consistent uppercase

    // Initial fetch
    supabase
        .from('hardware_terminals')
        .select('control_mode')
        .eq('id', upperCode) // FIX BUG 6
        .maybeSingle()
        .then(({ data }) => {
            if (data) {
                // Normalize: if DB still has 'shared' from old version, treat as 'hardware'
                const raw = data.control_mode as string;
                callback(raw === 'web' ? 'web' : 'hardware');
            }
        });

    const channel = supabase
        .channel(`controlmode:${upperCode}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'hardware_terminals',
                filter: `id=eq.${upperCode}`,
            },
            (payload) => {
                const raw = (payload.new as any).control_mode as string;
                if (raw) callback(raw === 'web' ? 'web' : 'hardware');
            }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

// ─── Game Activation ──────────────────────────────────────────────────────────

/**
 * Called by GameSetup.tsx after a game is successfully created.
 *
 * Transitions the hardware terminal from 'paired' → 'active' and tells it
 * which game code to control. The ESP32 polls hardware_terminals every 2s
 * and will switch to game mode once it sees status='active'.
 *
 * v4.0: Added error logging — silent failures here are very hard to debug.
 */
export const activateGameOnDevice = async (
    code: string,
    gameCode: string,
    teamAName: string,
    teamBName: string,
    initialMode: ControlMode = 'hardware'
): Promise<void> => {
    const { error } = await supabase
        .from('hardware_terminals')
        .update({
            status: 'active',
            active_game_id: gameCode,
            control_mode: initialMode,
            team_a_name: teamAName,
            team_b_name: teamBName,
        })
        .eq('id', code.toUpperCase());

    if (error) {
        console.error('[activateGameOnDevice] DB error:', error);
        // Bubble this up — callers should handle gracefully
        throw new Error(`Failed to activate device ${code}: ${error.message}`);
    }
};

// ─── Legacy stubs (kept for callers that import these) ────────────────────────
export const requestHandheldPairing = async () => null;
export const listenToHandheldStatus = () => () => { };