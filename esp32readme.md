# THE BOX — ESP32 Hardware Controller Integration
### BMSCE Sports Tech Division

---

## What Is This?

THE BOX scoring platform supports a physical ESP32 hardware controller that referees can hold in their hands to score games. The ESP32 connects to the same website backend (Supabase) that the web dashboard uses, so everything stays in sync in real time.

Think of it like AirPods connecting to a phone — the ESP32 shows a 4-character code on its Nokia 5110 display, the operator enters that code on the website, and they're paired. From that point, the physical buttons on the ESP32 control the scoreboard just like clicking the web interface would.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE BACKEND                         │
│                                                                 │
│   hardware_terminals table     games table (JSONB)              │
│   ┌──────────────────────┐     ┌─────────────────────────┐     │
│   │ id: "A3K9"           │     │ code: "483921"           │     │
│   │ status: "active"     │     │ teamA.score: 14          │     │
│   │ control_mode: "hw"   │     │ teamB.score: 11          │     │
│   │ active_game_id: ...  │     │ gameState.period: 2      │     │
│   │ last_heartbeat: ...  │     └─────────────────────────┘     │
│   └──────────────────────┘                                      │
│                                                                 │
│   Realtime Broadcast Channel: hw-{gameCode}                     │
│   (ephemeral signals, no DB writes — for instant score updates) │
└─────────┬───────────────────────────────────┬───────────────────┘
          │ polls every 2s                     │ broadcast signals
          │ heartbeat every 5s                 │ (score, clock, etc.)
          ▼                                    ▼
