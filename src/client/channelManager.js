export class ChannelManager {
  constructor(channelList, onChannelSelect) {
    this.channelList = channelList;
    this.onChannelSelect = onChannelSelect;
    this.currentChannel = null;
  }

  renderChannels(channels) {
    this.channelList.innerHTML = '';
    channels.forEach(channel => {
      const channelElement = document.createElement('div');
      channelElement.className = `channel ${this.currentChannel === channel ? 'active' : ''}`;
      channelElement.textContent = `# ${channel}`;
      channelElement.onclick = () => this.selectChannel(channel);
      this.channelList.appendChild(channelElement);
    });
  }

  selectChannel(channel) {
    if (this.currentChannel === channel) return;
    this.currentChannel = channel;
    this.onChannelSelect(channel);
    this.updateActiveChannel();
  }

  updateActiveChannel() {
    const channels = this.channelList.getElementsByClassName('channel');
    Array.from(channels).forEach(channel => {
      channel.classList.toggle('active', 
        channel.textContent.substring(2) === this.currentChannel);
    });
  }

  getCurrentChannel() {
    return this.currentChannel;
  }
}