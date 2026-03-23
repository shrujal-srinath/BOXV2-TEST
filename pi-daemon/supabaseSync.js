import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ No Supabase credentials found in .env. Cloud sync is disabled.');
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
let activeChannel = null;

export function broadcastToCloud(gameCode, state) {
    if (!supabase || !gameCode) return;

    // Initialize or switch channels if the game code changes
    if (!activeChannel || activeChannel.topic !== `realtime:game-${gameCode}`) {
        if (activeChannel) supabase.removeChannel(activeChannel);
        activeChannel = supabase.channel(`game-${gameCode}`);
        activeChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log(`☁️ Synced to Supabase Cloud: [game-${gameCode}]`);
        });
    }

    // 1. Broadcast Score Updates (Matches your React subscribeToGameBroadcast expectations)
    activeChannel.send({
        type: 'broadcast',
        event: 'score_update',
        payload: {
            teamA: state.teamA.score,
            teamB: state.teamB.score,
            foulsA: state.teamA.fouls,
            foulsB: state.teamB.fouls,
            timeoutsA: state.teamA.timeouts,
            timeoutsB: state.teamB.timeouts,
            possession: state.clock.period % 2 !== 0 ? 'A' : 'B' // Simple toggle logic
        }
    });
}

// Separate function for the clock so we don't spam Supabase 10 times a second
export function broadcastClockToCloud(gameCode, clockState) {
    if (!activeChannel) return;

    activeChannel.send({
        type: 'broadcast',
        event: 'clock_sync',
        payload: {
            minutes: Math.floor(clockState.gameMs / 60000),
            seconds: Math.floor((clockState.gameMs % 60000) / 1000),
            period: clockState.period,
            gameRunning: clockState.isRunning,
            shotClock: Math.ceil(clockState.shotMs / 1000)
        }
    });
}