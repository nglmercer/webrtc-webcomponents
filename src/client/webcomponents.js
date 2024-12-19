class ChatComponent extends HTMLElement {
  constructor() {
    super();

    // Crear el shadow DOM
    this.attachShadow({ mode: 'open' });

    // Contenedor principal de los mensajes
    this.messagesDiv = document.createElement('div');
    this.messagesDiv.className = 'messages';

    // Estilo por defecto
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: Arial, sans-serif;
          border: 1px solid #ccc;
          border-radius: 5px;
          overflow: hidden;
          width: 100%;
          max-height: 300px;
        }

        .messages {
          padding: 10px;
          overflow-y: auto;
          max-height: 300px;
          background-color: var(--background-color, #fff);
          color: var(--text-color, #000);
        }

        .message {
          margin-bottom: 10px;
          padding: 5px;
          border-radius: 5px;
        }

        .system-message {
          font-style: italic;
          color: var(--system-message-color, #888);
        }

        .private-message {
          font-weight: bold;
          color: var(--private-message-color, #d63384);
        }
      </style>
    `;

    // Añadir el contenedor al shadow DOM
    this.shadowRoot.appendChild(this.messagesDiv);

    // Inicializar el tema
    this.updateTheme(this.getAttribute('theme') || 'light');
  }

  // Método para añadir un mensaje
  addMessage(text, isSystem = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSystem ? 'system-message' : ''}`;
    messageDiv.textContent = text;
    this.messagesDiv.appendChild(messageDiv);
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
  }

  // Método para añadir un mensaje privado
  addPrivateMessage(from, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message private-message';
    messageDiv.textContent = `[PM from ${from}] ${text}`;
    this.messagesDiv.appendChild(messageDiv);
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
  }

  // Método para limpiar los mensajes
  clear() {
    this.messagesDiv.innerHTML = '';
  }

  // Método para actualizar el tema
  updateTheme(theme) {
    if (theme === 'dark') {
      this.messagesDiv.style.setProperty('--background-color', '#222');
      this.messagesDiv.style.setProperty('--text-color', '#fff');
      this.messagesDiv.style.setProperty('--system-message-color', '#bbb');
      this.messagesDiv.style.setProperty('--private-message-color', '#ff79c6');
    } else {
      this.messagesDiv.style.setProperty('--background-color', '#fff');
      this.messagesDiv.style.setProperty('--text-color', '#000');
      this.messagesDiv.style.setProperty('--system-message-color', '#888');
      this.messagesDiv.style.setProperty('--private-message-color', '#d63384');
    }
  }

  // Observar cambios en el atributo 'theme'
  static get observedAttributes() {
    return ['theme'];
  }

  // Callback que se ejecuta cuando el atributo 'theme' cambia
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'theme') {
      this.updateTheme(newValue);
    }
  }
}

// Definir el nuevo elemento
customElements.define('chat-component', ChatComponent);
class GroupCall extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.usersInCall = new Set();
    this.webrtc = null;
    this.currentUserId = null;
  }

  connectedCallback() {
    this.render();
  }

  setWebRTCManager(webrtc, currentUserId) {
    this.webrtc = webrtc;
    this.currentUserId = currentUserId;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .call-container {
          display: flex;
          flex-direction: column;
          padding: 1rem;
          background: #f0f0f0;
          border: 1px solid #ccc;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .controls button {
          margin: 0.5rem 0;
          padding: 0.5rem;
          cursor: pointer;
        }

        .video-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 1rem;
        }

        video {
          width: 100%;
          max-width: 200px;
          height: 150px;
          background: #000;
          border: 1px solid #444;
          border-radius: 8px;
        }

        .user-list {
          margin-top: 1rem;
          font-size: 0.9rem;
        }
      </style>

      <div class="call-container">
        <div class="controls">
          <button id="start-call">Iniciar Llamada</button>
          <button id="join-call">Conectarse a la llamada</button>
        </div>
        <div class="video-container" id="video-container">
          <video id="local-video" autoplay muted></video>
        </div>
        <div class="user-list">
          <strong>Usuarios en la llamada:</strong>
          <ul id="user-list"></ul>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('start-call').addEventListener('click', () => this.startCall());
    this.shadowRoot.getElementById('join-call').addEventListener('click', () => this.joinCall());
  }
  async joinCall() {
      if (!this.webrtc) return;
      if (this.usersInCall.has(this.currentUserId)) return;
  }
  async startCall() {
    if (!this.webrtc) return;

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const localVideo = this.shadowRoot.getElementById('local-video');
      localVideo.srcObject = localStream;

    } catch (error) {
      console.error('Error al obtener el stream local:', error);
    }
  }

  addUserInCall(userId) {
    if (this.usersInCall.has(userId)) return;
    this.usersInCall.add(userId);
    this.updateUserList();
  }

  addRemoteStream(userId, stream) {
    const videoContainer = this.shadowRoot.getElementById('video-container');
    let videoElement = this.shadowRoot.getElementById(`remote-video-${userId}`);

    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.id = `remote-video-${userId}`;
      videoElement.autoplay = true;
      videoContainer.appendChild(videoElement);
    }

    videoElement.srcObject = stream;
    this.usersInCall.add(userId);
    this.updateUserList();
  }

  updateUserList() {
    const userListElement = this.shadowRoot.getElementById('user-list');
    userListElement.innerHTML = '';
    this.usersInCall.forEach(userId => {
      const li = document.createElement('li');
      li.textContent = userId;
      userListElement.appendChild(li);
    });
  }
}

customElements.define('group-call', GroupCall);
