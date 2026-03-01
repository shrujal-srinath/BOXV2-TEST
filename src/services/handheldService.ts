// src/services/handheldService.ts
//
// THE BOX — Hardware Controller Service
// BMSCE Sports Tech Division
//
// Handles all communication between the website and the ESP32 physical controller.
// Uses Supabase Postgres for persistent pairing state + Realtime for live subscriptions.
//
// Flow:
//   1. ESP32 boots → registers itself in hardware_terminals with its 4-char pairing code
//   2. Operator enters code on website → pairHandheldDevice() runs the handshake
//   3. Game launches → activateGameOnDevice() tells ESP32 which game to control
//   4. During game → ESP32 sends Broadcast signals → useHardwareSignaling picks them up
//   5. Control mode can be switched anytime: hardware | web
//
// v3.0 — Simplified to 2 modes only (removed 'shared' mode)
//   - 'hardware': ESP32 buttons are active, web console is locked (read-only)
//   - 'web': Web console is active, ESP32 buttons are ignored (display-only)
//   One authority at a time. No race conditions. No sync nightmares.

import { supabase } from './supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

export const HW_SESSION_KEY = 'BOX_HW_SESSION';

/**
 * v3.0: Only two modes — one authority at a time.
 *   'hardware' → ESP32 is parent. Ref scores from physical buttons. Web is read-only.
 *   'web'      → Web is parent. Operator scores from browser. ESP32 is display-only.
 */
export type ControlMode = 'web' | 'hardware';

// How long without a heartbeat before we consider the device offline
const ONLINE_THRESHOLD_MS = 15000;

// ─── Legacy path helpers (kept for TS compat with existing imports) ────────────
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
 *   searching → found → handshaking → confirmed
 *
 * The "handshake" is lightweight: we check the DB row exists and is reachable.
 * The ESP32 proves it's alive by having registered (upserted) its row on boot.
 * We don't wait for a live heartbeat tick — we just verify the row is in
 * 'paired' status, which we set ourselves during the handshake step.
 *
 * NOTE: last_heartbeat from ESP32 firmware uses millis() (ms since boot),
 * NOT Unix epoch. So we never compare it to Date.now(). We use status field instead.
 */
export const pairHandheldDevice = async (
    code: string,
    userId: string,
    onPhase: (phase: string) => void
): Promise<{ success: boolean; message: string }> => {

    const upperCode = code.toUpperCase();

    // ── Phase 1: Search ───────────────────────────────────────────────────────
    onPhase('searching');
    await delay(700);

    const { data: device, error: fetchError } = await supabase
        .from('hardware_terminals')
        .select('id, status')
        .eq('id', upperCode)
        .single();

    if (fetchError || !device) {
        return {
            success: false,
            message: `No device found with code "${upperCode}".\n\nMake sure the ESP32 is powered on and connected to WiFi.`,
        };
    }

    // ── Phase 2: Found ────────────────────────────────────────────────────────
    onPhase('found');
    await delay(500);

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
        return {
            success: false,
            message: 'Could not complete pairing. Database error — try again.',
        };
    }

    // ── Phase 4: Confirm — verify the row is now in paired state ──────────────
    const confirmed = await waitForPairedStatus(upperCode, 10000);

    if (!confirmed) {
        // Rollback
        await supabase
            .from('hardware_terminals')
            .update({ status: 'waiting', host_id: null })
            .eq('id', upperCode);

        return {
            success: false,
            message: 'Pairing confirmation failed. The ESP32 may have disconnected. Check the device and try again.',
        };
    }

    // ── Success ───────────────────────────────────────────────────────────────
    sessionStorage.setItem(HW_SESSION_KEY, upperCode);
    onPhase('confirmed');

    return { success: true, message: 'Paired!' };
};

/**
 * Polls Supabase until the terminal row has status='paired' (our own write confirmed)
 * OR until timeout. Returns true on success.
 */
const waitForPairedStatus = async (code: string, timeoutMs: number): Promise<boolean> => {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        await delay(800);

        const { data } = await supabase
            .from('hardware_terminals')
            .select('id, status')
            .eq('id', code)
            .single();

        if (data && (data.status === 'paired' || data.status === 'active')) {
            return true;
        }
    }

    return false;
};

/**
 * Unpairs the device — clears session storage and resets DB row to waiting.
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
 * Calls callback with (isOnline: boolean, lastSeen: number).
 *
 * IMPORTANT: ESP32 sends last_heartbeat as millis() (uptime in ms, NOT Unix epoch).
 * We cannot compare it to Date.now(). Instead, we track when WE last received
 * an update from Supabase — if an update arrived within ONLINE_THRESHOLD_MS, it's online.
 */
export const subscribeToDeviceHeartbeat = (
    code: string,
    callback: (isOnline: boolean, lastSeen: number) => void
): (() => void) => {

    let lastReceivedAt = 0;

    supabase
        .from('hardware_terminals')
        .select('id, status, last_heartbeat')
        .eq('id', code)
        .single()
        .then(({ data }) => {
            if (data) {
                const isOnline = data.status === 'paired' || data.status === 'active';
                lastReceivedAt = Date.now();
                callback(isOnline, lastReceivedAt);
            } else {
                callback(false, 0);
            }
        });

    const channel = supabase
        .channel(`heartbeat:${code}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'hardware_terminals',
                filter: `id=eq.${code}`,
            },
            (_payload) => {
                lastReceivedAt = Date.now();
                callback(true, lastReceivedAt);
            }
        )
        .subscribe();

    const watchdog = setInterval(() => {
        if (lastReceivedAt > 0 && Date.now() - lastReceivedAt > ONLINE_THRESHOLD_MS) {
            callback(false, lastReceivedAt);
        }
    }, 8000);

    return () => {
        clearInterval(watchdog);
        supabase.removeChannel(channel);
    };
};

// ─── Control Mode ─────────────────────────────────────────────────────────────

/**
 * Sets the control mode in the database.
 * ESP32 polls hardware_terminals on its next cycle and obeys this.
 *
 * v3.0: Only two modes:
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

    await supabase
        .from('hardware_terminals')
        .update(update)
        .eq('id', code.toUpperCase());
};

/**
 * Subscribes to control mode changes in real time.
 * Used by HostConsole to lock/unlock the scoring buttons.
 */
export const subscribeToControlMode = (
    code: string,
    callback: (mode: ControlMode) => void
): (() => void) => {

    supabase
        .from('hardware_terminals')
        .select('control_mode')
        .eq('id', code)
        .single()
        .then(({ data }) => {
            if (data) {
                // Normalize: if DB still has 'shared' from old version, treat as 'hardware'
                const raw = data.control_mode as string;
                callback(raw === 'web' ? 'web' : 'hardware');
            }
        });

    const channel = supabase
        .channel(`controlmode:${code}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'hardware_terminals',
                filter: `id=eq.${code}`,
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

// ─── Legacy stubs (kept for callers that import these) ────────────────────────
export const requestHandheldPairing = async () => null;
export const listenToHandheldStatus = () => () => { };