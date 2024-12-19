export class CommandHandler {
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