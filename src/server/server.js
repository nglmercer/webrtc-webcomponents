import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'node:path';
class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.clients = new Map();
    this.defaultChannels = ['general', 'random', 'help', 'announcements'];
  }

  addClient(ws, clientId) {
    this.clients.set(ws, { id: clientId, room: null });
    return {
      clientId,
      channels: this.defaultChannels
    };
  }

  joinRoom(ws, roomId) {
    const client = this.clients.get(ws);
    if (!client) return null;

    // Leave current room if exists
    if (client.room) {
      this.leaveRoom(ws);
    }
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    
    client.room = roomId;
    this.rooms.get(roomId).add(ws);
    
    return {
      roomId,
      usersCount: this.rooms.get(roomId).size,
      users: Array.from(this.rooms.get(roomId)).map(userWs => this.clients.get(userWs).id)
    };
  }

  leaveRoom(ws) {
    const client = this.clients.get(ws);
    if (client && client.room) {
      const room = this.rooms.get(client.room);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          this.rooms.delete(client.room);
        }
      }
      const roomId = client.room;
      client.room = null;
      return roomId;
    }
    return null;
  }

  broadcastToRoom(roomId, message, excludeWs = null) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.forEach(client => {
        if (client !== excludeWs && client.readyState === 1) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  removeClient(ws) {
    const roomId = this.leaveRoom(ws);
    this.clients.delete(ws);
    return roomId;
  }

  getClientId(ws) {
    return this.clients.get(ws)?.id;
  }

  getClientRoom(ws) {
    return this.clients.get(ws)?.room;
  }

  isClientInRoom(ws, roomId) {
    const client = this.clients.get(ws);
    return client && client.room === roomId;
  }
}
class UserManager {
  constructor() {
    this.users = new Map(); // userId -> { ws, info }
    this.wsToUser = new Map(); // ws -> userId
  }

  addUser(ws, userId, info = {}) {
    this.users.set(userId, { ws, info });
    this.wsToUser.set(ws, userId);
    return userId;
  }

  removeUser(userId) {
    const user = this.users.get(userId);
    if (user) {
      this.wsToUser.delete(user.ws);
      this.users.delete(userId);
    }
  }

  getUserById(userId) {
    return this.users.get(userId);
  }

  getUserByWs(ws) {
    const userId = this.wsToUser.get(ws);
    return userId ? this.users.get(userId) : null;
  }

  getUserId(ws) {
    return this.wsToUser.get(ws);
  }

  getAllUsers() {
    return Array.from(this.users.entries()).map(([id, user]) => ({
      id,
      ...user.info
    }));
  }

  sendMessageToUser(userId, message) {
    const user = this.users.get(userId);
    if (user && user.ws.readyState === 1) {
      user.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  updateUserInfo(userId, info) {
    const user = this.users.get(userId);
    if (user) {
      user.info = { ...user.info, ...info };
      return true;
    }
    return false;
  }
}
class CommandHandler {
  constructor(roomManager, userManager) {
    this.roomManager = roomManager;
    this.userManager = userManager;
    this.commands = new Map([
      ['msg', this.handlePrivateMessage.bind(this)],
      ['kick', this.handleKick.bind(this)],
      ['users', this.handleListUsers.bind(this)],
      ['whois', this.handleWhois.bind(this)]
    ]);
  }

  isCommand(message) {
    return message.startsWith('/');
  }

  parseCommand(message) {
    const parts = message.slice(1).split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    return { command, args };
  }

  async handleCommand(ws, message) {
    if (!this.isCommand(message)) return false;

    const { command, args } = this.parseCommand(message);
    const handler = this.commands.get(command);

    if (handler) {
      await handler(ws, args);
      return true;
    }
    
    return false;
  }

  async handlePrivateMessage(ws, args) {
    const [targetUser, ...messageParts] = args;
    const message = messageParts.join(' ');
    const senderId = this.userManager.getUserId(ws);

    if (!targetUser || !message) {
      this.sendSystemMessage(ws, 'Usage: /msg <username> <message>');
      return;
    }

    const targetUserData = this.userManager.getUserById(targetUser);
    if (!targetUserData) {
      this.sendSystemMessage(ws, `User ${targetUser} not found`);
      return;
    }

    this.userManager.sendMessageToUser(targetUser, {
      type: 'privateMessage',
      from: senderId,
      text: message
    });

    this.sendSystemMessage(ws, `Message sent to ${targetUser}`);
  }

  async handleKick(ws, args) {
    const [targetUser] = args;
    const senderId = this.userManager.getUserId(ws);
    const senderRoom = this.roomManager.getClientRoom(ws);

    if (!targetUser) {
      this.sendSystemMessage(ws, 'Usage: /kick <username>');
      return;
    }

    const targetUserData = this.userManager.getUserById(targetUser);
    if (!targetUserData) {
      this.sendSystemMessage(ws, `User ${targetUser} not found`);
      return;
    }

    if (this.roomManager.getClientRoom(targetUserData.ws) !== senderRoom) {
      this.sendSystemMessage(ws, `User ${targetUser} is not in this channel`);
      return;
    }

    this.roomManager.leaveRoom(targetUserData.ws);
    this.userManager.sendMessageToUser(targetUser, {
      type: 'kicked',
      from: senderId,
      roomId: senderRoom
    });

    this.roomManager.broadcastToRoom(senderRoom, {
      type: 'userKicked',
      userId: targetUser,
      by: senderId
    });
  }

  async handleListUsers(ws) {
    const room = this.roomManager.getClientRoom(ws);
    const users = this.userManager.getAllUsers()
      .filter(user => this.roomManager.isClientInRoom(
        this.userManager.getUserById(user.id).ws,
        room
      ));

    this.sendSystemMessage(ws, 'Users in channel:');
    users.forEach(user => {
      this.sendSystemMessage(ws, `- ${user.id}`);
    });
  }

  async handleWhois(ws, args) {
    const [targetUser] = args;
    
    if (!targetUser) {
      this.sendSystemMessage(ws, 'Usage: /whois <username>');
      return;
    }

    const user = this.userManager.getUserById(targetUser);
    if (!user) {
      this.sendSystemMessage(ws, `User ${targetUser} not found`);
      return;
    }

    const room = this.roomManager.getClientRoom(user.ws);
    this.sendSystemMessage(ws, `User: ${targetUser}`);
    this.sendSystemMessage(ws, `Current channel: ${room || 'None'}`);
  }

  sendSystemMessage(ws, text) {
    ws.send(JSON.stringify({
      type: 'system',
      text
    }));
  }
}
const __dirname = dirname(fileURLToPath(import.meta.url));
console.log(__dirname);
const app = express();
app.use(express.static(join(__dirname, '..','..',  'src', 'client')));
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '..','..', 'src', 'client'));
});
const server = createServer(app);

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