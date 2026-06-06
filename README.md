# THE BOX — Basketball Referee & Scoring System

THE BOX is a hardware-software basketball officiating system built on a Raspberry Pi 4. A referee keeps it on their table courtside. It scores, officiates, tracks stats, and broadcasts live to spectators.

---

## Hardware

| Component | Purpose |
|---|---|
| Raspberry Pi 4 | Main compute unit — runs the daemon and both screens |
| Waveshare 7" Touch Display | HDMI 1 → referee-facing touchscreen controller |
| LED Screen / TV | HDMI 2 → spectator-facing scoreboard (any size display) |
| Raspberry Pi Pico W | Button controller — reads 9 buttons + toggle, sends over UART (`/dev/serial0`) |
| 9 Push Buttons | Physical scoring and clock control (see layout below) |
| 1 Toggle Switch | Locks/unlocks the touchscreen |
| 12V Siren/Buzzer | GPIO 21 — sounds on period end and shot clock violation |
| ESP32 C3 Dongle | Optional wireless secondary input (`/dev/ttyACM0`) |

### Dual HDMI Output

```
Pi 4
 ├── HDMI 1 → Waveshare 7" Touch Screen
 │            Route: /referee
 │            WHO SEES IT: The referee (face-down on table)
 │            WHAT IT SHOWS: Full control UI — scoreboard, clock, buttons,
 │                           shot attribution, settings, roster
 │
 └── HDMI 2 → LED Screen / Projector / TV
              Route: /pi-receiver
              WHO SEES IT: Spectators, players, coaches
              WHAT IT SHOWS: Clean live scoreboard — scores, clock, period,
                             shot clock, possession arrow
```

---

## Physical Button Layout (Pico)

The Pico reads 9 push buttons + 1 toggle and sends named events over UART at 115200 baud.

```
┌─────────────────────────────────────────────────────────────────┐
│                    REFEREE BUTTON BOX                           │
│                                                                 │
│   HOME (Team A)              AWAY (Team B)                      │
│  ┌──────┐ ┌──────┐ ┌──────┐  ┌──────┐ ┌──────┐ ┌──────┐      │
│  │  +1  │ │  +2  │ │  +3  │  │  +1  │ │  +2  │ │  +3  │      │
│  │  FT  │ │  2PT │ │  3PT │  │  FT  │ │  2PT │ │  3PT │      │
│  └──────┘ └──────┘ └──────┘  └──────┘ └──────┘ └──────┘      │
│   BTN 1    BTN 2    BTN 3     BTN 4    BTN 5    BTN 6          │
│                                                                 │
│           ┌──────┐  ┌──────┐  ┌──────┐                        │
│           │CLOCK │  │ SHOT │  │ UNDO │                        │
│           │ TOG  │  │  24s │  │      │                        │
│           └──────┘  └──────┘  └──────┘                        │
│            BTN 7    BTN 8     BTN 9                            │
│                                                                 │
│                    ┌───────────┐                               │
│                    │  TOGGLE   │ ← locks/unlocks touchscreen   │
│                    └───────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### UART Message Protocol

| Button | UART Message | Action |
|--------|-------------|--------|
| BTN 1 | `SCORE_A1` | Team A +1 (free throw) |
| BTN 2 | `SCORE_A2` | Team A +2 (field goal) |
| BTN 3 | `SCORE_A3` | Team A +3 (three-pointer) |
| BTN 4 | `SCORE_B1` | Team B +1 (free throw) |
| BTN 5 | `SCORE_B2` | Team B +2 (field goal) |
| BTN 6 | `SCORE_B3` | Team B +3 (three-pointer) |
| BTN 7 | `CLOCK_TOGGLE` | Start / stop game clock |
| BTN 8 | `SHOT_CLOCK_24` | Reset shot clock to 24s |
| BTN 9 | `UNDO` | Undo last scoring action |
| TOGGLE | `SETTINGS` | Toggle touch screen lock/unlock |

> `SHOT_CLOCK_14` (reset to 14s after offensive rebound) is available via the touchscreen when unlocked.

---

## Software Architecture

```
pi-daemon/          Node.js daemon (runs on Pi boot)
  index.js          Game state engine, UART listener, clock, buzzer, Socket.io server
  supabaseSync.js   Cloud sync — broadcasts state to Supabase Realtime
  buttonMap.js      GPIO output config (buzzer pin)

