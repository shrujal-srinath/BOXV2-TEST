---
name: project-overview
description: THE BOX — what the platform is, hardware architecture, Pi referee controller, dual HDMI setup, software stack, key files
metadata:
  type: project
---

# THE BOX — Project Overview

THE BOX is a hardware-software basketball officiating system. A referee keeps the device on their courtside table. It scores, times, tracks stats/shot locations, and broadcasts live to spectators.

## Hardware

- **Raspberry Pi 4** — main compute
  - **HDMI 1** → Waveshare 7" touch screen → referee-facing controller (`/referee` route)
  - **HDMI 2** → LED screen / TV → spectator scoreboard (`/pi-receiver` route)
- **Raspberry Pi Pico W** — button controller (UART `/dev/serial0`, 115200 baud)
  - BTN1-3 = Team A +1/+2/+3, BTN4-6 = Team B +1/+2/+3, BTN7 = clock toggle, BTN8 = shot clock 24s, BTN9 = undo
  - 1 toggle switch = lock/unlock touchscreen (fires `SETTINGS` message)
- **12V Siren/Buzzer** — GPIO 21 via pigpio (SHORT=800ms, LONG=2s)
- **ESP32 C3 Dongle** — optional wireless input (`/dev/ttyACM0`)

## Software Structure

- `pi-daemon/index.js` — Node.js daemon: game state engine, UART→Socket.io, clock (100ms tick), offline shot queue, Supabase sync
- `src/pages/RefereeScreen.tsx` — master referee UI state machine (splash→dashboard→match_setup→roster_setup→connecting→live_game↔settings→post_game)
- `src/pages/PiLauncher.tsx` — Pi boot landing page
- `src/components/refereebox/` — all Pi-specific UI components

## Game Modes

1. **Quick** — scores + clock only
2. **Stats** — + fouls + timeouts per FIBA bucket rules
3. **Advanced** — + shot location on hex court map after every basket (with offline queue)

## Key Design Decisions

Physical buttons always take priority; touchscreen is supplementary. Toggle switch is the safety lock to prevent accidental taps during play. LAN-first offline operation — no internet dependency for core function.

**Why:** Built for BMSCE Sports Dept & Robotics Lab for college basketball officiating.
**How to apply:** Reliability and physical button feel matter more than UI polish. Offline-first always.
