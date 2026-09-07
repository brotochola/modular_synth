class RTCForUsersData {
  constructor(app) {
    this.app = app;
    this.connections = [];
    this.pendingConnects = new Set();
    this.state = "loading";
    this._retryCount = 0;
    this._handlingTaken = false;
    this._reconnectAttempts = {};
    this._reconnectTimers = {};
    this._reconnectToastAt = {};
    this.startPeer();
  }

  makePeerId() {
    return this.app.userID + "_" + this.app.sessionID;
  }

  startPeer() {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
    for (let id of Object.keys(this._reconnectTimers)) {
      clearTimeout(this._reconnectTimers[id]);
    }
    this._reconnectTimers = {};
    this.connections = [];
    this.peerID = this.makePeerId();
    this.state = "loading";
    this.peer = new Peer(this.peerID, peerJsConfig());
    this.bindPeerEvents();
  }

  bindPeerEvents() {
    let peer = this.peer;
    peer.on("open", (id) => {
      if (this.peer != peer) return;
      console.log("connection open", id);
      this._retryCount = 0;
      this._handlingTaken = false;
      this.state = "ready";
      this.peerID = id;
      for (let pendingId of this.pendingConnects) {
        this.connect(pendingId);
      }
      this.pendingConnects.clear();
      if (this.app.onPeerReady) this.app.onPeerReady(id);
      if (this.app.connectedUsers) {
        this.app.syncRtcMesh(this.app.connectedUsers);
      }
    });

    peer.on("connection", (conn) => {
      if (this.peer != peer) return;
      this.attachIncomingConnection(conn);
    });

    peer.on("error", (err) => {
      if (this.peer != peer || this.state == "destroyed") return;
      console.warn("#peer error", err);
      let type = err && err.type;
      if (type == "unavailable-id") {
        this.handleIdTaken();
        return;
      }
      if (type == "peer-unavailable") {
        let peerId = err && (err.peer || err.message);
        if (typeof peerId == "string" && peerId.indexOf(" ") < 0) {
          this.scheduleReconnect(peerId);
        }
      }
    });
  }

  handleIdTaken() {
    if (this._handlingTaken || this.state == "destroyed") return;
    if (this._retryCount > 4) {
      this.state = "failed";
      console.warn("#peer id taken, giving up");
      if (this.app.showMessage) {
        this.app.showMessage("Peer id failed — reload the tab");
      }
      return;
    }
    this._handlingTaken = true;
    this._retryCount++;
    if (this.app.rotateSessionForPeer) {
      this.app.rotateSessionForPeer();
    } else {
      this.app.sessionID = makeid(12);
      this.startPeer();
    }
    this._handlingTaken = false;
  }

  peerKey(entry) {
    return entry.to || (entry.conn && entry.conn.peer);
  }

  hasConnection(id) {
    return this.connections.some((k) => this.peerKey(k) == id);
  }

  isConnOpen(conn) {
    return (
      conn &&
      (conn.open === true ||
        ((conn.dataChannel || {}).readyState == "open"))
    );
  }

  hasOpenConnection() {
    return this.connections.some((k) => this.isConnOpen(k.conn));
  }

  listPeerIds() {
    return this.connections.map((k) => this.peerKey(k)).filter(Boolean);
  }

  shouldStayConnected(peerId) {
    if (!peerId || peerId == this.peerID) return false;
    for (let u of this.app.connectedUsers || []) {
      if (u && u.peerId == peerId) return true;
    }
    return false;
  }

  scheduleReconnect(peerId) {
    if (!peerId || this.state == "destroyed") return;
    if (!this.shouldStayConnected(peerId)) return;
    if (peerId <= this.peerID) return;

    let attempt = this._reconnectAttempts[peerId] || 0;
    let delay = Math.min(10000, 500 * Math.pow(2, Math.min(attempt, 5)));
    this._reconnectAttempts[peerId] = attempt + 1;
    if (attempt == 0) {
      this._reconnectToastAt[peerId] = performance.now() + 3000;
    }

    clearTimeout(this._reconnectTimers[peerId]);
    this._reconnectTimers[peerId] = setTimeout(() => {
      if (this.state == "destroyed") return;
      if (!this.shouldStayConnected(peerId)) return;
      let existing = this.connections.find((k) => this.peerKey(k) == peerId);
      if (existing && this.isConnOpen(existing.conn)) {
        this._reconnectAttempts[peerId] = 0;
        return;
      }
      if (existing) {
        try {
          if (existing.conn) existing.conn.close();
        } catch (e) {}
        this.connections = this.connections.filter((k) => k != existing);
      }
      if (
        this.app.showMessage &&
        performance.now() >= (this._reconnectToastAt[peerId] || 0)
      ) {
        this.app.showMessage("Reconnecting…");
        this._reconnectToastAt[peerId] = performance.now() + 10000;
      }
      this.connect(peerId);
    }, delay);
  }

  clearReconnect(peerId) {
    if (!peerId) return;
    clearTimeout(this._reconnectTimers[peerId]);
    delete this._reconnectTimers[peerId];
    delete this._reconnectAttempts[peerId];
    delete this._reconnectToastAt[peerId];
  }

  notifyPeerConnected(peerId, incoming) {
    this.clearReconnect(peerId);
    let label =
      (this.app.userIdForPeerId && this.app.userIdForPeerId(peerId)) || peerId;
    if (this.app.showMessage) {
      this.app.showMessage(
        (incoming ? "Peer connected: " : "Connected to ") + label,
      );
    }
    if (this.app.onRtcPeerOpen) this.app.onRtcPeerOpen(peerId);
  }

  attachIncomingConnection(conn) {
    let peerId = conn.peer;
    if (this.hasConnection(peerId)) {
      try {
        conn.close();
      } catch (e) {}
      return;
    }

    let entry = { to: peerId, conn, state: "connecting", counter: 0 };
    this.connections.push(entry);

    conn.on("open", () => {
      entry.state = "connected";
      console.log("#incoming webrtc open", peerId);
      this.notifyPeerConnected(peerId, true);
    });

    conn.on("data", (data) => {
      this.handleIncomingMessage(data);
    });

    conn.on("close", () => {
      this.handleConnectionClosed(conn);
    });
  }

  handleIncomingMessage(data) {
    let msg;
    try {
      msg = typeof data == "string" ? JSON.parse(data) : data;
    } catch (e) {
      return;
    }
    if (!msg || typeof msg != "object") return;

    if (msg.sessionID && msg.sessionID == this.app.sessionID) return;
    if (!msg.sessionID && msg.userID && msg.userID == this.app.userID) return;

    if (msg.type == "timeSync" && msg.t0 != null && msg.t1 == null) {
      if (this.app.admin) {
        this.sendMessage({
          type: "timeSync",
          t0: msg.t0,
          t1: performance.now(),
          userID: this.app.userID,
          sessionID: this.app.sessionID,
        });
      }
      return;
    }
    if (msg.type == "timeSync" && msg.t0 != null && msg.t1 != null) {
      if (this.app.onTimeSyncReply) this.app.onTimeSyncReply(msg);
      return;
    }

    if (msg.type == "transport" || msg.action == "play" || msg.action == "stop") {
      let playing =
        msg.type == "transport"
          ? !!msg.playing
          : msg.action == "play";
      if (this.app.applyTransport) {
        let tOpts = {
          playing,
          bpm: msg.bpm,
          fromRemote: true,
        };
        if ("beatOriginMs" in msg) tOpts.beatOriginMs = msg.beatOriginMs;
        if (msg.pausedMusicalSec != null) tOpts.pausedMusicalSec = msg.pausedMusicalSec;
        else if (msg.action == "stop") tOpts.pausedMusicalSec = 0;
        this.app.applyTransport(tOpts);
      }
      return;
    }

    if (msg.type == "cursor") {
      if (this.app.onRemoteCursor) this.app.onRemoteCursor(msg);
      return;
    }
    if (msg.type == "drag") {
      if (this.app.onRemoteDrag) this.app.onRemoteDrag(msg);
      return;
    }
    if (msg.type == "dragEnd") {
      if (this.app.onRemoteDragEnd) this.app.onRemoteDragEnd(msg);
      return;
    }
    if (msg.type == "dragGroup") {
      if (this.app.onRemoteDragGroup) this.app.onRemoteDragGroup(msg);
      return;
    }
    if (msg.type == "dragGroupEnd") {
      if (this.app.onRemoteDragGroupEnd) this.app.onRemoteDragGroupEnd(msg);
      return;
    }
    if (msg.type == "cableParams") {
      if (this.app.applyCableParamsFromPeer) {
        this.app.applyCableParamsFromPeer(msg.cables);
      }
      return;
    }
    if (msg.type == "input") {
      if (this.app.onRemoteInput) this.app.onRemoteInput(msg);
      return;
    }
  }

  sendMessage(msg) {
    let payload = JSON.stringify(msg);
    for (let k of this.connections) {
      if (!this.isConnOpen(k.conn)) continue;
      try {
        k.conn.send(payload);
      } catch (e) {
        console.warn("#rtc send failed", e);
      }
    }
  }

  connect(id) {
    if (!id || id == this.peerID) return;

    // Mesh: only dial lexicographically greater peer ids (avoids double dial).
    if (id <= this.peerID) return;

    if (this.hasConnection(id)) return;

    if (this.state != "ready" && this.state != "connected") {
      this.pendingConnects.add(id);
      return;
    }

    console.log("#connecting to ", id);
    let conn = this.peer.connect(id);
    let entry = {
      to: id,
      conn,
      state: "connecting",
      counter: 0,
    };
    this.connections.push(entry);

    conn.on("open", () => {
      entry.state = "connected";
      console.log("#you 're connected on WEBRTC", id);
      this.notifyPeerConnected(id, false);
    });

    conn.on("data", (data) => {
      this.handleIncomingMessage(data);
    });

    conn.on("close", () => {
      this.handleConnectionClosed(conn);
    });

    this.checkIfPeerIsConnected();
  }

  disconnect(id) {
    this.clearReconnect(id);
    let entry = this.connections.find((k) => this.peerKey(k) == id);
    if (!entry) return;
    try {
      if (entry.conn) entry.conn.close();
    } catch (e) {}
    this.connections = this.connections.filter((k) => this.peerKey(k) != id);
  }

  checkIfPeerIsConnected() {
    let waiting = false;
    for (let i = 0; i < this.connections.length; i++) {
      let c = this.connections[i];
      if (c.state == "connected") continue;
      if (this.isConnOpen(c.conn)) {
        c.state = "connected";
        continue;
      }
      c.counter = (c.counter || 0) + 1;
      if (c.counter > 20) {
        let peerId = this.peerKey(c);
        c.state = "failed";
        try {
          if (c.conn) c.conn.close();
        } catch (e) {}
        this.connections = this.connections.filter((k) => k != c);
        if (peerId) this.scheduleReconnect(peerId);
      } else {
        waiting = true;
      }
    }

    if (waiting) {
      setTimeout(() => this.checkIfPeerIsConnected(), 500);
    }
  }

  handleConnectionClosed(conn) {
    let peerId = conn && conn.peer;
    console.log("#got disconnected", peerId);
    this.connections = this.connections.filter((k) => k.conn != conn);
    let userID =
      (this.app.userIdForPeerId && this.app.userIdForPeerId(peerId)) || peerId;
    let sessionID =
      this.app.sessionIdForPeerId && this.app.sessionIdForPeerId(peerId);
    if (this.app.removeRemoteCursor) {
      this.app.removeRemoteCursor(sessionID || userID);
    }
    if (userID && this.app.clearRemoteInputs) {
      this.app.clearRemoteInputs(userID);
    }
    if (peerId && this.app.showMessage) {
      this.app.showMessage(
        "Peer disconnected: " + (userID || peerId),
      );
    }
    if (peerId) this.scheduleReconnect(peerId);
  }

  remove() {
    this.state = "destroyed";
    for (let id of Object.keys(this._reconnectTimers)) {
      clearTimeout(this._reconnectTimers[id]);
    }
    this._reconnectTimers = {};
    for (let k of this.connections) {
      try {
        if (k.conn) k.conn.close();
      } catch (e) {}
    }
    this.connections = [];
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
  }
}