┌──────────────────┐               ┌──────────────────────────────┐
│   ESP32 Device   │               │     WEBSITE (React/TS)       │
│                  │               │                              │
│  Nokia 5110      │               │  HostConsole.tsx             │
│  10 Buttons      │               │  → useHardwareSignaling()    │
│  Piezo Buzzer    │               │  → dispatch() to GameEngine  │
│                  │               │                              │
│  Firmware:       │               │  ConnectControllerModal.tsx  │
│  - Registers     │               │  → pairHandheldDevice()      │
│    itself in DB  │               │                              │
│  - Sends         │               │  ControllerStatusBar.tsx     │
│    heartbeats    │               │  → shows online/offline      │
│  - Broadcasts    │               │  → control mode switcher     │
│    button presses│               └──────────────────────────────┘
└──────────────────┘
```

---

## The 3 Control Modes

The system supports three operating modes that can be switched live during a game:

| Mode | ESP32 Buttons | Web Console | Use Case |
|------|---------------|-------------|----------|
| **HARDWARE** | ✅ Active | 🔒 Locked (read-only) | Referee has full control |
| **WEB** | 🚫 Ignored | ✅ Active | Operator at laptop scoring |
| **SHARED** | ✅ Active | ✅ Active | Backup / both scoring, last write wins |

Switching modes is instant — the operator clicks a button on the website, Supabase updates the `control_mode` field, and the ESP32 picks it up on its next poll cycle (~2 seconds).

---

## Database Table: `hardware_terminals`

This is the single source of truth for device pairing state.

```sql
CREATE TABLE public.hardware_terminals (
  id              TEXT PRIMARY KEY,       -- 4-char pairing code (e.g. "A3K9")
  status          TEXT DEFAULT 'waiting', -- waiting | paired | active
  host_id         TEXT,                   -- Supabase user ID of operator
  control_mode    TEXT DEFAULT 'hardware',-- web | hardware | shared
  active_game_id  TEXT,                   -- game code when in active state
  team_a_name     TEXT,
  team_b_name     TEXT,
  local_ip        TEXT,                   -- ESP32's IP (informational)
  last_heartbeat  BIGINT DEFAULT 0,       -- millis() from ESP32 (uptime, NOT epoch)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Important:** `last_heartbeat` stores `millis()` from the ESP32 — milliseconds since the device booted, **not** Unix epoch. Never compare it to `Date.now()` from JavaScript. The website tracks online/offline state by watching for DB update events via Supabase Realtime, not by timestamp comparison.

---

## Pairing Flow (Step by Step)

```
ESP32 Powers On
      │
      ▼
Generates 4-char code (e.g. "A3K9")
      │
      ▼
Calls registerDevice() → upserts row in hardware_terminals
  { id: "A3K9", status: "waiting", local_ip: "192.168.1.x" }
      │
      ▼
Displays code on Nokia 5110 display
      │
      ▼ (operator sees code on screen)
      │
Operator opens website → "Connect Controller" modal
      │
      ▼
Enters "A3K9" → clicks "Pair Controller"
      │
      ▼
pairHandheldDevice() runs:
  1. [searching]    → queries hardware_terminals for id="A3K9"
  2. [found]        → row exists → proceeds
  3. [handshaking]  → updates status to 'paired', host_id to user's ID
  4. [confirmed]    → polls to verify write landed → success
      │
      ▼
sessionStorage.setItem('BOX_HW_SESSION', 'A3K9')
      │
      ▼
ESP32 polls hardware_terminals every 2s
Sees status='paired' → shows "PAIRED" on display + beeps
      │
      ▼
Operator launches game in GameSetup
      │
      ▼
activateGameOnDevice() runs:
  Updates { status: 'active', active_game_id: '483921', control_mode: 'hardware' }
      │
      ▼
ESP32 sees status='active' → fetches game state → enters game mode
      │
      ▼
🎮 LIVE — ESP32 buttons now control the scoreboard
```

---

## Button Mapping (10-Button Controller)

| Button | GPIO | Function | Signal Sent |
|--------|------|----------|-------------|
| BTN_A | 13 | Team A +1 point | `ADD_SCORE_A` |
| BTN_B | 25 | Team A -1 point | `SUB_SCORE_A` |
| BTN_C | 19 | Team B +1 point | `ADD_SCORE_B` |
| BTN_D | 26 | Team B -1 point | `SUB_SCORE_B` |
| BTN_E | 14 | Reset shot clock (24s) | `RESET_SHOT_CLOCK_24` |
| BTN_F | 33 | Next period / quarter | `NEXT_PERIOD` |
| BTN_G | 27 | Pause / Resume clock | `TOGGLE_CLOCK` |
| BTN_H | 32 | Undo last action | `UNDO` |
| BTN_I | 15 | Toggle possession arrow | `TOGGLE_POSSESSION` |
| BTN_J | 4  | Reset shot clock (14s) | `RESET_SHOT_CLOCK_14` |

The ESP32 firmware sends these signals via **Supabase Realtime Broadcast** to the channel `hw-{gameCode}`. The website's `useHardwareSignaling` hook listens on this channel and dispatches matching actions to the GameEngine.

---

## Signal Flow During a Game

When a referee presses a button:

```
Button pressed on ESP32
        │
        ▼ (~0ms)
Firmware debounces (200ms)
        │
        ▼
POST to Supabase Realtime Broadcast
  Channel: hw-483921
  Event: "signal"
  Payload: { action: "ADD_SCORE_A", gameId: "483921", deviceId: "A3K9", timestamp: 12345 }
        │
        ▼ (~30-80ms on same WiFi)
useHardwareSignaling() receives signal in HostConsole
        │
        ▼
Checks controlMode — if 'web', signal is ignored
        │
        ▼ (if hardware or shared)
Dispatches to GameEngine:
  { type: 'ADD_POINTS', team: 'A', amount: 1 }
        │
        ▼
GameEngine updates state → Supabase Postgres write (durable)
        │
        ▼
Supabase Broadcast pushes update to spectator views
        │
        ▼
Score updates on LED wall display, phones, tablets
```

---

## File Structure (Website Side)

```
src/
├── services/
│   └── handheldService.ts          ← ALL pairing/mode logic lives here
│
├── hooks/
│   ├── useHardwareBridge.ts        ← Connection state (isConnected, controlMode)
│   └── useHardwareSignaling.ts     ← Listens for ESP32 button signals
│
├── components/
│   ├── ConnectControllerModal.tsx  ← The "AirPods pairing" UI dialog
│   ├── ControllerStatusBar.tsx     ← Persistent status bar (online/offline/mode)
│   └── HardwareControlOverlay.tsx  ← Lock overlay when ESP32 has control
│
└── pages/
    ├── GameSetup.tsx               ← Calls activateGameOnDevice() on launch
    └── HostConsole.tsx             ← Wires useHardwareSignaling → GameEngine
```

---

## File Structure (ESP32 Side)

```
firmware/
└── the_box_firmware.ino
    ├── WiFi connection
    ├── registerDevice()        → upserts hardware_terminals on boot
    ├── checkForPairRequest()   → polls for status='paired'
    ├── checkForGameActivation()→ polls for status='active'
    ├── fetchGameState()        → loads initial game from games table
    ├── handleButtons()         → debounced button press detection
    ├── onButtonPress()         → maps button index → signal → broadcastEvent()
    ├── broadcastEvent()        → POST to Supabase Realtime Broadcast
    ├── syncGameToSupabase()    → periodic REST write for persistence
    ├── sendHeartbeat()         → PATCH last_heartbeat every 5s
    └── showGameScreen()        → Nokia 5110 display renderer
```

---

## Known Quirks & Important Notes

### heartbeat is millis(), not epoch
The ESP32 firmware sends `last_heartbeat` as `millis()` — the number of milliseconds since the device booted. This is NOT a Unix timestamp. The website never compares it to `Date.now()`. Online/offline detection works by watching for DB update events via Supabase Realtime — if updates stop arriving for 15 seconds, the device is considered offline.

### Broadcast has no persistence
Signals sent via Supabase Broadcast (button presses) are ephemeral — they're pub/sub only, no database write. If the website is disconnected when a signal arrives, it's lost. This is intentional (it's a clock event, not a score event). Scores are durably written to Postgres every 2 seconds via `syncGameToSupabase()`.

### The firmware's `broadcastEvent()` bug (fix before flashing)
The v2 firmware file has a bug on the line:
```cpp
body += "\"payload\":" + serialized;  // 'serialized' is undefined
```
Replace the entire `broadcastEvent()` function body to build the JSON string manually without using `serialized`. The function in the firmware correctly builds `body` as a string — just remove the one bad reference.

### Control mode polling delay
When you switch control mode on the website, the ESP32 picks it up on its next poll cycle (~2 seconds). There's a brief window where the ESP32 might still process a button press after mode is switched. This is acceptable for tournament use — it's not a security boundary, just a UX convenience.

### WiFi credentials in firmware
The firmware has hardcoded WiFi credentials:
```cpp
const char* WIFI_SSID     = "THE-BOX";
const char* WIFI_PASSWORD = "87654321";
```
Change these to your venue's WiFi before flashing. For tournament use, bring a dedicated hotspot so the SSID never changes between venues.

---

## Setup Checklist (Fresh Start)

### Supabase (one-time)
- [ ] Run the `hardware_terminals` SQL migration in Supabase SQL editor
- [ ] Verify RLS policies allow public read/insert/update on `hardware_terminals`

### Firmware (each device)
- [ ] Update `WIFI_SSID` and `WIFI_PASSWORD` to your network
- [ ] Update `SUPABASE_URL` and `SUPABASE_KEY` to your project's values
- [ ] Fix the `broadcastEvent()` `serialized` bug
- [ ] Flash to ESP32 via Arduino IDE (install Adafruit PCD8544, ArduinoJson, HTTPClient libraries)
- [ ] Verify Nokia 5110 shows pairing code on boot

### Website (each game session)
- [ ] Open Dashboard → click "Connect Controller" (gamepad icon)
- [ ] Enter the 4-char code shown on ESP32 screen
- [ ] Wait for "Controller Paired" confirmation
- [ ] Create/launch a game — ESP32 auto-activates
- [ ] Verify control mode shows "ESP32 Has Control" in HostConsole header

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No device found" on pairing | ESP32 not registered in DB | Check WiFi connection, check Supabase URL/key in firmware |
| "Pairing confirmation failed" | DB write didn't land | Check Supabase RLS policies allow anonymous UPDATE |
| ESP32 shows online then goes offline | Heartbeat not updating | Verify `sendHeartbeat()` is being called in loop() |
| Button presses not updating score | Broadcast not reaching web | Check game code matches, check `useHardwareSignaling` is mounted |
| Scores update but with 2s delay | Using REST sync not broadcast | Ensure `broadcastEvent()` is called in `onButtonPress()` |
| Mode switch takes >5s to apply | ESP32 poll interval | Normal — ESP32 polls every 2s, allow up to 3s |

---

*THE BOX — BMSCE Sports Tech Division | February 2026*