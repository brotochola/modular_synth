class RTCForUsersData {
  constructor(app) {
    this.app = app;
    this.connections = [];
    this.pendingConnects = new Set();
    this.state = "loading";
    this._retryCount = 0;
    this._handlingTaken = false;
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
    this.connections = [];
    this.peerID = this.makePeerId();
    this.state = "loading";
    this.peer = new Peer(this.peerID, {});
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
      if (err && err.type == "unavailable-id") this.handleIdTaken();
    });
  }

  handleIdTaken() {
    if (this._handlingTaken || this.state == "destroyed") return;
    if (this._retryCount > 4) {
      this.state = "failed";
      console.warn("#peer id taken, giving up");
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

    if (msg.action == "play") {
      if (!this.app.admin) this.app.actx.resume();
      return;
    }
    if (msg.action == "stop") {
      if (!this.app.admin) this.app.actx.suspend();
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
        c.state = "failed";
        try {
          if (c.conn) c.conn.close();
        } catch (e) {}
        this.connections = this.connections.filter((k) => k != c);
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
  }

  remove() {
    this.state = "destroyed";
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
