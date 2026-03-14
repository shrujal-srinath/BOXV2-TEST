// src/services/handheldService.ts
//
// THE BOX — Hardware Controller Service
// BMSCE Sports Tech Division — v5.0
//
// CHANGELOG v5.0 (full rewrite of pairing layer):
//
//   BREAKING CHANGE 1 — Pairing now uses pair_esp32_device() RPC instead of
//     direct SELECT → UPDATE. This is atomic, race-free, and validates
//     ownership server-side. No more "User B hijacks User A's device" bug.
//
//   BREAKING CHANGE 2 — Unpairing now uses unpair_esp32_device() RPC.
//     Server validates that the caller is the actual device owner before
//     allowing the unpair. Prevents unauthorized disconnects.
//
//   BREAKING CHANGE 3 — Game activation now uses activate_esp32_game() RPC.
//     Server validates device ownership AND game existence atomically.
//     No more "activate device on a deleted game" ghost bug.
//
//   FIX 1 — Switched from sessionStorage to localStorage with expiry.
//     Closing a tab no longer kills the pairing. On page load, we check
//     if the stored device still exists and is still paired to this user.
//     Auto-reconnect instead of "enter code again" flow.
//
//   FIX 2 — All error messages from RPCs are now surfaced to the UI.
//     The server returns structured { success, error } objects.
//
//   FIX 3 — Heartbeat subscription unchanged (was already solid in v4.0).

import { supabase } from './supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * localStorage key for persisting the paired device ID.
 * Survives tab closes, page refreshes, and browser restarts.
 * Cleared on explicit unpair or after PAIRING_EXPIRY_MS.
 */
export const HW_STORAGE_KEY = 'BOX_HW_DEVICE';

/** Also keep the old key name for backwards compat during migration */
const HW_LEGACY_KEY = 'BOX_HW_SESSION';

/** Pairing auto-expires after 12 hours (tournament day length) */
const PAIRING_EXPIRY_MS = 12 * 60 * 60 * 1000;

/**
 * v5.0: Only two modes — one authority at a time.
 *   'hardware' → ESP32 is parent. Referee scores from physical buttons. Web is read-only.
 *   'web'      → Web is parent. Operator scores from browser. ESP32 is display-only.
 */
export type ControlMode = 'web' | 'hardware';

/** Device considered offline if no DB update received in this window. */
const ONLINE_THRESHOLD_MS = 15_000;

// ─── Storage helpers (localStorage with expiry) ───────────────────────────────

interface StoredPairing {
    deviceId: string;
    pairedAt: number;
    userId: string;
}

const savePairing = (deviceId: string, userId: string): void => {
    const data: StoredPairing = {
        deviceId: deviceId.toUpperCase(),
        pairedAt: Date.now(),
        userId,
    };
    localStorage.setItem(HW_STORAGE_KEY, JSON.stringify(data));
    // Also write to legacy key so old components don't break during migration
    sessionStorage.setItem(HW_LEGACY_KEY, deviceId.toUpperCase());
};

const clearPairing = (): void => {
    localStorage.removeItem(HW_STORAGE_KEY);
    sessionStorage.removeItem(HW_LEGACY_KEY);
};

/**
 * Reads the stored pairing. Returns null if expired or missing.
 */
export const getStoredPairing = (): StoredPairing | null => {
    const raw = localStorage.getItem(HW_STORAGE_KEY);
    if (!raw) {
        // Check legacy sessionStorage for backwards compat
        const legacy = sessionStorage.getItem(HW_LEGACY_KEY);
        if (legacy) {
            return { deviceId: legacy.toUpperCase(), pairedAt: Date.now(), userId: '' };
        }
        return null;
    }
    try {
        const data: StoredPairing = JSON.parse(raw);
        // Check expiry
        if (Date.now() - data.pairedAt > PAIRING_EXPIRY_MS) {
            clearPairing();
            return null;
        }
        return data;
    } catch {
        clearPairing();
        return null;
    }
};

/**
 * Convenience getter for components that just need the device ID string.
 */
export const getDeviceId = (): string | null => {
    return getStoredPairing()?.deviceId ?? null;
};

