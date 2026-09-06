import { WebSocketServer } from 'ws';

let wss = null;
const clients = new Set();

export function initWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (socket) => {
    clients.add(socket);
    console.log('Dashboard client connected. Total:', clients.size);

    socket.on('close', () => {
      clients.delete(socket);
      console.log('Dashboard client disconnected. Total:', clients.size);
    });
  });
}

export function broadcast(event) {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}