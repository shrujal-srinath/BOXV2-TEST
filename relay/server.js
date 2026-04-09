const WebSocket = require('ws');
const http = require('http');
const PORT = process.env.PORT || 8080;

// rooms: Map<deviceId, Set<WebSocket>>
const rooms = new Map();

const server = http.createServer((req, res) => {
  if(req.url === '/health'){
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      rooms: rooms.size,
      connections: [...rooms.values()]
        .reduce((a, s) => a + s.size, 0)
    }));
    return;
  }
  res.writeHead(404); res.end();
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const match = req.url?.match(/^\/device\/([A-Z0-9]{4})$/i);
  if(!match){ ws.close(4001, 'Invalid room'); return; }

  const deviceId = match[1].toUpperCase();
  if(!rooms.has(deviceId)) rooms.set(deviceId, new Set());
  const room = rooms.get(deviceId);
  room.add(ws);

  console.log(`[${deviceId}] +1 connection (${room.size} total)`);

  ws.on('message', (data) => {
    const roomMembers = rooms.get(deviceId);
    if(!roomMembers) return;
    roomMembers.forEach(member => {
      if(member !== ws && member.readyState === WebSocket.OPEN){
        member.send(data);
      }
    });
  });

  ws.on('close', () => {
    const roomMembers = rooms.get(deviceId);
    if(roomMembers){
      roomMembers.delete(ws);
      if(roomMembers.size === 0) rooms.delete(deviceId);
    }
    console.log(`[${deviceId}] -1 connection`);
  });

  ws.on('error', () => {
    const roomMembers = rooms.get(deviceId);
    if(roomMembers) roomMembers.delete(ws);
  });

  const ping = setInterval(() => {
    if(ws.readyState === WebSocket.OPEN) ws.ping();
    else clearInterval(ping);
  }, 25000);

  ws.on('pong', () => {});
});

server.listen(PORT, () => {
  console.log(`THE BOX relay on port ${PORT}`);
});