// ─── Legacy path helpers (kept for TS compat with existing imports) ───────────
export const hwPath = {
    root: (_c: string) => '',
    controlMode: (_c: string) => '',
};

// For backwards compat — components that import HW_SESSION_KEY
export const HW_SESSION_KEY = HW_LEGACY_KEY;

// ─── Internal helpers ─────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Auto-Reconnect ───────────────────────────────────────────────────────────

/**
 * Called on app startup. Checks if a stored pairing is still valid in the DB.
 * If the device is still paired to this user, returns the device ID.
 * If not (device unpaired, deleted, or taken by someone else), clears storage.
 */
export const tryAutoReconnect = async (
    userId: string
): Promise<{ connected: boolean; deviceId: string | null }> => {
    const stored = getStoredPairing();
    if (!stored) return { connected: false, deviceId: null };

    const { data: device, error } = await supabase
        .from('hardware_terminals')
        .select('id, status, host_id')
        .eq('id', stored.deviceId)
        .maybeSingle();

    if (error || !device) {
        clearPairing();
        return { connected: false, deviceId: null };
    }

    // Device exists but is no longer ours
    if (device.host_id && device.host_id !== userId) {
        clearPairing();
        return { connected: false, deviceId: null };
    }

    // Device exists and is waiting (was auto-unpaired by staleness cron)
    if (device.status === 'waiting') {
        clearPairing();
        return { connected: false, deviceId: null };
    }

    // Still paired or active — reconnect
    return { connected: true, deviceId: stored.deviceId };
};

// ─── Pairing ──────────────────────────────────────────────────────────────────

/**
 * Pairs an ESP32 device using the atomic pair_esp32_device() RPC.
 *
 * Drives the UI through phases:
 *   searching → found → handshaking → confirmed (or error)
 *
 * v5.0: All validation happens server-side. The RPC handles:
 *   - Device existence check
 *   - Status validation (must be 'waiting')
 *   - Ownership validation (can't steal another user's device)
 *   - Atomic state transition
 *   - Audit logging
 */
export const pairHandheldDevice = async (
    code: string,
    userId: string,
    onPhase: (phase: string) => void
): Promise<{ success: boolean; message: string }> => {

    const upperCode = code.toUpperCase();

    // ── Phase 1: Search ───────────────────────────────────────────────────
    onPhase('searching');
    await delay(500); // UX: let the animation breathe

    // ── Phase 2: Found → Handshaking ──────────────────────────────────────
    onPhase('found');
    await delay(300);
    onPhase('handshaking');

    // ── Phase 3: Call the atomic pairing RPC ──────────────────────────────
    const { data, error } = await supabase.rpc('pair_esp32_device', {
        p_device_id: upperCode,
        p_user_id: userId,
    });

    if (error) {
        console.error('[Pair] RPC error:', error);
        return {
            success: false,
            message: `Pairing failed: ${error.message}`,
        };
    }

    // The RPC returns JSONB: { success, error?, device_id?, already_paired? }
    if (!data?.success) {
        return {
            success: false,
            message: data?.error || 'Unknown pairing error',
        };
    }

    // ── Phase 4: Confirmed ────────────────────────────────────────────────
    await delay(200);

    savePairing(upperCode, userId);
    onPhase('confirmed');

    if (data.already_paired) {
        return { success: true, message: 'Reconnected to your device!' };
    }

    return { success: true, message: 'Paired!' };
};

/**
 * Unpairs the device using the atomic unpair_esp32_device() RPC.
 * Server validates ownership before allowing the unpair.
 */
export const unpairHandheldDevice = async (code: string, userId: string): Promise<void> => {
    clearPairing();

    const { data, error } = await supabase.rpc('unpair_esp32_device', {
        p_device_id: code.toUpperCase(),
        p_user_id: userId,
    });

    if (error) {
        console.error('[Unpair] RPC error:', error);
        return;
    }

    if (data && !data.success) {
        console.warn('[Unpair] Server rejected:', data.error);
    }
};

// ─── Heartbeat ────────────────────────────────────────────────────────────────

/**
 * Subscribes to live device heartbeat updates.
 *
 * Online detection: watches for DB row changes via Supabase Realtime.
 * If the row stops being updated for ONLINE_THRESHOLD_MS, reports offline.
 *
 * Returns an unsubscribe function.
 */
