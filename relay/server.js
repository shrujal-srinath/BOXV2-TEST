const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.RELAY_AUTH_TOKEN || 'thebox-relay-2024';

// rooms: Map<deviceId, Set<WebSocket>>
const rooms = new Map();

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'ok', 
      rooms: rooms.size,
      connections: [...rooms.values()]
        .reduce((a, s) => a + s.size, 0)
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  // URL format: /device/XXXX
  const match = req.url?.match(/^\/device\/([A-Z0-9]{4})$/i);
  if (!match) {
    ws.close(4001, 'Invalid room');
    return;
  }

  const deviceId = match[1].toUpperCase();
  
  // Add to room
  if (!rooms.has(deviceId)) rooms.set(deviceId, new Set());
  const room = rooms.get(deviceId);
  room.add(ws);

  console.log(`[${deviceId}] connected (${room.size} in room)`);

  // Forward all messages to everyone else in the same room
  ws.on('message', (data) => {
    const roomMembers = rooms.get(deviceId);
    if (!roomMembers) return;
    roomMembers.forEach(member => {
      if (member !== ws && member.readyState === WebSocket.OPEN) {
        member.send(data);
      }
    });
  });

  ws.on('close', () => {
    const roomMembers = rooms.get(deviceId);
    if (roomMembers) {
      roomMembers.delete(ws);
      if (roomMembers.size === 0) rooms.delete(deviceId);
    }
    console.log(`[${deviceId}] disconnected`);
  });

  ws.on('error', () => {
    const roomMembers = rooms.get(deviceId);
    if (roomMembers) roomMembers.delete(ws);
  });

  // Ping every 30s to keep connection alive through proxies
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  ws.on('pong', () => {
    // Connection is alive
  });
});

server.listen(PORT, () => {
  console.log(`THE BOX relay running on port ${PORT}`);
});
