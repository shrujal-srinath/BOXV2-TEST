// src/services/arenaSessionService.ts
// ═══════════════════════════════════════════════════════════════
//  ARENA SESSION SERVICE
//
//  Manages multi-court arena sessions.
//  A host creates a session (4-char arena_code).
//  Scorers join using that code — their game appears on the display.
//  The display page (/arena/:arenaCode) subscribes in real-time.
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';

// Same charset as games — avoids visually ambiguous characters
const CODE_CHARS = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingRequest {
    game_code: string;
    requester_id: string;
    game_name: string;
    team_a: string;
    team_b: string;
    requested_at: string;
}

export interface ArenaSession {
    id: string;
    arena_code: string;
    label: string;
    created_by: string | null;
    layout: 'auto' | '1x2' | '2x2' | '2x3' | '3x2';
    game_codes: string[];
    max_slots: number;
    join_mode: 'open' | 'approval';
    pending_requests: PendingRequest[];
    status: 'active' | 'ended';
    created_at: string;
    last_updated: string;
}

// ─── Code Generation ──────────────────────────────────────────────────────────

const generateArenaCode = async (): Promise<string> => {
    while (true) {
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
        }
        const { data } = await supabase
            .from('arena_sessions')
            .select('arena_code')
            .eq('arena_code', code)
            .maybeSingle();
        if (!data) return code;
    }
};

// ─── Create ───────────────────────────────────────────────────────────────────

export const createArenaSession = async (params: {
    label: string;
    layout: string;
    maxSlots: number;
    joinMode: 'open' | 'approval';
    userId: string;
}): Promise<{ session: ArenaSession; arenaCode: string }> => {
    const arenaCode = await generateArenaCode();

    const { data, error } = await supabase
        .from('arena_sessions')
        .insert({
            arena_code: arenaCode,
            label: params.label,
            created_by: params.userId,
            layout: params.layout,
            max_slots: params.maxSlots,
            join_mode: params.joinMode,
            game_codes: [],
            pending_requests: [],
            status: 'active',
        })
        .select()
        .single();

    if (error || !data) {
        throw new Error(`Failed to create arena session: ${error?.message}`);
    }

    return { session: data as ArenaSession, arenaCode };
};

// ─── Join ─────────────────────────────────────────────────────────────────────