src/pages/
  PiLauncher.tsx    Landing screen on Pi startup → navigates to /referee or /pi-receiver
  RefereeScreen.tsx Master state machine for the referee UI (HDMI 1)
  WatchPage.tsx     Spectator live view (HDMI 2 / any browser)

src/components/refereebox/
  SplashScreen.tsx          Boot animation
  PiDashboard.tsx           Mode select (Start Game / Stream Live / Arena View)
  MatchSetup.tsx            Game configuration wizard
  RosterSetup.tsx           Player roster entry
  LockedScoreboard.tsx      Live game scoreboard (touch-locked, physical buttons only)
  PiTouchScoringScreen.tsx  Full touch scoring deck (unlocked by toggle)
  UnlockedSettings.tsx      Settings panel (adjust clock, fouls, timeouts)
  PiAdvancedShotFlow.tsx    Shot attribution popup (court map + player select)
  PiHexCourt.tsx            Hex-zone court map for shot tracking
  GameReviewScreen.tsx      Post-game summary
  PhoneSetupOverlay.tsx     Phone/cast setup
  sharedScoreboard.tsx      Shared scoreboard component
```

### Daemon ↔ UI Communication

The daemon runs a local Socket.io server on port 3001. Both HDMI screens connect to it.

```
Pico (UART) → pi-daemon → Socket.io → Waveshare UI (HDMI 1)
                        ↓
                   Supabase Realtime → Cloud / Web Browsers
                        ↓
                   Socket.io → Spectator Screen (HDMI 2)
```

---

## Referee Screen State Machine

```
SPLASH
  └→ DASHBOARD
       ├→ MATCH_SETUP
       │     └→ ROSTER_SETUP (stats/advanced mode only)
       │           └→ CONNECTING → PRE_GAME → LIVE_GAME
       │                                 ↕
       │                             SETTINGS
       │                                 └→ END_GAME_CONFIRM → POST_GAME
       │
       └→ WATCH (receive live game — STREAM LIVE mode)
```

---

## Game Modes

| Mode | What it does |
|------|-------------|
| **Quick** | Scores + clock only. No stats, no rosters. Fastest to start. |
| **Stats** | Scores + clock + fouls + timeouts + team-level stats. Roster optional. |
| **Advanced** | Everything in Stats + shot location on a hex court map after every basket. |

### How Advanced Shot Tracking Works
1. Ref presses physical button (e.g., BTN 2 — Team A +2)
2. Score updates immediately on both screens
3. Touch popup appears on Waveshare screen: court map + roster list
4. Ref taps where the shot came from on the court + which player (optional)
5. Shot event saved to Supabase with zone, x/y, player, period, and game clock
6. If offline, shot is queued locally and auto-flushed when reconnected

---

## Basketball Officiating Workflow

### Pre-Game
1. Power on Pi → SplashScreen → Dashboard
2. Select **START GAME**
3. **Match Setup**: enter team names, pick colors, set period length (10/12/20 min), shot clock (24/14s or off), quarters vs halves, timeouts, game mode
4. **Roster Setup** (stats/advanced): enter player names + jersey numbers for both teams
5. Confirm → connects to daemon → PRE_GAME screen

### Live Game
- **Scoring**: press physical buttons (BTN 1–6) immediately — score updates on both screens
- **Clock**: BTN 7 toggles start/stop; auto-stops on period end; buzzer fires
- **Shot clock**: BTN 8 resets to 24s; touchscreen shows 14s option after offensive rebound (when unlocked)
- **Fouls**: unlocked touchscreen → tap FOUL for team; auto-shows BONUS when team reaches 5 fouls
- **Timeouts**: unlocked touchscreen → tap TIMEOUT; tracks remaining per FIBA bucket rules
- **Possession**: unlocked touchscreen → tap HOME ◀ or AWAY ▶
- **Undo**: BTN 9 — rolls back the last state (score, foul, timeout); up to 50 levels deep
- **Horn**: tap HORN on the unlocked touchscreen to manually fire the buzzer

### Touch Lock System
- By default touchscreen is **locked** — no accidental taps during play
- **TOGGLE switch** → unlocks touchscreen for foul entry, timeouts, corrections
- **TOGGLE again** → relocks
- Green "TOUCH ACTIVE" indicator appears on-screen when unlocked

### Period / Half Time
1. Clock hits 0 → buzzer fires (LONG blast, 2 seconds)
2. Ref flips toggle → unlocks screen → taps NEXT PERIOD
3. Clock resets, shot clock resets, team fouls reset to 0
4. Timeouts adjust per FIBA bucket rules automatically

### End of Game
1. Toggle → unlock → Settings → END GAME
2. Final score recorded to Supabase
3. Game review screen shows full stats summary
4. System returns to dashboard ready for next game

---

## FIBA Timeout Rules (Auto-Enforced)

| Period | Allowed timeouts |
|--------|-----------------|
| Q1 + Q2 (first half) | 2 total |
| Q3 | 1 |
| Q4 (until 2:00 mark) | 1 |
| Q4 last 2 minutes | 1 additional |
| Each OT period | 1 |

The daemon tracks timeout bucket state and greys out the TIMEOUT button when none remain in the current bucket.

---

## HDMI 2 — Spectator Scoreboard

The `/pi-receiver` route is designed for large LED screens and projectors:
- Full-width cinematic scoreboard layout
- Giant scores + running clock + shot clock
- Possession arrow
- Period indicator
- Broadcasts live via Supabase Realtime — works over LAN or internet
- Any laptop/TV/screen can also watch at `/watch-live` in a browser using a 4-character TV code

---

## Running the System

### On the Pi

```bash
# 1. Start the daemon
cd pi-daemon
npm start

