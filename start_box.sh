#!/bin/bash

# ==========================================
# THE BOX: Master Auto-Boot Sequence
# ==========================================

PROJECT_DIR="/home/the-box/BOXV2-TEST"

echo "📦 Booting THE BOX Ecosystem..."

# 1. Hardware Daemon
echo "⚡ Starting Hardware Brain..."
cd "$PROJECT_DIR/pi-daemon"
sudo env PATH=$PATH node index.js &
DAEMON_PID=$!

# 2. React Frontend
echo "🖥️  Starting Visual Interface..."
cd "$PROJECT_DIR"
npm run dev -- --host &
VITE_PID=$!

# 3. Black screen + hide cursor while servers start
echo "🖤 Setting black screen..."
DISPLAY=:0 xsetroot -solid black 2>/dev/null || true
DISPLAY=:0 unclutter -idle 0 &

# 4. Wait for servers
echo "⏳ Waiting for servers..."
sleep 12

# 4. Pi Launcher on display 0 (DSI primary)
echo "📺 Launching Pi Launcher UI..."
DISPLAY=:0 chromium-browser \
  --app=http://localhost:5173/pi-launcher \
  --start-fullscreen \
  --kiosk \
  --no-sandbox \
  --disable-infobars \
  --noerrdialogs \
  --user-data-dir=/tmp/chrome_referee &

# 5. Pi Launcher on display 1 (HDMI)
echo "🏟️  Launching Pi Launcher UI (HDMI)..."
DISPLAY=:0 chromium-browser \
  --app=http://localhost:5173/pi-launcher \
  --start-fullscreen \
  --kiosk \
  --no-sandbox \
  --disable-infobars \
  --noerrdialogs \
  --window-position=1024,0 \
  --user-data-dir=/tmp/chrome_arena &

echo "✅ THE BOX IS LIVE."
echo "   Daemon PID: $DAEMON_PID"
echo "   Vite PID:   $VITE_PID"

# Trap SIGINT to cleanly kill children
trap "kill $DAEMON_PID $VITE_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait