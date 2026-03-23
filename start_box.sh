#!/bin/bash

# ==========================================
# THE BOX: Master Auto-Boot Sequence
# ==========================================

# NOTE: Update this path to wherever your project actually lives on the Pi
PROJECT_DIR="/home/pi/BOXV2-TEST-main" 

echo "📦 Booting THE BOX Ecosystem..."

# 1. Start the Hardware Daemon in the background
echo "⚡ Starting Hardware Brain..."
cd $PROJECT_DIR/pi-daemon
npm start &

# 2. Start the React Frontend in the background
echo "🖥️ Starting Visual Interface..."
cd $PROJECT_DIR
npm run dev &

# 3. Wait 10 seconds to ensure both local servers are fully online
echo "⏳ Waiting for servers to warm up..."
sleep 10

# 4. Launch Display 1: The DSI Touchscreen (Referee Console)
# We use a separate user-data-dir so the two windows don't merge into one session
echo "📺 Launching Referee UI..."
chromium-browser --app=http://localhost:5173/referee \
  --start-fullscreen \
  --kiosk \
  --window-position=0,0 \
  --user-data-dir=/tmp/chrome_referee &

# 5. Launch Display 2: The HDMI Output (Arena Spectator View)
# We offset the window position by 1024 pixels (the width of your DSI screen) 
# so it is forced onto the secondary HDMI monitor.
echo "🏟️ Launching Arena UI..."
chromium-browser --app=http://localhost:5173/arena \
  --start-fullscreen \
  --kiosk \
  --window-position=1024,0 \
  --user-data-dir=/tmp/chrome_arena &

echo "✅ THE BOX IS LIVE."

# Keep the script running so the background processes don't die
wait