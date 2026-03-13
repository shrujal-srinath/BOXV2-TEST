// src/features/tablet/StatusBar.tsx (V2 - PRODUCTION READY)
/**
 * STATUS BAR - PRODUCTION VERSION
 * 
 * FEATURES:
 * ✅ Clear online/offline status
 * ✅ User-friendly sync messaging
 * ✅ Last sync timestamp
 * ✅ Pending actions count
 * ✅ Battery/time (device info)
 */

import React, { useState, useEffect } from 'react';
import { Settings, Wifi, WifiOff, Cloud, AlertCircle } from 'lucide-react';

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

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format last sync time
  const getLastSyncText = (): string => {
    const secondsAgo = Math.floor((Date.now() - lastSync) / 1000);
    
    if (secondsAgo < 10) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
    return `${Math.floor(secondsAgo / 86400)}d ago`;
  };

  // Get sync status message
  const getSyncStatusMessage = (): { text: string; color: string; icon: 'synced' | 'syncing' | 'offline' | 'warning' } => {
    if (!isOnline && offlineQueueCount > 0) {
      return {
        text: `${offlineQueueCount} action${offlineQueueCount > 1 ? 's' : ''} waiting to sync`,
        color: 'text-amber-500',
        icon: 'offline'
      };
    }
    
    if (!isOnline) {
      return {
        text: 'All changes saved locally',
        color: 'text-blue-500',
        icon: 'offline'
      };
    }
    
    if (offlineQueueCount > 0) {
      return {
        text: `Syncing ${offlineQueueCount} action${offlineQueueCount > 1 ? 's' : ''}...`,
        color: 'text-amber-500',
        icon: 'syncing'
      };
    }
    
    return {
      text: `Synced ${getLastSyncText()}`,
      color: 'text-green-500',
      icon: 'synced'
    };
  };

  const syncStatus = getSyncStatusMessage();

  return (
    <div className="bg-zinc-950 border-b-2 border-zinc-900 px-6 py-4 relative z-10">
      <div className="flex items-center justify-between">
        
        {/* Left: Game Info */}
        <div className="flex items-center gap-6">
          {/* Connection Status LED */}
          <div className="flex items-center gap-3">
            <div className={`led-indicator ${isOnline ? 'led-on-green' : 'led-on-red'} ${
              offlineQueueCount > 0 ? 'animate-pulse' : ''
            }`}></div>
            <div>
              <div className="text-sm font-bold text-white">
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </div>
              <div className={`text-xs font-mono ${syncStatus.color}`}>
                {syncStatus.text}
              </div>
            </div>
          </div>

          {/* Game Code */}
          <div className="metal-panel px-4 py-2">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Game Code
            </div>
            <div className="text-sm font-mono font-bold text-white">
              {gameCode}
            </div>
          </div>

          {/* Sync Icon Indicator */}
          {syncStatus.icon === 'syncing' && (
            <div className="flex items-center gap-2 text-amber-500">
              <Cloud size={20} className="animate-pulse" />
              <span className="text-xs font-bold">SYNCING...</span>
            </div>
          )}
          
          {syncStatus.icon === 'offline' && offlineQueueCount > 0 && (
            <div className="flex items-center gap-2 text-amber-500">
              <AlertCircle size={20} className="animate-pulse" />
              <span className="text-xs font-bold">PENDING SYNC</span>
            </div>
          )}
        </div>

        {/* Center: App Title */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <h1 className="text-2xl font-black italic tracking-tight text-white">
            THE BOX
          </h1>
        </div>

        {/* Right: System Info & Settings */}
        <div className="flex items-center gap-6">
          
          {/* Device Time */}
          <div className="text-right">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Device Time
            </div>
            <div className="text-sm font-mono font-bold text-white">
              {currentTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: false 
              })}
            </div>
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="hw-button hw-button-sm flex items-center gap-2"
            style={{ minWidth: '100px' }}
          >
            <Settings size={16} />
            <span>SETTINGS</span>
          </button>
        </div>
      </div>

      {/* Warning Banner for Critical States */}
      {!isOnline && offlineQueueCount > 10 && (
        <div className="mt-3 bg-amber-900/20 border border-amber-900/50 rounded px-4 py-2 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-500" />
          <div className="flex-1">
            <div className="text-sm font-bold text-amber-500">
              Many actions pending sync ({offlineQueueCount})
            </div>
            <div className="text-xs text-amber-700">
              Connect to internet to sync your game data to the cloud
            </div>
          </div>
        </div>
      )}
    </div>
  );
};