export const subscribeToDeviceHeartbeat = (
    code: string,
    callback: (online: boolean, lastReceivedAt: number) => void
): (() => void) => {
    const upperCode = code.toUpperCase();
    let lastReceivedAt = 0;
    let lastHeartbeatValue: any = null;
    let reportedOnline = false;

    // ── Initial check: is the device alive right now? ─────────────────────
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

            // Use updated_at to determine if ESP32 is alive RIGHT NOW
            const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
            const isRecent = updatedAt > 0 && (Date.now() - updatedAt) < ONLINE_THRESHOLD_MS;

            if (isRecent && data.status !== 'waiting') {
                lastReceivedAt = Date.now();
                lastHeartbeatValue = data.last_heartbeat;
                reportedOnline = true;
                callback(true, lastReceivedAt);
            } else {
                callback(false, 0);
            }
        });

    // ── Realtime subscription: watch for heartbeat changes ────────────────
    const channel = supabase
        .channel(`heartbeat:${upperCode}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'hardware_terminals',
                filter: `id=eq.${upperCode}`,
            },
            (payload) => {
                const incomingHeartbeat = (payload.new as any).last_heartbeat;

                // Only count actual heartbeat ticks from the ESP32, not
                // website-initiated updates (status changes, mode switches).
                if (incomingHeartbeat && incomingHeartbeat !== lastHeartbeatValue) {
                    lastHeartbeatValue = incomingHeartbeat;
                    lastReceivedAt = Date.now();
                    reportedOnline = true;
                    callback(true, lastReceivedAt);
                }
            }
        )
        .subscribe();

    // ── Watchdog: detect offline if no heartbeat for ONLINE_THRESHOLD_MS ──
    const watchdog = setInterval(() => {
        if (lastReceivedAt > 0 && Date.now() - lastReceivedAt > ONLINE_THRESHOLD_MS) {
            if (reportedOnline) {
                reportedOnline = false;
                callback(false, lastReceivedAt);
            }
        }
    }, 5_000);

    return () => {
        clearInterval(watchdog);
        supabase.removeChannel(channel);
    };
};

// ─── Control Mode ─────────────────────────────────────────────────────────────

/**
 * Sets the control mode in the database.
 * This still uses direct REST update (not an RPC) because:
 *   1. The tightened RLS ensures only the device owner can update.
 *   2. It's a simple single-field write with no complex validation needed.
 *   3. Control mode switches happen frequently mid-game — RPC overhead isn't worth it.
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
        .eq('id', code.toUpperCase());

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
    const upperCode = code.toUpperCase();

    // Initial fetch
    supabase
        .from('hardware_terminals')
        .select('control_mode')
        .eq('id', upperCode)
        .maybeSingle()
        .then(({ data }) => {
            if (data) {
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
 * Activates a game on the paired device using the atomic activate_esp32_game() RPC.
 *
 * v5.0: Server validates:
 *   - Device exists and is paired to this user
 *   - Game code exists in the games table
 *   - Control mode is valid
 * All in one atomic transaction with audit logging.
 */
export const activateGameOnDevice = async (
    code: string,
    gameCode: string,
    teamAName: string,
    teamBName: string,
    initialMode: ControlMode = 'hardware',
    userId?: string
): Promise<void> => {
    // Get userId from stored pairing if not provided
    const storedUserId = userId || getStoredPairing()?.userId;
    if (!storedUserId) {
        throw new Error('No user ID available for game activation');
    }

    const { data, error } = await supabase.rpc('activate_esp32_game', {
        p_device_id: code.toUpperCase(),
        p_user_id: storedUserId,
        p_game_code: gameCode,
        p_team_a_name: teamAName,
        p_team_b_name: teamBName,
        p_control_mode: initialMode,
    });

    if (error) {
        console.error('[activateGameOnDevice] RPC error:', error);
        throw new Error(`Failed to activate device ${code}: ${error.message}`);
    }

    if (data && !data.success) {
        throw new Error(`Failed to activate device ${code}: ${data.error}`);
    }
};

// ─── Legacy stubs (kept for callers that import these) ────────────────────────
export const requestHandheldPairing = async () => null;
export const listenToHandheldStatus = () => () => { };