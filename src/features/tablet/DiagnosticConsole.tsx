// src/features/tablet/DiagnosticConsole.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { BasketballGame } from '../../types';

interface DiagnosticConsoleProps {
  game: BasketballGame;
  syncQueue: any[];
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticConsole: React.FC<DiagnosticConsoleProps> = ({
  game,
  syncQueue,
  isOpen,
  onClose
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [uptime, setUptime] = useState(0);

  // Capture console.log
  useEffect(() => {
    const originalLog = console.log;
    const capturedLogs: string[] = [];

    console.log = (...args: any[]) => {
      originalLog(...args);
      const timestamp = new Date().toLocaleTimeString();
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      capturedLogs.push(`[${timestamp}] ${message}`);
      if (capturedLogs.length > 50) capturedLogs.shift();
      setLogs([...capturedLogs]);
    };

    return () => {
      console.log = originalLog;
    };
  }, []);

  // Track uptime
  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!isOpen) return null;

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getMemoryUsage = () => {
    if ('memory' in performance) {
      const mem = (performance as any).memory;
      const usedMB = (mem.usedJSHeapSize / 1048576).toFixed(2);
      const totalMB = (mem.jsHeapSizeLimit / 1048576).toFixed(2);
      return `${usedMB} / ${totalMB} MB`;
    }
    return 'N/A';
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="h-full flex flex-col p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="led-indicator led-on-amber"></div>
            <div>
              <h2 className="text-2xl font-black italic tracking-tight text-white">
                DIAGNOSTIC CONSOLE
              </h2>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                Internal Monitoring System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hw-button hw-button-red"
          >
            CLOSE [×]
          </button>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
          {/* LEFT: System Status */}
          <div className="metal-panel p-6 flex flex-col gap-4">
            <h3 className="embossed-label mb-2">SYSTEM STATUS</h3>

            <div className="space-y-4">
              <StatusRow label="Mode" value={navigator.onLine ? 'ONLINE' : 'OFFLINE'} />
              <StatusRow label="Uptime" value={formatUptime(uptime)} />
              <StatusRow label="Memory" value={getMemoryUsage()} />
              <StatusRow label="Game Code" value={game.code} />
              <StatusRow label="Period" value={`Q${game.gameState.period}`} />
              <StatusRow
                label="Clock"
                value={`${game.gameState.gameTime.minutes}:${game.gameState.gameTime.seconds.toString().padStart(2, '0')}`}
              />
              <StatusRow
                label="Shot Clock"
                value={game.gameState.shotClock.toString()}
              />
              <StatusRow
                label="Possession"
                value={game.gameState.possession === 'A' ? game.teamA.name : game.teamB.name}
              />
            </div>

            <div className="mt-auto pt-4 border-t border-zinc-700">
              <StatusRow
                label="Queue Length"
                value={syncQueue.length.toString()}
                highlight={syncQueue.length > 0}
              />
            </div>
          </div>

          {/* MIDDLE: Sync Queue */}
          <div className="metal-panel p-6 flex flex-col">
            <h3 className="embossed-label mb-4">SYNC QUEUE</h3>

            <div className="flex-1 terminal-output">
              {syncQueue.length === 0 ? (
                <div className="text-zinc-700 text-center py-8">
                  Queue Empty - All Actions Synced
                </div>
              ) : (
                <div className="space-y-1">
                  {syncQueue.map((item: any, idx: number) => (
                    <div key={idx} className="terminal-line text-xs">
                      [{new Date(item.timestamp).toLocaleTimeString()}]
                      {item.code} - {item.data.gameState.period}Q
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Event Log */}
          <div className="metal-panel p-6 flex flex-col">
            <h3 className="embossed-label mb-4">EVENT LOG (LAST 50)</h3>

            <div className="flex-1 terminal-output">
              {logs.length === 0 ? (
                <div className="text-zinc-700 text-center py-8">
                  No Console Activity
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, idx) => (
                    <div key={idx} className="terminal-line text-xs">
                      {log}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-between items-center text-xs text-zinc-600 font-mono">
          <span>BOX-V2 Diagnostic System v1.0</span>
          <span>Triple-tap top-left corner to toggle</span>
        </div>
      </div>
    </div>
  );
};

const StatusRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight
}) => (
  <div className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wide">{label}</span>
    <span className={`text-sm font-mono font-bold ${highlight ? 'text-amber-500' : 'text-white'}`}>
      {value}
    </span>
  </div>
);