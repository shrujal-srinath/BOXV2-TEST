// src/features/tablet/StatusBar.tsx (V2 - WITH SETTINGS & OFFLINE QUEUE)
/**
 * STATUS BAR V2
 * 
 * FEATURES:
 * ✅ Settings icon (replaced triple-tap)
 * ✅ Offline queue count
 * ✅ Real-time sync status
 * ✅ Network latency indicator
 * ✅ Battery status
 * ✅ Last sync timestamp
 */

import React, { useEffect, useState } from 'react';

interface StatusBarProps {
  gameCode: string;
  isOnline: boolean;
  lastSync: number;
  offlineQueueCount: number;
  onOpenSettings: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  gameCode,
  isOnline,
  lastSync,
  offlineQueueCount,
  onOpenSettings
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get battery status
  useEffect(() => {
    const getBattery = async () => {
      if ('getBattery' in navigator) {
        try {
          const batteryManager = await (navigator as any).getBattery();
          const updateBattery = () => {
            setBattery({
              level: Math.round(batteryManager.level * 100),
              charging: batteryManager.charging
            });
          };
          
          updateBattery();
          batteryManager.addEventListener('levelchange', updateBattery);
          batteryManager.addEventListener('chargingchange', updateBattery);
          
          return () => {
            batteryManager.removeEventListener('levelchange', updateBattery);
            batteryManager.removeEventListener('chargingchange', updateBattery);
          };
        } catch (err) {
          console.error('Battery API not available:', err);
        }
      }
    };

    getBattery();
  }, []);

  // Measure network latency
  useEffect(() => {
    if (!isOnline) {
      setLatency(null);
      return;
    }

    const measureLatency = async () => {
      const start = performance.now();
      try {
        await fetch('https://www.google.com/favicon.ico', { method: 'HEAD', mode: 'no-cors' });
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch {
        setLatency(null);
      }
    };

    measureLatency();
    const interval = setInterval(measureLatency, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [isOnline]);

  // Format relative time since last sync
  const getTimeSinceSync = () => {
    const seconds = Math.floor((Date.now() - lastSync) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Signal strength based on latency
  const getSignalStrength = () => {
    if (!isOnline || latency === null) return 0;
    if (latency < 100) return 4;
    if (latency < 200) return 3;
    if (latency < 400) return 2;
    return 1;
  };

  const signalBars = getSignalStrength();

  return (
    <div className="bg-gradient-to-r from-zinc-900 via-black to-zinc-900 border-b-4 border-green-700 shadow-2xl">
      <div className="flex items-center justify-between px-6 py-3">
        {/* LEFT: Game Code & Network Status */}
        <div className="flex items-center gap-6">
          {/* Settings Icon */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-zinc-800 border-2 border-green-700 hover:bg-zinc-700 active:scale-95 transition-all"
            aria-label="Settings"
          >
            <svg 
              className="w-6 h-6 text-green-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
              />
            </svg>
          </button>

          {/* Game Code */}
          <div>
            <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Game Code</div>
            <div className="text-2xl font-black text-green-500 font-mono tracking-wider">
              {gameCode}
            </div>
          </div>

          {/* Network Status */}
          <div className="flex items-center gap-3">
            {/* LED Indicator */}
            <div 
              className={`led-indicator ${
                isOnline 
                  ? offlineQueueCount > 0 
                    ? 'led-on-amber animate-pulse' 
                    : 'led-on-green'
                  : 'led-on-red'
              }`}
            ></div>

            {/* Status Details */}
            <div>
              <div className={`text-sm font-bold ${
                isOnline 
                  ? offlineQueueCount > 0 
                    ? 'text-amber-500' 
                    : 'text-green-500'
                  : 'text-red-500'
              }`}>
                {isOnline 
                  ? offlineQueueCount > 0 
                    ? 'SYNCING' 
                    : 'ONLINE'
                  : 'OFFLINE'
                }
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                {isOnline ? (
                  offlineQueueCount > 0 ? (
                    `${offlineQueueCount} pending`
                  ) : (
                    getTimeSinceSync()
                  )
                ) : (
                  `${offlineQueueCount} queued`
                )}
              </div>
            </div>

            {/* Signal Strength */}
            {isOnline && (
              <div className="flex items-end gap-0.5 h-5">
                {[1, 2, 3, 4].map(bar => (
                  <div
                    key={bar}
                    className={`w-1 rounded-t transition-all ${
                      bar <= signalBars 
                        ? 'bg-green-500' 
                        : 'bg-zinc-700'
                    }`}
                    style={{ height: `${bar * 25}%` }}
                  ></div>
                ))}
              </div>
            )}

            {/* Latency */}
            {isOnline && latency !== null && (
              <div className="text-xs text-zinc-500 font-mono">
                {latency}ms
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: System Status */}
        <div className="flex items-center gap-6">
          {/* Battery */}
          {battery && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-zinc-500 font-mono">
                {battery.level}%
              </div>
              <div className="relative w-8 h-4 border-2 border-zinc-500 rounded-sm">
                {/* Battery Cap */}
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-2 bg-zinc-500 rounded-r"></div>
                
                {/* Battery Fill */}
                <div 
                  className={`h-full rounded-sm transition-all ${
                    battery.charging 
                      ? 'bg-green-500 animate-pulse' 
                      : battery.level > 20 
                        ? 'bg-green-500' 
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${battery.level}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Time */}
          <div className="text-right">
            <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Local Time</div>
            <div className="text-xl font-bold text-white font-mono">
              {currentTime.toLocaleTimeString('en-US', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Offline Queue Alert Banner */}
      {offlineQueueCount > 5 && (
        <div className="bg-amber-500 text-black px-6 py-2 text-center font-bold text-sm animate-pulse">
          ⚠️ {offlineQueueCount} actions pending - will sync when online
        </div>
      )}
    </div>
  );
};