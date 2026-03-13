# 🚀 OFFLINE-FIRST IMPLEMENTATION GUIDE

## 📦 FILES CREATED

### **Core Services** (Backend Logic)
✅ `localGameService.ts` - Local storage CRUD operations  
✅ `syncService.ts` - Cloud sync orchestration  
✅ `useLocalGame.ts` - React hook for local games  

### **UI Components** (User Interface)
✅ `StandaloneTablet.tsx` - Offline-first entry page  
✅ `TabletController-UPDATED.tsx` - Universal game controller  
✅ `App-UPDATED.tsx` - Updated routing  
✅ `manifest-UPDATED.json` - PWA configuration  

---

## 🔧 INSTALLATION STEPS

### **Step 1: Add New Files**

Copy these files to your project:

```bash
# Services
src/services/localGameService.ts
src/services/syncService.ts

# Hooks
src/hooks/useLocalGame.ts

# Pages
src/pages/StandaloneTablet.tsx

# Replace existing files
src/pages/TabletController.tsx  → TabletController-UPDATED.tsx
src/App.tsx                     → App-UPDATED.tsx
public/manifest.json            → manifest-UPDATED.json
```

---

### **Step 2: Update Imports**

Add this to `src/App.tsx`:

```typescript
import { StandaloneTablet } from './pages/StandaloneTablet';
import { startAutoSync } from './services/syncService';
import { useEffect } from 'react';
```

---

### **Step 3: Verify File Structure**

Your project should now have:

```
src/
├── services/
│   ├── firebase.ts
│   ├── gameService.ts
│   ├── authService.ts
│   ├── hybridService.ts
│   ├── localGameService.ts    ← NEW
│   └── syncService.ts          ← NEW
├── hooks/
│   ├── useBasketballGame.ts
│   ├── useGameTimer.ts
│   └── useLocalGame.ts         ← NEW
├── pages/
│   ├── LandingPage.tsx
│   ├── Dashboard.tsx
│   ├── GameSetup.tsx
│   ├── TabletController.tsx    ← UPDATED
│   └── StandaloneTablet.tsx    ← NEW
└── App.tsx                     ← UPDATED
```

---

## 🎯 TESTING THE NEW SYSTEM

### **Test 1: Standalone Mode**

1. **Open in browser:**
   ```
   http://localhost:3000/tablet/standalone
   ```

2. **Expected behavior:**
   - Boot sequence plays
   - Shows "Start New Game" button
   - No login required
   - Works completely offline

---

### **Test 2: Create Local Game**

1. Click **"Start New Game"**
2. Enter team names: `Warriors` / `Titans`
3. Click **"Start Game"**
4. Should redirect to `/tablet/LOCAL-XXXXXX`
5. Hardware UI loads
6. Start scoring (works offline!)

---

### **Test 3: Offline Operation**

1. Open DevTools → Network
2. Set to **"Offline"**
3. Create a game
4. Score points
5. Toggle clock
6. Everything should work normally
7. Check `localStorage`:
   ```javascript
   localStorage.getItem('BOX_V2_LOCAL_GAMES')
   ```
   Should show your game data

---

### **Test 4: Cloud Sync**

1. **Set network back to "Online"**
2. **Log in** (if not already)
3. In Standalone page, click **"Sync to Cloud"**
4. Click **"Sync Now"**
5. Check Firebase console
6. Local games should appear with new cloud IDs

---

### **Test 5: PWA Installation**

1. **Build production version:**
   ```bash
   npm run build
   npm run preview
   ```

2. **Open in Chrome**
3. **Click install icon** in address bar
4. **App installs** to home screen
5. **Open installed app**
6. Should open to `/tablet/standalone`

---

## 🔄 HOW IT WORKS

### **Architecture Overview**

```
┌─────────────────────────────────────┐
│     USER OPENS INSTALLED APP        │
└──────────────┬──────────────────────┘
               ↓
    /tablet/standalone (Entry Point)
               ↓
    ┌─────────────────────┐
    │  StandaloneTablet   │
    │  • Create Game      │
    │  • Resume Games     │
    │  • Sync to Cloud    │
    └──────────┬──────────┘
               ↓
    Creates LOCAL-ABC123
               ↓
    /tablet/LOCAL-ABC123
               ↓
    ┌─────────────────────┐
    │  TabletController   │
    │  Detects: isLocal   │
    │  Uses: useLocalGame │
    └──────────┬──────────┘
               ↓
    ┌─────────────────────┐
    │  localGameService   │
    │  • localStorage     │
    │  • No Firebase      │
    └──────────┬──────────┘
               ↓
    User logs in / goes online
               ↓
    ┌─────────────────────┐
    │    syncService      │
    │  • Uploads to cloud │
    │  • Converts to pro  │
    └─────────────────────┘
```

---

### **Storage Keys**

The system uses these localStorage keys:

```javascript
'BOX_V2_LOCAL_GAMES'       // All local games
'BOX_V2_ACTIVE_LOCAL_GAME' // Currently playing
'BOX_V2_SYNC_PENDING'      // Queue for cloud sync
'BOX_V2_SYNC_STATUS'       // Sync metadata
'BOX_V2_APP_SETTINGS'      // User preferences
```

---

### **Game ID Format**

```
Local Games:  LOCAL-A1B2C3
Cloud Games:  123456
```

**Detection Logic:**
```typescript
const isLocalGame = gameCode?.startsWith('LOCAL-');
```

---

## 🎨 USER FLOWS

### **Flow 1: Pure Offline User**

```
1. Install app from website
2. Never log in
3. Create games in standalone mode
4. Games save to localStorage
5. Never synced to cloud
6. Manual export option available
```

**Perfect for:** Referees without internet

