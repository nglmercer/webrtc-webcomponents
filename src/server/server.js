import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'node:path';
import { RoomManager } from './roomManager.js';
import { UserManager } from './userManager.js';
import { CommandHandler } from './commandHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(readFileSync(join(__dirname, '../client/index.html')));
  } else if (req.url.startsWith('/src/client/')) {
    const filePath = join(__dirname, '..', '..', req.url);
    const ext = extname(filePath);
    let contentType = 'application/octet-stream'; // Tipo MIME por defecto

    switch (ext) {
      case '.html':
        contentType = 'text/html';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.js':
        contentType = 'application/javascript';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.svg':
          contentType = 'image/svg+xml';
          break;
      // Agrega más tipos MIME según las extensiones que necesites servir
    }

    try {
      const fileContent = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fileContent);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Archivo no encontrado');
      }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('No encontrado');
  }
});

const wss = new WebSocketServer({ server });
const roomManager = new RoomManager();
const userManager = new UserManager();
const commandHandler = new CommandHandler(roomManager, userManager);

wss.on('connection', (ws) => {
  const userId = Math.random().toString(36).substr(2, 9);
  const clientInfo = roomManager.addClient(ws, userId);
  userManager.addUser(ws, userId);
  
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId: userId,
    channels: clientInfo.channels
  }));

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Message received:', message);
      if (message.type === 'message') {
        // Check if it's a command
        const isCommand = await commandHandler.handleCommand(ws, message.text);
        console.log('Message command', isCommand, message.text);
        if (isCommand) return;
      }

      switch (message.type) {
        case 'join':
          const joinResult = roomManager.joinRoom(ws, message.roomId);
          if (joinResult) {
            ws.send(JSON.stringify({
              type: 'joined',
              roomId: joinResult.roomId,
              usersCount: joinResult.usersCount,
              users: joinResult.users
            }));
            roomManager.broadcastToRoom(message.roomId, {
              type: 'userJoined',
              userId
            }, ws);
          }
          break;

        case 'message':
          const room = roomManager.getClientRoom(ws);
          if (room) {
            roomManager.broadcastToRoom(room, {
              type: 'message',
              userId,
              text: message.text
            });
          }
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          if (message.targetUserId && roomManager.isClientInRoom(ws, message.roomId)) {
            roomManager.broadcastToRoom(message.roomId, {
              type: message.type,
              userId,
              targetUserId: message.targetUserId,
              data: message.data
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    const roomId = roomManager.removeClient(ws);
    if (roomId) {
      roomManager.broadcastToRoom(roomId, {
        type: 'userLeft',
        userId
      });
    }
    userManager.removeUser(userId);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});