export class RoomManager {
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