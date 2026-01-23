import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HardwareDeck } from '../components/HardwareDeck';
import { saveGameAction, loadLocalGame } from '../services/hybridService';
import type { BasketballGame } from '../types';
import { subscribeToGame } from '../services/gameService'; 

export const TabletController: React.FC = () => {
  const { gameCode } = useParams();
  const [game, setGame] = useState<BasketballGame | null>(null);

  // 1. INIT: Load from Local Storage (Instant) or Cloud (Fallback)
  useEffect(() => {
    if (!gameCode) return;

    // Try local load first (Offline support)
    const local = loadLocalGame();
    if (local && local.code === gameCode) {
      setGame(local);
    }

    // Subscribe to cloud updates (Hybrid Sync)
    const unsubscribe = subscribeToGame(gameCode, (cloudData) => {
      setGame(cloudData);
    });

    return () => unsubscribe && unsubscribe();
  }, [gameCode]);

  // 2. LOGIC HANDLERS (Mutate State Locally -> Save Hybrid)
  const updateGame = (updater: (g: BasketballGame) => void) => {
    if (!game) return;
    
    // Deep Clone to avoid mutation errors
    const newGame = JSON.parse(JSON.stringify(game));
    
    // Apply logic
    updater(newGame);
    newGame.lastUpdate = Date.now();

    // 1. Update UI Instantly
    setGame(newGame);
    
    // 2. Trigger Hybrid Save (Local Store + Cloud Sync)
    saveGameAction(newGame);
  };

  if (!game) return <div className="h-screen bg-black flex items-center justify-center text-green-500 font-mono animate-pulse">BOOTING HARDWARE INTERFACE...</div>;

  return (
    <HardwareDeck 
       teamA={game.teamA} 
       teamB={game.teamB} 
       gameState={game.gameState}
       
       onAction={(team, type, val) => updateGame((g) => {
         if (type === 'points') {
           if (team === 'A') g.teamA.score = Math.max(0, g.teamA.score + val);
           else g.teamB.score = Math.max(0, g.teamB.score + val);
         }
         if (type === 'foul') {
           if (team === 'A') g.teamA.fouls = Math.max(0, g.teamA.fouls + val);
           else g.teamB.fouls = Math.max(0, g.teamB.fouls + val);
         }
         if (type === 'timeout') {
           if (team === 'A') g.teamA.timeouts = Math.max(0, g.teamA.timeouts + val);
           else g.teamB.timeouts = Math.max(0, g.teamB.timeouts + val);
         }
       })}

       onGameClock={(action) => updateGame((g) => {
         if (action === 'toggle') g.gameState.gameRunning = !g.gameState.gameRunning;
       })}

       onShotClock={(action) => updateGame((g) => {
         if (action === 'reset-24') g.gameState.shotClock = 24;
         if (action === 'reset-14') g.gameState.shotClock = 14;
       })}

       onPossession={() => updateGame((g) => {
         g.gameState.possession = g.gameState.possession === 'A' ? 'B' : 'A';
       })}

       // --- FIX 2: Added the missing Next Period Handler ---
       onNextPeriod={() => updateGame((g) => {
          g.gameState.period = (g.gameState.period % 4) + 1; // Cycles 1 -> 2 -> 3 -> 4 -> 1
       })}
    />
  );
};