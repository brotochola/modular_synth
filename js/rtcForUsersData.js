class RTCForUsersData {
  constructor(app) {
    this.app = app;

    this.peerID = this.app.userID;
    this.peer = new Peer(this.peerID, {});

    this.connections = [];
    this.pendingConnects = new Set();
    this.state = "loading";

    this.peer.on("open", (id) => {
      console.log("connection open", id);
      this.state = "ready";
      for (let pendingId of this.pendingConnects) {
        this.connect(pendingId);
      }
      this.pendingConnects.clear();
      if (this.app.connectedUsers) {
        this.app.syncRtcMesh(this.app.connectedUsers);
      }
    });

    this.peer.on("connection", (conn) => {
      this.attachIncomingConnection(conn);
    });

    this.peer.on("error", (err) => {
      console.warn("#peer error", err);
    });
  }

  peerKey(entry) {
    return entry.to || (entry.conn && entry.conn.peer);
  }

  hasConnection(id) {
    return this.connections.some((k) => this.peerKey(k) == id);
  }

  listPeerIds() {
    return this.connections
      .map((k) => this.peerKey(k))
      .filter(Boolean);
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

    if (msg.userID && msg.userID == this.app.userID) return;

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
  }

  sendMessage(msg) {
    let payload = JSON.stringify(msg);
    for (let k of this.connections) {
      let ready =
        k.conn &&
        ((k.conn.open === true) ||
          ((k.conn.dataChannel || {}).readyState == "open"));
      if (!ready) continue;
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
      let open =
        c.conn &&
        (c.conn.open === true ||
          ((c.conn.dataChannel || {}).readyState == "open"));
      if (open) {
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
    if (peerId && this.app.removeRemoteCursor) {
      this.app.removeRemoteCursor(peerId);
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
    if (this.peer) this.peer.destroy();
  }
}
