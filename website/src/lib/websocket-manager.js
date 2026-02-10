/**
 * VocalIA WebSocket Manager
 * Session 250.56: Real-time connection management
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Heartbeat/ping-pong
 * - Event subscription
 * - Message queue during disconnection
 * - Connection state management
 * - Multiple channel support
 */

const WS_CONFIG = {
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  reconnectMaxAttempts: 10,
  heartbeatInterval: 30000,
  heartbeatTimeout: 5000,
  messageQueueSize: 100,
  debug: false // Set to true for debugging
};

// Debug logger (disabled in production)
const wsDebug = WS_CONFIG.debug ? (...args) => console.debug('[WS]', ...args) : () => {};

const WS_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

class WebSocketManager {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      autoConnect: options.autoConnect !== false,
      autoReconnect: options.autoReconnect !== false,
      heartbeat: options.heartbeat !== false,
      protocols: options.protocols || [],
      ...options
    };

    this.socket = null;
    this.state = WS_STATES.CLOSED;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.heartbeatTimeoutTimer = null;
    this.messageQueue = [];
    this.channels = new Map();
    this.eventHandlers = new Map();
    this.connectionId = null;

    if (this.options.autoConnect) {
      this.connect();
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.socket && this.state !== WS_STATES.CLOSED) {
      return this;
    }

    this.state = WS_STATES.CONNECTING;
    this._emit('connecting');

    try {
      this.socket = new WebSocket(this.url, this.options.protocols);

      this.socket.onopen = (event) => this._handleOpen(event);
      this.socket.onclose = (event) => this._handleClose(event);
      this.socket.onerror = (event) => this._handleError(event);
      this.socket.onmessage = (event) => this._handleMessage(event);

    } catch (error) {
      console.error('[WS] Connection error:', error);
      this._emit('error', error);
      this._scheduleReconnect();
    }

    return this;
  }

  /**
   * Handle connection open
   */
  _handleOpen(event) {
    this.state = WS_STATES.OPEN;
    this.reconnectAttempts = 0;
    this.connectionId = Date.now().toString(36);

    wsDebug(' Connected');
    this._emit('open', event);

    // Flush message queue
    this._flushQueue();

    // Start heartbeat
    if (this.options.heartbeat) {
      this._startHeartbeat();
    }

    // Re-subscribe to channels
    this.channels.forEach((handlers, channel) => {
      this._sendSubscribe(channel);
    });
  }

  /**
   * Handle connection close
   */
  _handleClose(event) {
    const wasOpen = this.state === WS_STATES.OPEN;
    this.state = WS_STATES.CLOSED;
    this.socket = null;

    this._stopHeartbeat();

    wsDebug(' Disconnected:', event.code, event.reason);
    this._emit('close', event);

    // W2 fix: Reconnect on any non-clean close (not just when wasOpen)
    if (this.options.autoReconnect && event.code !== 1000) {
      this._scheduleReconnect();
    }
  }

  /**
   * Handle error
   */
  _handleError(event) {
    console.error('[WS] Error:', event);
    this._emit('error', event);
  }

  /**
   * Handle incoming message
   */
  _handleMessage(event) {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch (e) {
      data = event.data;
    }

    // Handle heartbeat response
    if (data.type === 'pong') {
      this._handlePong();
      return;
    }

    // Handle channel messages
    if (data.channel) {
      this._emitChannel(data.channel, data.event || 'message', data.data);
      return;
    }

    // Emit general message event
    this._emit('message', data);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= WS_CONFIG.reconnectMaxAttempts) {
      wsDebug(' Max reconnection attempts reached');
      this._emit('maxReconnect');
      return;
    }

    clearTimeout(this.reconnectTimer);

    const delay = Math.min(
      WS_CONFIG.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts),
      WS_CONFIG.reconnectMaxDelay
    );

    this.reconnectAttempts++;

    wsDebug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this._emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat
   */
  _startHeartbeat() {
    this._stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.state === WS_STATES.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });

        // Set timeout for pong response
        this.heartbeatTimeoutTimer = setTimeout(() => {
          wsDebug(' Heartbeat timeout');
          this.socket?.close(4000, 'Heartbeat timeout');
        }, WS_CONFIG.heartbeatTimeout);
      }
    }, WS_CONFIG.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  _stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.heartbeatTimeoutTimer);
    this.heartbeatTimer = null;
    this.heartbeatTimeoutTimer = null;
  }

  /**
   * Handle pong response
   */
  _handlePong() {
    clearTimeout(this.heartbeatTimeoutTimer);
  }

  /**
   * Flush queued messages
   */
  _flushQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this._doSend(message);
    }
  }

  /**
   * Actually send a message
   */
  _doSend(data) {
    if (this.socket && this.state === WS_STATES.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.socket.send(message);
      return true;
    }
    return false;
  }

  /**
   * Send subscribe message
   */
  _sendSubscribe(channel) {
    this._doSend({ type: 'subscribe', channel });
  }

  /**
   * Send unsubscribe message
   */
  _sendUnsubscribe(channel) {
    this._doSend({ type: 'unsubscribe', channel });
  }

  /**
   * Emit event to handlers
   */
  _emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error('[WS] Event handler error:', e);
      }
    });
  }

  /**
   * Emit channel event
   */
  _emitChannel(channel, event, data) {
    const channelHandlers = this.channels.get(channel);
    if (!channelHandlers) return;

    const handlers = channelHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error('[WS] Channel handler error:', e);
      }
    });
  }

  // ==================== PUBLIC API ====================

  /**
   * Send a message
   */
  send(data) {
    if (this.state === WS_STATES.OPEN) {
      return this._doSend(data);
    }

    // Queue message if not connected
    if (this.messageQueue.length < WS_CONFIG.messageQueueSize) {
      this.messageQueue.push(data);
    }

    return false;
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel, event, handler) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Map());

      // Send subscribe if connected
      if (this.state === WS_STATES.OPEN) {
        this._sendSubscribe(channel);
      }
    }

    const channelHandlers = this.channels.get(channel);

    if (!channelHandlers.has(event)) {
      channelHandlers.set(event, []);
    }

    channelHandlers.get(event).push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = channelHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }

      // Clean up if no more handlers
      if (handlers.length === 0) {
        channelHandlers.delete(event);
      }

      if (channelHandlers.size === 0) {
        this.channels.delete(channel);
        if (this.state === WS_STATES.OPEN) {
          this._sendUnsubscribe(channel);
        }
      }
    };
  }

  /**
   * Subscribe to connection events
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }

    this.eventHandlers.get(event).push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to event once
   */
  once(event, handler) {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      handler(data);
    });
    return unsubscribe;
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.options.autoReconnect = false;
    clearTimeout(this.reconnectTimer);
    this._stopHeartbeat();

    if (this.socket) {
      this.state = WS_STATES.CLOSING;
      this.socket.close(1000, 'Client disconnect');
    }

    return this;
  }

  /**
   * Reconnect (force)
   */
  reconnect() {
    this.disconnect();
    this.options.autoReconnect = true;
    this.reconnectAttempts = 0;

    setTimeout(() => {
      this.connect();
    }, 100);

    return this;
  }

  /**
   * Get connection state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.state === WS_STATES.OPEN;
  }

  /**
   * Get connection ID
   */
  getConnectionId() {
    return this.connectionId;
  }
}

/**
 * Create WebSocket manager with default VocalIA URL
 * @param {string} path - WebSocket path
 * @param {Object} options - Options
 * @param {string} options.token - JWT access token for authentication
 */
function createManager(path = '/ws', options = {}) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'localhost:3013'
    : 'api.vocalia.ma';

  // H5 fix: Send token via Sec-WebSocket-Protocol header (not query string)
  const token = options.token || (typeof window !== 'undefined' && window.VocaliaAuth?.getAccessToken?.());
  if (token && !options.protocols) {
    options.protocols = [token];
  }

  const url = `${protocol}//${host}${path}`;
  return new WebSocketManager(url, options);
}

// Export
const ws = {
  WebSocketManager,
  createManager,
  WS_STATES
};

if (typeof window !== 'undefined') {
  window.VocaliaWS = ws;
}

export default ws;
export { WebSocketManager, createManager, WS_STATES };
