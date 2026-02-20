// src/pages/EngineDemo.tsx
import React, { useState } from 'react';
import { useGameEngine } from '../core/engine/useGameEngine';
import { SPORT_REGISTRY } from '../sports/basketball/registry';
import { Game } from '../core/types/Game';

export default function EngineDemo() {
    // 1. Load the requested Sport Plugin (Dynamic)
    const manifest = SPORT_REGISTRY['basketball'];

    // 2. Scaffold a mock database row (What Supabase would normally return)
    const [mockGame] = useState<Game<any, any>>(() => ({
        id: 'demo-game-123',
        code: 'DEMO-123',
        hostId: 'referee-999',
        sportId: 'basketball',
        status: 'live',
        createdAt: Date.now(),
        lastUpdate: Date.now(),
        rules: manifest.rules, // e.g., 4 quarters, 10 mins
        state: manifest.createInitialState(manifest.rules), // The pure 0-0 state
        teamA: { name: 'Home', color: '#EF4444', score: 0 },
        teamB: { name: 'Away', color: '#3B82F6', score: 0 }
    }));

    // 3. Boot up the Universal Engine!
    const { state, dispatch, isOffline } = useGameEngine(
        mockGame.id,
        mockGame,
        manifest,
        true // Enable God Mode/Admin for the demo
    );

    // 4. Extract the strictly-typed UI components from the plugin
    const { TabletController, WallCard } = manifest.components;

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <header className="border-b border-gray-800 pb-4">
                    <h1 className="text-3xl font-bold text-blue-400">BOX-V2 Architecture Demo</h1>
                    <p className="text-gray-400 mt-2">
                        Loaded Plugin: <span className="text-white font-mono">{manifest.label}</span> |
                        Network: {isOffline ? '🔴 Offline' : '🟢 Online'}
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: The Controller */}
                    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900 flex flex-col">
                        <div className="bg-gray-800 p-2 text-center text-xs font-bold tracking-widest text-gray-400">
                            REFEREE TABLET (DISPATCHER)
                        </div>
                        <div className="flex-1 p-4">
                            <TabletController
                                gameId={mockGame.id}
                                state={state}
                                dispatch={dispatch}
                                isOffline={isOffline}
                                syncQueueCount={0}
                            />
                        </div>
                    </div>

                    {/* Right Column: The Wall Display */}
                    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900 flex flex-col">
                        <div className="bg-gray-800 p-2 text-center text-xs font-bold tracking-widest text-gray-400">
                            STADIUM WALL DISPLAY (LISTENER)
                        </div>
                        <div className="flex-1 flex items-center justify-center p-4">
                            <WallCard state={state} />
                        </div>
                    </div>
                </div>

                {/* Debugging Console: Watch the JSONB mutate in real-time */}
                <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 text-sm font-mono text-green-400 overflow-auto">
                    <h3 className="text-white mb-2 font-sans font-bold text-lg">Postgres JSONB Payload (Auto-Syncs):</h3>
                    <pre>{JSON.stringify(state, null, 2)}</pre>
                </div>
            </div>
        </div>
    );
}