# 2. Build and serve the React app
npm run build
npm run preview -- --host 0.0.0.0 --port 5173
```

### HDMI 1 (Waveshare 7") — Chromium kiosk
```bash
chromium-browser --kiosk http://localhost:5173/referee
```

### HDMI 2 (LED Screen) — Chromium on second display
```bash
# Local display (LAN-only, connects to daemon directly — no internet needed)
DISPLAY=:0.1 chromium-browser --kiosk http://localhost:5173/pi-local-display

# Cloud display (requires internet — shows full game analytics via Supabase)
DISPLAY=:0.1 chromium-browser --kiosk http://localhost:5173/pi-receiver
```

### Development (laptop without Pi hardware)
```bash
npm install && npm run dev
cd pi-daemon && node index.js   # runs in mock mode on macOS — no GPIO needed
# In-browser: keyboard keys 1–9 fire simulated Pico button presses via dev_pico_message
```

---

## Offline Operation

The system is built LAN-first:
- All game state lives in the Pi daemon (RAM)
- Clock, scoring, and buzzer all run locally with no network dependency
- Shot events queue offline and flush to Supabase automatically when reconnected
- The spectator screen on the same LAN works without internet via local Socket.io

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `pi-daemon/index.js` | Game state engine, UART handler, clock, buzzer, Socket.io |
| `src/hooks/useRefereeBox.ts` | Socket.io client hook — connects UI to daemon |
| `src/services/fibaTimeouts.ts` | FIBA timeout bucket logic |
| `src/services/supabaseGameService.ts` | Cloud game CRUD |
| `src/services/castControlService.ts` | Phone/cast control relay |
| `src/services/tvDisplayService.ts` | TV/spectator screen registration + heartbeat |
| `src/components/shotchart/` | Shot chart + hex court map components |
| `supabase/migrations/` | Database schema migrations |

---

## Pico W Firmware

The button controller firmware lives in `pico-firmware/main.py`. It's MicroPython and runs on the Pico W with no external dependencies. Flash instructions and full wiring diagram are in `pico-firmware/README.md`.

**Quick flash:**
```bash
pip install mpremote
mpremote connect /dev/ttyACM0 fs cp pico-firmware/main.py :main.py
```

---

## Tech Stack

- **Pi daemon**: Node.js, Express, Socket.io, serialport, pigpio
- **UI**: React + TypeScript + Vite + Tailwind CSS
- **Cloud**: Supabase (Postgres + Realtime + Storage)
- **Fonts**: Oswald (scoreboards), JetBrains Mono (data), Space Grotesk (UI)
- **Hardware**: Raspberry Pi 4, Pico W, Waveshare 7" HDMI touch display