---

### **Flow 2: Hybrid User**

```
1. Install app
2. Create games offline
3. Log in later
4. Click "Sync to Cloud"
5. Games upload to Firebase
6. Now accessible from Dashboard
7. Multi-device support enabled
```

**Perfect for:** Most users

---

### **Flow 3: Cloud-First User (Existing)**

```
1. Log in to Dashboard
2. Create game with rosters
3. Click "Tablet" button
4. Opens in tablet mode
5. Real-time Firebase sync
6. Works offline (hybrid mode)
```

**Perfect for:** Professional operators

---

## 🛠️ CUSTOMIZATION OPTIONS

### **Option 1: Change Default Settings**

Edit `localGameService.ts`:

```typescript
export const getAppSettings = (): AppSettings => {
  return safeJSONParse<AppSettings>(STORAGE_KEYS.APP_SETTINGS, {
    autoSync: true,                  // Auto-sync when online
    keepSyncedGames: true,           // Keep local copies after sync
    vibrationEnabled: true,          // Haptic feedback
    defaultPeriodDuration: 10,       // Change default period length
    defaultShotClock: 24,            // Change default shot clock
  });
};
```

---

### **Option 2: Storage Limits**

Edit `localGameService.ts`:

```typescript
const MAX_LOCAL_GAMES = 50; // Change to 100, 200, etc.
```

---

### **Option 3: Sync Behavior**

Edit `syncService.ts`:

```typescript
const MAX_RETRY_ATTEMPTS = 3;   // Retry failed syncs
const RETRY_DELAY_MS = 2000;    // Wait between retries
```

---

## 🐛 TROUBLESHOOTING

### **Issue: "Game not found"**

**Cause:** Game ID doesn't exist in storage  
**Fix:**
```javascript
// Check storage
localStorage.getItem('BOX_V2_LOCAL_GAMES');

// Clear and restart
localStorage.clear();
sessionStorage.clear();
```

---

### **Issue: "Sync failed"**

**Cause:** Not logged in or no internet  
**Fix:**
1. Check `auth.currentUser`
2. Check `navigator.onLine`
3. Look at sync status:
   ```javascript
   import { getSyncStatus } from './services/syncService';
   console.log(getSyncStatus());
   ```

---

### **Issue: "Storage quota exceeded"**

**Cause:** Too many games saved  
**Fix:**
```javascript
import { clearSyncedGames } from './services/localGameService';
clearSyncedGames(); // Removes already-synced games
```

---

## 📊 MONITORING & DEBUGGING

### **Check Storage Usage**

```javascript
import { getStorageStats } from './services/localGameService';
console.log(getStorageStats());

// Output:
{
  totalGames: 15,
  syncedGames: 10,
  pendingGames: 5,
  maxGames: 50,
  storageAvailable: 35,
  oldestGame: Date,
  newestGame: Date
}
```

---

### **Check Sync Status**

```javascript
import { getSyncStatus } from './services/syncService';
console.log(getSyncStatus());

// Output:
{
  isSyncing: false,
  lastSyncTime: 1234567890,
  pendingCount: 3,
  failedCount: 0,
  errors: []
}
```

---

### **Export All Data (Backup)**

```javascript
import { exportLocalGames } from './services/localGameService';
const backup = exportLocalGames();
console.log(backup); // JSON string

// Save to file
const blob = new Blob([backup], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'box-backup.json';
a.click();
```

---

## ✅ VERIFICATION CHECKLIST

Before going live, verify:

- [ ] `/tablet/standalone` loads without errors
- [ ] Can create local game offline
- [ ] Game saves to localStorage
- [ ] Can resume saved games
- [ ] Sync works when logged in
- [ ] PWA installs correctly
- [ ] Start URL points to `/tablet/standalone`
- [ ] Works in airplane mode
- [ ] Timer counts down properly
- [ ] Haptics work on mobile
- [ ] Diagnostic console accessible (triple-tap)

---

## 🚀 DEPLOYMENT NOTES

### **Environment Variables**

No additional env vars needed! Everything works with existing Firebase config.

---

### **Build Command**

```bash
npm run build
```

Should include:
- Service worker (for offline caching)
- PWA manifest
- All routes pre-rendered

---

### **Vercel/Netlify Config**

Ensure rewrites handle all routes:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 📈 PERFORMANCE EXPECTATIONS

### **Load Times**

```
First Load (Online):     ~2s
First Load (Offline):    ~1s (cached)
Game Create:             <100ms
Score Update:            <50ms
Sync Upload (per game):  ~500ms
```

---

### **Storage Usage**

```
Per Game:     ~5KB
50 Games:     ~250KB
100 Games:    ~500KB

localStorage limit: ~5-10MB (browser-dependent)
```

---

## 🎓 KEY CONCEPTS

### **Offline-First**
Data saves locally FIRST, syncs to cloud LATER.

### **Progressive Enhancement**
Works without internet, better WITH internet.

### **Local-First**
User owns their data, cloud is backup.

### **Hybrid Sync**
Combines offline speed with cloud reliability.

---

## 🎉 SUCCESS CRITERIA

You'll know it's working when:

1. ✅ App installs without internet
2. ✅ Can create games offline
3. ✅ Games persist after closing app
4. ✅ Sync uploads when online
5. ✅ No data loss ever

---

## 📞 NEXT STEPS

**You now have:**
- ✅ Offline-first architecture
- ✅ Standalone mode
- ✅ Cloud sync capability
- ✅ PWA installation
- ✅ Local game library
- ✅ Export/import tools

**Ready to test!** Start with Test 1 above.

---

**Built with ❤️ for BMSCE Demo Day**

*"The best apps work everywhere. Even without WiFi."*