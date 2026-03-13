// src/services/supabase.ts
//
// THE BOX — Supabase Client Initialization
//
// REPLACES: src/services/firebase.ts
//
// Architecture:
//   - Supabase Postgres → replaces Firestore (games, tournaments, users)
//   - Supabase Realtime Broadcast → replaces Firebase RTDB (clock ticks, score updates)
//   - Supabase Auth → replaces Firebase Auth
//
// Why Supabase?
//   1. Broadcast is true pub/sub: host publishes once, N spectators receive.
//      Firebase RTDB creates N subscriptions, each downloading every tick.
//   2. Postgres gives real SQL: JOINs, transactions, RLS — no more
//      denormalized Firestore documents.
//   3. Realtime Broadcast is ephemeral — no database writes for clock ticks.
//      Firebase RTDB writes every tick to disk. Supabase doesn't.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Environment Validation ───────────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        '[Supabase] Missing environment variables.\n' +
        'Add to your .env file:\n' +
        '  VITE_SUPABASE_URL=https://xxxxx.supabase.co\n' +
        '  VITE_SUPABASE_ANON_KEY=eyJ...\n'
    );
}

// ─── Client ───────────────────────────────────────────────────────────────────

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
        params: {
            // Allow receiving your own broadcast messages (host sees own ticks)
            eventsPerSecond: 10,
        },
    },
    auth: {
        // Persist sessions in localStorage for PWA offline support
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

export default supabase;