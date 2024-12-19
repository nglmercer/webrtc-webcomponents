export class UserManager {
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