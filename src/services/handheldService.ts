// src/services/handheldService.ts
//
// Real implementation replacing all stubs.
// Uses Supabase Postgres for pairing state + Realtime for live subscriptions.

import { supabase } from './supabase';

export const HW_SESSION_KEY = 'BOX_HW_SESSION';
export type ControlMode = 'web' | 'hardware' | 'shared';

// ─── Pairing ──────────────────────────────────────────────────────────────────

/**
 * Called by ConnectControllerModal when user submits a 4-char code.
 * Drives the handshake phases: searching → found → handshaking → confirmed
 */
export const pairHandheldDevice = async (
    code: string,
    userId: string,
    onPhase: (phase: string) => void
): Promise<{ success: boolean; message: string }> => {

    // Phase 1: Search for the device in the DB
    onPhase('searching');
    await delay(600);

    const { data, error } = await supabase
        .from('hardware_terminals')
        .select('id, status')
        .eq('id', code.toUpperCase())
        .single();

    if (error || !data) {
        return { success: false, message: `No device found with code "${code}". Make sure the ESP32 is on and connected to WiFi.` };
    }

    // Phase 2: Device found — update it to paired status
    onPhase('found');
    await delay(500);

    onPhase('handshaking');

    const { error: updateError } = await supabase
        .from('hardware_terminals')
        .update({
            status: 'paired',
            host_id: userId,
        })
        .eq('id', code.toUpperCase());

    if (updateError) {
        return { success: false, message: 'Could not complete pairing. Try again.' };
    }

    // Phase 3: Wait for ESP32 to confirm (it polls and updates last_heartbeat)
    // We wait up to 8 seconds for a fresh heartbeat
    const confirmed = await waitForHeartbeat(code.toUpperCase(), 8000);

    if (!confirmed) {
        // Rollback
        await supabase
            .from('hardware_terminals')
            .update({ status: 'waiting', host_id: null })
            .eq('id', code.toUpperCase());
        return { success: false, message: 'ESP32 did not respond. Check the device display and try again.' };
    }

    // Save to session
    sessionStorage.setItem(HW_SESSION_KEY, code.toUpperCase());
    onPhase('confirmed');

    return { success: true, message: 'Paired!' };
};

/**
 * Waits up to `timeoutMs` for the ESP32 to send a fresh heartbeat.
 * Polls every 500ms. Returns true if heartbeat received.
 */
const waitForHeartbeat = async (code: string, timeoutMs: number): Promise<boolean> => {
    const start = Date.now();
    const threshold = Date.now() - 3000; // heartbeat must be within last 3s

    while (Date.now() - start < timeoutMs) {
        await delay(500);
        const { data } = await supabase
            .from('hardware_terminals')
            .select('last_heartbeat')
            .eq('id', code)
            .single();

        if (data && data.last_heartbeat > threshold) {
            return true;
        }
    }
    return false;
};

/**
 * Unpairs the device — clears session and resets DB row.
 */
export const unpairHandheldDevice = async (code: string, _userId: string): Promise<void> => {
    sessionStorage.removeItem(HW_SESSION_KEY);
    await supabase
        .from('hardware_terminals')
        .update({
            status: 'waiting',
            host_id: null,
            active_game_id: null,
            control_mode: 'hardware',
        })
        .eq('id', code.toUpperCase());
};

// ─── Heartbeat ────────────────────────────────────────────────────────────────

/**
 * Subscribes to live heartbeat changes via Supabase Realtime Postgres Changes.
 * Calls callback with (isOnline: boolean, lastSeen: timestamp).
 * Device is considered online if heartbeat was < 12 seconds ago.
 */
export const subscribeToDeviceHeartbeat = (
    code: string,
    callback: (isOnline: boolean, lastSeen: number) => void
): (() => void) => {
    const ONLINE_THRESHOLD_MS = 12000;

    // Initial fetch
    supabase
        .from('hardware_terminals')
        .select('last_heartbeat')
        .eq('id', code)
        .single()
        .then(({ data }) => {
            if (data) {
                const ts = data.last_heartbeat;
                callback(Date.now() - ts < ONLINE_THRESHOLD_MS, ts);
            }
        });

    const channel = supabase
        .channel(`heartbeat:${code}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'hardware_terminals', filter: `id=eq.${code}` },
            (payload) => {
                const ts = (payload.new as any).last_heartbeat;
                callback(Date.now() - ts < ONLINE_THRESHOLD_MS, ts);
            }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

// ─── Control Mode ─────────────────────────────────────────────────────────────

/**
 * Sets the control mode in DB. ESP32 polls this and obeys.
 */
export const setControlMode = async (
    code: string,
    mode: ControlMode,
    teamAName?: string,
    teamBName?: string
): Promise<void> => {
    await supabase
        .from('hardware_terminals')
        .update({
            control_mode: mode,
            team_a_name: teamAName,
            team_b_name: teamBName,
        })
        .eq('id', code.toUpperCase());
};

/**
 * Subscribes to control mode changes in real time.
 */
export const subscribeToControlMode = (
    code: string,
    callback: (mode: ControlMode) => void
): (() => void) => {
    // Initial fetch
    supabase
        .from('hardware_terminals')
        .select('control_mode')
        .eq('id', code)
        .single()
        .then(({ data }) => {
            if (data) callback(data.control_mode as ControlMode);
        });

    const channel = supabase
        .channel(`controlmode:${code}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'hardware_terminals', filter: `id=eq.${code}` },
            (payload) => {
                callback((payload.new as any).control_mode as ControlMode);
            }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

// ─── Game Activation ──────────────────────────────────────────────────────────

/**
 * Called by GameSetup after game is created.
 * Tells the ESP32 which game it's now controlling.
 */
export const activateGameOnDevice = async (
    code: string,
    gameCode: string,
    teamAName: string,
    teamBName: string,
    initialMode: ControlMode = 'hardware'
): Promise<void> => {
    await supabase
        .from('hardware_terminals')
        .update({
            status: 'active',
            active_game_id: gameCode,
            control_mode: initialMode,
            team_a_name: teamAName,
            team_b_name: teamBName,
        })
        .eq('id', code.toUpperCase());
};

// ─── Legacy stubs (kept for TS compatibility) ─────────────────────────────────
export const requestHandheldPairing = async () => null;
export const listenToHandheldStatus = () => () => { };
export const hwPath = { root: (_c: string) => '', controlMode: (_c: string) => '' };

// ─── Util ─────────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));