export const joinArenaSession = async (
    arenaCode: string,
    gameCode: string,
    meta?: {
        gameName?: string;
        teamA?: string;
        teamB?: string;
        requesterId?: string;
    }
): Promise<{ success: boolean; message: string; slotIndex?: number; isPending?: boolean }> => {
    const upper = arenaCode.toUpperCase();
    const upperGame = gameCode.toUpperCase();

    const { data: session, error: fetchErr } = await supabase
        .from('arena_sessions')
        .select('*')
        .eq('arena_code', upper)
        .eq('status', 'active')
        .single();

    if (fetchErr || !session) {
        return { success: false, message: 'Arena session not found or has ended.' };
    }

    const s = session as ArenaSession;

    // Already in session
    if (s.game_codes.includes(upperGame)) {
        return { success: true, message: 'Already in session.', slotIndex: s.game_codes.indexOf(upperGame) };
    }

    // Full
    if (s.game_codes.length >= s.max_slots) {
        return { success: false, message: 'Arena is full. All courts are occupied.' };
    }

    if (s.join_mode === 'approval') {
        // Add to pending
        const alreadyPending = s.pending_requests.some((r) => r.game_code === upperGame);
        if (alreadyPending) {
            return { success: true, message: 'Request already pending.', isPending: true };
        }

        const newRequest: PendingRequest = {
            game_code: upperGame,
            requester_id: meta?.requesterId || '',
            game_name: meta?.gameName || upperGame,
            team_a: meta?.teamA || 'Team A',
            team_b: meta?.teamB || 'Team B',
            requested_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('arena_sessions')
            .update({
                pending_requests: [...s.pending_requests, newRequest],
                last_updated: new Date().toISOString(),
            })
            .eq('arena_code', upper);

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Join request sent. Awaiting host approval.', isPending: true };
    }

    // Open mode — append directly
    const newCodes = [...s.game_codes, upperGame];
    const { error } = await supabase
        .from('arena_sessions')
        .update({
            game_codes: newCodes,
            last_updated: new Date().toISOString(),
        })
        .eq('arena_code', upper);

    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Joined arena successfully.', slotIndex: newCodes.length - 1 };
};

// ─── Leave ────────────────────────────────────────────────────────────────────

export const leaveArenaSession = async (arenaCode: string, gameCode: string): Promise<void> => {
    const upper = arenaCode.toUpperCase();
    const upperGame = gameCode.toUpperCase();

    const { data: session } = await supabase
        .from('arena_sessions')
        .select('game_codes')
        .eq('arena_code', upper)
        .single();

    if (!session) return;

    const newCodes = (session.game_codes as string[]).filter((c) => c !== upperGame);
    await supabase
        .from('arena_sessions')
        .update({ game_codes: newCodes, last_updated: new Date().toISOString() })
        .eq('arena_code', upper);
};

// ─── Approve / Reject Requests ────────────────────────────────────────────────

export const approveArenaRequest = async (
    arenaCode: string,
    gameCode: string
): Promise<{ success: boolean }> => {
    const upper = arenaCode.toUpperCase();
    const upperGame = gameCode.toUpperCase();

    const { data: session } = await supabase
        .from('arena_sessions')
        .select('*')
        .eq('arena_code', upper)
        .single();

    if (!session) return { success: false };

    const s = session as ArenaSession;
    const pending = s.pending_requests.filter((r) => r.game_code !== upperGame);
    const newCodes = [...s.game_codes, upperGame];

    const { error } = await supabase
        .from('arena_sessions')
        .update({
            game_codes: newCodes,
            pending_requests: pending,
            last_updated: new Date().toISOString(),
        })
        .eq('arena_code', upper);

    return { success: !error };
};

export const rejectArenaRequest = async (
    arenaCode: string,
    gameCode: string
): Promise<{ success: boolean }> => {
    const upper = arenaCode.toUpperCase();
    const upperGame = gameCode.toUpperCase();

    const { data: session } = await supabase
        .from('arena_sessions')
        .select('pending_requests')
        .eq('arena_code', upper)
        .single();

    if (!session) return { success: false };

    const pending = (session.pending_requests as PendingRequest[]).filter(
        (r) => r.game_code !== upperGame
    );

    const { error } = await supabase
        .from('arena_sessions')
        .update({ pending_requests: pending, last_updated: new Date().toISOString() })
        .eq('arena_code', upper);

    return { success: !error };
};

// ─── Fetch (one-time) ─────────────────────────────────────────────────────────

export const fetchArenaSession = async (arenaCode: string): Promise<ArenaSession | null> => {
    const { data, error } = await supabase
        .from('arena_sessions')
        .select('*')
        .eq('arena_code', arenaCode.toUpperCase())
        .single();

    if (error || !data) return null;
    return data as ArenaSession;
};

export const fetchMyArenaSessions = async (userId: string): Promise<ArenaSession[]> => {
    const { data, error } = await supabase
        .from('arena_sessions')
        .select('*')
        .eq('created_by', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as ArenaSession[];
};

// ─── Realtime Subscription ────────────────────────────────────────────────────

export const subscribeToArenaSession = (
    arenaCode: string,
    callback: (session: ArenaSession) => void
): (() => void) => {
    const upper = arenaCode.toUpperCase();

    const channel = supabase
        .channel(`arena_session_${upper}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'arena_sessions',
                filter: `arena_code=eq.${upper}`,
            },
            (payload) => {
                if (payload.eventType !== 'DELETE') {
                    callback(payload.new as ArenaSession);
                }
            }
        )
        .subscribe((status, err) => {
            if (err) console.error(`[ArenaSession] Subscribe error for ${upper}:`, err);
        });

    return () => { supabase.removeChannel(channel); };
};

// ─── End Session ──────────────────────────────────────────────────────────────

export const endArenaSession = async (arenaCode: string): Promise<void> => {
    await supabase
        .from('arena_sessions')
        .update({ status: 'ended', last_updated: new Date().toISOString() })
        .eq('arena_code', arenaCode.toUpperCase());
};

// ─── Validate Code ────────────────────────────────────────────────────────────

export const validateArenaCode = async (
    arenaCode: string
): Promise<{ valid: boolean; session?: ArenaSession; message: string }> => {
    if (arenaCode.length !== 4) {
        return { valid: false, message: 'Arena code must be 4 characters.' };
    }

    const { data, error } = await supabase
        .from('arena_sessions')
        .select('*')
        .eq('arena_code', arenaCode.toUpperCase())
        .eq('status', 'active')
        .single();

    if (error || !data) {
        return { valid: false, message: `No active arena found with code "${arenaCode.toUpperCase()}".` };
    }

    return { valid: true, session: data as ArenaSession, message: 'Arena found.' };
};
