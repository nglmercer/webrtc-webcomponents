export class WebRTCManager {
  constructor() {
    this.connections = new Map();
    this.dataChannels = new Map();
    this.privateChannels = new Map();
    this.onMessage = null;
    this.onPrivateMessage = null;
  }

  async createPeerConnection(targetUserId) {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };
    const pc = new RTCPeerConnection(config);
    this.connections.set(targetUserId, pc);

    // Create main chat channel
    const dataChannel = pc.createDataChannel('chat');
    this.setupDataChannel(dataChannel, targetUserId);

    // Create private messaging channel
    const privateChannel = pc.createDataChannel(`private-${targetUserId}`);
    this.setupPrivateChannel(privateChannel, targetUserId);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(targetUserId, event.candidate);
      }
    };

    pc.ondatachannel = (event) => {
      if (event.channel.label.startsWith('private-')) {
        this.setupPrivateChannel(event.channel, targetUserId);
      } else {
        this.setupDataChannel(event.channel, targetUserId);
      }
    };

    return pc;
  }

  setupDataChannel(dataChannel, targetUserId) {
    this.dataChannels.set(targetUserId, dataChannel);
    dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.onMessage?.(message, targetUserId);
    };
    dataChannel.onopen = () => console.log(`Data channel with ${targetUserId} is open`);
    dataChannel.onclose = () => console.log(`Data channel with ${targetUserId} is closed`);
  }

  setupPrivateChannel(channel, targetUserId) {
    this.privateChannels.set(targetUserId, channel);
    channel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.onPrivateMessage?.(message, targetUserId);
    };
    channel.onopen = () => console.log(`Private channel with ${targetUserId} is open`);
    channel.onclose = () => console.log(`Private channel with ${targetUserId} is closed`);
  }

  sendPrivateMessage(message, targetUserId) {
    const channel = this.privateChannels.get(targetUserId);
    if (channel?.readyState === 'open') {
      channel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  async createOffer(targetUserId) {
    const pc = await this.createPeerConnection(targetUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }

  async handleAnswer(targetUserId, answer) {
    const pc = this.connections.get(targetUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleOffer(targetUserId, offer) {
    const pc = await this.createPeerConnection(targetUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  async addIceCandidate(targetUserId, candidate) {
    const pc = this.connections.get(targetUserId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  sendMessage(message, targetUserId) {
    const dataChannel = this.dataChannels.get(targetUserId);
    if (dataChannel?.readyState === 'open') {
      dataChannel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  broadcastMessage(message, excludeUserId = null) {
    this.dataChannels.forEach((dataChannel, userId) => {
      if (userId !== excludeUserId && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(message));
      }
    });
  }

  closeConnection(targetUserId) {
    const pc = this.connections.get(targetUserId);
    if (pc) {
      pc.close();
      this.connections.delete(targetUserId);
      this.dataChannels.delete(targetUserId);
      this.privateChannels.delete(targetUserId);
    }
  }
}
/* export class WebRTCManager {
  constructor() {
    this.connections = new Map();
    this.dataChannels = new Map();
    this.privateChannels = new Map();
    this.onMessage = null;
    this.onPrivateMessage = null;
  }

  async createPeerConnection(targetUserId) {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };
    const pc = new RTCPeerConnection(config);
    this.connections.set(targetUserId, pc);

    // Create main chat channel
    const dataChannel = pc.createDataChannel('chat');
    this.setupDataChannel(dataChannel, targetUserId);

    // Create private messaging channel
    const privateChannel = pc.createDataChannel(`private-${targetUserId}`);
    this.setupPrivateChannel(privateChannel, targetUserId);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(targetUserId, event.candidate);
      }
    };

    pc.ondatachannel = (event) => {
      if (event.channel.label.startsWith('private-')) {
        this.setupPrivateChannel(event.channel, targetUserId);
      } else {
        this.setupDataChannel(event.channel, targetUserId);
      }
    };

    return pc;
  }

  setupDataChannel(dataChannel, targetUserId) {
    this.dataChannels.set(targetUserId, dataChannel);
    dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.onMessage?.(message, targetUserId);
    };
    dataChannel.onopen = () => console.log(`Data channel with ${targetUserId} is open`);
    dataChannel.onclose = () => console.log(`Data channel with ${targetUserId} is closed`);
  }

  setupPrivateChannel(channel, targetUserId) {
    this.privateChannels.set(targetUserId, channel);
    channel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.onPrivateMessage?.(message, targetUserId);
    };
    channel.onopen = () => console.log(`Private channel with ${targetUserId} is open`);
    channel.onclose = () => console.log(`Private channel with ${targetUserId} is closed`);
  }

  sendPrivateMessage(message, targetUserId) {
    const channel = this.privateChannels.get(targetUserId);
    if (channel?.readyState === 'open') {
      channel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  async createOffer(targetUserId) {
    const pc = await this.createPeerConnection(targetUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }

  async handleAnswer(targetUserId, answer) {
    const pc = this.connections.get(targetUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleOffer(targetUserId, offer) {
    const pc = await this.createPeerConnection(targetUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  async addIceCandidate(targetUserId, candidate) {
    const pc = this.connections.get(targetUserId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  sendMessage(message, targetUserId) {
    const dataChannel = this.dataChannels.get(targetUserId);
    if (dataChannel?.readyState === 'open') {
      dataChannel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  broadcastMessage(message, excludeUserId = null) {
    this.dataChannels.forEach((dataChannel, userId) => {
      if (userId !== excludeUserId && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(message));
      }
    });
  }

  closeConnection(targetUserId) {
    const pc = this.connections.get(targetUserId);
    if (pc) {
      pc.close();
      this.connections.delete(targetUserId);
      this.dataChannels.delete(targetUserId);
      this.privateChannels.delete(targetUserId);
    }
  }
} */